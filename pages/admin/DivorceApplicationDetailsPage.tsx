import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { adminService } from '../../services/admin';
import { divorceApplicationService } from '../../services/divorceApplication';
import { divorceCertificateService } from '../../services/divorceCertificates';
import { DivorceApplication, DivorceCertificate, CertificateDetails } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { viewDivorceCertificate, downloadDivorceCertificate } from '../../utils/divorceCertificateGenerator';
import VerifyDivorceApplicationModal from '../../components/admin/VerifyDivorceApplicationModal';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import {
  FileX,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  Users,
  Eye,
  Download,
  Calendar,
  MapPin,
  Lock,
  Unlock,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import { safeFormatDate } from '../../utils/dateUtils';
import { formatAadhaar } from '../../utils/formatUtils';

const DivorceApplicationDetailsPage: React.FC = () => {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useNotification();

  const [application, setApplication] = useState<DivorceApplication | null>(null);
  const [certificate, setCertificate] = useState<DivorceCertificate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [adminComment, setAdminComment] = useState('');
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [isUnverifying, setIsUnverifying] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const loadData = async () => {
    if (!applicationId) return;
    try {
      setIsLoading(true);
      const app = await divorceApplicationService.getDivorceApplicationById(applicationId);
      if (!app) {
        showToast('Divorce application not found', 'error');
        navigate('/admin/divorce/applications');
        return;
      }
      setApplication(app);
      setAdminComment(app.adminComment || '');

      if (app.verified) {
        const cert = await divorceCertificateService.getDivorceCertificateByApplicationId(applicationId);
        setCertificate(cert);
      }
    } catch (err: any) {
      console.error('Failed to load application:', err);
      showToast('Failed to load application details', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [applicationId]);

  const handleVerify = async (
    certificateNumber: string,
    registrationDate: string,
    registrarName: string,
    certificateDetails: CertificateDetails
  ) => {
    if (!application || !user) return;
    try {
      const updated = await adminService.verifyDivorceApplication(
        application.id,
        user.id,
        user.name || 'Admin',
        certificateNumber,
        registrationDate,
        registrarName,
        certificateDetails
      );
      setApplication(updated);
      showToast('Divorce application verified and certificate issued successfully!', 'success');
      loadData();
    } catch (err: any) {
      console.error('Failed to verify divorce application:', err);
      showToast(err.message || 'Verification failed', 'error');
      throw err;
    }
  };

  const handleUnverify = async () => {
    if (!application || !user) return;
    if (!window.confirm('Are you sure you want to unverify this divorce application? The associated certificate will be deleted.')) {
      return;
    }

    try {
      setIsUnverifying(true);
      const updated = await adminService.unverifyDivorceApplication(
        application.id,
        user.id,
        user.name || 'Admin'
      );
      setApplication(updated);
      setCertificate(null);
      showToast('Divorce application unverified successfully', 'success');
    } catch (err: any) {
      console.error('Failed to unverify:', err);
      showToast(err.message || 'Failed to unverify application', 'error');
    } finally {
      setIsUnverifying(false);
    }
  };

  const handleToggleDownloadPermission = async () => {
    if (!certificate) return;
    const newStatus = !certificate.canDownload;
    try {
      await divorceCertificateService.updateDownloadPermission(certificate.id, newStatus);
      setCertificate({ ...certificate, canDownload: newStatus });
      showToast(
        newStatus
          ? 'Client download permission enabled'
          : 'Client download permission disabled',
        'success'
      );
    } catch (err: any) {
      console.error('Failed to update download permission:', err);
      showToast('Failed to update download permission', 'error');
    }
  };

  const handleSaveComment = async () => {
    if (!application || !user) return;
    try {
      setIsSavingComment(true);
      await adminService.updateDivorceApplicationComment(
        application.id,
        adminComment,
        user.id,
        user.name || 'Admin'
      );
      showToast('Admin comment saved', 'success');
    } catch (err: any) {
      console.error('Failed to save comment:', err);
      showToast('Failed to save comment', 'error');
    } finally {
      setIsSavingComment(false);
    }
  };

  const handleViewCertificate = async () => {
    if (!application) return;
    try {
      setIsActionLoading(true);
      await viewDivorceCertificate(application);
    } catch (err: any) {
      console.error('Failed to view certificate:', err);
      showToast('Failed to generate certificate preview', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDownloadCertificate = async () => {
    if (!application) return;
    try {
      setIsActionLoading(true);
      await downloadDivorceCertificate(application);
      showToast('Certificate PDF downloaded', 'success');
    } catch (err: any) {
      console.error('Failed to download certificate:', err);
      showToast('Failed to download certificate', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-sm text-gray-500">
        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-gold-600" />
        Loading application details...
      </div>
    );
  }

  if (!application) {
    return null;
  }

  const husband = application.userDetails || {};
  const wife = (application.partnerForm as any) || {};
  const husbandAddr = application.userAddress || {};
  const wifeAddr = application.partnerAddress || {};

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/admin/divorce/applications')}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors mb-2"
          >
            <ArrowLeft size={14} />
            Back to Applications
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900">
              Divorce Application Details
            </h1>
            {application.verified ? (
              <Badge variant="success">Verified</Badge>
            ) : (
              <Badge variant="info">Pending Verification</Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Application ID: <span className="font-mono">{application.id}</span>
          </p>
        </div>

        {/* Verification / Certificate Actions */}
        <div className="flex items-center gap-2">
          {!application.verified ? (
            <Button
              variant="primary"
              onClick={() => setIsVerifyModalOpen(true)}
              size="sm"
            >
              <CheckCircle2 size={16} className="mr-1.5" />
              Verify & Issue Certificate
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleViewCertificate}
                disabled={isActionLoading}
              >
                <Eye size={16} className="mr-1.5" />
                View Certificate
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleDownloadCertificate}
                disabled={isActionLoading}
              >
                <Download size={16} className="mr-1.5" />
                Download PDF
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleUnverify}
                isLoading={isUnverifying}
              >
                Unverify
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Verified Banner */}
      {application.verified && (
        <Card className="p-4 sm:p-5 border-emerald-300 bg-emerald-50/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm sm:text-base">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span>Certificate Verified & Issued</span>
              </div>
              <div className="mt-2 text-xs sm:text-sm text-emerald-950 flex flex-wrap gap-x-6 gap-y-1 font-mono">
                <span>Certificate No: <strong>{application.certificateNumber}</strong></span>
                <span>Reg Date: <strong>{safeFormatDate(application.registrationDate, 'dd-MM-yyyy')}</strong></span>
                <span>Registrar: <strong>{application.registrarName === 'md_ismail_khan' ? 'MD Ismail Khan' : 'Minhajul Islam Khan'}</strong></span>
              </div>
            </div>

            {certificate && (
              <div className="flex items-center gap-2">
                <Button
                  variant={certificate.canDownload ? 'success' : 'secondary'}
                  size="sm"
                  onClick={handleToggleDownloadPermission}
                >
                  {certificate.canDownload ? (
                    <>
                      <Unlock size={14} className="mr-1.5 text-emerald-600" />
                      Download Allowed for Client
                    </>
                  ) : (
                    <>
                      <Lock size={14} className="mr-1.5 text-gray-500" />
                      Client Download Locked
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Divorce Particulars */}
      <Card className="p-4 sm:p-6">
        <h2 className="text-base font-semibold text-gray-900 pb-3 mb-4 border-b border-gray-100 flex items-center gap-2">
          <Calendar size={18} className="text-gold-600" />
          Divorce Particulars
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
          <div>
            <p className="text-gray-500 font-medium">Date of Divorce</p>
            <p className="font-semibold text-gray-900 mt-1">
              {application.divorceDate ? safeFormatDate(application.divorceDate, 'dd-MM-yyyy') : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 font-medium">Type of Divorce</p>
            <p className="font-semibold text-gold-700 uppercase mt-1">
              {application.divorceType || 'TALAQ'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 font-medium">Marriage Certificate Ref</p>
            <p className="font-mono font-semibold text-gray-900 mt-1">
              {application.marriageCertificateNumber || 'N/A'}
            </p>
          </div>
        </div>

        {application.divorceReason && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 font-medium mb-1">Divorce Reason / Notes</p>
            <p className="text-xs sm:text-sm text-gray-700 bg-gray-50 p-2.5 rounded-lg">
              {application.divorceReason}
            </p>
          </div>
        )}
      </Card>

      {/* Husband & Wife Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Husband Details */}
        <Card className="p-4 sm:p-6">
          <h2 className="text-base font-semibold text-gray-900 pb-3 mb-4 border-b border-gray-100 flex items-center gap-2">
            <User size={18} className="text-gold-600" />
            Details of Husband
          </h2>
          <div className="space-y-3 text-xs sm:text-sm">
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Name</span>
              <span className="font-semibold text-gray-900">{husband.firstName} {husband.lastName}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Father's Name</span>
              <span className="font-medium text-gray-900">{(husband as any).fatherName || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Date of Birth</span>
              <span className="font-medium text-gray-900">{husband.dateOfBirth ? safeFormatDate(husband.dateOfBirth, 'dd-MM-yyyy') : 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Aadhaar</span>
              <span className="font-mono font-medium text-gray-900">{formatAadhaar(husband.aadhaarNumber)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Mobile</span>
              <span className="font-medium text-gray-900">{husband.mobileNumber || 'N/A'}</span>
            </div>

            <div className="pt-2">
              <p className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                <MapPin size={12} className="text-gold-600" />
                Address
              </p>
              <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-2.5 rounded-lg">
                VILL: {husbandAddr.villageStreet || 'N/A'}, P.O: {husbandAddr.postOffice || 'N/A'},
                P.S: {husbandAddr.policeStation || 'N/A'}, DIST: {husbandAddr.district || 'N/A'},
                {husbandAddr.state || 'WEST BENGAL'}, PIN: {husbandAddr.zipCode || 'N/A'}
              </p>
            </div>
          </div>
        </Card>

        {/* Wife Details */}
        <Card className="p-4 sm:p-6">
          <h2 className="text-base font-semibold text-gray-900 pb-3 mb-4 border-b border-gray-100 flex items-center gap-2">
            <Users size={18} className="text-gold-600" />
            Details of Wife
          </h2>
          <div className="space-y-3 text-xs sm:text-sm">
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Name</span>
              <span className="font-semibold text-gray-900">{wife.firstName} {wife.lastName}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Father's Name</span>
              <span className="font-medium text-gray-900">{wife.fatherName || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Date of Birth</span>
              <span className="font-medium text-gray-900">{wife.dateOfBirth ? safeFormatDate(wife.dateOfBirth, 'dd-MM-yyyy') : 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Aadhaar / ID</span>
              <span className="font-mono font-medium text-gray-900">{formatAadhaar(wife.aadhaarNumber || wife.idNumber)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Mobile</span>
              <span className="font-medium text-gray-900">{wife.mobileNumber || 'N/A'}</span>
            </div>

            <div className="pt-2">
              <p className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                <MapPin size={12} className="text-gold-600" />
                Address
              </p>
              <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-2.5 rounded-lg">
                VILL: {wifeAddr.villageStreet || 'N/A'}, P.O: {wifeAddr.postOffice || 'N/A'},
                P.S: {wifeAddr.policeStation || 'N/A'}, DIST: {wifeAddr.district || 'N/A'},
                {wifeAddr.state || 'WEST BENGAL'}, PIN: {wifeAddr.zipCode || 'N/A'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Admin Notes Section */}
      <Card className="p-4 sm:p-6">
        <h2 className="text-base font-semibold text-gray-900 pb-3 mb-4 border-b border-gray-100 flex items-center gap-2">
          <MessageSquare size={18} className="text-gold-600" />
          Admin Remarks / Internal Notes
        </h2>
        <div className="space-y-3">
          <textarea
            value={adminComment}
            onChange={(e) => setAdminComment(e.target.value)}
            rows={3}
            placeholder="Write internal admin notes here..."
            className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
          />
          <div className="flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSaveComment}
              isLoading={isSavingComment}
            >
              Save Remarks
            </Button>
          </div>
        </div>
      </Card>

      {/* Verify Modal */}
      <VerifyDivorceApplicationModal
        isOpen={isVerifyModalOpen}
        onClose={() => setIsVerifyModalOpen(false)}
        onConfirm={handleVerify}
        applicationId={application.id}
        currentCertificateNumber={application.certificateNumber}
        currentRegistrationDate={application.registrationDate}
        divorceDate={application.divorceDate}
        divorceType={application.divorceType}
      />
    </div>
  );
};

export default DivorceApplicationDetailsPage;

