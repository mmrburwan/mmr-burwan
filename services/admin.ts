import { applicationService } from './application';
import { documentService } from './documents';
import { auditService } from './audit';
import { supabase } from '../lib/supabase';
import { Application } from '../types';

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

  async rejectDocument(documentId: string, reason: string, actorId: string, actorName: string): Promise<void> {
    await documentService.rejectDocument(documentId);
    
    await auditService.createLog({
      actorId,
      actorName,
      actorRole: 'admin',
      action: 'document_rejected',
      resourceType: 'document',
      resourceId: documentId,
      details: { reason },
    });
  },

  async verifyApplication(applicationId: string, actorId: string, actorName: string): Promise<Application> {
    const { data, error } = await supabase
      .from('applications')
      .update({
        verified: true,
        verified_at: new Date().toISOString(),
        verified_by: actorId,
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
      action: 'application_verified',
      resourceType: 'application',
      resourceId: applicationId,
    });

    return applicationService.mapApplication(data);
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
      declarations?: Record<string, boolean>;
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
};
