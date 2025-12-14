import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { applicationService } from '../../services/application';
import { documentService } from '../../services/documents';
import { Application, Document } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { ArrowLeft, FileText, Eye, X, CheckCircle } from 'lucide-react';
import { safeFormatDate } from '../../utils/dateUtils';

const ViewApplicationPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useNotification();
  const [application, setApplication] = useState<Application | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        navigate('/auth/login');
        return;
      }

      try {
        const app = await applicationService.getApplication(user.id);
        if (app) {
          setApplication(app);
          const docs = await documentService.getDocuments(app.id);
          setDocuments(docs);
        } else {
          showToast('No application found', 'error');
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Failed to load application:', error);
        showToast('Failed to load application', 'error');
        navigate('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, navigate, showToast]);

  const getDocumentTypeLabel = (type: string): string => {
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

  const formatAddress = (address: any): string => {
    if (!address) return 'N/A';
    const parts = [];
    const village = address.villageStreet || address.street || '';
    if (village) parts.push(`VILL- ${village.toUpperCase()}`);
    const postOffice = address.postOffice || address.city || '';
    if (postOffice) parts.push(`P.O- ${postOffice.toUpperCase()}`);
    const policeStation = address.policeStation || '';
    if (policeStation) parts.push(`P.S- ${policeStation.toUpperCase()}`);
    const district = address.district || address.city || '';
    if (district) parts.push(`DIST- ${district.toUpperCase()}`);
    const state = address.state || '';
    if (state) parts.push(state.toUpperCase());
    if (address.zipCode) parts.push(`PIN- ${address.zipCode}`);
    return parts.length > 0 ? parts.join(', ') : 'N/A';
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
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mt-4">
            <ArrowLeft size={18} className="mr-2" />
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const userDetails = (application.userDetails as any) || {};
  const partnerForm = application.partnerForm || {};
  const userAddress = application.userAddress || application.address || {};
  const userCurrentAddress = application.userCurrentAddress || (application as any).currentAddress || {};
  const partnerAddress = application.partnerAddress || partnerForm.address || {};
  const partnerCurrentAddress = application.partnerCurrentAddress || {};
  const declarations = application.declarations || {};

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 lg:px-6 py-3 sm:py-6 lg:py-8">
      <div className="mb-3 sm:mb-6 lg:mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-1.5 sm:mb-3 lg:mb-4 !text-xs sm:!text-sm !px-2 sm:!px-3"
          size="sm"
        >
          <ArrowLeft size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          Back to Dashboard
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-lg sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-0.5 sm:mb-2">
              Application Details
            </h1>
            <p className="text-[10px] sm:text-sm text-gray-600 truncate">Application ID: {application.id}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
            <Badge
              variant={
                application.status === 'submitted' ? 'info' :
                  application.status === 'approved' ? 'success' :
                    application.status === 'rejected' ? 'error' :
                      'default'
              }
              className="!text-[10px] sm:!text-xs"
            >
              {application.status}
            </Badge>
            {application.verified !== undefined && (
              <Badge variant={application.verified ? 'success' : 'default'} className="!text-[10px] sm:!text-xs">
                {application.verified ? 'Verified' : 'Unverified'}
              </Badge>
            )}
            {application.verified && application.certificateNumber && (
              <div className="text-[10px] sm:text-xs lg:text-sm text-gray-600 min-w-0">
                <p className="truncate max-w-[120px] sm:max-w-none">Certificate: {application.certificateNumber}</p>
                {application.registrationDate && (
                  <p className="truncate max-w-[120px] sm:max-w-none">Reg. Date: {safeFormatDate(application.registrationDate, 'MMM d, yyyy')}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2.5 sm:space-y-4 lg:space-y-6">
        {/* Groom Personal Details */}
        <Card className="p-2.5 sm:p-4 lg:p-6">
          <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-1.5 sm:mb-3 lg:mb-4">
            Groom Personal Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-3 lg:gap-4 text-xs sm:text-sm">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Full Name</p>
              <p className="font-medium text-xs sm:text-sm text-gray-900 truncate" title={`${userDetails.firstName || ''} ${userDetails.lastName || ''}`}>
                {userDetails.firstName || '-'} {userDetails.lastName || ''}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Father's Name</p>
              <p className="font-medium text-gray-900 truncate" title={userDetails.fatherName || '-'}>{userDetails.fatherName || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Date of Birth</p>
              <p className="font-medium text-gray-900">
                {userDetails.dateOfBirth ? safeFormatDate(userDetails.dateOfBirth, 'MMMM d, yyyy') : '-'}
              </p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Aadhaar Number</p>
              <p className="font-medium text-gray-900">{userDetails.aadhaarNumber || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Mobile Number</p>
              <p className="font-medium text-gray-900">{userDetails.mobileNumber || '-'}</p>
            </div>
          </div>
        </Card>

        {/* Bride Personal Details */}
        <Card className="p-2.5 sm:p-4 lg:p-6">
          <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-1.5 sm:mb-3 lg:mb-4">
            Bride Personal Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-3 lg:gap-4 text-xs sm:text-sm">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Full Name</p>
              <p className="font-medium text-xs sm:text-sm text-gray-900 truncate" title={`${partnerForm.firstName || ''} ${partnerForm.lastName || ''}`}>
                {partnerForm.firstName || '-'} {partnerForm.lastName || ''}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Father's Name</p>
              <p className="font-medium text-gray-900 truncate" title={(partnerForm as any).fatherName || '-'}>{(partnerForm as any).fatherName || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Date of Birth</p>
              <p className="font-medium text-gray-900">
                {partnerForm.dateOfBirth ? safeFormatDate(partnerForm.dateOfBirth, 'MMMM d, yyyy') : '-'}
              </p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Aadhaar Number</p>
              <p className="font-medium text-gray-900">
                {(partnerForm as any).aadhaarNumber || (partnerForm as any).idNumber || '-'}
              </p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Mobile Number</p>
              <p className="font-medium text-gray-900">{(partnerForm as any).mobileNumber || '-'}</p>
            </div>
          </div>
        </Card>

        {/* Groom Addresses */}
        <Card className="p-2.5 sm:p-4 lg:p-6">
          <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-1.5 sm:mb-3 lg:mb-4">
            Groom Addresses
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 lg:gap-6">
            <div>
              <p className="text-[11px] sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Groom Present Address</p>
              <div className="text-[11px] sm:text-sm text-gray-600 space-y-1 break-words">
                <p className="break-words">{formatAddress(userCurrentAddress)}</p>
              </div>
            </div>
            <div>
              <p className="text-[11px] sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Groom Permanent Address</p>
              <div className="text-[11px] sm:text-sm text-gray-600 space-y-1 break-words">
                <p className="break-words">{formatAddress(userAddress)}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Bride Addresses */}
        <Card className="p-2.5 sm:p-4 lg:p-6">
          <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-1.5 sm:mb-3 lg:mb-4">
            Bride Addresses
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 lg:gap-6">
            <div>
              <p className="text-[11px] sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Bride Present Address</p>
              <div className="text-[11px] sm:text-sm text-gray-600 space-y-1 break-words">
                <p className="break-words">{formatAddress(partnerCurrentAddress)}</p>
              </div>
            </div>
            <div>
              <p className="text-[11px] sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Bride Permanent Address</p>
              <div className="text-[11px] sm:text-sm text-gray-600 space-y-1 break-words">
                <p className="break-words">{formatAddress(partnerAddress)}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Documents */}
        <Card className="p-2.5 sm:p-4 lg:p-6">
          <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-1.5 sm:mb-3 lg:mb-4">
            Uploaded Documents
          </h3>
          <div className="space-y-2.5 sm:space-y-4">
            <div>
              <p className="text-[11px] sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Groom's Documents</p>
              <div className="space-y-1 sm:space-y-2">
                {documents.filter(d => d.belongsTo === 'user').map(doc => (
                  <div
                    key={doc.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-[11px] sm:text-sm text-gray-600 p-1.5 sm:p-2.5 lg:p-3 rounded-lg bg-gray-50 min-w-0"
                  >
                    <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
                      <FileText size={12} className="sm:w-4 sm:h-5 text-gold-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p
                          className="font-medium text-[11px] sm:text-sm text-gray-900 truncate block"
                          title={`${getDocumentTypeLabel(doc.type)}: ${doc.name}`}
                        >
                          <span className="text-gray-500">{getDocumentTypeLabel(doc.type)}:</span> {doc.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-3 flex-shrink-0">
                      <Badge
                        variant={doc.status === 'approved' ? 'success' : doc.status === 'rejected' ? 'error' : 'default'}
                        className="flex-shrink-0 !text-[9px] sm:!text-xs"
                      >
                        {doc.status}
                      </Badge>
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
                            setPreviewUrl(doc.url);
                          } finally {
                            setIsLoadingPreview(false);
                          }
                        }}
                        title="View Document"
                      >
                        <Eye size={11} className="sm:w-4 sm:h-4" />
                        <span className="ml-1 sm:ml-1.5 hidden sm:inline">View</span>
                      </Button>
                    </div>
                  </div>
                ))}
                {documents.filter(d => d.belongsTo === 'user').length === 0 && (
                  <p className="text-[11px] sm:text-sm text-gray-400 italic">No documents uploaded</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-[11px] sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Bride's Documents</p>
              <div className="space-y-1 sm:space-y-2">
                {documents.filter(d => d.belongsTo === 'partner').map(doc => (
                  <div
                    key={doc.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-[11px] sm:text-sm text-gray-600 p-1.5 sm:p-2.5 lg:p-3 rounded-lg bg-gray-50 min-w-0"
                  >
                    <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
                      <FileText size={12} className="sm:w-4 sm:h-5 text-gold-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p
                          className="font-medium text-[11px] sm:text-sm text-gray-900 truncate block"
                          title={`${getDocumentTypeLabel(doc.type)}: ${doc.name}`}
                        >
                          <span className="text-gray-500">{getDocumentTypeLabel(doc.type)}:</span> {doc.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-3 flex-shrink-0">
                      <Badge
                        variant={doc.status === 'approved' ? 'success' : doc.status === 'rejected' ? 'error' : 'default'}
                        className="flex-shrink-0 !text-[9px] sm:!text-xs"
                      >
                        {doc.status}
                      </Badge>
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
                            setPreviewUrl(doc.url);
                          } finally {
                            setIsLoadingPreview(false);
                          }
                        }}
                        title="View Document"
                      >
                        <Eye size={11} className="sm:w-4 sm:h-4" />
                        <span className="ml-1 sm:ml-1.5 hidden sm:inline">View</span>
                      </Button>
                    </div>
                  </div>
                ))}
                {documents.filter(d => d.belongsTo === 'partner').length === 0 && (
                  <p className="text-[11px] sm:text-sm text-gray-400 italic">No documents uploaded</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-[11px] sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Joint Documents</p>
              <div className="space-y-1 sm:space-y-2">
                {documents.filter(d => d.belongsTo === 'joint').map(doc => (
                  <div
                    key={doc.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-[11px] sm:text-sm text-gray-600 p-1.5 sm:p-2.5 lg:p-3 rounded-lg bg-gray-50 min-w-0"
                  >
                    <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
                      <FileText size={12} className="sm:w-4 sm:h-5 text-gold-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p
                          className="font-medium text-[11px] sm:text-sm text-gray-900 truncate block"
                          title={`${getDocumentTypeLabel(doc.type)}: ${doc.name}`}
                        >
                          <span className="text-gray-500">{getDocumentTypeLabel(doc.type)}:</span> {doc.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-3 flex-shrink-0">
                      <Badge
                        variant={doc.status === 'approved' ? 'success' : doc.status === 'rejected' ? 'error' : 'default'}
                        className="flex-shrink-0 !text-[9px] sm:!text-xs"
                      >
                        {doc.status}
                      </Badge>
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
                            setPreviewUrl(doc.url);
                          } finally {
                            setIsLoadingPreview(false);
                          }
                        }}
                        title="View Document"
                      >
                        <Eye size={11} className="sm:w-4 sm:h-4" />
                        <span className="ml-1 sm:ml-1.5 hidden sm:inline">View</span>
                      </Button>
                    </div>
                  </div>
                ))}
                {documents.filter(d => d.belongsTo === 'joint').length === 0 && (
                  <p className="text-[11px] sm:text-sm text-gray-400 italic">No documents uploaded</p>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Marriage Information */}
        <Card className="p-2.5 sm:p-4 lg:p-6">
          <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-1.5 sm:mb-3 lg:mb-4">
            Marriage Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Marriage Date</p>
              <p className="font-medium text-gray-900">
                {((declarations as any)?.marriageDate || (declarations as any)?.marriageRegistrationDate)
                  ? safeFormatDate(
                    (declarations as any).marriageDate || (declarations as any).marriageRegistrationDate,
                    'MMMM d, yyyy',
                    'Invalid date'
                  )
                  : 'Not provided'}
              </p>
            </div>
          </div>
        </Card>

        {/* Declarations */}
        {application.declarations && (
          <Card className="p-2.5 sm:p-4 lg:p-6">
            <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-1.5 sm:mb-3 lg:mb-4">
              Declarations
            </h3>
            <div className="space-y-1.5 sm:space-y-2 text-[11px] sm:text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle size={14} className="sm:w-4 sm:h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-gray-600">I consent to the processing of my personal data for marriage registration purposes.</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle size={14} className="sm:w-4 sm:h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-gray-600">I confirm that all information provided is accurate and truthful.</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle size={14} className="sm:w-4 sm:h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-gray-600">I confirm that I am legally eligible to enter into marriage.</p>
              </div>
            </div>
          </Card>
        )}

        {/* Application Information */}
        <Card className="p-2.5 sm:p-4 lg:p-6">
          <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-1.5 sm:mb-3 lg:mb-4">
            Application Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Progress</p>
              <p className="font-medium text-gray-900">{application.progress}%</p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Last Updated</p>
              <p className="font-medium text-gray-900">
                {safeFormatDate(application.lastUpdated, 'MMMM d, yyyy')}
              </p>
            </div>
            {application.submittedAt && (
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Submitted At</p>
                <p className="font-medium text-gray-900">
                  {safeFormatDate(application.submittedAt, 'MMMM d, yyyy')}
                </p>
              </div>
            )}
            {application.verifiedAt && (
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Verified At</p>
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
        >
          <div
            className="bg-white rounded-lg sm:rounded-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between z-10">
              <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 truncate flex-1">
                {getDocumentTypeLabel(previewDocument.type)}: {previewDocument.name}
              </h3>
              <button
                onClick={() => {
                  setPreviewDocument(null);
                  setPreviewUrl(null);
                }}
                className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0 ml-2"
                aria-label="Close"
              >
                <X size={18} className="sm:w-5 sm:h-5" />
              </button>
            </div>
            <div className="p-3 sm:p-4">
              {isLoadingPreview ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold-500"></div>
                </div>
              ) : previewUrl ? (
                <div className="w-full">
                  {previewDocument.type === 'photo' || previewUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                    <img
                      src={previewUrl}
                      alt={previewDocument.name}
                      className="w-full h-auto rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const errorDiv = document.createElement('div');
                        errorDiv.className = 'text-center py-8 text-gray-500';
                        errorDiv.textContent = 'Failed to load image';
                        (e.target as HTMLImageElement).parentElement?.appendChild(errorDiv);
                      }}
                    />
                  ) : (
                    <iframe
                      src={previewUrl}
                      className="w-full h-[600px] sm:h-[700px] rounded-lg border border-gray-200"
                      title={previewDocument.name}
                    />
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p>Failed to load document preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewApplicationPage;

