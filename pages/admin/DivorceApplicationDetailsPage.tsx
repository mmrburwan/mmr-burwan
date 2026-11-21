import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminService } from '../../services/admin';
import { divorceApplicationService } from '../../services/divorceApplication';
import { divorceCertificateService } from '../../services/divorceCertificates';
import { documentService } from '../../services/documents';
import { DivorceApplication, DivorceCertificate, CertificateDetails, Document } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { viewDivorceCertificate, downloadDivorceCertificate } from '../../utils/divorceCertificateGenerator';
import VerifyDivorceApplicationModal from '../../components/admin/VerifyDivorceApplicationModal';
import RejectDocumentModal from '../../components/admin/RejectDocumentModal';
import ImageCropModal from '../../components/ui/ImageCropModal';
import { isTripleTalaq, formatDivorceTypeDisplay } from '../../utils/divorceUtils';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
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
  Edit2,
  Save,
  X,
  XCircle,
  CheckCircle,
  Upload,
  Copy,
  Check,
} from 'lucide-react';
import { safeFormatDate } from '../../utils/dateUtils';
import { formatAadhaar, handleAadhaarInput } from '../../utils/formatUtils';
import { downloadFileFromUrl } from '../../utils/download';

const DivorceApplicationDetailsPage: React.FC = () => {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useNotification();

  const [application, setApplication] = useState<DivorceApplication | null>(null);
  const [certificate, setCertificate] = useState<DivorceCertificate | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Verification & admin action states
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [adminComment, setAdminComment] = useState('');
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [isUnverifying, setIsUnverifying] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Document action states
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isProcessingDoc, setIsProcessingDoc] = useState<string | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [reuploadingDoc, setReuploadingDoc] = useState<string | null>(null);
  const reuploadFileInputsRef = useRef<Map<string, HTMLInputElement>>(new Map());
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [pendingCropFile, setPendingCropFile] = useState<{ file: File; documentId: string } | null>(null);

  // Credentials modal state
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

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

      const docs = await documentService.getDivorceDocuments(applicationId);
      setDocuments(docs);

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

  // Handle Edit
  const handleStartEdit = () => {
    if (!application) return;
    setEditForm({
      userDetails: { ...(application.userDetails || {}) },
      partnerForm: { ...(application.partnerForm || {}) },
      userAddress: { ...(application.userAddress || {}) },
      userCurrentAddress: { ...(application.userCurrentAddress || {}) },
      partnerAddress: { ...(application.partnerAddress || {}) },
      partnerCurrentAddress: { ...(application.partnerCurrentAddress || {}) },
      divorceDate: application.divorceDate || '',
      divorceType: formatDivorceTypeDisplay(application.divorceType),
      talaqDate1: (application.certificateDetails as any)?.talaqDate1 || application.talaqDate1 || (application.declarations as any)?.talaqDate1 || application.divorceDate || '',
      talaqDate2: (application.certificateDetails as any)?.talaqDate2 || application.talaqDate2 || (application.declarations as any)?.talaqDate2 || application.divorceDate || '',
      talaqDate3: (application.certificateDetails as any)?.talaqDate3 || application.talaqDate3 || (application.declarations as any)?.talaqDate3 || application.divorceDate || '',
      divorceReason: application.divorceReason || '',
      marriageCertificateNumber: application.marriageCertificateNumber || '',
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const handleSaveEdit = async () => {
    if (!application) return;
    try {
      setIsSavingEdit(true);
      const updated = await divorceApplicationService.updateDivorceApplication(application.id, {
        userDetails: editForm.userDetails,
        partnerForm: editForm.partnerForm,
        userAddress: editForm.userAddress,
        userCurrentAddress: editForm.userCurrentAddress,
        partnerAddress: editForm.partnerAddress,
        partnerCurrentAddress: editForm.partnerCurrentAddress,
        divorceDate: isTripleTalaq(editForm.divorceType)
          ? (editForm.talaqDate3 || editForm.talaqDate1 || editForm.divorceDate)
          : editForm.divorceDate,
        divorceType: editForm.divorceType,
        talaqDate1: editForm.talaqDate1,
        talaqDate2: editForm.talaqDate2,
        talaqDate3: editForm.talaqDate3,
        divorceReason: editForm.divorceReason,
      });
      setApplication(updated);
      setIsEditing(false);
      showToast('Application details updated successfully', 'success');
    } catch (err: any) {
      console.error('Failed to save edit:', err);
      showToast(err.message || 'Failed to update application details', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Document verification & approval
  const handleApproveDocument = async (documentId: string) => {
    if (!user) return;
    setIsProcessingDoc(documentId);
    try {
      await adminService.approveDivorceDocument(documentId, user.id, user.name || user.email || 'Admin');
      const updated = await documentService.getDivorceDocuments(application!.id);
      setDocuments(updated);
      showToast('Document approved successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to approve document', 'error');
    } finally {
      setIsProcessingDoc(null);
    }
  };

  const handleRejectDocument = (document: Document) => {
    setSelectedDocument(document);
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async (reason: string, sendEmail: boolean) => {
    if (!user || !selectedDocument || !application) return;
    setIsProcessingDoc(selectedDocument.id);
    try {
      await adminService.rejectDivorceDocument(
        selectedDocument.id,
        reason,
        user.id,
        user.name || user.email || 'Admin',
        sendEmail
      );
      const updated = await documentService.getDivorceDocuments(application.id);
      setDocuments(updated);
      showToast('Document rejected', 'success');
      setRejectModalOpen(false);
      setSelectedDocument(null);
    } catch (error: any) {
      showToast(error.message || 'Failed to reject document', 'error');
    } finally {
      setIsProcessingDoc(null);
    }
  };

  // Re-upload documents
  const handleReuploadDocument = async (documentId: string, file: File) => {
    if (!application) return;
    setReuploadingDoc(documentId);
    try {
      const targetDoc = documents.find((d) => d.id === documentId);
      await documentService.uploadDivorceDocument(
        application.id,
        file,
        targetDoc?.type || 'aadhaar',
        targetDoc?.belongsTo || 'user',
        documentId
      );
      const updated = await documentService.getDivorceDocuments(application.id);
      setDocuments(updated);
      showToast('Document re-uploaded successfully', 'success');
    } catch (error: any) {
      console.error('Failed to re-upload document:', error);
      showToast(error.message || 'Failed to re-upload document', 'error');
    } finally {
      setReuploadingDoc(null);
    }
  };

  const handleReuploadFileSelect = (documentId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const MAX_FILE_SIZE = 250 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        showToast('File size exceeds 250KB limit. Please compress or resize before uploading.', 'error');
        event.target.value = '';
        return;
      }

      const doc = documents.find((d) => d.id === documentId);
      if (doc && doc.type === 'photo') {
        setPendingCropFile({ file, documentId });
        setCropModalOpen(true);
        event.target.value = '';
        return;
      }

      handleReuploadDocument(documentId, file);
    }
    event.target.value = '';
  };

  const handleCropComplete = async (croppedFile: File) => {
    if (!pendingCropFile) return;
    const MAX_FILE_SIZE = 250 * 1024;
    if (croppedFile.size > MAX_FILE_SIZE) {
      showToast('Cropped file too large. Please resize before uploading.', 'error');
      setPendingCropFile(null);
      setCropModalOpen(false);
      return;
    }
    await handleReuploadDocument(pendingCropFile.documentId, croppedFile);
    setPendingCropFile(null);
    setCropModalOpen(false);
  };

  const handleCropSkip = async () => {
    if (!pendingCropFile) return;
    await handleReuploadDocument(pendingCropFile.documentId, pendingCropFile.file);
    setPendingCropFile(null);
    setCropModalOpen(false);
  };

  // Verification & unverify
  const handleVerify = async (
    certificateNumber: string,
    registrationDate: string,
    registrarName: string,
    certificateDetails: CertificateDetails,
    talaqDates?: { talaqDate1?: string; talaqDate2?: string; talaqDate3?: string }
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
        certificateDetails,
        talaqDates
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

  const getDocumentTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      aadhaar: 'Aadhaar Card',
      tenth_certificate: 'Madhyamik Admit Card',
      voter_id: 'Voter ID',
      id: 'ID Document',
      photo: 'Photo',
      certificate: 'Marriage / Kabin Certificate',
      other: 'Other',
    };
    return labels[type] || type;
  };

  const isImage = (mimeType?: string) => mimeType?.startsWith('image/');
  const isPDF = (mimeType?: string) => mimeType === 'application/pdf';

  if (isLoading) {
    return (
      <div className="p-12 text-center text-sm text-gray-500">
        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-gold-600" />
        Loading divorce application details...
      </div>
    );
  }

  if (!application) {
    return null;
  }

  const husband = isEditing ? editForm.userDetails || {} : application.userDetails || {};
  const wife = isEditing ? editForm.partnerForm || {} : (application.partnerForm as any) || {};
  const husbandAddr = isEditing ? editForm.userAddress || {} : application.userAddress || {};
  const wifeAddr = isEditing ? editForm.partnerAddress || {} : application.partnerAddress || {};
  const declarations = application.declarations || {};

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/admin/clients?tab=divorce')}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors mb-2"
          >
            <ArrowLeft size={14} />
            Back to Applications
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900">
              Divorce Application Details
            </h1>
            {application.isProxyApplication && (
              <Badge variant="info">Admin-Created</Badge>
            )}
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

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {!isEditing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartEdit}
              className="text-xs"
            >
              <Edit2 size={14} className="mr-1.5" />
              Edit Application
            </Button>
          ) : (
            <div className="flex items-center gap-1.5">
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveEdit}
                isLoading={isSavingEdit}
                className="text-xs"
              >
                <Save size={14} className="mr-1.5" />
                Save Changes
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEdit}
                disabled={isSavingEdit}
                className="text-xs"
              >
                <X size={14} className="mr-1.5" />
                Cancel
              </Button>
            </div>
          )}

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

      {/* Admin-Created Application Card */}
      {application.isProxyApplication && (
        <Card className="p-3 sm:p-4 bg-blue-50/60 border-blue-200">
          <h3 className="font-semibold text-xs sm:text-sm text-gray-900 mb-1.5">
            Admin-Created (Offline Applicant)
          </h3>
          <div className="space-y-2 text-xs text-gray-700">
            {application.proxyUserEmail && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-gray-500">Proxy User Email:</span>{' '}
                  <span className="font-mono font-medium">{application.proxyUserEmail}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      // 1. Check offlineApplicantContact first (stored directly on application)
                      let contact: any = application.offlineApplicantContact;
                      if (typeof contact === 'string') {
                        try {
                          contact = JSON.parse(contact);
                        } catch (e) {
                          // ignore json parse error
                        }
                      }
                      if (contact && typeof contact === 'object' && contact.email && contact.password) {
                        setCredentials({ email: contact.email, password: contact.password });
                        setShowCredentialsModal(true);
                        return;
                      }

                      // 2. Fetch credentials from database by application_id
                      const { data, error } = await supabase
                        .from('proxy_user_credentials')
                        .select('email, password')
                        .eq('application_id', application.id)
                        .maybeSingle();

                      if (!error && data?.email && data?.password) {
                        setCredentials({ email: data.email, password: data.password });
                        setShowCredentialsModal(true);
                        return;
                      }

                      // 3. Fallback to proxy_user_credentials by user_id
                      if (application.userId) {
                        const { data: userCreds } = await supabase
                          .from('proxy_user_credentials')
                          .select('email, password')
                          .eq('user_id', application.userId)
                          .maybeSingle();

                        if (userCreds?.email && userCreds?.password) {
                          setCredentials({ email: userCreds.email, password: userCreds.password });
                          setShowCredentialsModal(true);
                          return;
                        }
                      }

                      showToast('Credentials not found or you do not have permission to view them', 'error');
                    } catch (error: any) {
                      console.error('Failed to fetch credentials:', error);
                      showToast('Failed to fetch credentials', 'error');
                    }
                  }}
                  className="!text-[10px] sm:!text-xs !px-2"
                >
                  <Eye size={12} className="sm:w-4 sm:h-4 mr-1" />
                  View Credentials
                </Button>
              </div>
            )}
            {application.offlineApplicantContact && typeof application.offlineApplicantContact === 'object' && ((application.offlineApplicantContact as any).phone || (application.offlineApplicantContact as any).contactPerson || (application.offlineApplicantContact as any).notes) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-blue-100">
                {(application.offlineApplicantContact as any).phone && (
                  <div>
                    <span className="text-gray-500">Contact Phone:</span>{' '}
                    <span className="font-medium">{(application.offlineApplicantContact as any).phone}</span>
                  </div>
                )}
                {(application.offlineApplicantContact as any).contactPerson && (
                  <div>
                    <span className="text-gray-500">Contact Person:</span>{' '}
                    <span className="font-medium">{(application.offlineApplicantContact as any).contactPerson}</span>
                  </div>
                )}
                {(application.offlineApplicantContact as any).notes && (
                  <div className="sm:col-span-2">
                    <span className="text-gray-500">Notes:</span>{' '}
                    <span className="font-medium">{(application.offlineApplicantContact as any).notes}</span>
                  </div>
                )}
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

        {!isEditing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs sm:text-sm">
            <div>
              <p className="text-gray-500 font-medium">Type of Divorce</p>
              <p className="font-bold text-gold-800 uppercase mt-1">
                {formatDivorceTypeDisplay(application.divorceType)}
              </p>
            </div>
              { isTripleTalaq(application.divorceType) || application.talaqDate2 || application.talaqDate3 || (application.certificateDetails as any)?.talaqDate2 ? (
              <>
                <div>
                  <p className="text-gray-500 font-medium">Date of 1st Talaq</p>
                  <p className="font-semibold text-gray-900 mt-1">
                    {(application.certificateDetails as any)?.talaqDate1
                      ? safeFormatDate((application.certificateDetails as any).talaqDate1, 'dd-MM-yyyy')
                      : (application.talaqDate1 ? safeFormatDate(application.talaqDate1, 'dd-MM-yyyy') : (application.divorceDate ? safeFormatDate(application.divorceDate, 'dd-MM-yyyy') : 'N/A'))}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 font-medium">Date of 2nd Talaq</p>
                  <p className="font-semibold text-gray-900 mt-1">
                    {(application.certificateDetails as any)?.talaqDate2
                      ? safeFormatDate((application.certificateDetails as any).talaqDate2, 'dd-MM-yyyy')
                      : (application.talaqDate2 ? safeFormatDate(application.talaqDate2, 'dd-MM-yyyy') : (application.divorceDate ? safeFormatDate(application.divorceDate, 'dd-MM-yyyy') : 'N/A'))}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 font-medium">Date of 3rd Talaq</p>
                  <p className="font-semibold text-gray-900 mt-1">
                    {(application.certificateDetails as any)?.talaqDate3
                      ? safeFormatDate((application.certificateDetails as any).talaqDate3, 'dd-MM-yyyy')
                      : (application.talaqDate3 ? safeFormatDate(application.talaqDate3, 'dd-MM-yyyy') : (application.divorceDate ? safeFormatDate(application.divorceDate, 'dd-MM-yyyy') : 'N/A'))}
                  </p>
                </div>
              </>
            ) : (
              <div>
                <p className="text-gray-500 font-medium">Date of Divorce</p>
                <p className="font-semibold text-gray-900 mt-1">
                  {application.divorceDate ? safeFormatDate(application.divorceDate, 'dd-MM-yyyy') : 'N/A'}
                </p>
              </div>
            )}
            {application.marriageCertificateNumber && (
              <div>
                <p className="text-gray-500 font-medium">Marriage Certificate Ref</p>
                <p className="font-mono font-semibold text-gray-900 mt-1">
                  {application.marriageCertificateNumber}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Type of Divorce</label>
                <select
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-lg focus:ring-gold-500 focus:border-gold-500 font-medium"
                  value={editForm.divorceType || 'TALAQ (HUSBAND: REGISTER B)'}
                  onChange={(e) => setEditForm({ ...editForm, divorceType: e.target.value })}
                >
                  <option value="TALAQ (HUSBAND: REGISTER B)">TALAQ (HUSBAND: REGISTER B)</option>
                  <option value="KHULA- TALAQ (MUTUAL: REGISTER C)">KHULA- TALAQ (MUTUAL: REGISTER C)</option>
                  <option value="TALAQ-I-TAFWEEZ (WIFE: REGISTER D)">TALAQ-I-TAFWEEZ (WIFE: REGISTER D)</option>
                  <option value="OTHERS">OTHERS</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Marriage Certificate Ref</label>
                <Input
                  value={editForm.marriageCertificateNumber || ''}
                  onChange={(e) => setEditForm({ ...editForm, marriageCertificateNumber: e.target.value })}
                />
              </div>
            </div>

            {isTripleTalaq(editForm.divorceType) ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-amber-50/70 border border-amber-200 rounded-lg p-3">
                <div className="col-span-full">
                  <span className="font-semibold text-xs text-amber-900">
                    TALAQ (HUSBAND: REGISTER B) - Triple Talaq
                  </span>
                  <p className="text-[11px] text-amber-700">Dates of the 3 pronouncements:</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Date of 1st Talaq *</label>
                  <Input
                    type="date"
                    value={editForm.talaqDate1 || ''}
                    onChange={(e) => setEditForm({ ...editForm, talaqDate1: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Date of 2nd Talaq *</label>
                  <Input
                    type="date"
                    value={editForm.talaqDate2 || ''}
                    onChange={(e) => setEditForm({ ...editForm, talaqDate2: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Date of 3rd Talaq *</label>
                  <Input
                    type="date"
                    value={editForm.talaqDate3 || ''}
                    onChange={(e) => setEditForm({ ...editForm, talaqDate3: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <div className="max-w-xs">
                <label className="text-xs text-gray-500 block mb-1">Date of Divorce *</label>
                <Input
                  type="date"
                  value={editForm.divorceDate || ''}
                  onChange={(e) => setEditForm({ ...editForm, divorceDate: e.target.value })}
                />
              </div>
            )}
          </div>
        )}

        {(!isEditing ? application.divorceReason : true) && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 font-medium mb-1">Divorce Reason / Notes</p>
            {!isEditing ? (
              <p className="text-xs sm:text-sm text-gray-700 bg-gray-50 p-2.5 rounded-lg">
                {application.divorceReason || 'None'}
              </p>
            ) : (
              <textarea
                value={editForm.divorceReason || ''}
                onChange={(e) => setEditForm({ ...editForm, divorceReason: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg"
                placeholder="Optional notes or reasons"
              />
            )}
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

          {!isEditing ? (
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
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Voter EPIC / Roll</span>
                <span className="font-mono font-medium text-gray-900">{husband.voterOrRollNo || 'N/A'}</span>
              </div>

              <div className="pt-2">
                <p className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <MapPin size={12} className="text-gold-600" />
                  Permanent Address
                </p>
                <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-2.5 rounded-lg">
                  VILL: {husbandAddr.villageStreet || 'N/A'}, P.O: {husbandAddr.postOffice || 'N/A'},
                  P.S: {husbandAddr.policeStation || 'N/A'}, DIST: {husbandAddr.district || 'N/A'},
                  {husbandAddr.state || 'WEST BENGAL'}, PIN: {husbandAddr.zipCode || 'N/A'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">First Name</label>
                  <Input
                    value={husband.firstName || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      userDetails: { ...editForm.userDetails, firstName: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Last Name</label>
                  <Input
                    value={husband.lastName || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      userDetails: { ...editForm.userDetails, lastName: e.target.value }
                    })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-0.5">Father's Name</label>
                <Input
                  value={husband.fatherName || ''}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    userDetails: { ...editForm.userDetails, fatherName: e.target.value }
                  })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Date of Birth</label>
                  <Input
                    type="date"
                    value={husband.dateOfBirth ? husband.dateOfBirth.split('T')[0] : ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      userDetails: { ...editForm.userDetails, dateOfBirth: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Mobile Number</label>
                  <Input
                    maxLength={10}
                    value={husband.mobileNumber || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      userDetails: { ...editForm.userDetails, mobileNumber: e.target.value.replace(/\D/g, '').slice(0, 10) }
                    })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Aadhaar Number</label>
                  <Input
                    maxLength={14}
                    value={husband.aadhaarNumber || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      userDetails: { ...editForm.userDetails, aadhaarNumber: handleAadhaarInput(e.target.value) }
                    })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Voter EPIC / Roll</label>
                  <Input
                    value={husband.voterOrRollNo || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      userDetails: { ...editForm.userDetails, voterOrRollNo: e.target.value }
                    })}
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-gray-100 space-y-2">
                <p className="text-xs font-semibold text-gray-700">Permanent Address</p>
                <Input
                  placeholder="Village / Street"
                  value={husbandAddr.villageStreet || ''}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    userAddress: { ...editForm.userAddress, villageStreet: e.target.value }
                  })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Post Office"
                    value={husbandAddr.postOffice || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      userAddress: { ...editForm.userAddress, postOffice: e.target.value }
                    })}
                  />
                  <Input
                    placeholder="Police Station"
                    value={husbandAddr.policeStation || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      userAddress: { ...editForm.userAddress, policeStation: e.target.value }
                    })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="District"
                    value={husbandAddr.district || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      userAddress: { ...editForm.userAddress, district: e.target.value }
                    })}
                  />
                  <Input
                    placeholder="State"
                    value={husbandAddr.state || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      userAddress: { ...editForm.userAddress, state: e.target.value }
                    })}
                  />
                  <Input
                    placeholder="PIN Code"
                    maxLength={6}
                    value={husbandAddr.zipCode || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      userAddress: { ...editForm.userAddress, zipCode: e.target.value.replace(/\D/g, '').slice(0, 6) }
                    })}
                  />
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Wife Details */}
        <Card className="p-4 sm:p-6">
          <h2 className="text-base font-semibold text-gray-900 pb-3 mb-4 border-b border-gray-100 flex items-center gap-2">
            <Users size={18} className="text-gold-600" />
            Details of Wife
          </h2>

          {!isEditing ? (
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
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Voter EPIC / Roll</span>
                <span className="font-mono font-medium text-gray-900">{wife.voterOrRollNo || 'N/A'}</span>
              </div>

              <div className="pt-2">
                <p className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <MapPin size={12} className="text-gold-600" />
                  Permanent Address
                </p>
                <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-2.5 rounded-lg">
                  VILL: {wifeAddr.villageStreet || 'N/A'}, P.O: {wifeAddr.postOffice || 'N/A'},
                  P.S: {wifeAddr.policeStation || 'N/A'}, DIST: {wifeAddr.district || 'N/A'},
                  {wifeAddr.state || 'WEST BENGAL'}, PIN: {wifeAddr.zipCode || 'N/A'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">First Name</label>
                  <Input
                    value={wife.firstName || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      partnerForm: { ...editForm.partnerForm, firstName: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Last Name</label>
                  <Input
                    value={wife.lastName || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      partnerForm: { ...editForm.partnerForm, lastName: e.target.value }
                    })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-0.5">Father's Name</label>
                <Input
                  value={wife.fatherName || ''}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    partnerForm: { ...editForm.partnerForm, fatherName: e.target.value }
                  })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Date of Birth</label>
                  <Input
                    type="date"
                    value={wife.dateOfBirth ? wife.dateOfBirth.split('T')[0] : ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      partnerForm: { ...editForm.partnerForm, dateOfBirth: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Mobile Number</label>
                  <Input
                    maxLength={10}
                    value={wife.mobileNumber || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      partnerForm: { ...editForm.partnerForm, mobileNumber: e.target.value.replace(/\D/g, '').slice(0, 10) }
                    })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Aadhaar Number</label>
                  <Input
                    maxLength={14}
                    value={wife.aadhaarNumber || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      partnerForm: { ...editForm.partnerForm, aadhaarNumber: handleAadhaarInput(e.target.value) }
                    })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Voter EPIC / Roll</label>
                  <Input
                    value={wife.voterOrRollNo || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      partnerForm: { ...editForm.partnerForm, voterOrRollNo: e.target.value }
                    })}
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-gray-100 space-y-2">
                <p className="text-xs font-semibold text-gray-700">Permanent Address</p>
                <Input
                  placeholder="Village / Street"
                  value={wifeAddr.villageStreet || ''}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    partnerAddress: { ...editForm.partnerAddress, villageStreet: e.target.value }
                  })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Post Office"
                    value={wifeAddr.postOffice || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      partnerAddress: { ...editForm.partnerAddress, postOffice: e.target.value }
                    })}
                  />
                  <Input
                    placeholder="Police Station"
                    value={wifeAddr.policeStation || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      partnerAddress: { ...editForm.partnerAddress, policeStation: e.target.value }
                    })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="District"
                    value={wifeAddr.district || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      partnerAddress: { ...editForm.partnerAddress, district: e.target.value }
                    })}
                  />
                  <Input
                    placeholder="State"
                    value={wifeAddr.state || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      partnerAddress: { ...editForm.partnerAddress, state: e.target.value }
                    })}
                  />
                  <Input
                    placeholder="PIN Code"
                    maxLength={6}
                    value={wifeAddr.zipCode || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      partnerAddress: { ...editForm.partnerAddress, zipCode: e.target.value.replace(/\D/g, '').slice(0, 6) }
                    })}
                  />
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Uploaded Documents Card */}
      <Card className="p-4 sm:p-6">
        <h2 className="text-base font-semibold text-gray-900 pb-3 mb-4 border-b border-gray-100 flex items-center gap-2">
          <FileText size={18} className="text-gold-600" />
          Uploaded Documents
        </h2>

        <div className="space-y-4">
          {/* Husband Documents */}
          <div>
            <p className="text-xs sm:text-sm font-semibold text-gray-800 mb-2">Husband's Documents</p>
            <div className="space-y-2">
              {documents
                .filter((d) => d.belongsTo === 'user')
                .map((doc) => (
                  <div
                    key={doc.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 sm:p-3 rounded-lg ${doc.isReuploaded ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                      }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText size={16} className="text-gold-600 flex-shrink-0" />
                      <div className="truncate">
                        <span className="font-semibold text-xs text-gray-900">{getDocumentTypeLabel(doc.type)}:</span>{' '}
                        <span className="text-xs text-gray-600">{doc.name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Badge
                        variant={doc.status === 'approved' ? 'success' : doc.status === 'rejected' ? 'error' : 'default'}
                        className="!text-[10px]"
                      >
                        {doc.status}
                      </Badge>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="!p-1.5 text-gray-600 hover:text-gray-900"
                        title="View Preview"
                        onClick={async () => {
                          setPreviewDocument(doc);
                          setIsLoadingPreview(true);
                          setPreviewUrl(null);
                          try {
                            const signedUrl = await documentService.getDivorceSignedUrl(doc.id);
                            setPreviewUrl(signedUrl);
                          } catch (err) {
                            setPreviewUrl(doc.url);
                          } finally {
                            setIsLoadingPreview(false);
                          }
                        }}
                      >
                        <Eye size={14} />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="!p-1.5 text-gray-600 hover:text-gray-900"
                        title="Download Document"
                        onClick={async () => {
                          const target = doc.url;
                          if (target) await downloadFileFromUrl(target, doc.name);
                        }}
                      >
                        <Download size={14} />
                      </Button>

                      <input
                        type="file"
                        accept={doc.type === 'photo' ? 'image/*' : 'image/*,.pdf'}
                        onChange={(e) => handleReuploadFileSelect(doc.id, e)}
                        className="hidden"
                        id={`reupload-husband-${doc.id}`}
                        ref={(el) => {
                          if (el) reuploadFileInputsRef.current.set(doc.id, el);
                          else reuploadFileInputsRef.current.delete(doc.id);
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="!p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        title="Re-upload"
                        onClick={() => reuploadFileInputsRef.current.get(doc.id)?.click()}
                        disabled={reuploadingDoc === doc.id}
                      >
                        {reuploadingDoc === doc.id ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-blue-600" />
                        ) : (
                          <Upload size={14} />
                        )}
                      </Button>

                      {doc.status === 'pending' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="!p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            title="Approve"
                            onClick={() => handleApproveDocument(doc.id)}
                            disabled={isProcessingDoc === doc.id}
                          >
                            <CheckCircle size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="!p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            title="Reject"
                            onClick={() => handleRejectDocument(doc)}
                            disabled={isProcessingDoc === doc.id}
                          >
                            <XCircle size={14} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              {documents.filter((d) => d.belongsTo === 'user').length === 0 && (
                <p className="text-xs text-gray-400 italic">No husband documents uploaded</p>
              )}
            </div>
          </div>

          {/* Wife Documents */}
          <div>
            <p className="text-xs sm:text-sm font-semibold text-gray-800 mb-2">Wife's Documents</p>
            <div className="space-y-2">
              {documents
                .filter((d) => d.belongsTo === 'partner')
                .map((doc) => (
                  <div
                    key={doc.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 sm:p-3 rounded-lg ${doc.isReuploaded ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                      }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText size={16} className="text-gold-600 flex-shrink-0" />
                      <div className="truncate">
                        <span className="font-semibold text-xs text-gray-900">{getDocumentTypeLabel(doc.type)}:</span>{' '}
                        <span className="text-xs text-gray-600">{doc.name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Badge
                        variant={doc.status === 'approved' ? 'success' : doc.status === 'rejected' ? 'error' : 'default'}
                        className="!text-[10px]"
                      >
                        {doc.status}
                      </Badge>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="!p-1.5 text-gray-600 hover:text-gray-900"
                        title="View Preview"
                        onClick={async () => {
                          setPreviewDocument(doc);
                          setIsLoadingPreview(true);
                          setPreviewUrl(null);
                          try {
                            const signedUrl = await documentService.getDivorceSignedUrl(doc.id);
                            setPreviewUrl(signedUrl);
                          } catch (err) {
                            setPreviewUrl(doc.url);
                          } finally {
                            setIsLoadingPreview(false);
                          }
                        }}
                      >
                        <Eye size={14} />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="!p-1.5 text-gray-600 hover:text-gray-900"
                        title="Download Document"
                        onClick={async () => {
                          const target = doc.url;
                          if (target) await downloadFileFromUrl(target, doc.name);
                        }}
                      >
                        <Download size={14} />
                      </Button>

                      <input
                        type="file"
                        accept={doc.type === 'photo' ? 'image/*' : 'image/*,.pdf'}
                        onChange={(e) => handleReuploadFileSelect(doc.id, e)}
                        className="hidden"
                        id={`reupload-wife-${doc.id}`}
                        ref={(el) => {
                          if (el) reuploadFileInputsRef.current.set(doc.id, el);
                          else reuploadFileInputsRef.current.delete(doc.id);
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="!p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        title="Re-upload"
                        onClick={() => reuploadFileInputsRef.current.get(doc.id)?.click()}
                        disabled={reuploadingDoc === doc.id}
                      >
                        {reuploadingDoc === doc.id ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-blue-600" />
                        ) : (
                          <Upload size={14} />
                        )}
                      </Button>

                      {doc.status === 'pending' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="!p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            title="Approve"
                            onClick={() => handleApproveDocument(doc.id)}
                            disabled={isProcessingDoc === doc.id}
                          >
                            <CheckCircle size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="!p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            title="Reject"
                            onClick={() => handleRejectDocument(doc)}
                            disabled={isProcessingDoc === doc.id}
                          >
                            <XCircle size={14} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              {documents.filter((d) => d.belongsTo === 'partner').length === 0 && (
                <p className="text-xs text-gray-400 italic">No wife documents uploaded</p>
              )}
            </div>
          </div>

          {/* Joint / Marriage Documents */}
          <div>
            <p className="text-xs sm:text-sm font-semibold text-gray-800 mb-2">Joint / Marriage Documents</p>
            <div className="space-y-2">
              {documents
                .filter((d) => d.belongsTo === 'joint')
                .map((doc) => (
                  <div
                    key={doc.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 sm:p-3 rounded-lg ${doc.isReuploaded ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                      }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText size={16} className="text-gold-600 flex-shrink-0" />
                      <div className="truncate">
                        <span className="font-semibold text-xs text-gray-900">{getDocumentTypeLabel(doc.type)}:</span>{' '}
                        <span className="text-xs text-gray-600">{doc.name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Badge
                        variant={doc.status === 'approved' ? 'success' : doc.status === 'rejected' ? 'error' : 'default'}
                        className="!text-[10px]"
                      >
                        {doc.status}
                      </Badge>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="!p-1.5 text-gray-600 hover:text-gray-900"
                        title="View Preview"
                        onClick={async () => {
                          setPreviewDocument(doc);
                          setIsLoadingPreview(true);
                          setPreviewUrl(null);
                          try {
                            const signedUrl = await documentService.getDivorceSignedUrl(doc.id);
                            setPreviewUrl(signedUrl);
                          } catch (err) {
                            setPreviewUrl(doc.url);
                          } finally {
                            setIsLoadingPreview(false);
                          }
                        }}
                      >
                        <Eye size={14} />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="!p-1.5 text-gray-600 hover:text-gray-900"
                        title="Download Document"
                        onClick={async () => {
                          const target = doc.url;
                          if (target) await downloadFileFromUrl(target, doc.name);
                        }}
                      >
                        <Download size={14} />
                      </Button>

                      <input
                        type="file"
                        accept={doc.type === 'photo' ? 'image/*' : 'image/*,.pdf'}
                        onChange={(e) => handleReuploadFileSelect(doc.id, e)}
                        className="hidden"
                        id={`reupload-joint-${doc.id}`}
                        ref={(el) => {
                          if (el) reuploadFileInputsRef.current.set(doc.id, el);
                          else reuploadFileInputsRef.current.delete(doc.id);
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="!p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        title="Re-upload"
                        onClick={() => reuploadFileInputsRef.current.get(doc.id)?.click()}
                        disabled={reuploadingDoc === doc.id}
                      >
                        {reuploadingDoc === doc.id ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-blue-600" />
                        ) : (
                          <Upload size={14} />
                        )}
                      </Button>

                      {doc.status === 'pending' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="!p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            title="Approve"
                            onClick={() => handleApproveDocument(doc.id)}
                            disabled={isProcessingDoc === doc.id}
                          >
                            <CheckCircle size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="!p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            title="Reject"
                            onClick={() => handleRejectDocument(doc)}
                            disabled={isProcessingDoc === doc.id}
                          >
                            <XCircle size={14} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              {documents.filter((d) => d.belongsTo === 'joint').length === 0 && (
                <p className="text-xs text-gray-400 italic">No joint/marriage certificates uploaded</p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Declarations */}
      {declarations && (
        <Card className="p-4 sm:p-6">
          <h2 className="text-base font-semibold text-gray-900 pb-3 mb-4 border-b border-gray-100">
            Declarations
          </h2>
          <div className="space-y-2 text-xs sm:text-sm text-gray-700">
            <div className="flex items-start gap-2">
              <CheckCircle size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
              <span>Applicant confirmed accuracy of all divorce registration details.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
              <span>Divorce is declared legally valid in accordance with Islamic jurisprudence.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
              <span>Acknowledged provisions of Bengal Muhammadan Marriages & Divorces Registration Act 1876.</span>
            </div>
          </div>
        </Card>
      )}

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
        talaqDate1={(application.certificateDetails as any)?.talaqDate1 || application.talaqDate1 || (application.declarations as any)?.talaqDate1}
        talaqDate2={(application.certificateDetails as any)?.talaqDate2 || application.talaqDate2 || (application.declarations as any)?.talaqDate2}
        talaqDate3={(application.certificateDetails as any)?.talaqDate3 || application.talaqDate3 || (application.declarations as any)?.talaqDate3}
      />

      {/* Reject Document Modal */}
      {selectedDocument && (
        <RejectDocumentModal
          isOpen={rejectModalOpen}
          onClose={() => {
            setRejectModalOpen(false);
            setSelectedDocument(null);
          }}
          onConfirm={handleConfirmReject}
          documentName={selectedDocument.name}
          documentType={selectedDocument.type}
        />
      )}

      {/* Image Crop Modal */}
      <ImageCropModal
        isOpen={cropModalOpen}
        onClose={() => {
          setCropModalOpen(false);
          setPendingCropFile(null);
        }}
        imageFile={pendingCropFile?.file || null}
        onCropComplete={handleCropComplete}
        onSkip={handleCropSkip}
      />

      {/* Document Preview Modal */}
      {previewDocument && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => {
            setPreviewDocument(null);
            setPreviewUrl(null);
          }}
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-4xl my-auto bg-white rounded-xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={18} className="text-gold-600 flex-shrink-0" />
                <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate">
                  {getDocumentTypeLabel(previewDocument.type)} - {previewDocument.name}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {previewUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="!p-1.5 sm:!px-3 sm:!py-1.5 text-xs"
                    onClick={async () => {
                      await downloadFileFromUrl(previewUrl, previewDocument.name);
                    }}
                  >
                    <Download size={14} className="sm:mr-1.5" />
                    <span className="hidden sm:inline">Download</span>
                  </Button>
                )}
                <button
                  onClick={() => {
                    setPreviewDocument(null);
                    setPreviewUrl(null);
                  }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="p-3 sm:p-6 overflow-y-auto flex-1 flex items-center justify-center bg-gray-100">
              {isLoadingPreview ? (
                <div className="py-12 text-center text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold-600 mx-auto mb-2"></div>
                  Loading preview...
                </div>
              ) : previewUrl ? (
                isImage(previewDocument.mimeType) ? (
                  <img
                    src={previewUrl}
                    alt={previewDocument.name}
                    className="max-w-full max-h-[70vh] object-contain rounded shadow"
                  />
                ) : isPDF(previewDocument.mimeType) ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[70vh] rounded border border-gray-300"
                    title={previewDocument.name}
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt={previewDocument.name}
                    className="max-w-full max-h-[70vh] object-contain rounded shadow"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )
              ) : (
                <p className="text-gray-500">Failed to load preview</p>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Credentials Modal */}
      {showCredentialsModal && credentials && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setShowCredentialsModal(false)}
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-md sm:max-w-lg my-auto bg-white rounded-xl sm:rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
              <h2 className="font-serif text-base sm:text-lg font-semibold text-gray-900">
                Application Credentials
              </h2>
              <button
                onClick={() => {
                  setShowCredentialsModal(false);
                  setCredentials(null);
                }}
                className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close modal"
              >
                <X size={18} className="sm:w-5 sm:h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <p className="text-center text-gray-600 text-xs sm:text-sm mb-4">
                Please copy these credentials securely and share them with the applicant.
              </p>
              <Card className="p-4 sm:p-5 mb-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] sm:text-xs text-gray-500 mb-1 block">Email</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-50 rounded text-[10px] sm:text-xs font-mono text-gray-900 break-all">
                        {credentials.email}
                      </code>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(credentials.email);
                            setCopiedField('email');
                            showToast('Email copied to clipboard', 'success');
                            setTimeout(() => setCopiedField(null), 2000);
                          } catch (error) {
                            showToast('Failed to copy email', 'error');
                          }
                        }}
                        className="p-1.5 sm:p-2 text-gray-600 hover:text-gold-600 hover:bg-gold-50 rounded transition-colors"
                        title="Copy Email"
                      >
                        {copiedField === 'email' ? (
                          <Check size={14} className="sm:w-4 sm:h-4 text-green-600" />
                        ) : (
                          <Copy size={14} className="sm:w-4 sm:h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] sm:text-xs text-gray-500 mb-1 block">Password</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-50 rounded text-[10px] sm:text-xs font-mono text-gray-900 break-all">
                        {credentials.password}
                      </code>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(credentials.password);
                            setCopiedField('password');
                            showToast('Password copied to clipboard', 'success');
                            setTimeout(() => setCopiedField(null), 2000);
                          } catch (error) {
                            showToast('Failed to copy password', 'error');
                          }
                        }}
                        className="p-1.5 sm:p-2 text-gray-600 hover:text-gold-600 hover:bg-gold-50 rounded transition-colors"
                        title="Copy Password"
                      >
                        {copiedField === 'password' ? (
                          <Check size={14} className="sm:w-4 sm:h-4 text-green-600" />
                        ) : (
                          <Copy size={14} className="sm:w-4 sm:h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setShowCredentialsModal(false);
                    setCredentials(null);
                  }}
                  className="w-full sm:w-auto"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DivorceApplicationDetailsPage;
