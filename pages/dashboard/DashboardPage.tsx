import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { profileService } from '../../services/profile';
import { applicationService } from '../../services/application';
import { appointmentService } from '../../services/appointments';
import { certificateService } from '../../services/certificates';
import { messageService } from '../../services/messages';
import { Profile, Application, Appointment, Certificate } from '../../types';
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
  LogOut
} from 'lucide-react';
import NotificationIcon from '../../components/ui/NotificationIcon';
import NotificationPanel from '../../components/ui/NotificationPanel';
import { safeFormatDate, safeFormatDateObject } from '../../utils/dateUtils';
import { downloadCertificate } from '../../utils/certificateGenerator';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { showToast } = useNotification();
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
        appointmentService.getUserAppointment(user.id),
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
    { id: 'groom', label: 'Groom Details' },
    { id: 'bride', label: 'Bride Details' },
    { id: 'documents', label: 'Documents' },
    { id: 'confirmation', label: 'Confirmation' },
    { id: 'review', label: 'Review' },
  ];

  // Calculate current step based on actual data filled
  const getCurrentStep = () => {
    if (!application) return 0;
    
    // Check if groom details are filled
    const hasGroomDetails = application.userDetails?.firstName && 
                            application.userDetails?.lastName &&
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
    
    // Check if bride details are filled
    const hasBrideDetails = application.partnerForm?.firstName && 
                            application.partnerForm?.lastName &&
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
              Welcome, {profile?.firstName || user?.name}!
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5">Your registration progress</p>
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
              <span className="hidden sm:inline text-xs sm:text-sm">Logout</span>
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
              <h3 className="font-semibold text-sm sm:text-base text-gray-900">Profile</h3>
              <p className="text-xs sm:text-sm text-gray-500">{profile?.completionPercentage || 0}% complete</p>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2 mb-3">
            <div
              className="bg-gold-500 h-1.5 sm:h-2 rounded-full transition-all"
              style={{ width: `${profile?.completionPercentage || 0}%` }}
            />
          </div>
          <Button variant="ghost" size="sm" className="w-full !text-xs sm:!text-sm" onClick={() => navigate('/settings')}>
            Update Profile
          </Button>
        </Card>

        {/* Application Progress */}
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2.5 sm:gap-3 mb-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
              <FileText size={18} className="sm:w-5 sm:h-5 text-rose-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm sm:text-base text-gray-900">Application</h3>
              <Badge variant={application?.status === 'submitted' ? 'success' : 'warning'}>
                {application?.status || 'Not started'}
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
            <p className="text-xs sm:text-sm text-gray-500 mb-3">Start your application</p>
          )}
          {application?.status === 'submitted' || application?.status === 'under_review' || application?.status === 'approved' ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full !text-xs sm:!text-sm"
              disabled
            >
              Application Submitted
              <CheckCircle size={14} className="ml-1.5 sm:w-4 sm:h-4" />
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              className="w-full !text-xs sm:!text-sm"
              onClick={() => navigate('/application')}
            >
              {application ? 'Continue' : 'Start Application'}
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
                <h3 className="font-semibold text-sm sm:text-base text-gray-900">Messages</h3>
                <p className="text-xs sm:text-sm text-gray-500">
                  {unreadMessages > 0 ? `${unreadMessages} unread` : 'No new messages'}
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
            View Messages
            <ArrowRight size={14} className="ml-1.5 sm:w-4 sm:h-4" />
          </Button>
        </Card>
      </div>

      {/* Secondary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Upcoming Appointment */}
        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm sm:text-base text-gray-900 flex items-center gap-1.5 sm:gap-2">
              <Calendar size={16} className="sm:w-5 sm:h-5 text-gold-600" />
              Appointment
            </h3>
            {appointment && (
              <Badge variant={appointment.status === 'confirmed' ? 'success' : 'warning'}>
                {appointment.status}
              </Badge>
            )}
          </div>
          {appointment ? (
            <div className="space-y-2 sm:space-y-3">
              <div>
                <p className="text-[11px] sm:text-xs text-gray-500">Date & Time</p>
                <p className="font-medium text-xs sm:text-sm text-gray-900">
                  {safeFormatDate(appointment.date, 'MMM d, yyyy')} at {appointment.time}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  className="!text-xs sm:!text-sm flex-1"
                  onClick={() => navigate('/pass')}
                >
                  View Pass
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="!text-xs sm:!text-sm"
                  onClick={() => navigate('/appointments')}
                >
                  Reschedule
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs sm:text-sm text-gray-500 mb-3">No appointment scheduled</p>
              <Button
                variant="primary"
                size="sm"
                className="!text-xs sm:!text-sm"
                onClick={() => navigate('/appointments')}
              >
                Book Appointment
                <ArrowRight size={14} className="ml-1.5 sm:w-4 sm:h-4" />
              </Button>
            </div>
          )}
        </Card>

        {/* Latest Certificate */}
        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm sm:text-base text-gray-900 flex items-center gap-1.5 sm:gap-2">
              <Award size={16} className="sm:w-5 sm:h-5 text-gold-600" />
              Certificate
            </h3>
            {application?.verified && <Badge variant="success">Verified</Badge>}
          </div>
          {application?.verified ? (
            <div className="space-y-2 sm:space-y-3">
              <div>
                <p className="text-[11px] sm:text-xs text-gray-500">Status</p>
                <p className="font-medium text-xs sm:text-sm text-gray-900">
                  Application verified
                </p>
                {application.verifiedAt && (
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                    Verified on {safeFormatDate(application.verifiedAt, 'MMM d, yyyy')}
                  </p>
                )}
                {application.certificateNumber && (
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 break-all">
                    Cert: {application.certificateNumber}
                  </p>
                )}
              </div>
              {certificate ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    className="!text-xs sm:!text-sm flex-1"
                    onClick={() => navigate(`/verify/${certificate.verificationId}`)}
                  >
                    <Award size={14} className="mr-1 sm:w-4 sm:h-4" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="!text-xs sm:!text-sm flex-1"
                    onClick={async () => {
                      if (application) {
                        try {
                          await downloadCertificate(application);
                          showToast('Certificate downloaded successfully', 'success');
                        } catch (error) {
                          console.error('Failed to download certificate:', error);
                          showToast('Failed to download certificate', 'error');
                        }
                      }
                    }}
                  >
                    Download PDF
                  </Button>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full !text-xs sm:!text-sm"
                  onClick={async () => {
                    if (application) {
                      try {
                        await downloadCertificate(application);
                        showToast('Certificate downloaded successfully', 'success');
                      } catch (error) {
                        console.error('Failed to download certificate:', error);
                        showToast('Failed to download certificate', 'error');
                      }
                    }
                  }}
                >
                  <Award size={14} className="mr-1 sm:w-4 sm:h-4" />
                  Download Certificate
                </Button>
              )}
            </div>
          ) : (
            <div>
              <p className="text-[11px] sm:text-xs text-gray-500">Status</p>
              <p className="font-medium text-xs sm:text-sm text-gray-900">
                {application?.status === 'submitted' || application?.status === 'under_review'
                  ? 'Under review'
                  : application
                  ? 'Pending verification'
                  : 'No application'}
              </p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-1 leading-relaxed">
                {application?.status === 'submitted' || application?.status === 'under_review'
                  ? 'Certificate will be available once verified.'
                  : application
                  ? 'Complete and submit to proceed.'
                  : 'Start your application first.'}
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="mt-4 sm:mt-6">
        <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-2 sm:mb-3">Quick Actions</h3>
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          <Button
            variant="outline"
            className="flex flex-col items-center gap-1 sm:gap-1.5 h-auto py-2.5 sm:py-3 !px-1 sm:!px-2"
            onClick={() => navigate('/documents')}
          >
            <Upload size={18} className="sm:w-5 sm:h-5 text-gold-600" />
            <span className="text-[10px] sm:text-xs text-center leading-tight">Upload<br className="sm:hidden" /> Docs</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-1 sm:gap-1.5 h-auto py-2.5 sm:py-3 !px-1 sm:!px-2"
            onClick={() => navigate('/appointments')}
          >
            <Calendar size={18} className="sm:w-5 sm:h-5 text-gold-600" />
            <span className="text-[10px] sm:text-xs text-center leading-tight">Book<br className="sm:hidden" /> Appt</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-1 sm:gap-1.5 h-auto py-2.5 sm:py-3 !px-1 sm:!px-2"
            onClick={() => navigate('/chat')}
          >
            <MessageSquare size={18} className="sm:w-5 sm:h-5 text-gold-600" />
            <span className="text-[10px] sm:text-xs text-center leading-tight">Support</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-1 sm:gap-1.5 h-auto py-2.5 sm:py-3 !px-1 sm:!px-2"
            onClick={() => navigate('/help-center')}
          >
            <FileText size={18} className="sm:w-5 sm:h-5 text-gold-600" />
            <span className="text-[10px] sm:text-xs text-center leading-tight">Help</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

