import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../contexts/AuthContext';
import { ApplicationProvider, useApplication } from '../../contexts/ApplicationContext';
import { useNotification } from '../../contexts/NotificationContext';
import { agentService } from '../../services/agent';
import { applicationService } from '../../services/application';
import { supabase } from '../../lib/supabase';
import ApplicationFormContent from '../../components/application/ApplicationFormContent';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { UserPlus, ArrowRight, Loader2 } from 'lucide-react';
import { Application } from '../../types';

// Basic info schema for account creation
const basicInfoSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type BasicInfoFormData = z.infer<typeof basicInfoSchema>;

// Component for Phase 1: Basic Info Form
const BasicInfoForm: React.FC<{
  onSubmit: (data: BasicInfoFormData) => Promise<void>;
  isLoading: boolean;
  onCancel?: () => void;
}> = ({ onSubmit, isLoading, onCancel }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BasicInfoFormData>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 sm:space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Client's Email Address <span className="text-rose-500">*</span>
        </label>
        <Input
          type="email"
          placeholder="email@example.com"
          error={errors.email?.message}
          className="text-sm"
          {...register('email')}
          required
        />
        <p className="mt-1.5 text-xs text-gray-500">
          This email will be used for the client's account
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Password <span className="text-rose-500">*</span>
        </label>
        <Input
          {...register('password')}
          type="password"
          placeholder="Enter password (min 6 characters)"
          error={errors.password?.message}
          className="text-sm"
          showPasswordToggle={true}
          required
        />
        <p className="mt-1.5 text-xs text-gray-500">
          Password must be at least 6 characters long
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-5 border-t border-gray-200">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isLoading}
            className="text-sm"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          size="sm"
          isLoading={isLoading}
          disabled={isLoading}
          className="text-sm"
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" />
              Creating Account...
            </>
          ) : (
            <>
              Create Account & Continue
              <ArrowRight size={16} className="ml-2" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

// Component for Phase 2: Application Form
const ApplicationFormPhase: React.FC<{
  userId: string;
  applicationId: string;
  onComplete: () => void;
}> = ({ userId, applicationId, onComplete }) => {
  const { application } = useApplication();

  React.useEffect(() => {
    if (application?.status === 'submitted' && application?.id === applicationId) {
      setTimeout(() => {
        onComplete();
      }, 500);
    }
  }, [application?.status, applicationId, onComplete]);

  return (
    <div>
      <div className="mb-4 px-3 sm:px-6 pt-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-blue-800">
            <strong>Note:</strong> You are filling the application on behalf of a client.
            The account has been created. Please complete all steps below.
          </p>
        </div>
      </div>
      <ApplicationFormContent />
    </div>
  );
};

const AgentCreateApplicationPage: React.FC = () => {
  const { user: agentUser } = useAuth();
  const { showToast } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();

  const [phase, setPhase] = useState<'basic-info' | 'application-form'>('basic-info');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);
  const [createdApplicationId, setCreatedApplicationId] = useState<string | null>(null);

  useEffect(() => {
    // Check if we need to resume an application
    const searchParams = new URLSearchParams(location.search);
    const resumeId = searchParams.get('resume');
    
    if (resumeId && agentUser) {
      resumeApplication(resumeId);
    }
  }, [location, agentUser]);

  const resumeApplication = async (appId: string) => {
    try {
      const app = await applicationService.getApplicationById(appId);
      if (app && app.agentId === agentUser?.id) {
        setCreatedUserId(app.userId);
        setCreatedApplicationId(app.id);
        setPhase('application-form');
      } else {
        showToast('Application not found or unauthorized', 'error');
        navigate('/agent/dashboard');
      }
    } catch (error) {
      console.error('Error resuming application:', error);
      showToast('Error loading application', 'error');
    }
  };

  const handleBasicInfoSubmit = async (data: BasicInfoFormData) => {
    if (!agentUser) return;

    setIsCreatingAccount(true);
    try {
      const minimalApplicationData = {
        userDetails: {},
        partnerForm: {},
        userAddress: {},
        userCurrentAddress: {},
        partnerAddress: {},
        partnerCurrentAddress: {},
        declarations: {},
      };

      const result = await agentService.createApplicationForOfflineUser(
        {
          email: data.email,
          password: data.password,
        },
        minimalApplicationData,
        agentUser.id,
        agentUser.name || agentUser.email
      );

      setCreatedUserId(result.application.userId);
      setCreatedApplicationId(result.application.id);
      setPhase('application-form');
      showToast('Client account created successfully. Please fill the application form.', 'success');
    } catch (error: any) {
      console.error('Error creating account:', error);
      showToast(error.message || 'Failed to create account. Please try again.', 'error');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleApplicationComplete = () => {
    showToast('Application submitted successfully!', 'success');
    navigate('/agent/dashboard');
  };

  if (phase === 'basic-info') {
    return (
      <div className="max-w-2xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <div className="mb-4 sm:mb-6">
          <h1 className="font-serif text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">
            Create Application for Client
          </h1>
          <p className="text-xs sm:text-sm text-gray-600">
            Enter client's email and a secure password to create their account.
          </p>
        </div>
        <Card className="p-4 sm:p-5 lg:p-6">
          <BasicInfoForm
            onSubmit={handleBasicInfoSubmit}
            isLoading={isCreatingAccount}
            onCancel={() => navigate('/agent/dashboard')}
          />
        </Card>
      </div>
    );
  }

  if (phase === 'application-form' && createdUserId && createdApplicationId) {
    return (
      <ApplicationProvider userId={createdUserId}>
        <ApplicationFormPhase
          userId={createdUserId}
          applicationId={createdApplicationId}
          onComplete={handleApplicationComplete}
        />
      </ApplicationProvider>
    );
  }

  return null;
};

export default AgentCreateApplicationPage;
