import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../contexts/AuthContext';
import { ApplicationProvider, useApplication } from '../../contexts/ApplicationContext';
import { useNotification } from '../../contexts/NotificationContext';
import { adminService } from '../../services/admin';
import { applicationService } from '../../services/application';
import { supabase } from '../../lib/supabase';
import ApplicationFormContent from '../../components/application/ApplicationFormContent';
import AdminApplicationSuccessModal from '../../components/admin/AdminApplicationSuccessModal';
import SelectCertificateNumberModal from '../../components/admin/SelectCertificateNumberModal';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import { UserPlus, ArrowRight, Loader2, Clock, FileText, ChevronRight, X, Award, Trash2 } from 'lucide-react';
import { Application } from '../../types';
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
}> = ({ onSubmit, isLoading, onCancel, onSelectCertificateNumber, certificateEmailTrigger, onCertificateEmailSet }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    setValue,
    watch,
    reset,
  } = useForm<BasicInfoFormData>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const emailValue = watch('email');
  const [isLoadingCertificateEmail, setIsLoadingCertificateEmail] = useState(false);

  // Pre-fill form with certificate email from sessionStorage (same pattern as registration -> login)
  // This runs on mount AND when certificateEmailTrigger changes (when certificate modal closes)
  useEffect(() => {
    const pendingCertificateEmail = sessionStorage.getItem('pendingCertificateEmail');

    if (pendingCertificateEmail) {
      setIsLoadingCertificateEmail(true);
      // Use requestAnimationFrame to ensure DOM is ready, then update
      requestAnimationFrame(() => {
        setValue('email', pendingCertificateEmail, {
          shouldValidate: true,
          shouldDirty: true,
          shouldTouch: false,
        });
        // Force a re-render by triggering validation
        setTimeout(() => {
          // Remove from sessionStorage after using (same pattern as login page)
          sessionStorage.removeItem('pendingCertificateEmail');
          setIsLoadingCertificateEmail(false);
          // Notify parent if callback provided
          if (onCertificateEmailSet) {
            onCertificateEmailSet(pendingCertificateEmail);
          }
        }, 50);
      });
    }
  }, [setValue, certificateEmailTrigger, onCertificateEmailSet]);

  // Aggressive polling when trigger changes - checks immediately and then every 50ms
  useEffect(() => {
    if (certificateEmailTrigger && certificateEmailTrigger > 0) {
      // Check immediately
      const checkImmediately = () => {
        const pendingCertificateEmail = sessionStorage.getItem('pendingCertificateEmail');
        if (pendingCertificateEmail) {
          setIsLoadingCertificateEmail(true);
          setValue('email', pendingCertificateEmail, {
            shouldValidate: true,
            shouldDirty: true,
            shouldTouch: false,
          });
          sessionStorage.removeItem('pendingCertificateEmail');
          setIsLoadingCertificateEmail(false);
          return true;
        }
        return false;
      };

      // Check immediately first
      if (checkImmediately()) {
        return;
      }

      // If not found, poll aggressively
      const interval = setInterval(() => {
        if (checkImmediately()) {
          clearInterval(interval);
        }
      }, 50);

      // Clear interval after 1 second (safety timeout)
      const timeout = setTimeout(() => {
        clearInterval(interval);
        setIsLoadingCertificateEmail(false);
      }, 1000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [certificateEmailTrigger, setValue]);

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
            onBlur={() => {
              setValue('email', emailValue || '', { shouldValidate: true });
            }}
            name="email"
            autoComplete="email"
          />
        </div>
        <p className="mt-1.5 text-xs text-gray-500">
          {emailValue && emailValue.includes('@mmrburwan.com')
            ? 'Username will be set from certificate number'
            : 'This email will be used for the user account'}
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

// Component for Phase 2: Application Form (reuses ApplicationPage)
const ApplicationFormPhase: React.FC<{
  userId: string;
  applicationId: string;
  onComplete: (applicationId: string, credentials: { email: string; password: string }) => void;
  credentials: { email: string; password: string };
}> = ({ userId, applicationId, onComplete, credentials }) => {
  const { application } = useApplication();

  // Monitor application status and show success modal when submitted
  React.useEffect(() => {
    if (application?.status === 'submitted' && application?.id === applicationId) {
      // Small delay to ensure UI updates
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

  const [phase, setPhase] = useState<'pending-list' | 'basic-info' | 'application-form'>('pending-list');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);
  const [createdApplicationId, setCreatedApplicationId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [pendingApplications, setPendingApplications] = useState<Application[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [selectedCertificateNumber, setSelectedCertificateNumber] = useState<string | null>(null);
  const [certificateEmailTrigger, setCertificateEmailTrigger] = useState(0);

  useEffect(() => {
    if (adminUser && adminUser.role === 'admin') {
      loadPendingApplications();
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

  const loadPendingApplications = async () => {
    if (!adminUser) return;

    setIsLoadingPending(true);
    try {
      const allApplications = await applicationService.getAllApplications();
      // Filter for admin-created applications that are still in draft or under_review status
      const pending = allApplications
        .filter(app =>
          app.isProxyApplication &&
          app.createdByAdminId === adminUser.id &&
          (app.status === 'draft' || app.status === 'under_review')
        )
        .map(app => ({
          ...app,
          progress: applicationService.calculateActualProgress(app), // Recalculate actual progress
        }));
      setPendingApplications(pending);
    } catch (error) {
      console.error('Failed to load pending applications:', error);
    } finally {
      setIsLoadingPending(false);
    }
  };

  const handleContinueApplication = async (application: Application) => {
    if (!adminUser) return;

    try {
      // Fetch credentials from database
      const { data: credData, error: credError } = await supabase
        .from('proxy_user_credentials')
        .select('email, password')
        .eq('application_id', application.id)
        .single();

      // Set the application ID and user ID to continue
      setCreatedUserId(application.userId);
      setCreatedApplicationId(application.id);

      // Set credentials if available, otherwise use proxy email
      if (credData && !credError) {
        setCredentials({
          email: credData.email,
          password: credData.password,
        });
      } else {
        // If credentials not found, use proxy email (password won't be available)
        setCredentials({
          email: application.proxyUserEmail || '',
          password: '', // Password not available - admin can view from details page
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

  const handleDeleteApplication = async (e: React.MouseEvent, application: Application) => {
    e.stopPropagation(); // Prevent triggering the row click
    if (!adminUser) return;

    if (!window.confirm(`Are you sure you want to delete this pending application for ${application.proxyUserEmail || 'this user'}? This action cannot be undone.`)) {
      return;
    }

    try {
      await adminService.deleteApplication(application.id, adminUser.id, adminUser.name || adminUser.email);
      setPendingApplications(prev => prev.filter(app => app.id !== application.id));
      showToast('Application deleted successfully', 'success');
    } catch (error: any) {
      console.error('Failed to delete application:', error);
      showToast(error.message || 'Failed to delete application', 'error');
    }
  };

  if (!adminUser || adminUser.role !== 'admin') {
    navigate('/admin');
    return null;
  }

  const handleBasicInfoSubmit = async (data: BasicInfoFormData) => {
    if (!adminUser) return;

    setIsCreatingAccount(true);
    try {
      // Create a minimal application first to get the structure
      // We'll update it with full data in the application form phase
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
      // Store the credentials that were provided
      setCredentials({
        email: data.email,
        password: data.password,
      });
      setShowCreateForm(false); // Close the modal
      setSelectedCertificateNumber(null); // Reset certificate number selection
      setPhase('application-form');
      showToast('Account created successfully. Please fill the application form.', 'success');
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

  if (phase === 'pending-list') {
    return (
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 lg:py-8">
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h1 className="font-serif text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">
            Create Application for Offline User
          </h1>
          <p className="text-xs sm:text-sm text-gray-600">
            Create a new application or continue pending ones
          </p>
        </div>

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
              You have {pendingApplications.length} application{pendingApplications.length > 1 ? 's' : ''} that you started but haven't completed yet. Click on any application to continue filling it.
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
                        {app.status === 'draft' ? 'Draft' : app.status === 'under_review' ? 'Under Review' : app.status}
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
                      {safeFormatDate(app.lastUpdated || app.submittedAt || new Date().toISOString(), 'dd MMM yyyy')}
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

        {/* Email/Password Form Modal/Overlay */}
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
                      Create New Application
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600">
                      Enter email and password to create an account for the applicant
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
            // Update state first, then close modal to ensure state propagates
            setSelectedCertificateNumber(certificateNumber);
            // Small delay to ensure state update propagates before modal closes
            setTimeout(() => {
              setShowCertificateModal(false);
            }, 100);
          }}
        />
      </div>
    );
  }

  if (phase === 'basic-info') {
    return (
      <div className="max-w-2xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <div className="mb-4 sm:mb-6">
          <h1 className="font-serif text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">
            Create Application for Offline User
          </h1>
          <p className="text-xs sm:text-sm text-gray-600">
            Enter email and password to create an account for the applicant
          </p>
        </div>
        <Card className="p-4 sm:p-5 lg:p-6">
          <BasicInfoForm
            key={selectedCertificateNumber || 'default'}
            onSubmit={handleBasicInfoSubmit}
            isLoading={isCreatingAccount}
            onSelectCertificateNumber={() => setShowCertificateModal(true)}
            certificateEmailTrigger={certificateEmailTrigger}
          />
        </Card>
      </div>
    );
  }

  if (phase === 'application-form' && createdUserId && createdApplicationId && credentials) {
    return (
      <>
        <ApplicationProvider userId={createdUserId}>
          <ApplicationFormPhase
            userId={createdUserId}
            applicationId={createdApplicationId}
            onComplete={handleApplicationComplete}
            credentials={credentials}
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

        {/* Certificate Number Selection Modal */}
        <SelectCertificateNumberModal
          isOpen={showCertificateModal}
          onClose={() => {
            setShowCertificateModal(false);
            setSelectedCertificateNumber(null);
          }}
          onSelect={(certificateNumber) => {
            // Store in sessionStorage first
            const certificateEmail = `${certificateNumber}@mmrburwan.com`;
            sessionStorage.setItem('pendingCertificateEmail', certificateEmail);

            // Update state
            setSelectedCertificateNumber(certificateNumber);

            // Trigger re-check of sessionStorage in BasicInfoForm
            setCertificateEmailTrigger(prev => prev + 1);

            // Close modal after a brief delay to ensure sessionStorage is set
            setTimeout(() => {
              setShowCertificateModal(false);
            }, 150);
          }}
        />
      </>
    );
  }

  return null;
};

export default CreateApplicationPage;

