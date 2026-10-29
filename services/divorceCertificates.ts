import { supabase } from '../lib/supabase';
import { storage } from '../lib/storage';
import { DivorceCertificate } from '../types';

export const divorceCertificateService = {
  async getDivorceCertificate(userId: string): Promise<DivorceCertificate | null> {
    const { data, error } = await supabase
      .from('divorce_certificates')
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

    return this.mapCertificate(data);
  },

  async getDivorceCertificateByVerificationId(verificationId: string): Promise<DivorceCertificate | null> {
    const { data, error } = await supabase
      .from('divorce_certificates')
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

    return this.mapCertificate(data);
  },

  async getDivorceCertificateByCertificateNumber(certificateNumber: string): Promise<any | null> {
    const rawNumber = certificateNumber.trim();
    const normalizedCertNumber = rawNumber.toUpperCase().replace(/-/g, '');

    // 1. Match certificate_number case-insensitively
    let { data: application, error: appError } = await supabase
      .from('divorce_applications')
      .select('*')
      .ilike('certificate_number', normalizedCertNumber)
      .eq('verified', true)
      .maybeSingle();

    // 2. If not found and input differs, try rawNumber
    if (!application && rawNumber !== normalizedCertNumber) {
      const { data: fallbackApp } = await supabase
        .from('divorce_applications')
        .select('*')
        .ilike('certificate_number', rawNumber)
        .eq('verified', true)
        .maybeSingle();
      if (fallbackApp) {
        application = fallbackApp;
      }
    }

    // 3. Fallback: check by verification_id in divorce_certificates table
    if (!application) {
      const { data: cert } = await supabase
        .from('divorce_certificates')
        .select('*')
        .ilike('verification_id', rawNumber)
        .eq('verified', true)
        .maybeSingle();

      if (cert?.divorce_application_id) {
        const { data: appFromCert } = await supabase
          .from('divorce_applications')
          .select('*')
          .eq('id', cert.divorce_application_id)
          .eq('verified', true)
          .maybeSingle();
        if (appFromCert) {
          application = appFromCert;
        }
      }
    }

    if (appError) {
      if (appError.code === 'PGRST116') {
        return null;
      }
      throw new Error(appError.message);
    }

    if (!application || !application.verified) {
      return null;
    }

    return {
      certificateNumber: application.certificate_number,
      registrationDate: application.registration_date,
      divorceDate: application.divorce_date,
      divorceType: application.divorce_type,
      marriageCertificateNumber: application.marriage_certificate_number,
      userDetails: application.user_details,
      partnerForm: application.partner_form,
      userAddress: application.user_address,
      partnerAddress: application.partner_address,
      declarations: application.declarations,
      isDivorce: true,
    };
  },

  async issueDivorceCertificate(
    userId: string,
    divorceApplicationId: string | undefined,
    certificateNumber?: string,
    registrationDate?: string,
    husbandName?: string,
    wifeName?: string,
    canDownload: boolean = false,
    pdfUrl?: string
  ): Promise<DivorceCertificate> {
    // Keep standard MMR prefix as requested
    const verificationId = `MMR-BW-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const { data, error } = await supabase
      .from('divorce_certificates')
      .insert({
        user_id: userId,
        divorce_application_id: divorceApplicationId || null,
        verification_id: verificationId,
        name: 'Divorce Registration Certificate',
        pdf_url: pdfUrl || null,
        issued_on: new Date().toISOString(),
        verified: true,
        certificate_number: certificateNumber || null,
        registration_date: registrationDate || null,
        husband_name: husbandName || null,
        wife_name: wifeName || null,
        can_download: canDownload,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return this.mapCertificate(data);
  },

  async getAllDivorceCertificates(): Promise<DivorceCertificate[]> {
    const { data, error } = await supabase
      .from('divorce_certificates')
      .select('*')
      .eq('verified', true)
      .order('issued_on', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return data.map((cert) => this.mapCertificate(cert));
  },

  async getDivorceCertificateByApplicationId(applicationId: string): Promise<DivorceCertificate | null> {
    const { data, error } = await supabase
      .from('divorce_certificates')
      .select('*')
      .eq('divorce_application_id', applicationId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new Error(error.message);
    }

    if (!data) return null;
    return this.mapCertificate(data);
  },

  async updateDownloadPermission(certificateId: string, canDownload: boolean): Promise<void> {
    const { data: certData, error } = await supabase
      .from('divorce_certificates')
      .update({ can_download: canDownload })
      .eq('id', certificateId)
      .select('divorce_application_id')
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    // Sync into divorce_applications certificate_details
    if (certData?.divorce_application_id) {
      try {
        const { data: appData } = await supabase
          .from('divorce_applications')
          .select('certificate_details')
          .eq('id', certData.divorce_application_id)
          .maybeSingle();

        const currentDetails = appData?.certificate_details || {};
        await supabase
          .from('divorce_applications')
          .update({
            certificate_details: {
              ...currentDetails,
              canDownload: canDownload,
            },
          })
          .eq('id', certData.divorce_application_id);
      } catch (syncErr) {
        console.warn('Failed to sync canDownload into divorce_applications:', syncErr);
      }
    }
  },

  async updateDivorceCertificate(
    certificateId: string,
    updates: {
      pdfUrl?: string;
      certificateNumber?: string;
      registrationDate?: string;
      husbandName?: string;
      wifeName?: string;
      canDownload?: boolean;
    }
  ): Promise<DivorceCertificate> {
    const updateData: any = {
      verified: true,
    };

    if (updates.pdfUrl) updateData.pdf_url = updates.pdfUrl;
    if (updates.certificateNumber) updateData.certificate_number = updates.certificateNumber;
    if (updates.registrationDate) updateData.registration_date = updates.registrationDate;
    if (updates.husbandName) updateData.husband_name = updates.husbandName;
    if (updates.wifeName) updateData.wife_name = updates.wifeName;
    if (updates.canDownload !== undefined) updateData.can_download = updates.canDownload;

    const { data, error } = await supabase
      .from('divorce_certificates')
      .update(updateData)
      .eq('id', certificateId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (updates.canDownload !== undefined && data.divorce_application_id) {
      try {
        const { data: appData } = await supabase
          .from('divorce_applications')
          .select('certificate_details')
          .eq('id', data.divorce_application_id)
          .maybeSingle();

        const currentDetails = appData?.certificate_details || {};
        await supabase
          .from('divorce_applications')
          .update({
            certificate_details: {
              ...currentDetails,
              canDownload: updates.canDownload,
            },
          })
          .eq('id', data.divorce_application_id);
      } catch (syncErr) {
        console.warn('Failed to sync canDownload into divorce_application.certificate_details:', syncErr);
      }
    }

    return this.mapCertificate(data);
  },

  async getSignedUrl(certificateId: string): Promise<string> {
    const { data: certificate, error } = await supabase
      .from('divorce_certificates')
      .select('pdf_url')
      .eq('id', certificateId)
      .single();

    if (error || !certificate?.pdf_url) {
      return '';
    }

    let filePath: string | undefined;
    try {
      const url = new URL(certificate.pdf_url);
      const pathname = url.pathname;

      if (pathname.includes('/storage/v1/object/public/certificates/')) {
        filePath = pathname.split('/storage/v1/object/public/certificates/')[1];
      } else if (pathname.includes('/certificates/')) {
        filePath = pathname.split('/certificates/')[1];
      }
    } catch {
      const pdfUrl = certificate.pdf_url;
      if (pdfUrl.includes('/certificates/')) {
        filePath = pdfUrl.split('/certificates/').pop()?.split('?')[0];
      }
    }

    if (!filePath) {
      return certificate.pdf_url;
    }

    const { data: signedUrlData, error: signedUrlError } = await storage.from('certificates')
      .createSignedUrl(filePath, 3600);

    if (signedUrlError) {
      return certificate.pdf_url;
    }

    return signedUrlData.signedUrl;
  },

  mapCertificate(data: any): DivorceCertificate {
    return {
      id: data.id,
      userId: data.user_id,
      divorceApplicationId: data.divorce_application_id,
      verificationId: data.verification_id,
      name: data.name,
      issuedOn: data.issued_on,
      pdfUrl: data.pdf_url || undefined,
      verified: data.verified || true,
      expiresAt: data.expires_at,
      certificateNumber: data.certificate_number,
      registrationDate: data.registration_date,
      husbandName: data.husband_name,
      wifeName: data.wife_name,
      canDownload: data.can_download || false,
    };
  },
};

