import { applicationService } from './application';
import { documentService } from './documents';
import { auditService } from './audit';
import { notificationService } from './notifications';
import { emailService } from './email';
import { certificateService } from './certificates';
import { supabase } from '../lib/supabase';
import { Application, CertificateDetails } from '../types';

export const adminService = {
  async checkCertificateNumber(certificateNumber: string, currentApplicationId?: string): Promise<boolean> {
    // Check applications table
    let appQuery = supabase
      .from('applications')
      .select('id')
      .eq('certificate_number', certificateNumber)
      .eq('verified', true);

    if (currentApplicationId) {
      appQuery = appQuery.neq('id', currentApplicationId);
    }

    const { data: appData, error: appError } = await appQuery;

    if (appError) {
      console.error('Error checking certificate number in applications:', appError);
      throw new Error('Failed to check certificate number uniqueness');
    }

    if (appData && appData.length > 0) {
      return true;
    }

    // Check certificates table
    let certQuery = supabase
      .from('certificates')
      .select('id')
      .eq('certificate_number', certificateNumber);

    // If we have currentApplicationId, we should exclude the certificate associated with this application
    if (currentApplicationId) {
      certQuery = certQuery.neq('application_id', currentApplicationId);
    }

    const { data: certData, error: certError } = await certQuery;

    if (certError) {
      console.error('Error checking certificate number in certificates:', certError);
      throw new Error('Failed to check certificate number uniqueness in certificates');
    }

    return certData && certData.length > 0;
  },

  async getApplications(
    page: number = 1,
    limit: number = 10,
    filters?: { search?: string; verified?: string }
  ): Promise<{ data: Application[]; count: number }> {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const isRejectedFilter = filters?.verified === 'rejected';

    let query = supabase
      .from('applications')
      .select(
        isRejectedFilter
          ? `*, documents!inner (*)`
          : `*, documents (*)`,
        { count: 'exact' }
      );

    // Apply Verification & Status Filters
    if (filters?.verified && filters.verified !== 'all') {
      switch (filters.verified) {
        case 'verified':
          query = query.eq('verified', true);
          break;
        case 'unverified':
          query = query
            .eq('status', 'submitted')
            .or('verified.is.false,verified.is.null');
          break;
        case 'submitted':
          query = query
            .eq('status', 'submitted')
            .or('verified.is.false,verified.is.null');
          break;
        case 'draft':
          query = query.eq('status', 'draft');
          break;
        case 'rejected':
          query = query.eq('documents.status', 'rejected');
          break;
      }
    }

    // Apply Search Filter across groom, bride, phone, certificate number, proxy email
    if (filters?.search && filters.search.trim()) {
      const term = filters.search.trim();
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term);

      const searchClauses: string[] = [
        `certificate_number.ilike.%${term}%`,
        `user_details->>firstName.ilike.%${term}%`,
        `user_details->>lastName.ilike.%${term}%`,
        `partner_form->>firstName.ilike.%${term}%`,
        `partner_form->>lastName.ilike.%${term}%`,
        `user_details->>mobileNumber.ilike.%${term}%`,
        `partner_form->>mobileNumber.ilike.%${term}%`,
        `proxy_user_email.ilike.%${term}%`,
      ];

      // If user typed multi-word name (e.g. "Rahul Sharma"), allow matching across first & last name
      const words = term.split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        const firstWord = words[0];
        const lastWord = words.slice(1).join(' ');
        searchClauses.push(`and(user_details->>firstName.ilike.%${firstWord}%,user_details->>lastName.ilike.%${lastWord}%)`);
        searchClauses.push(`and(partner_form->>firstName.ilike.%${firstWord}%,partner_form->>lastName.ilike.%${lastWord}%)`);
      }

      if (isUUID) {
        searchClauses.push(`id.eq.${term}`);
      }

      query = query.or(searchClauses.join(','));
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching applications:', error);
      throw new Error(error.message);
    }

    return {
      data: (data || []).map((app) => applicationService.mapApplication(app)),
      count: count || 0,
    };
  },

  async updateApplicationComment(applicationId: string, comment: string, actorId: string, actorName: string): Promise<Application> {
    const { data, error } = await supabase
      .from('applications')
      .update({ admin_comment: comment, last_updated: new Date().toISOString() })
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
      action: 'application_comment_updated',
      resourceType: 'application',
      resourceId: applicationId,
      details: { comment },
    });

    return applicationService.mapApplication(data);
  },

  async getApplicationStats(): Promise<{
    total: number;
    pending: number;
    verified: number;
    unverified: number;
    draft: number;
  }> {
    // We run parallel count queries. 
    // This is much lighter than fetching all rows.

    // 1. Total
    const totalPromise = supabase
      .from('applications')
      .select('id', { count: 'exact', head: true });

    // 2. Pending Review (submitted)
    const pendingPromise = supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'submitted');

    // 3. Verified
    const verifiedPromise = supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('verified', true);

    // 4. Unverified (submitted AND verified is false/null)
    const unverifiedPromise = supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'submitted')
      .or('verified.is.false,verified.is.null');

    // 5. Draft
    const draftPromise = supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'draft');

    const [totalRes, pendingRes, verifiedRes, unverifiedRes, draftRes] = await Promise.all([
      totalPromise,
      pendingPromise,
      verifiedPromise,
      unverifiedPromise,
      draftPromise
    ]);

    return {
      total: totalRes.count || 0,
      pending: pendingRes.count || 0,
      verified: verifiedRes.count || 0,
      unverified: unverifiedRes.count || 0,
      draft: draftRes.count || 0,
    };
  },

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
        tenth_certificate: 'Madhyamik Admit Card',
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
    registrationDate: string,
    registrarName: string,
    certificateDetails: CertificateDetails
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
      const getDocumentTypeLabel = (type: string): string => {
        const labels: Record<string, string> = {
          aadhaar: 'Aadhaar Card',
          tenth_certificate: 'Madhyamik Admit Card',
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

    const { error } = await supabase
      .from('applications')
      .update({
        verified: true,
        verified_at: new Date().toISOString(),
        verified_by: actorId,
        certificate_number: certificateNumber,
        registration_date: registrationDate,
        registrar_name: registrarName,
        certificate_details: certificateDetails,
      })
      .eq('id', applicationId);

    if (error) {
      throw new Error(error.message);
    }

    // Refetch the application to ensure we get the updated certificate_details
    const { data, error: fetchError } = await supabase
      .from('applications')
      .select(`
        *,
        documents (*)
      `)
      .eq('id', applicationId)
      .single();

    if (fetchError || !data) {
      throw new Error(fetchError?.message || 'Failed to fetch updated application');
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

      // Map application data for generator
      const mappedApplication = applicationService.mapApplication(data);

      // Extract user names from application data
      const userDetails = data.user_details as any;
      const partnerDetails = (data.partner_form || data.partner_details) as any;

      const groomName = userDetails?.firstName && userDetails?.lastName
        ? `${userDetails.firstName} ${userDetails.lastName}`.trim()
        : userDetails?.firstName || 'N/A';

      const brideName = partnerDetails?.firstName && partnerDetails?.lastName
        ? `${partnerDetails.firstName} ${partnerDetails.lastName}`.trim()
        : partnerDetails?.firstName || 'N/A';

      if (existingCert) {
        // Certificate exists - update details
        await certificateService.updateCertificate(existingCert.id, {
          certificateNumber,
          registrationDate,
          groomName,
          brideName,
        });

        console.log(`Certificate updated for application ${applicationId}`);
      } else {
        // Certificate doesn't exist - CREATE new record (canDownload defaults to false)
        await certificateService.issueCertificate(
          data.user_id,
          applicationId,
          certificateNumber,
          registrationDate,
          groomName,
          brideName,
          false // canDownload defaults to false - admin must enable it
        );
      }
    } catch (certError: any) {
      console.error('Failed to issue certificate record during verification:', certError);

      // Rollback application update to prevent inconsistent state
      try {
        await supabase
          .from('applications')
          .update({
            verified: false,
            verified_at: null,
            verified_by: null,
            certificate_number: null,
            registration_date: null,
          })
          .eq('id', applicationId);

        console.log('Rolled back application verification status');
      } catch (rollbackError) {
        console.error('Failed to rollback application verification:', rollbackError);
      }

      throw new Error(`Certificate record creation failed: ${certError.message || 'Unknown error'}. Verification has been cancelled. Please try again.`);
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
    // --- Delete certificate record from database before unverifying ---
    try {
      const existingCert = await certificateService.getCertificateByApplicationId(applicationId);
      if (existingCert) {
        const { error: deleteError } = await supabase
          .from('certificates')
          .delete()
          .eq('id', existingCert.id);

        if (deleteError) {
          console.error('Failed to delete certificate record:', deleteError);
        }
      }
    } catch (certDeleteError) {
      console.error('Error cleaning up certificate during unverify:', certDeleteError);
    }

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

    updatedData.updated_at = new Date().toISOString();

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

  async createApplicationForOfflineUser(
    applicantData: {
      email: string;
      password: string;
    },
    applicationData: {
      userDetails: any;
      partnerForm: any;
      userAddress: any;
      userCurrentAddress: any;
      partnerAddress: any;
      partnerCurrentAddress: any;
      declarations: Record<string, boolean | string>;
    },
    adminId: string,
    adminName: string
  ): Promise<{ application: Application; credentials: { email: string; password: string } }> {
    try {
      // Step 1: Call edge function to create user account
      // Ensure we have a valid session before calling the function
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error('Authentication required. Please log in again.');
      }

      // Use fetch directly to have better control over error handling
      const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
      const functionUrl = `${supabaseUrl}/functions/v1/create-proxy-user`;

      let functionData: any = null;

      try {
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({
            email: applicantData.email,
            password: applicantData.password,
            adminId: adminId,
            adminName: adminName,
          }),
        });

        // Parse response body
        const responseText = await response.text();
        try {
          functionData = JSON.parse(responseText);
        } catch (parseErr) {
          // If response is not JSON, treat it as error
          throw new Error(responseText || 'Failed to create user account');
        }

        // Check if response indicates an error
        if (!response.ok) {
          const errorMessage = functionData?.error || functionData?.message || 'Failed to create user account';
          const errorCode = functionData?.code || '';

          console.error('Edge function returned error:', {
            status: response.status,
            error: errorMessage,
            code: errorCode,
            fullResponse: functionData,
          });

          // Check if it's a user already exists error (409 Conflict)
          if (response.status === 409 ||
            errorCode === 'USER_ALREADY_EXISTS' ||
            errorMessage.toLowerCase().includes('already exists') ||
            errorMessage.toLowerCase().includes('already registered') ||
            errorMessage.toLowerCase().includes('email address is already')) {
            throw new Error('A user with this email address already exists. Please use a different email.');
          }

          throw new Error(errorMessage);
        }

        // Verify success response
        if (!functionData || !functionData.success) {
          const errorMessage = functionData?.error || functionData?.message || 'Failed to create user account';
          const errorCode = functionData?.code || '';

          // Check if it's a user already exists error
          if (errorCode === 'USER_ALREADY_EXISTS' ||
            errorMessage.toLowerCase().includes('already exists') ||
            errorMessage.toLowerCase().includes('already registered')) {
            throw new Error('A user with this email address already exists. Please use a different email.');
          }

          throw new Error(errorMessage);
        }
      } catch (fetchError: any) {
        console.error('Error calling edge function:', fetchError);

        // If it's already our custom error, re-throw it
        if (fetchError.message && (
          fetchError.message.includes('already exists') ||
          fetchError.message.includes('already registered')
        )) {
          throw fetchError;
        }

        // Otherwise, wrap it in a user-friendly message
        throw new Error(fetchError.message || 'Failed to create user account. Please try again.');
      }

      const { userId, email: userEmail, password } = functionData;

      // Step 2: Create application draft with proxy flags
      const { data: appData, error: appError } = await supabase
        .from('applications')
        .insert({
          user_id: userId,
          status: 'draft',
          progress: 0,
          created_by_admin_id: adminId,
          is_proxy_application: true,
          offline_applicant_contact: {},
          proxy_user_email: userEmail,
        })
        .select()
        .single();

      if (appError) {
        throw new Error(`Failed to create application: ${appError.message}`);
      }

      // Step 3: Update application with all form data
      const updatedData: any = {
        user_details: applicationData.userDetails,
        partner_form: applicationData.partnerForm,
        user_address: applicationData.userAddress,
        user_current_address: applicationData.userCurrentAddress,
        partner_address: applicationData.partnerAddress,
        partner_current_address: applicationData.partnerCurrentAddress,
        declarations: applicationData.declarations,
      };

      // Calculate progress based on actual data filled
      let progress = 0;

      // Check if user details are actually filled (not just empty object)
      const hasUserDetails = updatedData.user_details &&
        updatedData.user_details.firstName &&
        updatedData.user_details.dateOfBirth &&
        updatedData.user_details.aadhaarNumber &&
        updatedData.user_details.mobileNumber;
      if (hasUserDetails) progress += 20;

      // Check if partner details are actually filled
      const hasPartnerDetails = updatedData.partner_form &&
        updatedData.partner_form.firstName &&
        updatedData.partner_form.dateOfBirth &&
        (updatedData.partner_form.aadhaarNumber || updatedData.partner_form.idNumber);
      if (hasPartnerDetails) progress += 20;

      // Check if addresses are actually filled
      const hasUserAddress = updatedData.user_address &&
        ((updatedData.user_address as any)?.villageStreet || updatedData.user_address?.street) &&
        updatedData.user_address?.state;
      const hasPartnerAddress = updatedData.partner_address &&
        ((updatedData.partner_address as any)?.villageStreet || updatedData.partner_address?.street) &&
        updatedData.partner_address?.state;
      if (hasUserAddress || hasPartnerAddress) progress += 20;

      // Check if declarations are actually filled (not just empty object)
      const hasDeclarations = updatedData.declarations &&
        (updatedData.declarations.consent === true || updatedData.declarations.consent === false) &&
        (updatedData.declarations.accuracy === true || updatedData.declarations.accuracy === false) &&
        (updatedData.declarations.legal === true || updatedData.declarations.legal === false);
      if (hasDeclarations) progress += 20;

      // Documents will add remaining 20% (checked separately when documents are uploaded)
      updatedData.progress = Math.min(progress, 80);

      updatedData.updated_at = new Date().toISOString();

      const { data: updatedAppData, error: updateError } = await supabase
        .from('applications')
        .update(updatedData)
        .eq('id', appData.id)
        .select(`
          *,
          documents (*)
        `)
        .single();

      if (updateError) {
        throw new Error(`Failed to update application: ${updateError.message}`);
      }

      // Step 4: Store credentials in proxy_user_credentials table
      const { error: credError } = await supabase
        .from('proxy_user_credentials')
        .insert({
          user_id: userId,
          application_id: appData.id,
          email: userEmail,
          password: applicantData.password, // Use the input password directly to ensure it's captured
          created_by_admin_id: adminId,
        });

      if (credError) {
        console.error('Failed to store credentials:', credError);
        // Throw error so the user and UI are aware that credentials weren't saved
        throw new Error(`Application created but failed to save credentials: ${credError.message}`);
      }

      // Step 5: Create audit log entry
      await auditService.createLog({
        actorId: adminId,
        actorName: adminName,
        actorRole: 'admin',
        action: 'proxy_application_created',
        resourceType: 'application',
        resourceId: appData.id,
        details: {
          proxyUserEmail: userEmail,
          isProxyApplication: true,
        },
      });

      // Step 6: Return application and credentials
      return {
        application: applicationService.mapApplication(updatedAppData),
        credentials: {
          email: userEmail,
          password: password,
        },
      };
    } catch (error: any) {
      console.error('Error creating proxy application:', error);
      throw error;
    }
  },

  async deleteApplication(applicationId: string, actorId: string, actorName: string): Promise<void> {
    const { data: appData, error: fetchError } = await supabase
      .from('applications')
      .select('status, user_id')
      .eq('id', applicationId)
      .single();

    if (fetchError) {
      throw new Error('Application not found');
    }

    // Call the delete-application Edge Function
    // This ensures that the user is also deleted from auth.users (hard delete)
    // We use supabase.functions.invoke to handle auth headers and token refresh automatically
    const { data: functionData, error: functionError } = await supabase.functions.invoke('delete-application', {
      body: {
        applicationId,
        adminId: actorId,
      }
    });

    if (functionError) {
      console.error('Error calling delete-application edge function:', functionError);

      // Try to extract a meaningful message
      let errorMessage = functionError.message || 'Failed to delete application';

      // Sometimes the error context is in the response body which invoke() might parse into context
      if (functionError.context && typeof functionError.context === 'object') {
        const context = functionError.context as any;
        // Check standard HTTP error response format
        if (context.error) errorMessage = context.error;
        // Check Supabase Edge Function error structure
        if (context.message) errorMessage = context.message;
      }

      // Manual check for 401 to give better feedback
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        errorMessage = 'Unauthorized: Please verify you are logged in as an admin.';
      }

      throw new Error(errorMessage);
    }

    // Check for success in the response data
    if (!functionData || !functionData.success) {
      const msg = functionData?.error || 'Failed to delete application (unknown error)';
      throw new Error(msg);
    }

    // Application deleted successfully via Edge Function

    // Only audit log if delete was successful
    await auditService.createLog({
      actorId,
      actorName,
      actorRole: 'admin',
      action: 'application_deleted',
      resourceType: 'application',
      resourceId: applicationId,
      details: {
        previousStatus: appData.status,
        userId: appData.user_id,
        note: 'Deleted via admin action (hard delete)'
      }
    });
  },

  async getAgents(): Promise<{ id: string; email: string; name: string; createdAt: string }[]> {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('Authentication required.');
    }

    const { data: agents, error } = await supabase.rpc('list_agents');

    if (error) {
      throw new Error(error.message || 'Failed to fetch agents');
    }

    return agents || [];
  },

  async promoteToAgent(email: string, actorId: string, actorName: string): Promise<{ id: string; email: string; name: string }> {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('Authentication required.');
    }

    const { data: user, error } = await supabase.rpc('promote_to_agent', { target_email: email });

    if (error) {
      throw new Error(error.message || 'Failed to promote user to agent');
    }

    if (!user) {
      throw new Error('Failed to promote user to agent');
    }

    await auditService.createLog({
      actorId,
      actorName,
      actorRole: 'admin',
      action: 'promoted_to_agent',
      resourceType: 'user',
      resourceId: user.id,
      details: { email }
    });

    return user;
  }
};
