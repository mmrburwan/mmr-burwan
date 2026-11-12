import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../contexts/AuthContext';
import { ApplicationProvider, useApplication } from '../../contexts/ApplicationContext';
import { DivorceApplicationProvider } from '../../contexts/DivorceApplicationContext';
import { useNotification } from '../../contexts/NotificationContext';
import { adminService } from '../../services/admin';
import { applicationService } from '../../services/application';
import { divorceApplicationService } from '../../services/divorceApplication';
import { supabase } from '../../lib/supabase';
import ApplicationFormContent from '../../components/application/ApplicationFormContent';
import DivorceFormContent from '../../components/divorce/DivorceFormContent';
import AdminApplicationSuccessModal from '../../components/admin/AdminApplicationSuccessModal';
import SelectCertificateNumberModal from '../../components/admin/SelectCertificateNumberModal';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import {
  FileX,
  Heart,
  Plus,
  ArrowLeft,
  UserPlus,
  ArrowRight,
  Loader2,
  Clock,
  FileText,
  ChevronRight,
  X,
  Award,
  Trash2,
} from 'lucide-react';
import { Application, DivorceApplication } from '../../types';
import { safeFormatDate } from '../../utils/dateUtils';

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
  onSelectCertificateNumber?: () => void;
  certificateEmailTrigger?: number;
  onCertificateEmailSet?: (email: string) => void;
  isDivorce?: boolean;
}> = ({
  onSubmit,
  isLoading,
  onCancel,
  onSelectCertificateNumber,
  certificateEmailTrigger,
  onCertificateEmailSet,
  isDivorce = false,
}) => {
  const {
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    register,
  } = useForm<BasicInfoFormData>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const emailValue = watch('email');
  const [isLoadingCertificateEmail, setIsLoadingCertificateEmail] = useState(false);

  useEffect(() => {
    const pendingCertificateEmail = sessionStorage.getItem('pendingCertificateEmail');

    if (pendingCertificateEmail) {
      setIsLoadingCertificateEmail(true);
      requestAnimationFrame(() => {
        setValue('email', pendingCertificateEmail, {
          shouldValidate: true,
          shouldDirty: true,
          shouldTouch: false,
        });
        setTimeout(() => {
          sessionStorage.removeItem('pendingCertificateEmail');
          setIsLoadingCertificateEmail(false);
          if (onCertificateEmailSet) {
            onCertificateEmailSet(pendingCertificateEmail);
          }
        }, 50);
      });
    }
  }, [setValue, certificateEmailTrigger, onCertificateEmailSet]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 sm:space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Email Address <span className="text-rose-500">*</span>
          </label>
          {onSelectCertificateNumber && (
            <button
              type="button"
              onClick={onSelectCertificateNumber}
              className="flex items-center gap-1.5 text-xs sm:text-sm text-gold-700 hover:text-gold-800 font-medium hover:underline transition-colors"
            >
              <Award size={14} className="sm:w-4 sm:h-4" />
              <span>Use Certificate Number</span>
            </button>
          )}
        </div>
        <div className="relative">
          {isLoadingCertificateEmail && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg z-10">
              <Loader2 size={16} className="animate-spin text-gold-600" />
            </div>
          )}
          <Input
            type="email"
            placeholder="email@example.com"
            error={errors.email?.message}
            className="text-sm"
            disabled={isLoadingCertificateEmail}
            value={emailValue || ''}
            onChange={(e) => {
              setValue('email', e.target.value, { shouldValidate: true });
            }}
            name="email"
            autoComplete="email"
          />
        </div>
        <p className="mt-1.5 text-xs text-gray-500">
          {emailValue && emailValue.includes('@mmrburwan.com')
            ? 'Username will be set from certificate number'
            : 'This email will be used for the applicant account'}
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
          className={`text-sm ${isDivorce ? 'bg-rose-600 hover:bg-rose-700' : ''}`}
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

// Component for Phase 2: Application Form (Marriage)
const ApplicationFormPhase: React.FC<{
  userId: string;
  applicationId: string;
  onComplete: (applicationId: string, credentials: { email: string; password: string }) => void;
  credentials: { email: string; password: string };
}> = ({ userId, applicationId, onComplete, credentials }) => {
  const { application } = useApplication();

  React.useEffect(() => {
    if (application?.status === 'submitted' && application?.id === applicationId) {
      setTimeout(() => {
        onComplete(applicationId, credentials);
      }, 500);
    }
  }, [application?.status, applicationId, credentials, onComplete]);

  return (
    <div>
      <div className="mb-4 px-3 sm:px-6 pt-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-blue-800">
            <strong>Note:</strong> You are filling the application on behalf of an offline user.
            The account has been created. Please complete all steps below.
          </p>
        </div>
      </div>
      <ApplicationFormContent />
    </div>
  );
};

const CreateApplicationPage: React.FC = () => {
  const { user: adminUser } = useAuth();
  const { showToast } = useNotification();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [applicationType, setApplicationType] = useState<'marriage' | 'divorce'>(() => {
    return searchParams.get('type') === 'divorce' ? 'divorce' : 'marriage';
  });

  const handleTypeChange = (type: 'marriage' | 'divorce') => {
    setApplicationType(type);
    setSearchParams(type === 'divorce' ? { type: 'divorce' } : {});
  };

  const [phase, setPhase] = useState<'pending-list' | 'basic-info' | 'application-form'>('pending-list');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);
  const [createdApplicationId, setCreatedApplicationId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Marriage Pending Applications
  const [pendingApplications, setPendingApplications] = useState<Application[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(false);

  // Divorce Pending Applications
  const [pendingDivorceApplications, setPendingDivorceApplications] = useState<DivorceApplication[]>([]);
  const [isLoadingPendingDivorce, setIsLoadingPendingDivorce] = useState(false);

  // Certificate Modal State
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [selectedCertificateNumber, setSelectedCertificateNumber] = useState<string | null>(null);
  const [certificateEmailTrigger, setCertificateEmailTrigger] = useState(0);

  const loadPendingApplications = async () => {
    if (!adminUser) return;
    setIsLoadingPending(true);
    try {
      const allApplications = await applicationService.getAllApplications();
      const pending = allApplications
        .filter(
          (app) =>
            app.isProxyApplication &&
            app.createdByAdminId === adminUser.id &&
            (app.status === 'draft' || app.status === 'under_review')
        )
        .map((app) => ({
          ...app,
          progress: applicationService.calculateActualProgress(app),
        }));
      setPendingApplications(pending);
    } catch (error) {
      console.error('Failed to load pending applications:', error);
    } finally {
      setIsLoadingPending(false);
    }
  };

  const loadPendingDivorceApplications = async () => {
    if (!adminUser) return;
    setIsLoadingPendingDivorce(true);
    try {
      const drafts = await adminService.getPendingDivorceApplications(adminUser.id);
      setPendingDivorceApplications(drafts);
    } catch (err) {
      console.error('Failed to load pending divorce applications:', err);
    } finally {
      setIsLoadingPendingDivorce(false);
    }
  };

  useEffect(() => {
    if (adminUser && adminUser.role === 'admin') {
      loadPendingApplications();
      loadPendingDivorceApplications();
    }
  }, [adminUser]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showCreateForm) {
        setShowCreateForm(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showCreateForm]);

  if (!adminUser || adminUser.role !== 'admin') {
    navigate('/admin');
    return null;
  }

  // Marriage: Continue
  const handleContinueApplication = async (application: Application) => {
    if (!adminUser) return;
    try {
      const { data: credData } = await supabase
        .from('proxy_user_credentials')
        .select('email, password')
        .eq('application_id', application.id)
        .maybeSingle();

      setCreatedUserId(application.userId);
      setCreatedApplicationId(application.id);

      if (credData) {
        setCredentials({
          email: credData.email,
          password: credData.password,
        });
      } else {
        setCredentials({
          email: application.proxyUserEmail || '',
          password: '',
        });
      }

      setShowCreateForm(false);
      setPhase('application-form');
      showToast('Continuing application...', 'success');
    } catch (error: any) {
      console.error('Error loading application:', error);
      showToast('Failed to load application. Please try again.', 'error');
    }
  };

  // Divorce: Continue
  const handleContinueDivorceApplication = (application: DivorceApplication) => {
    if (!adminUser) return;
    setCreatedUserId(application.userId);
    setCreatedApplicationId(application.id);
    const offlineContact: any = application.offlineApplicantContact || {};
    setCredentials({
      email: application.proxyUserEmail || offlineContact.email || '',
      password: offlineContact.password || '',
    });
    setShowCreateForm(false);
    setPhase('application-form');
    showToast('Continuing divorce application...', 'success');
  };

  // Marriage: Delete
  const handleDeleteApplication = async (e: React.MouseEvent, application: Application) => {
    e.stopPropagation();
    if (!adminUser) return;
    if (
      !window.confirm(
        `Are you sure you want to delete this pending application for ${
          application.proxyUserEmail || 'this user'
        }? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await adminService.deleteApplication(application.id, adminUser.id, adminUser.name || adminUser.email);
      setPendingApplications((prev) => prev.filter((app) => app.id !== application.id));
      showToast('Application deleted successfully', 'success');
    } catch (error: any) {
      console.error('Failed to delete application:', error);
      showToast(error.message || 'Failed to delete application', 'error');
    }
  };

  // Divorce: Delete
  const handleDeleteDivorceApplication = async (e: React.MouseEvent, application: DivorceApplication) => {
    e.stopPropagation();
    if (!adminUser) return;
    if (
      !window.confirm(
        `Are you sure you want to delete this pending divorce application? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await adminService.deleteDivorceApplication(application.id, adminUser.id, adminUser.name || adminUser.email);
      setPendingDivorceApplications((prev) => prev.filter((app) => app.id !== application.id));
      showToast('Divorce application deleted successfully', 'success');
    } catch (error: any) {
      console.error('Failed to delete divorce application:', error);
      showToast(error.message || 'Failed to delete divorce application', 'error');
    }
  };

  // Submit Basic Info
  const handleBasicInfoSubmit = async (data: BasicInfoFormData) => {
    if (!adminUser) return;

    setIsCreatingAccount(true);
    try {
      if (applicationType === 'divorce') {
        const result = await adminService.createDivorceApplicationForOfflineUser(
          {
            email: data.email,
            password: data.password,
          },
          adminUser.id,
          adminUser.name || adminUser.email
        );

        setCreatedUserId(result.application.userId);
        setCreatedApplicationId(result.application.id);
        setCredentials({
          email: data.email,
          password: data.password,
        });
        setShowCreateForm(false);
        setSelectedCertificateNumber(null);
        setPhase('application-form');
        showToast('Divorce account created. Please complete the application steps.', 'success');
      } else {
        const minimalApplicationData = {
          userDetails: {},
          partnerForm: {},
          userAddress: {},
          userCurrentAddress: {},
          partnerAddress: {},
          partnerCurrentAddress: {},
          declarations: {},
        };

        const result = await adminService.createApplicationForOfflineUser(
          {
            email: data.email,
            password: data.password,
          },
          minimalApplicationData,
          adminUser.id,
          adminUser.name || adminUser.email
        );

        setCreatedUserId(result.application.userId);
        setCreatedApplicationId(result.application.id);
        setCredentials({
          email: data.email,
          password: data.password,
        });
        setShowCreateForm(false);
        setSelectedCertificateNumber(null);
        setPhase('application-form');
        showToast('Account created successfully. Please fill the application form.', 'success');
      }
    } catch (error: any) {
      console.error('Error creating account:', error);
      showToast(error.message || 'Failed to create account. Please try again.', 'error');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleApplicationComplete = (applicationId: string, creds: { email: string; password: string }) => {
    setShowSuccessModal(true);
  };

  // PHASE 1: PENDING LIST VIEW
  if (phase === 'pending-list') {
    return (
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 lg:py-8">
        <div className="mb-4 sm:mb-6">
          <h1 className="font-serif text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-1">
            Create Application
          </h1>
          <p className="text-xs sm:text-sm text-gray-600">
            Select application category: apply for marriage registration or divorce registration
          </p>
        </div>

        {/* Browser-like Application Category Switcher */}
        <div className="mb-6">
          <div className="inline-flex p-1 bg-slate-200/70 rounded-xl border border-gray-200/90 shadow-inner w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleTypeChange('marriage')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2 px-4 sm:px-6 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 ${
                applicationType === 'marriage'
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200 text-gold-700 font-bold'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
              }`}
            >
              <Heart
                size={16}
                className={applicationType === 'marriage' ? 'text-gold-600 fill-gold-100' : 'text-gray-400'}
              />
              <span>Marriage Registration</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('divorce')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2 px-4 sm:px-6 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 ${
                applicationType === 'divorce'
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200 text-rose-700 font-bold'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
              }`}
            >
              <FileX size={16} className={applicationType === 'divorce' ? 'text-rose-600' : 'text-gray-400'} />
              <span>Apply for Divorce</span>
            </button>
          </div>
        </div>

        {applicationType === 'divorce' ? (
          <div className="space-y-4 sm:space-y-6">
            {/* Create New Divorce Application Button Card */}
            <Card className="p-4 sm:p-5 lg:p-6 mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div>
                  <h2 className="font-semibold text-sm sm:text-base text-gray-900 mb-1">
                    Apply For Divorce Registration
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Start a new multi-step divorce application under Bengal Act 1876 for an applicant
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowCreateForm(true)}
                  className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700"
                >
                  <Plus size={16} className="mr-2" />
                  Apply For Divorce
                </Button>
              </div>
            </Card>

            {/* Pending Divorce Applications Section */}
            {isLoadingPendingDivorce ? (
              <Card className="p-6 sm:p-8">
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-rose-600" />
                </div>
              </Card>
            ) : pendingDivorceApplications.length > 0 ? (
              <Card className="p-4 sm:p-5 lg:p-6">
                <div className="flex items-center justify-between mb-4 sm:mb-5">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Clock size={18} className="sm:w-5 sm:h-5 text-rose-600" />
                    <h2 className="font-semibold text-sm sm:text-base lg:text-lg text-gray-900">
                      Pending Divorce Applications
                    </h2>
                    <Badge variant="outline" className="!text-[10px] sm:!text-xs text-rose-700 border-rose-200">
                      {pendingDivorceApplications.length}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-5">
                  You have {pendingDivorceApplications.length} divorce application
                  {pendingDivorceApplications.length > 1 ? 's' : ''} in progress. Click on any application to continue filling it.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {pendingDivorceApplications.map((app) => (
                    <div
                      key={app.id}
                      className="group flex items-center justify-between p-4 sm:p-5 bg-gradient-to-br from-gray-50 to-white hover:from-rose-50 hover:to-white rounded-xl border border-gray-200 hover:border-rose-300 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
                      onClick={() => handleContinueDivorceApplication(app)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="p-1.5 sm:p-2 bg-rose-100 rounded-lg group-hover:bg-rose-200 transition-colors">
                            <FileX size={14} className="sm:w-4 sm:h-4 text-rose-700" />
                          </div>
                          <p className="font-semibold text-xs sm:text-sm text-gray-900 truncate">
                            {app.userDetails?.firstName
                              ? `${app.userDetails.firstName} & ${app.partnerForm?.firstName || 'Wife'}`
                              : app.proxyUserEmail || 'Draft Divorce Application'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant={app.status === 'draft' ? 'outline' : 'default'}
                            className="!text-[10px] sm:!text-xs"
                          >
                            {app.status === 'draft' ? 'Draft' : app.status}
                          </Badge>
                          <span className="text-[10px] sm:text-xs text-rose-700 font-semibold uppercase">
                            {app.divorceType || 'TALAQ'}
                          </span>
                          {app.progress > 0 && (
                            <div className="flex items-center gap-1.5">
                              <div className="w-16 sm:w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-rose-500 transition-all duration-300"
                                  style={{ width: `${app.progress}%` }}
                                />
                              </div>
                              <span className="text-[10px] sm:text-xs text-gray-600 font-medium">
                                {app.progress}%
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] sm:text-xs text-gray-500">
                          {safeFormatDate(app.lastUpdated || app.submittedAt || new Date().toISOString(), 'dd-MM-yyyy')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <button
                          onClick={(e) => handleDeleteDivorceApplication(e, app)}
                          className="p-2 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          title="Delete Application"
                        >
                          <Trash2 size={18} className="sm:w-5 sm:h-5" />
                        </button>
                        <ChevronRight size={18} className="sm:w-5 sm:h-5 text-gray-400 group-hover:text-rose-600 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ) : (
              <Card className="p-6 sm:p-8 lg:p-10">
                <div className="text-center py-6 sm:py-8">
                  <FileX size={32} className="sm:w-12 sm:h-12 mx-auto text-gray-300 mb-3 sm:mb-4" />
                  <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1 sm:mb-2">
                    No Pending Divorce Applications
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600">
                    You don't have any pending divorce applications. Start a new one to get started.
                  </p>
                </div>
              </Card>
            )}
          </div>
        ) : (
          <>
            {/* Create New Application Button */}
            <Card className="p-4 sm:p-5 lg:p-6 mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div>
                  <h2 className="font-semibold text-sm sm:text-base text-gray-900 mb-1">
                    Create New Application
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Start a new application for an offline user
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowCreateForm(true)}
                  className="w-full sm:w-auto"
                >
                  <UserPlus size={16} className="mr-2" />
                  Create New Application
                </Button>
              </div>
            </Card>

            {/* Pending Applications Section */}
            {isLoadingPending ? (
              <Card className="p-6 sm:p-8">
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-gold-600" />
                </div>
              </Card>
            ) : pendingApplications.length > 0 ? (
              <Card className="p-4 sm:p-5 lg:p-6">
                <div className="flex items-center justify-between mb-4 sm:mb-5">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Clock size={18} className="sm:w-5 sm:h-5 text-gold-600" />
                    <h2 className="font-semibold text-sm sm:text-base lg:text-lg text-gray-900">
                      Pending Applications
                    </h2>
                    <Badge variant="outline" className="!text-[10px] sm:!text-xs">
                      {pendingApplications.length}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-5">
                  You have {pendingApplications.length} application
                  {pendingApplications.length > 1 ? 's' : ''} that you started but haven't completed yet. Click on any application to continue filling it.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {pendingApplications.map((app) => (
                    <div
                      key={app.id}
                      className="group flex items-center justify-between p-4 sm:p-5 bg-gradient-to-br from-gray-50 to-white hover:from-gold-50 hover:to-white rounded-xl border border-gray-200 hover:border-gold-300 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
                      onClick={() => handleContinueApplication(app)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="p-1.5 sm:p-2 bg-gold-100 rounded-lg group-hover:bg-gold-200 transition-colors">
                            <FileText size={14} className="sm:w-4 sm:h-4 text-gold-700" />
                          </div>
                          <p className="font-semibold text-xs sm:text-sm text-gray-900 truncate">
                            {app.proxyUserEmail || 'No email'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant={app.status === 'draft' ? 'outline' : 'default'}
                            className="!text-[10px] sm:!text-xs"
                          >
                            {app.status === 'draft'
                              ? 'Draft'
                              : app.status === 'under_review'
                              ? 'Under Review'
                              : app.status}
                          </Badge>
                          {app.progress > 0 && (
                            <div className="flex items-center gap-1.5">
                              <div className="w-16 sm:w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gold-500 transition-all duration-300"
                                  style={{ width: `${app.progress}%` }}
                                />
                              </div>
                              <span className="text-[10px] sm:text-xs text-gray-600 font-medium">
                                {app.progress}%
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] sm:text-xs text-gray-500">
                          {safeFormatDate(app.lastUpdated || app.submittedAt || new Date().toISOString(), 'dd-MM-yyyy')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <button
                          onClick={(e) => handleDeleteApplication(e, app)}
                          className="p-2 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          title="Delete Application"
                        >
                          <Trash2 size={18} className="sm:w-5 sm:h-5" />
                        </button>
                        <ChevronRight size={18} className="sm:w-5 sm:h-5 text-gray-400 group-hover:text-gold-600 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ) : (
              <Card className="p-6 sm:p-8 lg:p-10">
                <div className="text-center py-6 sm:py-8">
                  <FileText size={32} className="sm:w-12 sm:h-12 mx-auto text-gray-300 mb-3 sm:mb-4" />
                  <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1 sm:mb-2">
                    No Pending Applications
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600">
                    You don't have any pending applications. Create a new one to get started.
                  </p>
                </div>
              </Card>
            )}
          </>
        )}

        {/* Account Creation Modal (Works for Marriage & Divorce!) */}
        {showCreateForm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowCreateForm(false);
              }
            }}
          >
            <div
              className="relative z-10 w-full max-w-md sm:max-w-lg my-auto bg-white rounded-xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 sm:p-5 lg:p-6">
                <div className="flex items-center justify-between mb-5 sm:mb-6 pb-4 border-b border-gray-200">
                  <div className="flex-1 min-w-0 pr-3">
                    <h2 className="font-serif text-lg sm:text-xl font-bold text-gray-900 mb-1">
                      {applicationType === 'divorce'
                        ? 'Apply for Divorce Registration'
                        : 'Create New Application'}
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600">
                      Enter email and password to create an applicant account
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setSelectedCertificateNumber(null);
                    }}
                    className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
                    aria-label="Close"
                  >
                    <X size={18} className="sm:w-5 sm:h-5" />
                  </button>
                </div>
                <div className="pt-2">
                  <BasicInfoForm
                    key={selectedCertificateNumber || 'default'}
                    onSubmit={async (data) => {
                      await handleBasicInfoSubmit(data);
                    }}
                    isLoading={isCreatingAccount}
                    onCancel={() => {
                      setShowCreateForm(false);
                      setSelectedCertificateNumber(null);
                    }}
                    onSelectCertificateNumber={() => setShowCertificateModal(true)}
                    certificateEmailTrigger={certificateEmailTrigger}
                    isDivorce={applicationType === 'divorce'}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Certificate Number Selection Modal */}
        <SelectCertificateNumberModal
          isOpen={showCertificateModal}
          onClose={() => {
            setShowCertificateModal(false);
            setSelectedCertificateNumber(null);
          }}
          onSelect={(certificateNumber) => {
            setSelectedCertificateNumber(certificateNumber);
            setTimeout(() => {
              setShowCertificateModal(false);
            }, 100);
          }}
        />
      </div>
    );
  }

  // PHASE 2: APPLICATION FORM VIEW
  if (phase === 'application-form' && createdUserId && createdApplicationId) {
    if (applicationType === 'divorce') {
      return (
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
          <div className="mb-4 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPhase('pending-list');
                loadPendingDivorceApplications();
              }}
            >
              <ArrowLeft size={16} className="mr-1.5" />
              Back to Pending Applications
            </Button>
          </div>

          <div className="mb-4">
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-rose-900">
                <strong>Note:</strong> You are filling the divorce registration application on behalf of an applicant.
                The account has been created. Please complete all steps below.
              </p>
            </div>
          </div>

          <DivorceApplicationProvider applicationId={createdApplicationId} userId={createdUserId}>
            <DivorceFormContent
              onComplete={(appId) => {
                setShowSuccessModal(true);
              }}
              isAdminContext={true}
            />
          </DivorceApplicationProvider>

          {showSuccessModal && credentials && (
            <AdminApplicationSuccessModal
              isOpen={showSuccessModal}
              onClose={() => {
                setShowSuccessModal(false);
                navigate('/admin/clients?tab=divorce');
              }}
              applicationId={createdApplicationId}
              credentials={credentials}
              isDivorce={true}
            />
          )}
        </div>
      );
    }

    return (
      <>
        <div className="max-w-5xl mx-auto px-3 sm:px-6 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPhase('pending-list');
              loadPendingApplications();
            }}
          >
            <ArrowLeft size={16} className="mr-1.5" />
            Back to Pending Applications
          </Button>
        </div>
        <ApplicationProvider userId={createdUserId}>
          <ApplicationFormPhase
            userId={createdUserId}
            applicationId={createdApplicationId}
            onComplete={handleApplicationComplete}
            credentials={credentials!}
          />
        </ApplicationProvider>
        {showSuccessModal && credentials && (
          <AdminApplicationSuccessModal
            isOpen={showSuccessModal}
            onClose={() => {
              setShowSuccessModal(false);
              navigate('/admin');
            }}
            applicationId={createdApplicationId}
            credentials={credentials}
          />
        )}
      </>
    );
  }

  return null;
};

export default CreateApplicationPage;
