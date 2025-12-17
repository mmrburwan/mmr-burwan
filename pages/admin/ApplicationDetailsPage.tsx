import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { applicationService } from '../../services/application';
import { documentService } from '../../services/documents';
import { adminService } from '../../services/admin';
import { supabase } from '../../lib/supabase';
import { Application, Document } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import VerifyApplicationModal from '../../components/admin/VerifyApplicationModal';
import RejectDocumentModal from '../../components/admin/RejectDocumentModal';
import { ArrowLeft, FileText, CheckCircle, X, Eye, Edit2, Save, XCircle, Download, Copy, Check, Upload } from 'lucide-react';
import { safeFormatDate } from '../../utils/dateUtils';
import ImageCropModal from '../../components/ui/ImageCropModal';

const ApplicationDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useNotification();
  const { applicationId } = useParams<{ applicationId: string }>();
  const [application, setApplication] = useState<Application | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isProcessingDoc, setIsProcessingDoc] = useState<string | null>(null);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [reuploadingDoc, setReuploadingDoc] = useState<string | null>(null);
  const reuploadFileInputsRef = React.useRef<Map<string, HTMLInputElement>>(new Map());
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [pendingCropFile, setPendingCropFile] = useState<{ file: File; documentId: string } | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState<any>({});

  // Check if current admin created this application
  const isAdminCreatedApplication = user?.role === 'admin' && application?.isProxyApplication === true && application?.createdByAdminId === user?.id;

  useEffect(() => {
    const loadData = async () => {
      if (!applicationId) return;

      try {
        const allApplications = await applicationService.getAllApplications();
        const app = allApplications.find(a => a.id === applicationId);

        if (app) {
          setApplication(app);
          const docs = await documentService.getDocuments(app.id);
          setDocuments(docs);

          // Initialize edit form
          setEditForm({
            userDetails: app.userDetails || {},
            partnerForm: app.partnerForm || {},
            userAddress: app.userAddress || {},
            userCurrentAddress: app.userCurrentAddress || {},
            partnerAddress: app.partnerAddress || {},
            partnerCurrentAddress: app.partnerCurrentAddress || {},
            declarations: app.declarations || {},
          });

          // Note: User email will be fetched in the admin service when needed
          // For now, we'll pass undefined and let the service handle it
          // The modal will work without email (just won't show email option)
        }
      } catch (error) {
        console.error('Failed to load application details:', error);
        showToast('Failed to load application details', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [applicationId, showToast]);

  const handleApproveDocument = async (documentId: string) => {
    if (!user) return;

    setIsProcessingDoc(documentId);
    try {
      await adminService.approveDocument(documentId, user.id, user.name || user.email);
      const updated = await documentService.getDocuments(application!.id);
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

  const handleReuploadDocument = async (documentId: string, file: File) => {
    if (!application) return;

    setReuploadingDoc(documentId);
    try {
      // Use uploadDocument which will update existing document if it exists
      await documentService.uploadDocument(application.id, file,
        documents.find(d => d.id === documentId)?.type || 'aadhaar',
        documents.find(d => d.id === documentId)?.belongsTo || 'user'
      );

      // Refresh documents list
      const updated = await documentService.getDocuments(application.id);
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
      // Check file size (250KB limit)
      const MAX_FILE_SIZE = 250 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        showToast('File too large. Please compress or resize the file before uploading.', 'error');
        event.target.value = '';
        return;
      }

      // Check if this is a joint photo
      const doc = documents.find(d => d.id === documentId);
      if (doc && doc.type === 'photo' && doc.belongsTo === 'joint') {
        setPendingCropFile({ file, documentId });
        setCropModalOpen(true);
        event.target.value = '';
        return;
      }

      handleReuploadDocument(documentId, file);
    }
    // Reset input
    event.target.value = '';
  };

  const handleCropComplete = async (croppedFile: File) => {
    if (!pendingCropFile) return;

    // Check file size again after cropping
    const MAX_FILE_SIZE = 250 * 1024;
    if (croppedFile.size > MAX_FILE_SIZE) {
      showToast('Cropped file too large. Please try again with a smaller image.', 'error');
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

  const handleConfirmReject = async (reason: string, sendEmail: boolean) => {
    if (!user || !selectedDocument) return;

    setIsProcessingDoc(selectedDocument.id);
    try {
      await adminService.rejectDocument(
        selectedDocument.id,
        reason,
        user.id,
        user.name || user.email,
        sendEmail,
        userEmail
      );
      const updated = await documentService.getDocuments(application!.id);
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

  const handleSaveEdit = async () => {
    if (!application || !user) return;

    try {
      const updated = await adminService.updateApplication(
        application.id,
        editForm,
        user.id,
        user.name || user.email
      );
      setApplication(updated);
      setIsEditing(false);
      showToast('Application updated successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to update application', 'error');
    }
  };

  const handleCancelEdit = () => {
    if (application) {
      setEditForm({
        userDetails: application.userDetails || {},
        partnerForm: application.partnerForm || {},
        userAddress: application.userAddress || {},
        userCurrentAddress: application.userCurrentAddress || {},
        partnerAddress: application.partnerAddress || {},
        partnerCurrentAddress: application.partnerCurrentAddress || {},
        declarations: application.declarations || {},
      });
    }
    setIsEditing(false);
  };

  const handleVerify = async (certificateNumber: string, registrationDate: string, registrarName: string) => {
    if (!application || !user) return;

    try {
      const updated = await adminService.verifyApplication(
        application.id,
        user.id,
        user.name || user.email,
        certificateNumber,
        registrationDate,
        registrarName
      );
      setApplication(updated);
      showToast('Application verified successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to verify application', 'error');
      throw error;
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      aadhaar: 'Aadhaar Card',
      tenth_certificate: '10th Certificate',
      voter_id: 'Voter ID',
      id: 'ID Document',
      photo: 'Photo',
      certificate: 'Certificate',
      other: 'Other',
    };
    return labels[type] || type;
  };

  // Check if a document was re-uploaded (based on database flag)
  const isReuploaded = (doc: Document): boolean => {
    // Only show re-uploaded badge for pending documents that have been re-uploaded
    return doc.status === 'pending' && doc.isReuploaded === true;
  };

  const isImage = (mimeType: string) => {
    return mimeType?.startsWith('image/');
  };

  const isPDF = (mimeType: string) => {
    return mimeType === 'application/pdf';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold-500"></div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Card className="p-8 text-center">
          <p className="text-gray-500">Application not found</p>
          <Button variant="ghost" onClick={() => navigate('/admin')} className="mt-4">
            <ArrowLeft size={18} className="mr-2" />
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const userDetails = isEditing ? editForm.userDetails : (application.userDetails as any) || {};
  const partnerForm = isEditing ? editForm.partnerForm : (application.partnerForm || {});
  const userAddress = isEditing ? editForm.userAddress : (application.userAddress || application.address || {});
  const userCurrentAddress = isEditing ? editForm.userCurrentAddress : (application.userCurrentAddress || (application as any).currentAddress || {});
  const partnerAddress = isEditing ? editForm.partnerAddress : (application.partnerAddress || partnerForm.address || {});
  const partnerCurrentAddress = isEditing ? editForm.partnerCurrentAddress : (application.partnerCurrentAddress || {});
  const declarations = isEditing ? editForm.declarations : (application.declarations || {});

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/admin')}
          className="mb-2 sm:mb-3 lg:mb-4 !text-xs sm:!text-sm !px-2 sm:!px-3"
          size="sm"
        >
          <ArrowLeft size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          Back to Dashboard
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
              <h1 className="font-serif text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-900">Application Details</h1>
              {application.isProxyApplication && (
                <Badge variant="info" className="!text-[10px] sm:!text-xs">
                  Admin-Created
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-600 truncate">Application ID: {application.id}</p>
            {application.isProxyApplication && application.proxyUserEmail && (
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">Proxy User: {application.proxyUserEmail}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {!isEditing ? (
              <Button variant="outline" onClick={() => setIsEditing(true)} size="sm" className="!text-xs sm:!text-sm !px-2 sm:!px-3">
                <Edit2 size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Edit Application</span>
                <span className="sm:hidden">Edit</span>
              </Button>
            ) : (
              <div className="flex gap-1.5 sm:gap-2">
                <Button variant="primary" onClick={handleSaveEdit} size="sm" className="!text-xs sm:!text-sm !px-2 sm:!px-3">
                  <Save size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Save Changes</span>
                  <span className="sm:hidden">Save</span>
                </Button>
                <Button variant="outline" onClick={handleCancelEdit} size="sm" className="!text-xs sm:!text-sm !px-2 sm:!px-3">
                  <X size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Cancel
                </Button>
              </div>
            )}
            <Badge variant={application.status === 'submitted' ? 'info' : application.status === 'approved' ? 'success' : 'default'} className="!text-[10px] sm:!text-xs">
              {application.status}
            </Badge>
            {application.verified !== undefined && (
              <Badge variant={application.verified ? 'success' : 'default'} className="!text-[10px] sm:!text-xs">
                {application.verified ? 'Verified' : 'Unverified'}
              </Badge>
            )}
            {!application.verified && (() => {
              // Check for rejected documents that haven't been re-uploaded
              const rejectedDocuments = documents.filter(
                (doc) => doc.status === 'rejected' && !doc.isReuploaded
              );
              const hasRejectedDocuments = rejectedDocuments.length > 0;

              return (
                <Button
                  variant="primary"
                  onClick={() => {
                    if (hasRejectedDocuments) {
                      const docNames = rejectedDocuments.map(doc => {
                        const getPersonLabel = (belongsTo?: string) => {
                          if (!belongsTo) return '';
                          switch (belongsTo) {
                            case 'user': return 'Groom\'s';
                            case 'partner': return 'Bride\'s';
                            case 'joint': return 'Joint';
                            default: return '';
                          }
                        };
                        const getDocumentTypeLabel = (type: string) => {
                          const labels: Record<string, string> = {
                            aadhaar: 'Aadhaar Card',
                            tenth_certificate: '10th Certificate',
                            voter_id: 'Voter ID',
                            id: 'ID Document',
                            photo: 'Photo',
                            certificate: 'Certificate',
                            other: 'Other',
                          };
                          return labels[type] || type;
                        };
                        const personLabel = getPersonLabel(doc.belongsTo);
                        const docLabel = getDocumentTypeLabel(doc.type);
                        return personLabel ? `${personLabel} ${docLabel}` : docLabel;
                      }).join(', ');
                      showToast(
                        `Cannot verify application. The following document(s) have been rejected and not re-uploaded: ${docNames}`,
                        'error'
                      );
                    } else {
                      setIsVerifyModalOpen(true);
                    }
                  }}
                  size="sm"
                  className="!text-xs sm:!text-sm !px-2 sm:!px-3"
                >
                  <CheckCircle size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Verify Application</span>
                  <span className="sm:hidden">Verify</span>
                </Button>
              );
            })()}
            {application.verified && application.certificateNumber && (
              <div className="text-[10px] sm:text-xs lg:text-sm text-gray-600">
                <p className="truncate">Certificate: {application.certificateNumber}</p>
                {application.registrationDate && (
                  <p>Reg. Date: {safeFormatDate(application.registrationDate, 'MMM d, yyyy')}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3 sm:space-y-4 lg:space-y-6">
        {/* Proxy Application Info */}
        {application.isProxyApplication && (
          <Card className="p-3 sm:p-4 lg:p-6 bg-blue-50 border-blue-200">
            <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-2 sm:mb-3">Admin-Created Application</h3>
            <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
              {application.offlineApplicantContact && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {application.offlineApplicantContact.phone && (
                    <div>
                      <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Contact Phone</p>
                      <p className="font-medium text-gray-900">{application.offlineApplicantContact.phone}</p>
                    </div>
                  )}
                  {application.offlineApplicantContact.address && (
                    <div>
                      <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Contact Address</p>
                      <p className="font-medium text-gray-900">{application.offlineApplicantContact.address}</p>
                    </div>
                  )}
                  {application.offlineApplicantContact.contactPerson && (
                    <div>
                      <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Contact Person</p>
                      <p className="font-medium text-gray-900">{application.offlineApplicantContact.contactPerson}</p>
                    </div>
                  )}
                  {application.offlineApplicantContact.notes && (
                    <div className="sm:col-span-2">
                      <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Notes</p>
                      <p className="font-medium text-gray-900">{application.offlineApplicantContact.notes}</p>
                    </div>
                  )}
                </div>
              )}
              {application.proxyUserEmail && (
                <div className="pt-2 border-t border-blue-200">
                  <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Proxy User Account</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 bg-white rounded text-[10px] sm:text-xs font-mono text-gray-900 break-all">
                      {application.proxyUserEmail}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          // Fetch credentials from database - RLS policy allows admins to view
                          const { data, error } = await supabase
                            .from('proxy_user_credentials')
                            .select('email, password')
                            .eq('application_id', application.id)
                            .single();

                          if (error || !data) {
                            console.error('Credentials fetch error:', error);
                            showToast('Credentials not found or you do not have permission to view them', 'error');
                            return;
                          }

                          // Show credentials in modal
                          setCredentials({ email: data.email, password: data.password });
                          setShowCredentialsModal(true);
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
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Groom Personal Details */}
        <Card className="p-3 sm:p-4 lg:p-6">
          <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-2 sm:mb-3 lg:mb-4">Groom [পাত্র] Personal Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 lg:gap-4 text-xs sm:text-sm">
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Full Name</p>
              {isEditing ? (
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  <Input
                    value={userDetails.firstName || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      userDetails: { ...userDetails, firstName: e.target.value }
                    })}
                    placeholder="First Name"
                  />
                  <Input
                    value={userDetails.lastName || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      userDetails: { ...userDetails, lastName: e.target.value }
                    })}
                    placeholder="Last Name"
                  />
                </div>
              ) : (
                <p className="font-medium text-xs sm:text-sm text-gray-900 truncate">
                  {userDetails.firstName || '-'} {userDetails.lastName || ''}
                </p>
              )}
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Father's Name</p>
              {isEditing ? (
                <Input
                  value={userDetails.fatherName || ''}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    userDetails: { ...userDetails, fatherName: e.target.value }
                  })}
                  placeholder="Father's Name"
                />
              ) : (
                <p className="font-medium text-xs sm:text-sm text-gray-900 truncate">
                  {userDetails.fatherName || '-'}
                </p>
              )}
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Date of Birth</p>
              {isEditing ? (
                <Input
                  type="date"
                  value={userDetails.dateOfBirth ? userDetails.dateOfBirth.split('T')[0] : ''}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    userDetails: { ...userDetails, dateOfBirth: e.target.value }
                  })}
                />
              ) : (
                <p className="font-medium text-gray-900">
                  {userDetails.dateOfBirth ? safeFormatDate(userDetails.dateOfBirth, 'MMMM d, yyyy') : '-'}
                </p>
              )}
            </div>
            <div>
              <p className="text-gray-500 mb-1">Aadhaar Number</p>
              {isEditing ? (
                <Input
                  value={userDetails.aadhaarNumber || ''}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    userDetails: { ...userDetails, aadhaarNumber: e.target.value }
                  })}
                  placeholder="Aadhaar Number"
                />
              ) : (
                <p className="font-medium text-gray-900">{userDetails.aadhaarNumber || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-gray-500 mb-1">Mobile Number</p>
              {isEditing ? (
                <Input
                  value={userDetails.mobileNumber || ''}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    userDetails: { ...userDetails, mobileNumber: e.target.value }
                  })}
                  placeholder="Mobile Number"
                />
              ) : (
                <p className="font-medium text-gray-900">{userDetails.mobileNumber || '-'}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Groom Addresses */}
        <Card className="p-3 sm:p-4 lg:p-6">
          <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-2 sm:mb-3 lg:mb-4">Groom Addresses</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Groom [পাত্র] Present Address</p>
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Village/Street</label>
                    <Input
                      value={(userCurrentAddress as any).villageStreet || userCurrentAddress.street || ''}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        userCurrentAddress: { ...userCurrentAddress, villageStreet: e.target.value, street: e.target.value }
                      })}
                      placeholder="Enter village/street"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Post Office</label>
                      <Input
                        value={(userCurrentAddress as any).postOffice || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          userCurrentAddress: { ...userCurrentAddress, postOffice: e.target.value }
                        })}
                        placeholder="Enter post office"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Police Station</label>
                      <Input
                        value={(userCurrentAddress as any).policeStation || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          userCurrentAddress: { ...userCurrentAddress, policeStation: e.target.value }
                        })}
                        placeholder="Enter police station"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">District</label>
                      <Input
                        value={(userCurrentAddress as any).district || userCurrentAddress.city || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          userCurrentAddress: { ...userCurrentAddress, district: e.target.value, city: e.target.value }
                        })}
                        placeholder="Enter district"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                      <Input
                        value={userCurrentAddress.state || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          userCurrentAddress: { ...userCurrentAddress, state: e.target.value }
                        })}
                        placeholder="Enter state"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">PIN Code</label>
                      <Input
                        value={userCurrentAddress.zipCode || ''}
                        maxLength={6}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setEditForm({
                            ...editForm,
                            userCurrentAddress: { ...userCurrentAddress, zipCode: value }
                          });
                        }}
                        placeholder="Enter PIN code"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
                      <Input
                        value={userCurrentAddress.country || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          userCurrentAddress: { ...userCurrentAddress, country: e.target.value }
                        })}
                        placeholder="Enter country"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600 space-y-1">
                  <p>{(userCurrentAddress as any).villageStreet || userCurrentAddress.street || '-'}</p>
                  <p>P.O: {(userCurrentAddress as any).postOffice || '-'}, P.S: {(userCurrentAddress as any).policeStation || '-'}</p>
                  <p>Dist: {(userCurrentAddress as any).district || userCurrentAddress.city || '-'}, {userCurrentAddress.state || '-'}</p>
                  <p>PIN: {userCurrentAddress.zipCode || '-'}, {userCurrentAddress.country || '-'}</p>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Groom [পাত্র] Permanent Address</p>
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Village/Street</label>
                    <Input
                      value={(userAddress as any).villageStreet || userAddress.street || ''}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        userAddress: { ...userAddress, villageStreet: e.target.value, street: e.target.value }
                      })}
                      placeholder="Enter village/street"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Post Office</label>
                      <Input
                        value={(userAddress as any).postOffice || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          userAddress: { ...userAddress, postOffice: e.target.value }
                        })}
                        placeholder="Enter post office"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Police Station</label>
                      <Input
                        value={(userAddress as any).policeStation || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          userAddress: { ...userAddress, policeStation: e.target.value }
                        })}
                        placeholder="Enter police station"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">District</label>
                      <Input
                        value={(userAddress as any).district || userAddress.city || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          userAddress: { ...userAddress, district: e.target.value, city: e.target.value }
                        })}
                        placeholder="Enter district"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                      <Input
                        value={userAddress.state || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          userAddress: { ...userAddress, state: e.target.value }
                        })}
                        placeholder="Enter state"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">PIN Code</label>
                      <Input
                        value={userAddress.zipCode || ''}
                        maxLength={6}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setEditForm({
                            ...editForm,
                            userAddress: { ...userAddress, zipCode: value }
                          });
                        }}
                        placeholder="Enter PIN code"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
                      <Input
                        value={userAddress.country || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          userAddress: { ...userAddress, country: e.target.value }
                        })}
                        placeholder="Enter country"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600 space-y-1">
                  <p>{(userAddress as any).villageStreet || userAddress.street || '-'}</p>
                  <p>P.O: {(userAddress as any).postOffice || '-'}, P.S: {(userAddress as any).policeStation || '-'}</p>
                  <p>Dist: {(userAddress as any).district || userAddress.city || '-'}, {userAddress.state || '-'}</p>
                  <p>PIN: {userAddress.zipCode || '-'}, {userAddress.country || '-'}</p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Bride Personal Details */}
        <Card className="p-3 sm:p-4 lg:p-6">
          <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-2 sm:mb-3 lg:mb-4">Bride [পাত্রী] Personal Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 lg:gap-4 text-xs sm:text-sm">
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Full Name</p>
              {isEditing ? (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={partnerForm.firstName || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      partnerForm: { ...partnerForm, firstName: e.target.value }
                    })}
                    placeholder="First Name"
                  />
                  <Input
                    value={partnerForm.lastName || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      partnerForm: { ...partnerForm, lastName: e.target.value }
                    })}
                    placeholder="Last Name"
                  />
                </div>
              ) : (
                <p className="font-medium text-xs sm:text-sm text-gray-900 truncate">
                  {partnerForm.firstName || '-'} {partnerForm.lastName || ''}
                </p>
              )}
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Father's Name</p>
              {isEditing ? (
                <Input
                  value={(partnerForm as any).fatherName || ''}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    partnerForm: { ...partnerForm, fatherName: e.target.value }
                  })}
                  placeholder="Father's Name"
                />
              ) : (
                <p className="font-medium text-xs sm:text-sm text-gray-900 truncate">
                  {(partnerForm as any).fatherName || '-'}
                </p>
              )}
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Date of Birth</p>
              {isEditing ? (
                <Input
                  type="date"
                  value={partnerForm.dateOfBirth ? partnerForm.dateOfBirth.split('T')[0] : ''}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    partnerForm: { ...partnerForm, dateOfBirth: e.target.value }
                  })}
                />
              ) : (
                <p className="font-medium text-gray-900">
                  {partnerForm.dateOfBirth ? safeFormatDate(partnerForm.dateOfBirth, 'MMMM d, yyyy') : '-'}
                </p>
              )}
            </div>
            <div>
              <p className="text-gray-500 mb-1">Aadhaar Number</p>
              {isEditing ? (
                <Input
                  value={(partnerForm as any).aadhaarNumber || partnerForm.idNumber || ''}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    partnerForm: { ...partnerForm, aadhaarNumber: e.target.value, idNumber: e.target.value }
                  })}
                  placeholder="Aadhaar Number"
                />
              ) : (
                <p className="font-medium text-gray-900">{(partnerForm as any).aadhaarNumber || partnerForm.idNumber || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-gray-500 mb-1">Mobile Number</p>
              {isEditing ? (
                <Input
                  value={(partnerForm as any).mobileNumber || ''}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    partnerForm: { ...partnerForm, mobileNumber: e.target.value }
                  })}
                  placeholder="Mobile Number"
                />
              ) : (
                <p className="font-medium text-gray-900">{(partnerForm as any).mobileNumber || '-'}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Bride Addresses */}
        <Card className="p-3 sm:p-4 lg:p-6">
          <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-2 sm:mb-3 lg:mb-4">Bride Addresses</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Bride [পাত্রী] Present Address</p>
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Village/Street</label>
                    <Input
                      value={(partnerCurrentAddress as any).villageStreet || partnerCurrentAddress.street || ''}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        partnerCurrentAddress: { ...partnerCurrentAddress, villageStreet: e.target.value, street: e.target.value }
                      })}
                      placeholder="Enter village/street"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Post Office</label>
                      <Input
                        value={(partnerCurrentAddress as any).postOffice || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          partnerCurrentAddress: { ...partnerCurrentAddress, postOffice: e.target.value }
                        })}
                        placeholder="Enter post office"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Police Station</label>
                      <Input
                        value={(partnerCurrentAddress as any).policeStation || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          partnerCurrentAddress: { ...partnerCurrentAddress, policeStation: e.target.value }
                        })}
                        placeholder="Enter police station"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">District</label>
                      <Input
                        value={(partnerCurrentAddress as any).district || partnerCurrentAddress.city || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          partnerCurrentAddress: { ...partnerCurrentAddress, district: e.target.value, city: e.target.value }
                        })}
                        placeholder="Enter district"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                      <Input
                        value={partnerCurrentAddress.state || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          partnerCurrentAddress: { ...partnerCurrentAddress, state: e.target.value }
                        })}
                        placeholder="Enter state"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">PIN Code</label>
                      <Input
                        value={partnerCurrentAddress.zipCode || ''}
                        maxLength={6}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setEditForm({
                            ...editForm,
                            partnerCurrentAddress: { ...partnerCurrentAddress, zipCode: value }
                          });
                        }}
                        placeholder="Enter PIN code"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
                      <Input
                        value={partnerCurrentAddress.country || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          partnerCurrentAddress: { ...partnerCurrentAddress, country: e.target.value }
                        })}
                        placeholder="Enter country"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600 space-y-1">
                  <p>{(partnerCurrentAddress as any).villageStreet || partnerCurrentAddress.street || '-'}</p>
                  <p>P.O: {(partnerCurrentAddress as any).postOffice || '-'}, P.S: {(partnerCurrentAddress as any).policeStation || '-'}</p>
                  <p>Dist: {(partnerCurrentAddress as any).district || partnerCurrentAddress.city || '-'}, {partnerCurrentAddress.state || '-'}</p>
                  <p>PIN: {partnerCurrentAddress.zipCode || '-'}, {partnerCurrentAddress.country || '-'}</p>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Bride [পাত্রী] Permanent Address</p>
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Village/Street</label>
                    <Input
                      value={(partnerAddress as any).villageStreet || partnerAddress.street || ''}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        partnerAddress: { ...partnerAddress, villageStreet: e.target.value, street: e.target.value }
                      })}
                      placeholder="Enter village/street"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Post Office</label>
                      <Input
                        value={(partnerAddress as any).postOffice || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          partnerAddress: { ...partnerAddress, postOffice: e.target.value }
                        })}
                        placeholder="Enter post office"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Police Station</label>
                      <Input
                        value={(partnerAddress as any).policeStation || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          partnerAddress: { ...partnerAddress, policeStation: e.target.value }
                        })}
                        placeholder="Enter police station"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">District</label>
                      <Input
                        value={(partnerAddress as any).district || partnerAddress.city || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          partnerAddress: { ...partnerAddress, district: e.target.value, city: e.target.value }
                        })}
                        placeholder="Enter district"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                      <Input
                        value={partnerAddress.state || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          partnerAddress: { ...partnerAddress, state: e.target.value }
                        })}
                        placeholder="Enter state"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">PIN Code</label>
                      <Input
                        value={partnerAddress.zipCode || ''}
                        maxLength={6}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setEditForm({
                            ...editForm,
                            partnerAddress: { ...partnerAddress, zipCode: value }
                          });
                        }}
                        placeholder="Enter PIN code"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
                      <Input
                        value={partnerAddress.country || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          partnerAddress: { ...partnerAddress, country: e.target.value }
                        })}
                        placeholder="Enter country"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600 space-y-1">
                  <p>{(partnerAddress as any).villageStreet || partnerAddress.street || '-'}</p>
                  <p>P.O: {(partnerAddress as any).postOffice || '-'}, P.S: {(partnerAddress as any).policeStation || '-'}</p>
                  <p>Dist: {(partnerAddress as any).district || partnerAddress.city || '-'}, {partnerAddress.state || '-'}</p>
                  <p>PIN: {partnerAddress.zipCode || '-'}, {partnerAddress.country || '-'}</p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Documents */}
        <Card className="p-3 sm:p-4 lg:p-6">
          <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-2 sm:mb-3 lg:mb-4">Uploaded Documents</h3>
          <div className="space-y-3 sm:space-y-4">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Groom's Documents</p>
              <div className="space-y-1.5 sm:space-y-2">
                {documents.filter(d => d.belongsTo === 'user').map(doc => {
                  const reuploaded = isReuploaded(doc);
                  return (
                    <div key={doc.id} className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600 p-2 sm:p-2.5 lg:p-3 rounded-lg ${reuploaded ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'} min-w-0`}>
                      {/* First Row: Document Name (Mobile) / Inline (Desktop) */}
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <FileText size={14} className="sm:w-4 sm:h-5 lg:w-[18px] lg:h-[18px] text-gold-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap">
                            <p className="font-medium text-xs sm:text-sm text-gray-900 truncate" title={`${getDocumentTypeLabel(doc.type)}: ${doc.name}`}>
                              {getDocumentTypeLabel(doc.type)}: {doc.name}
                            </p>
                            {reuploaded && (
                              <Badge variant="info" size="sm" className="bg-blue-100 text-blue-700 border-blue-300 !text-[10px] sm:!text-xs flex-shrink-0">
                                Re-uploaded
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Second Row: Status and Buttons (Mobile) / Inline (Desktop) */}
                      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 flex-shrink-0">
                        <Badge variant={doc.status === 'approved' ? 'success' : doc.status === 'rejected' ? 'error' : 'default'} className="flex-shrink-0 !text-[10px] sm:!text-xs">
                          {doc.status}
                        </Badge>
                        <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="!p-1 sm:!p-1.5 !text-[10px] sm:!text-xs"
                            onClick={async () => {
                              setPreviewDocument(doc);
                              setIsLoadingPreview(true);
                              setPreviewUrl(null);
                              try {
                                const signedUrl = await documentService.getSignedUrl(doc.id);
                                setPreviewUrl(signedUrl);
                              } catch (error: any) {
                                console.error('Failed to get signed URL:', error);
                                // Fallback to original URL
                                setPreviewUrl(doc.url);
                              } finally {
                                setIsLoadingPreview(false);
                              }
                            }}
                            title="Preview"
                          >
                            <Eye size={12} className="sm:w-4 sm:h-4" />
                          </Button>
                          {isAdminCreatedApplication && (
                            <>
                              <input
                                type="file"
                                accept={doc.type === 'photo' ? 'image/*' : 'image/*,.pdf'}
                                onChange={(e) => handleReuploadFileSelect(doc.id, e)}
                                className="hidden"
                                id={`reupload-user-${doc.id}`}
                                ref={(el) => {
                                  if (el) {
                                    reuploadFileInputsRef.current.set(doc.id, el);
                                  } else {
                                    reuploadFileInputsRef.current.delete(doc.id);
                                  }
                                }}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="!p-1 sm:!p-1.5 !text-[10px] sm:!text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => {
                                  const input = reuploadFileInputsRef.current.get(doc.id);
                                  if (input) {
                                    input.click();
                                  }
                                }}
                                disabled={reuploadingDoc === doc.id || isProcessingDoc === doc.id}
                                title="Re-upload"
                              >
                                {reuploadingDoc === doc.id ? (
                                  <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-t-2 border-b-2 border-blue-600"></div>
                                ) : (
                                  <Upload size={12} className="sm:w-4 sm:h-4" />
                                )}
                              </Button>
                            </>
                          )}
                          {doc.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="!p-1 sm:!p-1.5 !text-[10px] sm:!text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleApproveDocument(doc.id)}
                                disabled={isProcessingDoc === doc.id || reuploadingDoc === doc.id}
                                title="Approve"
                              >
                                <CheckCircle size={12} className="sm:w-4 sm:h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="!p-1 sm:!p-1.5 !text-[10px] sm:!text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleRejectDocument(doc)}
                                disabled={isProcessingDoc === doc.id || reuploadingDoc === doc.id}
                                title="Reject"
                              >
                                <XCircle size={12} className="sm:w-4 sm:h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {documents.filter(d => d.belongsTo === 'user').length === 0 && (
                  <p className="text-xs sm:text-sm text-gray-400 italic">No documents uploaded</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Bride's Documents</p>
              <div className="space-y-1.5 sm:space-y-2">
                {documents.filter(d => d.belongsTo === 'partner').map(doc => {
                  const reuploaded = isReuploaded(doc);
                  return (
                    <div key={doc.id} className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600 p-2 sm:p-2.5 lg:p-3 rounded-lg ${reuploaded ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'} min-w-0`}>
                      {/* First Row: Document Name (Mobile) / Inline (Desktop) */}
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <FileText size={14} className="sm:w-4 sm:h-5 lg:w-[18px] lg:h-[18px] text-gold-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap">
                            <p className="font-medium text-xs sm:text-sm text-gray-900 truncate" title={`${getDocumentTypeLabel(doc.type)}: ${doc.name}`}>
                              {getDocumentTypeLabel(doc.type)}: {doc.name}
                            </p>
                            {reuploaded && (
                              <Badge variant="info" size="sm" className="bg-blue-100 text-blue-700 border-blue-300 !text-[10px] sm:!text-xs flex-shrink-0">
                                Re-uploaded
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Second Row: Status and Buttons (Mobile) / Inline (Desktop) */}
                      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 flex-shrink-0">
                        <Badge variant={doc.status === 'approved' ? 'success' : doc.status === 'rejected' ? 'error' : 'default'} className="flex-shrink-0 !text-[10px] sm:!text-xs">
                          {doc.status}
                        </Badge>
                        <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="!p-1 sm:!p-1.5 !text-[10px] sm:!text-xs"
                            onClick={async () => {
                              setPreviewDocument(doc);
                              setIsLoadingPreview(true);
                              setPreviewUrl(null);
                              try {
                                const signedUrl = await documentService.getSignedUrl(doc.id);
                                setPreviewUrl(signedUrl);
                              } catch (error: any) {
                                console.error('Failed to get signed URL:', error);
                                // Fallback to original URL
                                setPreviewUrl(doc.url);
                              } finally {
                                setIsLoadingPreview(false);
                              }
                            }}
                            title="Preview"
                          >
                            <Eye size={12} className="sm:w-4 sm:h-4" />
                          </Button>
                          {isAdminCreatedApplication && (
                            <>
                              <input
                                type="file"
                                accept={doc.type === 'photo' ? 'image/*' : 'image/*,.pdf'}
                                onChange={(e) => handleReuploadFileSelect(doc.id, e)}
                                className="hidden"
                                id={`reupload-partner-${doc.id}`}
                                ref={(el) => {
                                  if (el) {
                                    reuploadFileInputsRef.current.set(doc.id, el);
                                  } else {
                                    reuploadFileInputsRef.current.delete(doc.id);
                                  }
                                }}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="!p-1 sm:!p-1.5 !text-[10px] sm:!text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => {
                                  const input = reuploadFileInputsRef.current.get(doc.id);
                                  if (input) {
                                    input.click();
                                  }
                                }}
                                disabled={reuploadingDoc === doc.id || isProcessingDoc === doc.id}
                                title="Re-upload"
                              >
                                {reuploadingDoc === doc.id ? (
                                  <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-t-2 border-b-2 border-blue-600"></div>
                                ) : (
                                  <Upload size={12} className="sm:w-4 sm:h-4" />
                                )}
                              </Button>
                            </>
                          )}
                          {doc.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="!p-1 sm:!p-1.5 !text-[10px] sm:!text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleApproveDocument(doc.id)}
                                disabled={isProcessingDoc === doc.id || reuploadingDoc === doc.id}
                                title="Approve"
                              >
                                <CheckCircle size={12} className="sm:w-4 sm:h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="!p-1 sm:!p-1.5 !text-[10px] sm:!text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleRejectDocument(doc)}
                                disabled={isProcessingDoc === doc.id || reuploadingDoc === doc.id}
                                title="Reject"
                              >
                                <XCircle size={12} className="sm:w-4 sm:h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {documents.filter(d => d.belongsTo === 'partner').length === 0 && (
                  <p className="text-xs sm:text-sm text-gray-400 italic">No documents uploaded</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Joint Documents</p>
              <div className="space-y-1.5 sm:space-y-2">
                {documents.filter(d => d.belongsTo === 'joint').map(doc => {
                  const reuploaded = isReuploaded(doc);
                  return (
                    <div key={doc.id} className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600 p-2 sm:p-2.5 lg:p-3 rounded-lg ${reuploaded ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'} min-w-0`}>
                      {/* First Row: Document Name (Mobile) / Inline (Desktop) */}
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <FileText size={14} className="sm:w-4 sm:h-5 lg:w-[18px] lg:h-[18px] text-gold-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap">
                            <p className="font-medium text-xs sm:text-sm text-gray-900 truncate" title={`${getDocumentTypeLabel(doc.type)}: ${doc.name}`}>
                              {getDocumentTypeLabel(doc.type)}: {doc.name}
                            </p>
                            {reuploaded && (
                              <Badge variant="info" size="sm" className="bg-blue-100 text-blue-700 border-blue-300 !text-[10px] sm:!text-xs flex-shrink-0">
                                Re-uploaded
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Second Row: Status and Buttons (Mobile) / Inline (Desktop) */}
                      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 flex-shrink-0">
                        <Badge variant={doc.status === 'approved' ? 'success' : doc.status === 'rejected' ? 'error' : 'default'} className="flex-shrink-0 !text-[10px] sm:!text-xs">
                          {doc.status}
                        </Badge>
                        <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="!p-1 sm:!p-1.5 !text-[10px] sm:!text-xs"
                            onClick={async () => {
                              setPreviewDocument(doc);
                              setIsLoadingPreview(true);
                              setPreviewUrl(null);
                              try {
                                const signedUrl = await documentService.getSignedUrl(doc.id);
                                setPreviewUrl(signedUrl);
                              } catch (error: any) {
                                console.error('Failed to get signed URL:', error);
                                // Fallback to original URL
                                setPreviewUrl(doc.url);
                              } finally {
                                setIsLoadingPreview(false);
                              }
                            }}
                            title="Preview"
                          >
                            <Eye size={12} className="sm:w-4 sm:h-4" />
                          </Button>
                          {isAdminCreatedApplication && (
                            <>
                              <input
                                type="file"
                                accept={doc.type === 'photo' ? 'image/*' : 'image/*,.pdf'}
                                onChange={(e) => handleReuploadFileSelect(doc.id, e)}
                                className="hidden"
                                id={`reupload-joint-${doc.id}`}
                                ref={(el) => {
                                  if (el) {
                                    reuploadFileInputsRef.current.set(doc.id, el);
                                  } else {
                                    reuploadFileInputsRef.current.delete(doc.id);
                                  }
                                }}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="!p-1 sm:!p-1.5 !text-[10px] sm:!text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => {
                                  const input = reuploadFileInputsRef.current.get(doc.id);
                                  if (input) {
                                    input.click();
                                  }
                                }}
                                disabled={reuploadingDoc === doc.id || isProcessingDoc === doc.id}
                                title="Re-upload"
                              >
                                {reuploadingDoc === doc.id ? (
                                  <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-t-2 border-b-2 border-blue-600"></div>
                                ) : (
                                  <Upload size={12} className="sm:w-4 sm:h-4" />
                                )}
                              </Button>
                            </>
                          )}
                          {doc.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="!p-1 sm:!p-1.5 !text-[10px] sm:!text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleApproveDocument(doc.id)}
                                disabled={isProcessingDoc === doc.id || reuploadingDoc === doc.id}
                                title="Approve"
                              >
                                <CheckCircle size={12} className="sm:w-4 sm:h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="!p-1 sm:!p-1.5 !text-[10px] sm:!text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleRejectDocument(doc)}
                                disabled={isProcessingDoc === doc.id || reuploadingDoc === doc.id}
                                title="Reject"
                              >
                                <XCircle size={12} className="sm:w-4 sm:h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {documents.filter(d => d.belongsTo === 'joint').length === 0 && (
                  <p className="text-xs sm:text-sm text-gray-400 italic">No documents uploaded</p>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Marriage Information */}
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Marriage Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">Marriage Date</p>
              {isEditing ? (
                <Input
                  type="date"
                  value={(() => {
                    const dateValue = (declarations as any)?.marriageDate || (declarations as any)?.marriageRegistrationDate || '';
                    if (!dateValue) return '';
                    return typeof dateValue === 'string' ? dateValue.split('T')[0] : '';
                  })()}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    declarations: {
                      ...(declarations || {}),
                      marriageDate: e.target.value,
                      marriageRegistrationDate: e.target.value,
                    }
                  })}
                />
              ) : (
                <p className="font-medium text-gray-900">
                  {((declarations as any)?.marriageDate || (declarations as any)?.marriageRegistrationDate)
                    ? safeFormatDate(
                      (declarations as any).marriageDate || (declarations as any).marriageRegistrationDate,
                      'MMMM d, yyyy',
                      'Invalid date'
                    )
                    : 'Not provided'}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Declarations */}
        {application.declarations && (
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Declarations</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-gray-600">I consent to the processing of my personal data for marriage registration purposes.</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-gray-600">I confirm that all information provided is accurate and truthful.</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-gray-600">I confirm that I am legally eligible to enter into marriage.</p>
              </div>
            </div>
          </Card>
        )}

        {/* Application Info */}
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Application Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">Progress</p>
              <p className="font-medium text-gray-900">{application.progress}%</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Last Updated</p>
              <p className="font-medium text-gray-900">
                {safeFormatDate(application.lastUpdated, 'MMMM d, yyyy')}
              </p>
            </div>
            {application.submittedAt && (
              <div>
                <p className="text-gray-500 mb-1">Submitted At</p>
                <p className="font-medium text-gray-900">
                  {safeFormatDate(application.submittedAt, 'MMMM d, yyyy')}
                </p>
              </div>
            )}
            {application.verifiedAt && (
              <div>
                <p className="text-gray-500 mb-1">Verified At</p>
                <p className="font-medium text-gray-900">
                  {safeFormatDate(application.verifiedAt, 'MMMM d, yyyy')}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Document Preview Modal */}
      {previewDocument && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-2 sm:p-4"
          onClick={() => {
            setPreviewDocument(null);
            setPreviewUrl(null);
          }}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div
            className="bg-white rounded-lg sm:rounded-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
            style={{ zIndex: 101 }}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 p-2.5 sm:p-3 lg:p-4 flex items-center justify-between z-10 gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 truncate" title={`${getDocumentTypeLabel(previewDocument.type)}: ${previewDocument.name}`}>
                  {getDocumentTypeLabel(previewDocument.type)}: {previewDocument.name}
                </h3>
                {isReuploaded(previewDocument) && (
                  <Badge variant="info" size="sm" className="bg-blue-100 text-blue-700 border-blue-300 !text-[10px] sm:!text-xs flex-shrink-0">
                    Re-uploaded
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <Badge variant={previewDocument.status === 'approved' ? 'success' : previewDocument.status === 'rejected' ? 'error' : 'default'} className="!text-[10px] sm:!text-xs">
                  {previewDocument.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="!text-xs sm:!text-sm !px-2 sm:!px-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    const urlToDownload = previewUrl || previewDocument.url;
                    if (urlToDownload) {
                      window.open(urlToDownload, '_blank');
                    }
                  }}
                >
                  <Download size={14} className="sm:w-4 sm:h-4 mr-1" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="!p-1.5 sm:!p-2 hover:bg-red-50 hover:text-red-600 !text-xs sm:!text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewDocument(null);
                    setPreviewUrl(null);
                  }}
                  title="Close"
                >
                  <X size={16} className="sm:w-5 sm:h-5" />
                </Button>
              </div>
            </div>
            <div className="p-2 sm:p-3 lg:p-6 overflow-y-auto max-h-[calc(95vh-80px)] sm:max-h-[calc(90vh-100px)]">
              {isLoadingPreview ? (
                <div className="flex flex-col items-center justify-center py-8 sm:py-12">
                  <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 border-t-2 border-b-2 border-gold-500"></div>
                  <p className="text-xs sm:text-sm text-gray-500 mt-3">Loading preview...</p>
                </div>
              ) : previewUrl ? (
                <>
                  {isImage(previewDocument.mimeType) ? (
                    <div className="flex items-center justify-center min-h-[200px] sm:min-h-[300px] w-full">
                      <img
                        src={previewUrl}
                        alt={previewDocument.name}
                        className="max-w-full max-h-[calc(95vh-120px)] sm:max-h-[calc(90vh-140px)] w-auto h-auto rounded-lg shadow-lg mx-auto object-contain"
                        onLoad={() => console.log('Image loaded successfully')}
                        onError={(e) => {
                          console.error('Failed to load image:', e);
                          const fallbackUrl = previewDocument.url;
                          if (fallbackUrl) {
                            console.log('Trying fallback URL:', fallbackUrl);
                            (e.target as HTMLImageElement).src = fallbackUrl;
                          } else {
                            console.error('No fallback URL available');
                          }
                        }}
                      />
                    </div>
                  ) : isPDF(previewDocument.mimeType) ? (
                    <div className="w-full">
                      <iframe
                        src={previewUrl}
                        className="w-full h-[calc(95vh-120px)] sm:h-[calc(90vh-140px)] lg:h-[70vh] rounded-lg border border-gray-200"
                        title={previewDocument.name}
                        onLoad={() => console.log('PDF iframe loaded')}
                        onError={() => {
                          console.error('Failed to load PDF');
                        }}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-8 sm:py-12">
                      <FileText size={36} className="sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
                      <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">Preview not available</p>
                      <Button variant="primary" size="sm" className="!text-xs sm:!text-sm" onClick={() => window.open(previewUrl, '_blank')}>
                        <Download size={14} className="sm:w-4 sm:h-4 mr-1.5" />
                        Download to View
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 sm:py-12">
                  <FileText size={36} className="sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
                  <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">Failed to load preview</p>
                  <div className="space-y-2">
                    {previewDocument.url && (
                      <Button variant="primary" size="sm" className="!text-xs sm:!text-sm w-full sm:w-auto" onClick={() => window.open(previewDocument.url, '_blank')}>
                        <Download size={14} className="sm:w-4 sm:h-4 mr-1.5" />
                        Open in New Tab
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Verify Application Modal */}
      <VerifyApplicationModal
        isOpen={isVerifyModalOpen}
        onClose={() => setIsVerifyModalOpen(false)}
        onConfirm={handleVerify}
        applicationId={application?.id || ''}
        currentCertificateNumber={application?.certificateNumber}
        currentRegistrationDate={application?.registrationDate}
        documents={documents}
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
          userEmail={userEmail}
        />
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
              <div className="flex justify-center">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setShowCredentialsModal(false);
                    setCredentials(null);
                  }}
                  className="text-xs sm:text-sm"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
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
    </div>
  );
};

export default ApplicationDetailsPage;
