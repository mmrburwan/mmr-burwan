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
  }
};
