import { applicationService } from './application';
import { documentService } from './documents';
import { auditService } from './audit';
import { notificationService } from './notifications';
import { emailService } from './email';
import { certificateService } from './certificates';
import { supabase } from '../lib/supabase';
import { Application } from '../types';
import { generateAndUploadCertificate } from '../utils/certificateGenerator';

export const adminService = {
  async getAllApplications(): Promise<Application[]> {
    return applicationService.getAllApplications();
  },

  async approveApplication(applicationId: string, actorId: string, actorName: string): Promise<Application> {
    // Update application status
    const { data, error } = await supabase
      .from('applications')
      .update({ status: 'approved' })
      .eq('id', applicationId)
      .select(`
        *,
        documents (*)
      `)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Create audit log
    await auditService.createLog({
      actorId,
      actorName,
      actorRole: 'admin',
      action: 'application_approved',
      resourceType: 'application',
      resourceId: applicationId,
    });

    return applicationService.mapApplication(data);
  },

  async rejectApplication(applicationId: string, reason: string, actorId: string, actorName: string): Promise<Application> {
    // Update application status
    const { data, error } = await supabase
      .from('applications')
      .update({ status: 'rejected' })
      .eq('id', applicationId)
      .select(`
        *,
        documents (*)
      `)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Create audit log
    await auditService.createLog({
      actorId,
      actorName,
      actorRole: 'admin',
      action: 'application_rejected',
      resourceType: 'application',
      resourceId: applicationId,
      details: { reason },
    });

    return applicationService.mapApplication(data);
  },

  async approveDocument(documentId: string, actorId: string, actorName: string): Promise<void> {
    await documentService.approveDocument(documentId);

    await auditService.createLog({
      actorId,
      actorName,
      actorRole: 'admin',
      action: 'document_approved',
      resourceType: 'document',
      resourceId: documentId,
    });
  },

  async rejectDocument(
    documentId: string,
    reason: string,
    actorId: string,
    actorName: string,
    sendEmail: boolean = false,
    userEmail?: string
  ): Promise<void> {
    // Get document details first
    const { data: documentData, error: docError } = await supabase
      .from('documents')
      .select('*, applications!inner(user_id, user_details)')
      .eq('id', documentId)
      .single();

    if (docError || !documentData) {
      throw new Error('Document not found');
    }

    const application = documentData.applications as any;
    const userId = application.user_id;
    const document = documentData;

    // Reject the document
    await documentService.rejectDocument(documentId);

    // Get document type label
    const getDocumentTypeLabel = (type: string): string => {
      const labels: Record<string, string> = {
        aadhaar: 'Aadhaar Card',
        tenth_certificate: '10th Certificate',
        voter_id: 'Voter ID',
        id: 'ID Document',
        photo: 'Photo',
        certificate: 'Certificate',
        other: 'Other',
      };
      return labels[type] || type;
    };

    const documentTypeLabel = getDocumentTypeLabel(document.type);

    // Get person label (groom/bride/joint)
    const getPersonLabel = (belongsTo?: string): string => {
      if (!belongsTo) return '';
      switch (belongsTo) {
        case 'user':
          return 'Groom\'s';
        case 'partner':
          return 'Bride\'s';
        case 'joint':
          return 'Joint';
        default:
          return '';
      }
    };

    const personLabel = getPersonLabel(document.belongs_to);
    const documentTitle = personLabel
      ? `${personLabel} ${documentTypeLabel}`
      : documentTypeLabel;

    // Create notification (wrap in try-catch to prevent failure from blocking rejection)
    try {
      await notificationService.createNotification({
        userId,
        applicationId: document.application_id,
        documentId,
        type: 'document_rejected',
        title: `Document Rejected: ${documentTitle}`,
        message: reason,
      });
    } catch (notificationError: any) {
      // Log error but don't fail the rejection - notification is not critical
      console.error('Failed to create notification:', notificationError);
      // Note: We continue with the rejection even if notification creation fails
      // The document rejection is more important than the notification
    }

    // Send email if requested
    // Note: Email is now handled by a database webhook on the notifications table
    // The 'sendEmail' parameter is kept for backward compatibility but the logic is event-driven
    // if (sendEmail && userEmail) {
    //   // Email sending is handled by the 'send-rejection-email' Edge Function
    //   // triggered by the notification creation above
    // }

    // Create audit log
    await auditService.createLog({
      actorId,
      actorName,
      actorRole: 'admin',
      action: 'document_rejected',
      resourceType: 'document',
      resourceId: documentId,
      details: { reason, emailSent: sendEmail },
    });
  },

  async verifyApplication(
    applicationId: string,
    actorId: string,
    actorName: string,
    certificateNumber: string,
    registrationDate: string
  ): Promise<Application> {
    // First, check for rejected documents that haven't been re-uploaded
    const { data: documentsData, error: docsError } = await supabase
      .from('documents')
      .select('id, type, name, status, belongs_to, is_reuploaded')
      .eq('application_id', applicationId)
      .eq('status', 'rejected');

    if (docsError) {
      throw new Error(`Failed to check documents: ${docsError.message}`);
    }

    // Filter out rejected documents that haven't been re-uploaded
    const rejectedNotReuploaded = (documentsData || []).filter(
      (doc) => !doc.is_reuploaded
    );

    if (rejectedNotReuploaded.length > 0) {
      // Get document type labels
      const getDocumentTypeLabel = (type: string): string => {
        const labels: Record<string, string> = {
          aadhaar: 'Aadhaar Card',
          tenth_certificate: '10th Certificate',
          voter_id: 'Voter ID',
          id: 'ID Document',
          photo: 'Photo',
          certificate: 'Certificate',
          other: 'Other',
        };
        return labels[type] || type;
      };

      const getPersonLabel = (belongsTo?: string): string => {
        if (!belongsTo) return '';
        switch (belongsTo) {
          case 'user':
            return 'Groom\'s';
          case 'partner':
            return 'Bride\'s';
          case 'joint':
            return 'Joint';
          default:
            return '';
        }
      };

      const rejectedDocNames = rejectedNotReuploaded.map((doc) => {
        const personLabel = getPersonLabel(doc.belongs_to);
        const docLabel = getDocumentTypeLabel(doc.type);
        return personLabel ? `${personLabel} ${docLabel}` : docLabel;
      }).join(', ');

      throw new Error(
        `Cannot verify application. The following document(s) have been rejected and not re-uploaded: ${rejectedDocNames}. Please wait for the client to re-upload these documents.`
      );
    }

    const { data, error } = await supabase
      .from('applications')
      .update({
        verified: true,
        verified_at: new Date().toISOString(),
        verified_by: actorId,
        certificate_number: certificateNumber,
        registration_date: registrationDate,
      })
      .eq('id', applicationId)
      .select(`
        *,
        documents (*)
      `)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Get user details for personalized notification
    const userDetails = data.user_details as any;
    const userName = userDetails?.firstName
      ? `${userDetails.firstName} ${userDetails.lastName || ''}`.trim()
      : 'Applicant';

    // Create notification for the user that their application is verified
    // Note: This notification does NOT include download option - certificate must be generated separately
    try {
      await notificationService.createNotification({
        userId: data.user_id,
        applicationId: applicationId,
        type: 'application_verified',
        title: '🎉 Congratulations! Your Application is Verified',
        message: `Dear ${userName}, your marriage registration application has been verified successfully! Certificate Number: ${certificateNumber}. You will receive another notification when your certificate is ready for download.`,
      });
    } catch (notificationError: any) {
      // Log error but don't fail the verification - notification is not critical
      console.error('Failed to create verification notification:', notificationError);
    }

    await auditService.createLog({
      actorId,
      actorName,
      actorRole: 'admin',
      action: 'application_verified',
      resourceType: 'application',
      resourceId: applicationId,
      details: { certificateNumber, registrationDate },
    });

    // Automatically generate certificate when application is verified
    try {
      // Check if certificate already exists
      const existingCert = await certificateService.getCertificateByApplicationId(applicationId);

      if (!existingCert) {
        // Generate and upload certificate PDF
        const mappedApplication = applicationService.mapApplication(data);
        const { pdfUrl, certificateData } = await generateAndUploadCertificate(mappedApplication, supabase);

        // Extract user names from application data
        const userDetails = data.user_details as any;
        const partnerDetails = (data.partner_form || data.partner_details) as any;

        const groomName = userDetails?.firstName && userDetails?.lastName
          ? `${userDetails.firstName} ${userDetails.lastName}`.trim()
          : userDetails?.firstName || 'N/A';

        const brideName = partnerDetails?.firstName && partnerDetails?.lastName
          ? `${partnerDetails.firstName} ${partnerDetails.lastName}`.trim()
          : partnerDetails?.firstName || 'N/A';

        // Create certificate record in database (canDownload defaults to false)
        await certificateService.issueCertificate(
          data.user_id,
          applicationId,
          pdfUrl,
          certificateNumber,
          registrationDate,
          groomName,
          brideName,
          false // canDownload defaults to false - admin must enable it
        );
      }
    } catch (certError: any) {
      // Log error but don't fail the verification - certificate generation can be retried
      console.error('Failed to auto-generate certificate during verification:', certError);
    }

    return applicationService.mapApplication(data);
  },

  async generateCertificate(
    applicationId: string,
    actorId: string,
    actorName: string
  ): Promise<void> {
    // First, get the application to ensure it's verified
    const { data: appData, error: appError } = await supabase
      .from('applications')
      .select(`
        *,
        documents (*)
      `)
      .eq('id', applicationId)
      .single();

    if (appError) {
      throw new Error(`Failed to fetch application: ${appError.message}`);
    }

    if (!appData.verified) {
      throw new Error('Cannot generate certificate. Application must be verified first.');
    }

    if (!appData.certificate_number || !appData.registration_date) {
      throw new Error('Cannot generate certificate. Certificate number and registration date must be set during verification.');
    }

    // Check if certificate already exists
    const { data: existingCert, error: certCheckError } = await supabase
      .from('certificates')
      .select('id')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (certCheckError && certCheckError.code !== 'PGRST116') {
      throw new Error(`Failed to check existing certificate: ${certCheckError.message}`);
    }

    if (existingCert) {
      throw new Error('Certificate already exists for this application.');
    }

    // Generate and upload certificate PDF
    const mappedApplication = applicationService.mapApplication(appData);
    const { pdfUrl, certificateData } = await generateAndUploadCertificate(mappedApplication, supabase);

    // Extract user names from application data
    const userDetails = appData.user_details as any;
    const partnerDetails = (appData.partner_form || appData.partner_details) as any;

    const groomName = userDetails?.firstName && userDetails?.lastName
      ? `${userDetails.firstName} ${userDetails.lastName}`.trim()
      : userDetails?.firstName || 'N/A';

    const brideName = partnerDetails?.firstName && partnerDetails?.lastName
      ? `${partnerDetails.firstName} ${partnerDetails.lastName}`.trim()
      : partnerDetails?.firstName || 'N/A';

    // Create certificate record in database
    await certificateService.issueCertificate(
      appData.user_id,
      applicationId,
      pdfUrl,
      appData.certificate_number,
      appData.registration_date,
      groomName,
      brideName,
      false // canDownload defaults to false - admin must enable it
    );

    // Get user details for personalized notification
    const userName = userDetails?.firstName
      ? `${userDetails.firstName} ${userDetails.lastName || ''}`.trim()
      : 'Applicant';

    // Create notification for the user that their certificate is ready
    try {
      await notificationService.createNotification({
        userId: appData.user_id,
        applicationId: applicationId,
        type: 'certificate_ready',
        title: '🎉 Your Certificate is Ready!',
        message: `Dear ${userName}, your marriage certificate has been generated and is now available for download! Certificate Number: ${appData.certificate_number}. You can download it from your dashboard.`,
      });
    } catch (notificationError: any) {
      // Log error but don't fail the generation - notification is not critical
      console.error('Failed to create certificate notification:', notificationError);
    }

    // Create audit log
    await auditService.createLog({
      actorId,
      actorName,
      actorRole: 'admin',
      action: 'certificate_generated',
      resourceType: 'application',
      resourceId: applicationId,
      details: { certificateNumber: appData.certificate_number },
    });
  },

  async unverifyApplication(applicationId: string, actorId: string, actorName: string): Promise<Application> {
    const { data, error } = await supabase
      .from('applications')
      .update({
        verified: false,
        verified_at: null,
        verified_by: null,
      })
      .eq('id', applicationId)
      .select(`
        *,
        documents (*)
      `)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await auditService.createLog({
      actorId,
      actorName,
      actorRole: 'admin',
      action: 'application_unverified',
      resourceType: 'application',
      resourceId: applicationId,
    });

    return applicationService.mapApplication(data);
  },

  async updateApplication(
    applicationId: string,
    updates: {
      userDetails?: any;
      partnerForm?: any;
      userAddress?: any;
      userCurrentAddress?: any;
      partnerAddress?: any;
      partnerCurrentAddress?: any;
      declarations?: Record<string, boolean | string>; // Allow both boolean and string values (for marriageDate)
    },
    actorId: string,
    actorName: string
  ): Promise<Application> {
    const updatedData: any = {};

    if (updates.userDetails) updatedData.user_details = updates.userDetails;
    if (updates.partnerForm) updatedData.partner_form = updates.partnerForm;
    if (updates.userAddress) updatedData.user_address = updates.userAddress;
    if (updates.userCurrentAddress) updatedData.user_current_address = updates.userCurrentAddress;
    if (updates.partnerAddress) updatedData.partner_address = updates.partnerAddress;
    if (updates.partnerCurrentAddress) updatedData.partner_current_address = updates.partnerCurrentAddress;
    if (updates.declarations) updatedData.declarations = updates.declarations;

    updatedData.last_updated = new Date().toISOString();

    const { data, error } = await supabase
      .from('applications')
      .update(updatedData)
      .eq('id', applicationId)
      .select(`
        *,
        documents (*)
      `)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await auditService.createLog({
      actorId,
      actorName,
      actorRole: 'admin',
      action: 'application_updated',
      resourceType: 'application',
      resourceId: applicationId,
      details: { updatedFields: Object.keys(updatedData) },
    });

    return applicationService.mapApplication(data);
  },

  async getUserEmails(userIds: string[]): Promise<Record<string, string>> {
    // Call the database function to get user emails
    const { data, error } = await supabase.rpc('get_user_emails', {
      user_ids: userIds,
    });

    if (error) {
      console.error('Failed to fetch user emails:', error);
      // Return empty object on error to prevent breaking the UI
      return {};
    }

    // Convert array to record (map) for easy lookup
    const emailMap: Record<string, string> = {};
    if (data) {
      data.forEach((item: { user_id: string; email: string }) => {
        emailMap[item.user_id] = item.email || 'N/A';
      });
    }

    return emailMap;
  },
};
