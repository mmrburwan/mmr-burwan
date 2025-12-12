import { supabase } from '../lib/supabase';
import { Application, PartnerDetails, Address, Document } from '../types';

export const applicationService = {
  async getApplication(userId: string): Promise<Application | null> {
    const { data, error } = await supabase
      .from('applications')
      .select(`
        *,
        documents (*)
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

    return this.mapApplication(data);
  },

  async getApplicationById(applicationId: string): Promise<Application | null> {
    const { data, error } = await supabase
      .from('applications')
      .select(`
        *,
        documents (*)
      `)
      .eq('id', applicationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }

    if (!data) return null;
    return this.mapApplication(data);
  },

  async createDraft(userId: string): Promise<Application> {
    // Check if application already exists
    const existing = await this.getApplication(userId);
    if (existing) {
      return existing;
    }

    const { data, error } = await supabase
      .from('applications')
      .insert({
        user_id: userId,
        status: 'draft',
        progress: 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return this.mapApplication({ ...data, documents: [] });
  },

  async updateDraft(
    userId: string,
    updates: {
      userDetails?: any;
      partnerForm?: PartnerDetails;
      userAddress?: Address;
      userCurrentAddress?: Address;
      partnerAddress?: Address;
      partnerCurrentAddress?: Address;
      address?: Address;
      currentAddress?: Address;
      declarations?: Record<string, boolean | string>; // Allow both boolean and string values
    }
  ): Promise<Application> {
    // Get existing application
    let application = await this.getApplication(userId);
    if (!application) {
      application = await this.createDraft(userId);
    }

    // Calculate progress
    let progress = 0;

    // Merge declarations to preserve existing fields like marriageDate
    const mergedDeclarations = updates.declarations
      ? { ...(application.declarations || {}), ...updates.declarations }
      : application.declarations;

    const updatedData: any = {
      user_details: updates.userDetails || application.userDetails,
      partner_form: updates.partnerForm || application.partnerForm,
      user_address: updates.userAddress || application.userAddress,
      user_current_address: updates.userCurrentAddress || application.userCurrentAddress,
      partner_address: updates.partnerAddress || application.partnerAddress,
      partner_current_address: updates.partnerCurrentAddress || application.partnerCurrentAddress,
      address: updates.address || application.address,
      current_address: updates.currentAddress || application.currentAddress,
      declarations: mergedDeclarations,
    };

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

    // Check documents (need at least 4: user aadhaar, user 2nd doc, partner aadhaar, partner 2nd doc)
    if (application.documents.length >= 4) progress += 20;

    // Check if declarations are actually filled (not just empty object)
    const hasDeclarations = updatedData.declarations &&
      (updatedData.declarations.consent === true || updatedData.declarations.consent === false) &&
      (updatedData.declarations.accuracy === true || updatedData.declarations.accuracy === false) &&
      (updatedData.declarations.legal === true || updatedData.declarations.legal === false);
    if (hasDeclarations) progress += 20;

    updatedData.progress = Math.min(progress, 100);

    const { data, error } = await supabase
      .from('applications')
      .update(updatedData)
      .eq('id', application.id)
      .select(`
        *,
        documents (*)
      `)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return this.mapApplication(data);
  },

  async submitApplication(userId: string): Promise<Application> {
    const application = await this.getApplication(userId);
    if (!application) {
      throw new Error('Application not found');
    }

    const { data, error } = await supabase
      .from('applications')
      .update({
        status: 'submitted',
        progress: 100,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', application.id)
      .select(`
        *,
        documents (*)
      `)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Trigger Admin Notification (non-blocking)
    supabase.functions.invoke('send-admin-notification', {
      body: { record: data }
    }).then(({ error }) => {
      if (error) console.error('Failed to send admin notification:', error);
    }).catch(err => {
      console.error('Failed to invoke admin notification function:', err);
    });

    return this.mapApplication(data);
  },

  async getAllApplications(): Promise<Application[]> {
    const { data, error } = await supabase
      .from('applications')
      .select(`
        *,
        documents (*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return data.map((app) => this.mapApplication(app));
  },

  // Helper function to calculate actual progress based on filled data
  calculateActualProgress(application: Application): number {
    let progress = 0;

    // Check if user details are actually filled
    const hasUserDetails = application.userDetails &&
      application.userDetails.firstName &&
      application.userDetails.dateOfBirth &&
      application.userDetails.aadhaarNumber &&
      application.userDetails.mobileNumber;
    if (hasUserDetails) progress += 20;

    // Check if partner details are actually filled
    const hasPartnerDetails = application.partnerForm &&
      application.partnerForm.firstName &&
      application.partnerForm.dateOfBirth &&
      (application.partnerForm.aadhaarNumber || application.partnerForm.idNumber);
    if (hasPartnerDetails) progress += 20;

    // Check if addresses are actually filled
    const hasUserAddress = application.userAddress &&
      ((application.userAddress as any)?.villageStreet || application.userAddress?.street) &&
      application.userAddress?.state;
    const hasPartnerAddress = application.partnerAddress &&
      ((application.partnerAddress as any)?.villageStreet || application.partnerAddress?.street) &&
      application.partnerAddress?.state;
    if (hasUserAddress || hasPartnerAddress) progress += 20;

    // Check documents (need at least 4: user aadhaar, user 2nd doc, partner aadhaar, partner 2nd doc)
    if (application.documents && application.documents.length >= 4) progress += 20;

    // Check if declarations are actually filled
    const hasDeclarations = application.declarations &&
      (application.declarations.consent === true || application.declarations.consent === false) &&
      (application.declarations.accuracy === true || application.declarations.accuracy === false) &&
      (application.declarations.legal === true || application.declarations.legal === false);
    if (hasDeclarations) progress += 20;

    return Math.min(progress, 100);
  },

  // Helper to map database row to Application type
  mapApplication(data: any): Application {
    return {
      id: data.id,
      userId: data.user_id,
      status: data.status,
      progress: data.progress || 0,
      userDetails: data.user_details,
      partnerForm: data.partner_form,
      userAddress: data.user_address,
      userCurrentAddress: data.user_current_address,
      partnerAddress: data.partner_address,
      partnerCurrentAddress: data.partner_current_address,
      address: data.address,
      currentAddress: data.current_address,
      declarations: data.declarations,
      documents: (data.documents || []).map((doc: any) => ({
        id: doc.id,
        applicationId: doc.application_id,
        type: doc.type,
        name: doc.name,
        url: doc.url,
        status: doc.status,
        uploadedAt: doc.uploaded_at,
        size: doc.size,
        mimeType: doc.mime_type,
        belongsTo: doc.belongs_to,
      })) as Document[],
      verified: data.verified || false,
      verifiedAt: data.verified_at,
      verifiedBy: data.verified_by,
      certificateNumber: data.certificate_number,
      registrationDate: data.registration_date,
      submittedAt: data.submitted_at,
      lastUpdated: data.last_updated || data.updated_at,
      // Proxy application fields
      createdByAdminId: data.created_by_admin_id,
      isProxyApplication: data.is_proxy_application || false,
      offlineApplicantContact: data.offline_applicant_contact,
      proxyUserEmail: data.proxy_user_email,
    };
  },
};
