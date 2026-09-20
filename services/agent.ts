import { supabase } from '../lib/supabase';
import { Application } from '../types';
import { applicationService } from './application';
import { auditService } from './audit';

export const agentService = {
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
    agentId: string,
    agentName: string
  ): Promise<{ application: Application; credentials: { email: string; password: string } }> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error('Authentication required. Please log in again.');
      }

      // Use the existing proxy user creation edge function
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
            adminId: agentId, // Pass agentId as adminId for the edge function to work
            adminName: agentName,
          }),
        });

        const responseText = await response.text();
        try {
          functionData = JSON.parse(responseText);
        } catch (parseErr) {
          throw new Error(responseText || 'Failed to create user account');
        }

        if (!response.ok) {
          const errorMessage = functionData?.error || functionData?.message || 'Failed to create user account';
          const errorCode = functionData?.code || '';

          if (response.status === 409 ||
            errorCode === 'USER_ALREADY_EXISTS' ||
            errorMessage.toLowerCase().includes('already exists') ||
            errorMessage.toLowerCase().includes('already registered') ||
            errorMessage.toLowerCase().includes('email address is already')) {
            throw new Error('A user with this email address already exists. Please use a different email.');
          }

          throw new Error(errorMessage);
        }

        if (!functionData || !functionData.success) {
          const errorMessage = functionData?.error || functionData?.message || 'Failed to create user account';
          throw new Error(errorMessage);
        }
      } catch (fetchError: any) {
        console.error('Error calling edge function:', fetchError);
        if (fetchError.message && (
          fetchError.message.includes('already exists') ||
          fetchError.message.includes('already registered')
        )) {
          throw fetchError;
        }
        throw new Error(fetchError.message || 'Failed to create user account. Please try again.');
      }

      const { userId, email: userEmail, password } = functionData;

      // Create application draft with agent flags
      const { data: appData, error: appError } = await supabase
        .from('applications')
        .insert({
          user_id: userId,
          status: 'draft',
          progress: 0,
          agent_id: agentId,
          agent_name: agentName,
          is_agent_application: true,
          offline_applicant_contact: {},
          proxy_user_email: userEmail,
        })
        .select()
        .single();

      if (appError) {
        throw new Error(`Failed to create application: ${appError.message}`);
      }

      // Update application with all form data
      const updatedData: any = {
        user_details: applicationData.userDetails,
        partner_form: applicationData.partnerForm,
        user_address: applicationData.userAddress,
        user_current_address: applicationData.userCurrentAddress,
        partner_address: applicationData.partnerAddress,
        partner_current_address: applicationData.partnerCurrentAddress,
        declarations: applicationData.declarations,
      };

      updatedData.progress = 0; // We will let the Agent form update the progress as they fill it
      updatedData.last_updated = new Date().toISOString();

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

      // Store credentials in proxy_user_credentials table
      const { error: credError } = await supabase
        .from('proxy_user_credentials')
        .insert({
          user_id: userId,
          application_id: appData.id,
          email: userEmail,
          password: applicantData.password,
          created_by_admin_id: agentId, // Store agentId here
        });

      if (credError) {
        console.error('Failed to store credentials:', credError);
        throw new Error(`Application created but failed to save credentials: ${credError.message}`);
      }

      try {
        await auditService.createLog({
          actorId: agentId,
          actorName: agentName,
          actorRole: 'agent',
          action: 'agent_application_created',
          resourceType: 'application',
          resourceId: appData.id,
          details: {
            proxyUserEmail: userEmail,
            isAgentApplication: true,
          },
        });
      } catch (auditErr) {
        console.warn('Audit logging failed for agent application creation (non-critical):', auditErr);
      }

      return {
        application: applicationService.mapApplication(updatedAppData),
        credentials: {
          email: userEmail,
          password: password,
        },
      };
    } catch (error: any) {
      console.error('Error creating agent application:', error);
      throw error;
    }
  },

  async deleteApplication(applicationId: string, actorId: string, actorName: string): Promise<void> {
    const { data: appData, error: fetchError } = await supabase
      .from('applications')
      .select('status, user_id, agent_id')
      .eq('id', applicationId)
      .single();

    if (fetchError) {
      throw new Error('Application not found');
    }

    if (appData.agent_id !== actorId) {
      throw new Error('Unauthorized to delete this application');
    }

    const { data: functionData, error: functionError } = await supabase.functions.invoke('delete-application', {
      body: {
        applicationId,
        adminId: actorId, // Pass agentId to bypass admin check? The edge function might enforce admin role!
      }
    });

    if (functionError) {
      throw new Error(functionError.message || 'Failed to delete application');
    }

    if (!functionData || !functionData.success) {
      throw new Error(functionData?.error || 'Failed to delete application (unknown error)');
    }

    try {
      await auditService.createLog({
        actorId,
        actorName,
        actorRole: 'agent',
        action: 'agent_application_deleted',
        resourceType: 'application',
        resourceId: applicationId,
        details: {
          previousStatus: appData.status,
          userId: appData.user_id,
          note: 'Deleted via agent action (hard delete)'
        }
      });
    } catch (auditErr) {
      console.warn('Audit logging failed for agent application deletion (non-critical):', auditErr);
    }
  },

  async updateApplicationComment(applicationId: string, comment: string, actorId: string, actorName: string): Promise<Application> {
    const { data, error } = await supabase
      .from('applications')
      .update({ admin_comment: comment, last_updated: new Date().toISOString() })
      .eq('id', applicationId)
      .eq('agent_id', actorId)
      .select(`
        *,
        documents (*)
      `)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    try {
      await auditService.createLog({
        actorId,
        actorName,
        actorRole: 'agent',
        action: 'agent_application_comment_updated',
        resourceType: 'application',
        resourceId: applicationId,
        details: { comment },
      });
    } catch (auditErr) {
      console.warn('Failed to create audit log for comment update:', auditErr);
    }

    return applicationService.mapApplication(data);
  },

  async getApplications(
    agentId: string,
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
      )
      .eq('agent_id', agentId);

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

    // Apply Search Filter
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
      throw new Error(error.message);
    }

    return {
      data: (data || []).map((app) => applicationService.mapApplication(app)),
      count: count || 0,
    };
  },

  async getApplicationStats(agentId: string): Promise<{
    total: number;
    approved: number;
    pending: number;
    draft: number;
  }> {
    const { data, error } = await supabase
      .from('applications')
      .select('status, verified')
      .eq('agent_id', agentId);

    if (error) {
      throw new Error(error.message);
    }

    const total = (data || []).length;
    const approved = (data || []).filter((a) => a.verified === true || a.status === 'approved').length;
    const pending = (data || []).filter((a) => (a.status === 'submitted' || a.status === 'under_review') && !a.verified).length;
    const draft = (data || []).filter((a) => a.status === 'draft').length;

    return { total, approved, pending, draft };
  }
};
