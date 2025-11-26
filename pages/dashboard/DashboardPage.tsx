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
  CheckCircle
} from 'lucide-react';
import { safeFormatDate, safeFormatDateObject } from '../../utils/dateUtils';
import { downloadCertificate } from '../../utils/certificateGenerator';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useNotification();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

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
    { id: '1', label: 'Partner', description: 'Partner details' },
    { id: '2', label: 'Address', description: 'Address information' },
    { id: '3', label: 'Documents', description: 'Upload documents' },
    { id: '4', label: 'Review', description: 'Review & submit' },
  ];

  const currentStep = application ? Math.floor((application.progress / 100) * applicationSteps.length) : 0;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="font-serif text-4xl font-bold text-gray-900 mb-2">
          Welcome back, {profile?.firstName || user?.name}!
        </h1>
        <p className="text-gray-600">Here's your registration progress</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Profile Card */}
        <Card className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-gold-100 flex items-center justify-center">
              <User size={24} className="text-gold-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Profile</h3>
              <p className="text-sm text-gray-500">{profile?.completionPercentage || 0}% complete</p>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div
              className="bg-gold-500 h-2 rounded-full transition-all"
              style={{ width: `${profile?.completionPercentage || 0}%` }}
            />
          </div>
          <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate('/settings')}>
            Update Profile
          </Button>
        </Card>

        {/* Application Progress */}
        <Card className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
              <FileText size={24} className="text-rose-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Application</h3>
              <Badge variant={application?.status === 'submitted' ? 'success' : 'warning'}>
                {application?.status || 'Not started'}
              </Badge>
            </div>
          </div>
          {application ? (
            <div className="mb-4">
              <Stepper
                steps={applicationSteps}
                currentStep={currentStep}
                completedSteps={Array.from({ length: currentStep }, (_, i) => i)}
              />
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-4">Start your application</p>
          )}
          {application?.status === 'submitted' || application?.status === 'under_review' || application?.status === 'approved' ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              disabled
            >
              Application Submitted
              <CheckCircle size={16} className="ml-2" />
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              onClick={() => navigate('/application')}
            >
              {application ? 'Continue Application' : 'Start Application'}
              <ArrowRight size={16} className="ml-2" />
            </Button>
          )}
        </Card>

        {/* Messages */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <MessageSquare size={24} className="text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Messages</h3>
                <p className="text-sm text-gray-500">
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
            className="w-full"
            onClick={() => navigate('/chat')}
          >
            View Messages
            <ArrowRight size={16} className="ml-2" />
          </Button>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Appointment */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Calendar size={20} className="text-gold-600" />
              Upcoming Appointment
            </h3>
            {appointment && (
              <Badge variant={appointment.status === 'confirmed' ? 'success' : 'warning'}>
                {appointment.status}
              </Badge>
            )}
          </div>
          {appointment ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Date & Time</p>
                <p className="font-medium text-gray-900">
                  {safeFormatDate(appointment.date, 'MMMM d, yyyy')} at {appointment.time}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/pass')}
                >
                  View Pass
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/appointments')}
                >
                  Reschedule
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-500 mb-4">No appointment scheduled</p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/appointments')}
              >
                Book Appointment
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </div>
          )}
        </Card>

        {/* Latest Certificate */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Award size={20} className="text-gold-600" />
              Latest Certificate
            </h3>
            {application?.verified && <Badge variant="success">Verified</Badge>}
          </div>
          {application?.verified ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Verification Status</p>
                <p className="font-medium text-gray-900">
                  Your application has been verified
                </p>
                {application.verifiedAt && (
                  <p className="text-xs text-gray-500 mt-1">
                    Verified on {safeFormatDate(application.verifiedAt, 'MMMM d, yyyy')}
                  </p>
                )}
              </div>
              <Button
                variant="primary"
                size="sm"
                className="w-full"
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
                <Award size={16} className="mr-2" />
                Download Certificate
              </Button>
            </div>
          ) : application ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Test Certificate</p>
                <p className="font-medium text-gray-900">
                  Download template with random names
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Your application is not yet verified. This is a test certificate.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={async () => {
                  if (application) {
                    try {
                      await downloadCertificate(application);
                      showToast('Test certificate downloaded successfully', 'success');
                    } catch (error) {
                      console.error('Failed to download certificate:', error);
                      showToast('Failed to download certificate', 'error');
                    }
                  }
                }}
              >
                <Award size={16} className="mr-2" />
                Download Test Certificate
              </Button>
            </div>
          ) : certificate ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Issued On</p>
                <p className="font-medium text-gray-900">
                  {safeFormatDate(certificate.issuedOn, 'MMMM d, yyyy')}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Verification ID: {certificate.verificationId}
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/verify/${certificate.verificationId}`)}
              >
                View Certificate
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Test Certificate</p>
                <p className="font-medium text-gray-900">
                  Download template with random names
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {application?.status === 'submitted'
                    ? 'Your application is under review. This is a test certificate with random names.'
                    : application
                    ? 'Your application is not yet verified. This is a test certificate with random names.'
                    : 'No application yet. This is a test certificate with random names for preview.'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={async () => {
                  // Create a minimal application object for testing if none exists
                  const testApplication = application || {
                    id: 'test-app',
                    userId: user?.id || 'test-user',
                    status: 'draft' as const,
                    progress: 0,
                    documents: [],
                    lastUpdated: new Date().toISOString(),
                  };
                  try {
                    await downloadCertificate(testApplication);
                    showToast('Test certificate downloaded successfully', 'success');
                  } catch (error) {
                    console.error('Failed to download certificate:', error);
                    showToast('Failed to download certificate', 'error');
                  }
                }}
              >
                <Award size={16} className="mr-2" />
                Download Test Certificate
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={() => navigate('/documents')}
          >
            <Upload size={24} className="text-gold-600" />
            <span className="text-sm">Upload Documents</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={() => navigate('/appointments')}
          >
            <Calendar size={24} className="text-gold-600" />
            <span className="text-sm">Book Appointment</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={() => navigate('/chat')}
          >
            <MessageSquare size={24} className="text-gold-600" />
            <span className="text-sm">Contact Support</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={() => navigate('/help-center')}
          >
            <FileText size={24} className="text-gold-600" />
            <span className="text-sm">Help Center</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

