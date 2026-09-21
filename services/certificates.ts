import { supabase } from '../lib/supabase';
import { storage } from '../lib/storage';
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
      pdfUrl: data.pdf_url || undefined,
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
      pdfUrl: data.pdf_url || undefined,
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
    const normalizedCertNumber = certificateNumber.trim().toUpperCase().replace(/-/g, '');

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
    certificateNumber?: string,
    registrationDate?: string,
    groomName?: string,
    brideName?: string,
    canDownload: boolean = false,
    pdfUrl?: string
  ): Promise<Certificate> {
    const verificationId = `MMR-BW-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const { data, error } = await supabase
      .from('certificates')
      .insert({
        user_id: userId,
        application_id: applicationId || null,
        verification_id: verificationId,
        name: 'Marriage Registration Certificate',
        pdf_url: pdfUrl || null,
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
      pdfUrl: data.pdf_url || undefined,
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
      pdfUrl: cert.pdf_url || undefined,
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
    let data: any = null;

    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_agent_certificates', { app_ids: [applicationId] });
      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        data = rpcData[0];
      }
    } catch {
      // Fallback
    }

    if (!data) {
      const { data: directData, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('application_id', applicationId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw new Error(error.message);
      }
      data = directData;
    }

    if (!data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      applicationId: data.application_id,
      verificationId: data.verification_id,
      name: data.name,
      issuedOn: data.issued_on,
      pdfUrl: data.pdf_url || undefined,
      verified: data.verified || true,
      expiresAt: data.expires_at,
      certificateNumber: data.certificate_number,
      registrationDate: data.registration_date,
      groomName: data.groom_name,
      brideName: data.bride_name,
      canDownload: data.can_download || false,
    };
  },

  async getCertificatesByApplicationIds(applicationIds: string[]): Promise<Record<string, Certificate>> {
    if (!applicationIds || applicationIds.length === 0) {
      return {};
    }

    let records: any[] = [];

    // Try RPC first (bypasses RLS for agents)
    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_agent_certificates', { app_ids: applicationIds });
      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        records = rpcData;
      }
    } catch {
      // Continue to direct query fallback
    }

    // Direct table select fallback
    if (records.length === 0) {
      const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .in('application_id', applicationIds);

      if (!error && data) {
        records = data;
      } else if (error) {
        console.error('Failed to batch fetch certificates:', error);
      }
    }

    const certificateMap: Record<string, Certificate> = {};
    records.forEach((item: any) => {
      if (item.application_id) {
        certificateMap[item.application_id] = {
          id: item.id,
          userId: item.user_id,
          applicationId: item.application_id,
          verificationId: item.verification_id,
          name: item.name,
          issuedOn: item.issued_on,
          pdfUrl: item.pdf_url || undefined,
          verified: item.verified || true,
          expiresAt: item.expires_at,
          certificateNumber: item.certificate_number,
          registrationDate: item.registration_date,
          groomName: item.groom_name,
          brideName: item.bride_name,
          canDownload: item.can_download || false,
        };
      }
    });

    return certificateMap;
  },

  async updateDownloadPermission(certificateId: string, canDownload: boolean): Promise<void> {
    const { data: certData, error } = await supabase
      .from('certificates')
      .update({ can_download: canDownload })
      .eq('id', certificateId)
      .select('application_id')
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    // Also sync canDownload into the application's certificate_details JSONB
    if (certData?.application_id) {
      try {
        const { data: appData } = await supabase
          .from('applications')
          .select('certificate_details')
          .eq('id', certData.application_id)
          .maybeSingle();

        const currentDetails = appData?.certificate_details || {};
        await supabase
          .from('applications')
          .update({
            certificate_details: {
              ...currentDetails,
              canDownload: canDownload
            }
          })
          .eq('id', certData.application_id);
      } catch (syncErr) {
        console.warn('Failed to sync canDownload into application.certificate_details:', syncErr);
      }
    }
  },

  async getSignedUrl(certificateId: string): Promise<string> {
    const { data: certificate, error } = await supabase
      .from('certificates')
      .select('pdf_url')
      .eq('id', certificateId)
      .single();

    if (error || !certificate?.pdf_url) {
      return '';
    }

    // Extract file path from URL — handles both old Supabase and new R2 URL formats:
    //   Supabase: https://<project>.supabase.co/storage/v1/object/public/certificates/<path>
    //   R2:       https://pub-<id>.r2.dev/certificates/<path>
    let filePath: string | undefined;
    try {
      const url = new URL(certificate.pdf_url);
      const pathname = url.pathname;

      if (pathname.includes('/storage/v1/object/public/certificates/')) {
        // Old Supabase storage URL
        filePath = pathname.split('/storage/v1/object/public/certificates/')[1];
      } else if (pathname.includes('/certificates/')) {
        // R2 public URL or any URL with /certificates/ in path
        filePath = pathname.split('/certificates/')[1];
      }
    } catch {
      // URL parsing failed — try string-based extraction
      const pdfUrl = certificate.pdf_url;
      if (pdfUrl.includes('/certificates/')) {
        filePath = pdfUrl.split('/certificates/').pop()?.split('?')[0];
      }
    }

    if (!filePath) {
      return certificate.pdf_url;
    }

    // Get signed URL (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await storage.from('certificates')
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

    if (updates.canDownload !== undefined && data.application_id) {
      try {
        const { data: appData } = await supabase
          .from('applications')
          .select('certificate_details')
          .eq('id', data.application_id)
          .maybeSingle();

        const currentDetails = appData?.certificate_details || {};
        await supabase
          .from('applications')
          .update({
            certificate_details: {
              ...currentDetails,
              canDownload: updates.canDownload
            }
          })
          .eq('id', data.application_id);
      } catch (syncErr) {
        console.warn('Failed to sync canDownload into application.certificate_details:', syncErr);
      }
    }

    return {
      id: data.id,
      userId: data.user_id,
      applicationId: data.application_id,
      verificationId: data.verification_id,
      name: data.name,
      issuedOn: data.issued_on,
      pdfUrl: data.pdf_url || undefined,
      verified: data.verified || true,
      expiresAt: data.expires_at,
      certificateNumber: data.certificate_number,
      registrationDate: data.registration_date,
      groomName: data.groom_name,
      brideName: data.bride_name,
      canDownload: data.can_download || false,
    };
  },

  async deleteCertificateFile(pdfUrl?: string): Promise<void> {
    if (!pdfUrl) return;
    try {
      // Extract file path from URL — handles both old Supabase and new R2 URL formats:
      //   Supabase: .../storage/v1/object/public/certificates/path/to/file.pdf
      //   R2:       https://pub-<id>.r2.dev/certificates/path/to/file.pdf
      const url = new URL(pdfUrl);
      let filePath: string | undefined;

      if (url.pathname.includes('/storage/v1/object/public/certificates/')) {
        // Old Supabase storage URL
        filePath = url.pathname.split('/storage/v1/object/public/certificates/')[1];
      } else if (url.pathname.includes('/certificates/')) {
        // R2 public URL or any URL with /certificates/ in path
        const parts = url.pathname.split('/certificates/');
        filePath = parts.length >= 2 ? parts[1] : undefined;
      }

      if (!filePath) return;

      const { error } = await storage.from('certificates')
        .remove([filePath]);

      if (error) {
        console.error('Failed to delete old certificate file:', error);
      }
    } catch (error) {
      console.error('Error parsing PDF URL for deletion:', error);
    }
  },
};
