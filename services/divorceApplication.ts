import { supabase } from '../lib/supabase';
import { DivorceApplication, Document } from '../types';

export const divorceApplicationService = {
  async getDivorceApplication(userId: string): Promise<DivorceApplication | null> {
    const { data, error } = await supabase
      .from('divorce_applications')
      .select(`
        *,
        documents:divorce_documents (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(error.message);
    }

    if (!data) return null;

    return this.mapDivorceApplication(data);
  },

  async getDivorceApplicationById(applicationId: string): Promise<DivorceApplication | null> {
    const { data, error } = await supabase
      .from('divorce_applications')
      .select(`
        *,
        documents:divorce_documents (*)
      `)
      .eq('id', applicationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }

    if (!data) return null;
    return this.mapDivorceApplication(data);
  },

  async createDivorceApplication(payload: {
    userId: string;
    adminId: string;
    marriageApplicationId?: string;
    marriageCertificateNumber?: string;
    userDetails: any;
    partnerForm: any;
    userAddress?: any;
    userCurrentAddress?: any;
    partnerAddress?: any;
    partnerCurrentAddress?: any;
    divorceDate?: string;
    divorceReason?: string;
    divorceType?: string;
    declarations?: Record<string, boolean | string>;
    proxyUserEmail?: string;
  }): Promise<DivorceApplication> {
    const { data, error } = await supabase
      .from('divorce_applications')
      .insert({
        user_id: payload.userId,
        status: 'submitted',
        progress: 100,
        marriage_application_id: payload.marriageApplicationId || null,
        marriage_certificate_number: payload.marriageCertificateNumber || null,
        user_details: payload.userDetails,
        partner_form: payload.partnerForm,
        user_address: payload.userAddress || null,
        user_current_address: payload.userCurrentAddress || null,
        partner_address: payload.partnerAddress || null,
        partner_current_address: payload.partnerCurrentAddress || null,
        divorce_date: payload.divorceDate || null,
        divorce_reason: payload.divorceReason || null,
        divorce_type: payload.divorceType || 'talaq',
        declarations: payload.declarations || {},
        created_by_admin_id: payload.adminId,
        is_proxy_application: true,
        proxy_user_email: payload.proxyUserEmail || null,
        submitted_at: new Date().toISOString(),
      })
      .select(`
        *,
        documents:divorce_documents (*)
      `)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return this.mapDivorceApplication(data);
  },

  async updateDivorceApplication(
    applicationId: string,
    updates: Partial<{
      userDetails: any;
      partnerForm: any;
      userAddress: any;
      userCurrentAddress: any;
      partnerAddress: any;
      partnerCurrentAddress: any;
      divorceDate: string;
      divorceReason: string;
      divorceType: string;
      declarations: Record<string, boolean | string>;
      adminComment: string;
    }>
  ): Promise<DivorceApplication> {
    const dbUpdates: any = {
      last_updated: new Date().toISOString(),
    };

    if (updates.userDetails !== undefined) dbUpdates.user_details = updates.userDetails;
    if (updates.partnerForm !== undefined) dbUpdates.partner_form = updates.partnerForm;
    if (updates.userAddress !== undefined) dbUpdates.user_address = updates.userAddress;
    if (updates.userCurrentAddress !== undefined) dbUpdates.user_current_address = updates.userCurrentAddress;
    if (updates.partnerAddress !== undefined) dbUpdates.partner_address = updates.partnerAddress;
    if (updates.partnerCurrentAddress !== undefined) dbUpdates.partner_current_address = updates.partnerCurrentAddress;
    if (updates.divorceDate !== undefined) dbUpdates.divorce_date = updates.divorceDate;
    if (updates.divorceReason !== undefined) dbUpdates.divorce_reason = updates.divorceReason;
    if (updates.divorceType !== undefined) dbUpdates.divorce_type = updates.divorceType;
    if (updates.declarations !== undefined) dbUpdates.declarations = updates.declarations;
    if (updates.adminComment !== undefined) dbUpdates.admin_comment = updates.adminComment;

    const { data, error } = await supabase
      .from('divorce_applications')
      .update(dbUpdates)
      .eq('id', applicationId)
      .select(`
        *,
        documents:divorce_documents (*)
      `)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return this.mapDivorceApplication(data);
  },

  async getAllDivorceApplications(): Promise<DivorceApplication[]> {
    const { data, error } = await supabase
      .from('divorce_applications')
      .select(`
        *,
        documents:divorce_documents (*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return data.map((app) => this.mapDivorceApplication(app));
  },

  mapDivorceApplication(data: any): DivorceApplication {
    return {
      id: data.id,
      userId: data.user_id,
      status: data.status,
      progress: data.progress || 100,
      marriageApplicationId: data.marriage_application_id,
      marriageCertificateNumber: data.marriage_certificate_number,
      userDetails: data.user_details,
      partnerForm: data.partner_form,
      userAddress: data.user_address,
      userCurrentAddress: data.user_current_address,
      partnerAddress: data.partner_address,
      partnerCurrentAddress: data.partner_current_address,
      divorceDate: data.divorce_date,
      divorceReason: data.divorce_reason,
      divorceType: data.divorce_type,
      declarations: data.declarations,
      documents: (data.documents || []).map((doc: any) => ({
        id: doc.id,
        applicationId: doc.divorce_application_id || doc.application_id,
        type: doc.type,
        name: doc.name,
        url: doc.url,
        status: doc.status,
        uploadedAt: doc.uploaded_at,
        size: doc.size,
        mimeType: doc.mime_type,
        belongsTo: doc.belongs_to,
        isReuploaded: doc.is_reuploaded,
      })) as Document[],
      verified: data.verified || false,
      verifiedAt: data.verified_at,
      verifiedBy: data.verified_by,
      certificateNumber: data.certificate_number,
      registrationDate: data.registration_date,
      registrarName: data.registrar_name,
      certificateDetails: data.certificate_details,
      adminComment: data.admin_comment,
      createdByAdminId: data.created_by_admin_id,
      isProxyApplication: Boolean(data.is_proxy_application || data.created_by_admin_id),
      offlineApplicantContact: data.offline_applicant_contact,
      proxyUserEmail: data.proxy_user_email,
      submittedAt: data.submitted_at,
      createdAt: data.created_at,
      lastUpdated: data.last_updated || data.updated_at,
    };
  },
};

