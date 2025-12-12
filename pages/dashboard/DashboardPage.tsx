import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useTranslation } from '../../hooks/useTranslation';
import { profileService } from '../../services/profile';
import { applicationService } from '../../services/application';
import { appointmentService } from '../../services/appointments';
import { certificateService } from '../../services/certificates';
import { messageService } from '../../services/messages';
import { Profile, Application, Certificate, Appointment } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Stepper from '../../components/ui/Stepper';
import {
  FileText,
  Upload,
  Calendar,
  MessageSquare,
  Award,
  ArrowRight,
  User,
  CheckCircle,
  LogOut,
  Eye
} from 'lucide-react';
import NotificationIcon from '../../components/ui/NotificationIcon';
import NotificationPanel from '../../components/ui/NotificationPanel';
import { safeFormatDate, safeFormatDateObject } from '../../utils/dateUtils';
import { downloadCertificate } from '../../utils/certificateGenerator';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { showToast } = useNotification();
  const { t } = useTranslation('dashboard');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);

  const loadData = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    try {
      const [profileData, appData, aptData, certData, conversations] = await Promise.all([
        profileService.getProfile(user.id),
        applicationService.getApplication(user.id),
        appointmentService.getUserAppointment(user.id).catch(() => null),
        certificateService.getCertificate(user.id),
        messageService.getConversations(user.id),
      ]);

      // Recalculate completion if profile exists
      if (profileData) {
        const updatedCompletion = await profileService.calculateCompletion(user.id);
        // Reload profile to get updated completion percentage
        const updatedProfile = await profileService.getProfile(user.id);
        setProfile(updatedProfile);
      } else {
        setProfile(profileData);
      }

      setApplication(appData);
      setAppointment(aptData);
      setCertificate(certData);
      setUnreadMessages(conversations.reduce((sum, c) => sum + c.unreadCount, 0));
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold-500"></div>
      </div>
    );
  }

  const applicationSteps = [
    { id: 'groom', label: t('cards.application.steps.groom') },
    { id: 'bride', label: t('cards.application.steps.bride') },
    { id: 'documents', label: t('cards.application.steps.documents') },
    { id: 'confirmation', label: t('cards.application.steps.confirmation') },
    { id: 'review', label: t('cards.application.steps.review') },
  ];

  // Calculate current step based on actual data filled
  const getCurrentStep = () => {
    if (!application) return 0;

    // Check if groom details are filled (lastName is optional)
    const hasGroomDetails = application.userDetails?.firstName &&
      application.userDetails?.dateOfBirth &&
      application.userDetails?.aadhaarNumber &&
      application.userDetails?.mobileNumber;
    const hasGroomAddress = (application.userAddress as any)?.villageStreet ||
      application.userAddress?.street;
    const hasGroomCurrentAddress = (application.userCurrentAddress as any)?.villageStreet ||
      application.userCurrentAddress?.street;
    const hasMarriageDate = (application.declarations as any)?.marriageDate;

    if (!hasGroomDetails || !hasGroomAddress || !hasGroomCurrentAddress || !hasMarriageDate) {
      return 0; // Still on groom details step
    }

    // Check if bride details are filled (lastName is optional)
    const hasBrideDetails = application.partnerForm?.firstName &&
      application.partnerForm?.dateOfBirth &&
      ((application.partnerForm as any)?.aadhaarNumber || (application.partnerForm as any)?.idNumber);
    const hasBrideAddress = (application.partnerAddress as any)?.villageStreet ||
      application.partnerAddress?.street;
    const hasBrideCurrentAddress = (application.partnerCurrentAddress as any)?.villageStreet ||
      application.partnerCurrentAddress?.street;

    if (!hasBrideDetails || !hasBrideAddress || !hasBrideCurrentAddress) {
      return 1; // Still on bride details step
    }

    // Check if documents are uploaded (need 5 documents: groom aadhaar, groom 2nd doc, bride aadhaar, bride 2nd doc, joint photo)
    const documents = application.documents || [];
    const userAadhaar = documents.find(d => d.belongsTo === 'user' && d.type === 'aadhaar');
    const userSecondDoc = documents.find(d => d.belongsTo === 'user' && (d.type === 'tenth_certificate' || d.type === 'voter_id'));
    const partnerAadhaar = documents.find(d => d.belongsTo === 'partner' && d.type === 'aadhaar');
    const partnerSecondDoc = documents.find(d => d.belongsTo === 'partner' && (d.type === 'tenth_certificate' || d.type === 'voter_id'));
    const jointPhotograph = documents.find(d => d.belongsTo === 'joint' && d.type === 'photo');

    if (!userAadhaar || !userSecondDoc || !partnerAadhaar || !partnerSecondDoc || !jointPhotograph) {
      return 2; // Still on documents step
    }

    // Check if declarations are filled
    const hasDeclarations = application.declarations?.consent &&
      application.declarations?.accuracy &&
      application.declarations?.legal;

    if (!hasDeclarations) {
      return 3; // Still on confirmation step
    }

    return 4; // All steps completed, on review step
  };

  const currentStep = getCurrentStep();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
      navigate('/');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center justify-between mb-2 sm:mb-0">
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
              {t('title', { name: profile?.firstName || user?.name || '' })}
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5">{t('subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 ml-2">
            {user && (
              <>
                <NotificationIcon
                  userId={user.id}
                  onOpenPanel={() => setIsNotificationPanelOpen(true)}
                />
                <NotificationPanel
                  userId={user.id}
                  isOpen={isNotificationPanelOpen}
                  onClose={() => setIsNotificationPanelOpen(false)}
                />
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-gray-700 hover:text-gray-900 !px-2 sm:!px-3"
            >
              <LogOut size={16} className="sm:w-[18px] sm:h-[18px]" />
              <span className="hidden sm:inline text-xs sm:text-sm">{t('logout')}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        {/* Profile Card */}
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2.5 sm:gap-3 mb-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gold-100 flex items-center justify-center flex-shrink-0">
              <User size={18} className="sm:w-5 sm:h-5 text-gold-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm sm:text-base text-gray-900">{t('cards.profile.title')}</h3>
              <p className="text-xs sm:text-sm text-gray-500">{t('cards.profile.complete', { percentage: profile?.completionPercentage || 0 })}</p>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2 mb-3">
            <div
              className="bg-gold-500 h-1.5 sm:h-2 rounded-full transition-all"
              style={{ width: `${profile?.completionPercentage || 0}%` }}
            />
          </div>
          <Button variant="ghost" size="sm" className="w-full !text-xs sm:!text-sm" onClick={() => navigate('/settings')}>
            {t('cards.profile.updateProfile')}
          </Button>
        </Card>

        {/* Application Progress */}
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2.5 sm:gap-3 mb-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
              <FileText size={18} className="sm:w-5 sm:h-5 text-rose-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm sm:text-base text-gray-900">{t('cards.application.title')}</h3>
              <Badge variant={application?.status === 'submitted' ? 'success' : 'warning'}>
                {application?.status ? t(`status.${application.status}`) : t('cards.application.notStarted')}
              </Badge>
            </div>
          </div>
          {application ? (
            <div className="mb-3">
              <Stepper
                steps={applicationSteps}
                currentStep={currentStep}
                completedSteps={Array.from({ length: currentStep }, (_, i) => i)}
              />
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-gray-500 mb-3">{t('cards.application.startApplication')}</p>
          )}
          {application?.status === 'submitted' || application?.status === 'under_review' || application?.status === 'approved' ? (
            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                size="sm"
                className="w-full !text-xs sm:!text-sm"
                onClick={() => navigate('/application/view')}
              >
                <Eye size={14} className="sm:w-4 sm:h-4 mr-1.5" />
                {t('cards.application.viewApplication')}
              </Button>
              <p className="text-[10px] sm:text-xs text-gray-500 text-center">
                {t('cards.application.applicationSubmitted')}
                <CheckCircle size={12} className="inline ml-1 sm:w-3 sm:h-3" />
              </p>
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              className="w-full !text-xs sm:!text-sm"
              onClick={() => navigate('/application')}
            >
              {application ? t('cards.application.continue') : t('cards.application.start')}
              <ArrowRight size={14} className="ml-1.5 sm:w-4 sm:h-4" />
            </Button>
          )}
        </Card>

        {/* Messages */}
        <Card className="p-3 sm:p-4 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <MessageSquare size={18} className="sm:w-5 sm:h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-sm sm:text-base text-gray-900">{t('cards.messages.title')}</h3>
                <p className="text-xs sm:text-sm text-gray-500">
                  {unreadMessages > 0 ? t('cards.messages.unread', { count: unreadMessages }) : t('cards.messages.noNewMessages')}
                </p>
              </div>
            </div>
            {unreadMessages > 0 && (
              <Badge variant="info">{unreadMessages}</Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full !text-xs sm:!text-sm"
            onClick={() => navigate('/chat')}
          >
            {t('cards.messages.viewMessages')}
            <ArrowRight size={14} className="ml-1.5 sm:w-4 sm:h-4" />
          </Button>
        </Card>
      </div>

      {/* Secondary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Appointment / Acknowledgment Card */}
        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm sm:text-base text-gray-900 flex items-center gap-1.5 sm:gap-2">
              <Calendar size={16} className="sm:w-5 sm:h-5 text-gold-600" />
              Appointment / Acknowledgment
            </h3>
            {appointment && (
              <Badge variant={appointment.status === 'confirmed' ? 'success' : 'warning'}>
                {appointment.status.toUpperCase()}
              </Badge>
            )}
          </div>

          <div className="space-y-3">
            {/* Acknowledgment Section */}
            {application ? (
              <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-[11px] sm:text-xs text-gray-500 mb-2">Application Acknowledgment</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full !text-xs sm:!text-sm justify-center"
                  onClick={() => navigate(`/application/${application.id}/acknowledgement`)}
                >
                  <FileText size={14} className="mr-1.5 sm:w-4 sm:h-4" />
                  View/Download Slip
                </Button>
              </div>
            ) : (
              <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-[10px] sm:text-xs text-center text-gray-500">Submit application to view acknowledgment</p>
              </div>
            )}

            {/* Appointment Section */}
            <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-[11px] sm:text-xs text-gray-500 mb-2">Appointment</p>
              {appointment ? (
                <div className="space-y-2">
                  {appointment.date && (
                    <p className="font-medium text-xs sm:text-sm text-gray-900">
                      {safeFormatDate(appointment.date, 'MMM d, yyyy')} at {appointment.time}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1 !text-xs sm:!text-sm"
                      onClick={() => navigate('/pass')}
                    >
                      View Pass
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 !text-xs sm:!text-sm"
                      onClick={() => navigate('/appointments')}
                    >
                      Reschedule
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full !text-xs sm:!text-sm justify-center"
                  onClick={() => navigate('/appointments')}
                  disabled={!application || application.status === 'draft'}
                >
                  <Calendar size={14} className="mr-1.5 sm:w-4 sm:h-4" />
                  Book Appointment
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Latest Certificate */}
        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm sm:text-base text-gray-900 flex items-center gap-1.5 sm:gap-2">
              <Award size={16} className="sm:w-5 sm:h-5 text-gold-600" />
              {t('cards.certificate.title')}
            </h3>
            {application?.verified && <Badge variant="success">{t('cards.certificate.verified')}</Badge>}
          </div>
          {application?.verified ? (
            <div className="space-y-2 sm:space-y-3">
              <div>
                <p className="text-[11px] sm:text-xs text-gray-500">{t('cards.certificate.status')}</p>
                <p className="font-medium text-xs sm:text-sm text-gray-900">
                  {t('cards.certificate.applicationVerified')}
                </p>
                {application.verifiedAt && (
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                    {t('cards.certificate.verifiedOn', { date: safeFormatDate(application.verifiedAt, 'MMM d, yyyy') })}
                  </p>
                )}
                {application.certificateNumber && (
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 break-all">
                    {t('cards.certificate.certNumber', { number: application.certificateNumber })}
                  </p>
                )}
              </div>
              {certificate ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      className="!text-xs sm:!text-sm flex-1"
                      onClick={() => {
                        const certNumber = certificate.certificateNumber || application?.certificateNumber;
                        if (certNumber) {
                          navigate(`/verify/${certNumber}`);
                        } else {
                          showToast('Certificate number not available', 'error');
                        }
                      }}
                    >
                      <Award size={14} className="mr-1 sm:w-4 sm:h-4" />
                      {t('cards.certificate.view')}
                    </Button>
                    {certificate.canDownload ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="!text-xs sm:!text-sm flex-1"
                        onClick={async () => {
                          if (application && certificate) {
                            try {
                              // Verify certificate still exists and check download permission
                              const { certificateService } = await import('../../services/certificates');
                              const certCheck = await certificateService.getCertificateByApplicationId(application.id);
                              if (!certCheck) {
                                showToast(t('common:errors.notFound'), 'error');
                                return;
                              }
                              // Check if download is enabled by admin (double-check)
                              if (!certCheck.canDownload) {
                                showToast(t('cards.certificate.downloadDisabled'), 'error');
                                return;
                              }
                              await downloadCertificate(application);
                              showToast(t('common:success.downloaded'), 'success');
                            } catch (error: any) {
                              console.error('Failed to download certificate:', error);
                              showToast(error.message || t('common:errors.generic'), 'error');
                            }
                          }
                        }}
                      >
                        {t('cards.certificate.downloadPDF')}
                      </Button>
                    ) : null}
                  </div>
                  {!certificate.canDownload && (
                    <div className="p-2 sm:p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-[10px] sm:text-xs text-gray-600 text-center">
                        {t('cards.certificate.downloadDisabled')}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-2 sm:p-3 bg-gold-50 border border-gold-200 rounded-lg">
                  <p className="text-[10px] sm:text-xs text-gold-800 text-center">
                    {t('cards.certificate.beingPrepared')}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-[11px] sm:text-xs text-gray-500">{t('cards.certificate.status')}</p>
              <p className="font-medium text-xs sm:text-sm text-gray-900">
                {application?.status === 'submitted' || application?.status === 'under_review'
                  ? t('cards.certificate.underReview')
                  : application
                    ? t('cards.certificate.pendingVerification')
                    : t('cards.certificate.noApplication')}
              </p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-1 leading-relaxed">
                {application?.status === 'submitted' || application?.status === 'under_review'
                  ? t('cards.certificate.willBeAvailable')
                  : application
                    ? t('cards.certificate.completeAndSubmit')
                    : t('cards.certificate.startApplication')}
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="mt-4 sm:mt-6">
        <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-2 sm:mb-3">{t('quickActions.title')}</h3>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Button
            variant="outline"
            className="flex flex-col items-center gap-1 sm:gap-1.5 h-auto py-2.5 sm:py-3 !px-1 sm:!px-2"
            onClick={() => navigate('/documents')}
          >
            <Upload size={18} className="sm:w-5 sm:h-5 text-gold-600" />
            <span className="text-[10px] sm:text-xs text-center leading-tight">{t('quickActions.uploadDocs')}</span>
          </Button>
          {/* HIDDEN: Book Appointment quick action temporarily disabled
          <Button
            variant="outline"
            className="flex flex-col items-center gap-1 sm:gap-1.5 h-auto py-2.5 sm:py-3 !px-1 sm:!px-2"
            onClick={() => navigate('/appointments')}
          >
            <Calendar size={18} className="sm:w-5 sm:h-5 text-gold-600" />
            <span className="text-[10px] sm:text-xs text-center leading-tight">{t('quickActions.bookAppt')}</span>
          </Button>
          */}
          <Button
            variant="outline"
            className="flex flex-col items-center gap-1 sm:gap-1.5 h-auto py-2.5 sm:py-3 !px-1 sm:!px-2"
            onClick={() => navigate('/chat')}
          >
            <MessageSquare size={18} className="sm:w-5 sm:h-5 text-gold-600" />
            <span className="text-[10px] sm:text-xs text-center leading-tight">{t('quickActions.support')}</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-1 sm:gap-1.5 h-auto py-2.5 sm:py-3 !px-1 sm:!px-2"
            onClick={() => navigate('/help-center')}
          >
            <FileText size={18} className="sm:w-5 sm:h-5 text-gold-600" />
            <span className="text-[10px] sm:text-xs text-center leading-tight">{t('quickActions.help')}</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

