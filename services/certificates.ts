import { supabase } from '../lib/supabase';
import { Certificate } from '../types';

export const certificateService = {
  async getCertificate(userId: string): Promise<Certificate | null> {
    const { data, error } = await supabase
      .from('certificates')
      .select('*')
      .eq('user_id', userId)
      .order('issued_on', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(error.message);
    }

    if (!data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      applicationId: data.application_id,
      verificationId: data.verification_id,
      name: data.name,
      issuedOn: data.issued_on,
      pdfUrl: data.pdf_url,
      verified: data.verified || true,
      expiresAt: data.expires_at,
      certificateNumber: data.certificate_number,
      registrationDate: data.registration_date,
      groomName: data.groom_name,
      brideName: data.bride_name,
      canDownload: data.can_download || false,
    };
  },

  async getCertificateByVerificationId(verificationId: string): Promise<Certificate | null> {
    const { data, error } = await supabase
      .from('certificates')
      .select('*')
      .eq('verification_id', verificationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(error.message);
    }

    if (!data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      applicationId: data.application_id,
      verificationId: data.verification_id,
      name: data.name,
      issuedOn: data.issued_on,
      pdfUrl: data.pdf_url,
      verified: data.verified || true,
      expiresAt: data.expires_at,
      certificateNumber: data.certificate_number,
      registrationDate: data.registration_date,
      groomName: data.groom_name,
      brideName: data.bride_name,
      canDownload: data.can_download || false,
    };
  },

  async getCertificateByCertificateNumber(certificateNumber: string): Promise<any | null> {
    // Normalize input: remove all hyphens to match database format
    // This allows both old format (WB-MSD-BRW-...) and new format (WBMSDBRW...) to work
    const normalizedCertNumber = certificateNumber.replace(/-/g, '');

    // Find the application by certificate_number with all details
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('certificate_number', normalizedCertNumber)
      .eq('verified', true)
      .maybeSingle();

    if (appError) {
      if (appError.code === 'PGRST116') {
        return null;
      }
      throw new Error(appError.message);
    }

    if (!application || !application.verified) {
      return null;
    }

    // Return full application data
    return {
      certificateNumber: application.certificate_number,
      registrationDate: application.registration_date,
      userDetails: application.user_details,
      partnerForm: application.partner_form,
      userAddress: application.user_address,
      partnerAddress: application.partner_address,
      declarations: application.declarations,
    };
  },

  async issueCertificate(
    userId: string,
    applicationId: string | undefined,
    pdfUrl: string,
    certificateNumber?: string,
    registrationDate?: string,
    groomName?: string,
    brideName?: string,
    canDownload: boolean = false
  ): Promise<Certificate> {
    const verificationId = `MMR-BW-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const { data, error } = await supabase
      .from('certificates')
      .insert({
        user_id: userId,
        application_id: applicationId || null,
        verification_id: verificationId,
        name: 'Marriage Registration Certificate',
        pdf_url: pdfUrl,
        issued_on: new Date().toISOString(),
        verified: true,
        certificate_number: certificateNumber || null,
        registration_date: registrationDate || null,
        groom_name: groomName || null,
        bride_name: brideName || null,
        can_download: canDownload,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      id: data.id,
      userId: data.user_id,
      applicationId: data.application_id,
      verificationId: data.verification_id,
      name: data.name,
      issuedOn: data.issued_on,
      pdfUrl: data.pdf_url,
      verified: data.verified || true,
      expiresAt: data.expires_at,
      certificateNumber: data.certificate_number,
      registrationDate: data.registration_date,
      groomName: data.groom_name,
      brideName: data.bride_name,
      canDownload: data.can_download || false,
    };
  },

  async getAllCertificates(): Promise<Certificate[]> {
    const { data, error } = await supabase
      .from('certificates')
      .select('*')
      .eq('verified', true) // Only get verified certificates
      .order('issued_on', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return data.map((cert) => ({
      id: cert.id,
      userId: cert.user_id,
      applicationId: cert.application_id,
      verificationId: cert.verification_id,
      name: cert.name,
      issuedOn: cert.issued_on,
      pdfUrl: cert.pdf_url,
      verified: cert.verified || true,
      expiresAt: cert.expires_at,
      certificateNumber: cert.certificate_number,
      registrationDate: cert.registration_date,
      groomName: cert.groom_name,
      brideName: cert.bride_name,
      canDownload: cert.can_download || false,
    }));
  },

  async getCertificateByApplicationId(applicationId: string): Promise<Certificate | null> {
    const { data, error } = await supabase
      .from('certificates')
      .select('*')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(error.message);
    }

    if (!data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      applicationId: data.application_id,
      verificationId: data.verification_id,
      name: data.name,
      issuedOn: data.issued_on,
      pdfUrl: data.pdf_url,
      verified: data.verified || true,
      expiresAt: data.expires_at,
      certificateNumber: data.certificate_number,
      registrationDate: data.registration_date,
      groomName: data.groom_name,
      brideName: data.bride_name,
      canDownload: data.can_download || false,
    };
  },

  async updateDownloadPermission(certificateId: string, canDownload: boolean): Promise<void> {
    const { error } = await supabase
      .from('certificates')
      .update({ can_download: canDownload })
      .eq('id', certificateId);

    if (error) {
      throw new Error(error.message);
    }
  },

  async getSignedUrl(certificateId: string): Promise<string> {
    const { data: certificate, error } = await supabase
      .from('certificates')
      .select('pdf_url')
      .eq('id', certificateId)
      .single();

    if (error) {
      throw new Error('Certificate not found');
    }

    // Extract file path from URL
    const url = new URL(certificate.pdf_url);
    const filePath = url.pathname.split('/certificates/')[1];

    if (!filePath) {
      return certificate.pdf_url;
    }

    // Get signed URL (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('certificates')
      .createSignedUrl(filePath, 3600);

    if (signedUrlError) {
      // Fallback to public URL
      return certificate.pdf_url;
    }

    return signedUrlData.signedUrl;
  },


  async updateCertificate(
    certificateId: string,
    updates: {
      pdfUrl?: string;
      certificateNumber?: string;
      registrationDate?: string;
      groomName?: string;
      brideName?: string;
      canDownload?: boolean;
    }
  ): Promise<Certificate> {
    // Construct update object with snake_case keys matching DB schema
    const updateData: any = {
      verified: true, // Ensure it stays verified
    };

    if (updates.pdfUrl) updateData.pdf_url = updates.pdfUrl;
    if (updates.certificateNumber) updateData.certificate_number = updates.certificateNumber;
    if (updates.registrationDate) updateData.registration_date = updates.registrationDate;
    if (updates.groomName) updateData.groom_name = updates.groomName;
    if (updates.brideName) updateData.bride_name = updates.brideName;
    if (updates.canDownload !== undefined) updateData.can_download = updates.canDownload;

    // We do NOT spread ...updates here to avoid sending camelCase keys (like brideName) 
    // that don't exist as columns in the database.

    const { data, error } = await supabase
      .from('certificates')
      .update(updateData)
      .eq('id', certificateId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      id: data.id,
      userId: data.user_id,
      applicationId: data.application_id,
      verificationId: data.verification_id,
      name: data.name,
      issuedOn: data.issued_on,
      pdfUrl: data.pdf_url,
      verified: data.verified || true,
      expiresAt: data.expires_at,
      certificateNumber: data.certificate_number,
      registrationDate: data.registration_date,
      groomName: data.groom_name,
      brideName: data.bride_name,
      canDownload: data.can_download || false,
    };
  },

  async deleteCertificateFile(pdfUrl: string): Promise<void> {
    try {
      // Extract file path from URL
      // URL format: .../storage/v1/object/public/certificates/path/to/file.pdf
      const url = new URL(pdfUrl);
      const parts = url.pathname.split('/certificates/');

      if (parts.length < 2) return; // Invalid URL format

      const filePath = parts[1]; // Get everything after /certificates/

      if (!filePath) return;

      const { error } = await supabase.storage
        .from('certificates')
        .remove([filePath]);

      if (error) {
        console.error('Failed to delete old certificate file:', error);
      }
    } catch (error) {
      console.error('Error parsing PDF URL for deletion:', error);
    }
  },
};
