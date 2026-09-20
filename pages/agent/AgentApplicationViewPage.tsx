import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { applicationService } from '../../services/application';
import { documentService } from '../../services/documents';
import { Application, Document } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import {
  ArrowLeft,
  FileText,
  Eye,
  X,
  Printer,
  Calendar,
  User,
  MapPin,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Download
} from 'lucide-react';
import { safeFormatDate, calculateDetailedAge } from '../../utils/dateUtils';
import { formatAadhaar } from '../../utils/formatUtils';

const AgentApplicationViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
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
    if (id) {
      loadApplicationData(id);
    }
  }, [id, user]);

  const loadApplicationData = async (appId: string) => {
    setIsLoading(true);
    try {
      const app = await applicationService.getApplicationById(appId);
      if (!app) {
        showToast('Application not found', 'error');
        navigate('/agent/dashboard');
        return;
      }

      // Check authorization: Agent can only view their own applications (or admin)
      if (user && app.agentId && app.agentId !== user.id && user.role !== 'admin') {
        showToast('Unauthorized to view this application', 'error');
        navigate('/agent/dashboard');
        return;
      }

      setApplication(app);
      const docs = await documentService.getDocuments(appId);
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load application:', error);
      showToast('Error loading application details', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'rejected': return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'under_review': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'submitted': return 'bg-amber-100 text-amber-800 border-amber-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getDocumentTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      aadhaar: 'Aadhaar Card',
      tenth_certificate: 'Madhyamik Admit Card',
      voter_id: 'Voter ID',
      id: 'ID Document',
      photo: 'Photograph',
      certificate: 'Certificate',
      other: 'Document',
    };
    return labels[type] || type;
  };

  const formatAddress = (address: any): string => {
    if (!address) return 'N/A';
    const parts = [];
    const village = address.villageStreet || address.street || '';
    if (village) parts.push(`Vill: ${village}`);
    const postOffice = address.postOffice || '';
    if (postOffice) parts.push(`P.O: ${postOffice}`);
    const policeStation = address.policeStation || '';
    if (policeStation) parts.push(`P.S: ${policeStation}`);
    const district = address.district || address.city || '';
    if (district) parts.push(`Dist: ${district}`);
    const state = address.state || '';
    if (state) parts.push(state);
    if (address.zipCode) parts.push(`PIN: ${address.zipCode}`);
    return parts.length > 0 ? parts.join(', ') : 'N/A';
  };

  const handlePreview = async (doc: Document) => {
    setPreviewDocument(doc);
    setIsLoadingPreview(true);
    setPreviewUrl(null);
    try {
      const signedUrl = await documentService.getSignedUrl(doc.id);
      setPreviewUrl(signedUrl);
    } catch (error) {
      console.error('Failed to get signed URL:', error);
      setPreviewUrl(doc.url);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handlePrintSlip = () => {
    if (application?.id) {
      window.open(`/print/application/${application.id}/acknowledgement`, '_blank', 'width=800,height=800');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <p className="text-gray-500 mb-4">Application not found</p>
          <Button variant="ghost" onClick={() => navigate('/agent/dashboard')}>
            <ArrowLeft size={16} className="mr-2" />
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const userDetails = (application.userDetails as any) || {};
  const partnerForm = (application.partnerForm as any) || {};
  const userAddress = (application.userAddress as any) || {};
  const userCurrentAddress = (application.userCurrentAddress as any) || {};
  const partnerAddress = (application.partnerAddress as any) || {};
  const partnerCurrentAddress = (application.partnerCurrentAddress as any) || {};
  const declarations = (application.declarations as any) || {};

  const marriageDate = declarations?.marriageDate || declarations?.marriageRegistrationDate;
  const groomAge = userDetails.dateOfBirth ? calculateDetailedAge(userDetails.dateOfBirth, marriageDate || new Date()) : null;
  const brideAge = partnerForm.dateOfBirth ? calculateDetailedAge(partnerForm.dateOfBirth, marriageDate || new Date()) : null;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      {/* Top Navigation & Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/agent/dashboard')}
          className="mb-3 text-xs sm:text-sm"
        >
          <ArrowLeft size={16} className="mr-1.5" />
          Back to Dashboard
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2.5 mb-1 flex-wrap">
              <h1 className="font-serif text-xl sm:text-2xl font-bold text-gray-900">
                Application Details
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${getStatusColor(application.verified ? 'approved' : application.status)}`}>
                {application.verified ? 'Verified' : application.status}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Application ID: <span className="font-mono text-gray-700">{application.id}</span>
              {application.proxyUserEmail && (
                <> • Client Email: <span className="font-medium text-gray-700">{application.proxyUserEmail}</span></>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {application.status === 'draft' ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/agent/create-application?resume=${application.id}`)}
                className="text-xs sm:text-sm"
              >
                Resume Application
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintSlip}
                className="text-xs sm:text-sm"
              >
                <Printer size={16} className="mr-1.5" />
                Print Acknowledgement Slip
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Marriage Information */}
        <Card className="p-4 sm:p-6 bg-amber-50/40 border-amber-100">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={18} className="text-amber-700" />
            <h2 className="font-semibold text-sm sm:text-base text-gray-900">
              Marriage Information
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div>
              <p className="text-gray-500 text-xs mb-0.5">Date of Marriage</p>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-gray-900">
                  {marriageDate
                    ? safeFormatDate(marriageDate, 'dd-MM-yyyy')
                    : 'Not provided'}
                </p>
                {groomAge && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    groomAge.years >= 21
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    Groom Age: {groomAge.text}
                  </span>
                )}
                {brideAge && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    brideAge.years >= 18
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    Bride Age: {brideAge.text}
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-0.5">Application Submitted Date</p>
              <p className="font-medium text-gray-900">
                {application.submittedAt
                  ? safeFormatDate(application.submittedAt, 'dd-MM-yyyy, hh:mm a')
                  : safeFormatDate(application.lastUpdated, 'dd-MM-yyyy')}
              </p>
            </div>
          </div>
        </Card>

        {/* Groom & Bride Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Groom Details */}
          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
              <User size={18} className="text-gray-700" />
              <h2 className="font-semibold text-sm sm:text-base text-gray-900">
                Groom (পাত্র) Details
              </h2>
            </div>
            <div className="space-y-3 text-xs sm:text-sm">
              <div>
                <p className="text-gray-500 text-xs">Full Name</p>
                <p className="font-medium text-gray-900">{userDetails.firstName || '-'} {userDetails.lastName || ''}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Father's Name</p>
                <p className="font-medium text-gray-900">{userDetails.fatherName || '-'}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-gray-500 text-xs">Date of Birth</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-gray-900">
                      {userDetails.dateOfBirth ? safeFormatDate(userDetails.dateOfBirth, 'dd-MM-yyyy') : '-'}
                    </p>
                    {groomAge && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        groomAge.years >= 21
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        Age: {groomAge.text}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Aadhaar Number</p>
                  <p className="font-medium text-gray-900 font-mono">
                    {userDetails.aadhaarNumber ? formatAadhaar(userDetails.aadhaarNumber) : '-'}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Mobile Number</p>
                <p className="font-medium text-gray-900">{userDetails.mobileNumber || '-'}</p>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-gray-700 font-medium mb-1">
                  <MapPin size={14} />
                  <span>Present Address</span>
                </div>
                <p className="text-gray-600 text-xs">{formatAddress(userCurrentAddress)}</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-gray-700 font-medium mb-1">
                  <MapPin size={14} />
                  <span>Permanent Address</span>
                </div>
                <p className="text-gray-600 text-xs">{formatAddress(userAddress)}</p>
              </div>
            </div>
          </Card>

          {/* Bride Details */}
          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
              <User size={18} className="text-gray-700" />
              <h2 className="font-semibold text-sm sm:text-base text-gray-900">
                Bride (পাত্রী) Details
              </h2>
            </div>
            <div className="space-y-3 text-xs sm:text-sm">
              <div>
                <p className="text-gray-500 text-xs">Full Name</p>
                <p className="font-medium text-gray-900">{partnerForm.firstName || '-'} {partnerForm.lastName || ''}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Father's Name</p>
                <p className="font-medium text-gray-900">{partnerForm.fatherName || '-'}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-gray-500 text-xs">Date of Birth</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-gray-900">
                      {partnerForm.dateOfBirth ? safeFormatDate(partnerForm.dateOfBirth, 'dd-MM-yyyy') : '-'}
                    </p>
                    {brideAge && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        brideAge.years >= 18
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        Age: {brideAge.text}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Aadhaar Number</p>
                  <p className="font-medium text-gray-900 font-mono">
                    {partnerForm.aadhaarNumber || partnerForm.idNumber ? formatAadhaar(partnerForm.aadhaarNumber || partnerForm.idNumber) : '-'}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Mobile Number</p>
                <p className="font-medium text-gray-900">{partnerForm.mobileNumber || '-'}</p>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-gray-700 font-medium mb-1">
                  <MapPin size={14} />
                  <span>Present Address</span>
                </div>
                <p className="text-gray-600 text-xs">{formatAddress(partnerCurrentAddress)}</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-gray-700 font-medium mb-1">
                  <MapPin size={14} />
                  <span>Permanent Address</span>
                </div>
                <p className="text-gray-600 text-xs">{formatAddress(partnerAddress)}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Attached Documents */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-gray-700" />
              <h2 className="font-semibold text-sm sm:text-base text-gray-900">
                Uploaded Documents
              </h2>
            </div>
            <span className="text-xs text-gray-500">{documents.length} document(s)</span>
          </div>

          {documents.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-gray-50 px-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-gray-100 rounded-lg text-gray-600 flex-shrink-0">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                        {getDocumentTypeLabel(doc.type)}: <span className="text-gray-600 font-normal">{doc.name}</span>
                      </p>
                      <div className="flex items-center gap-2 text-[10px] sm:text-xs text-gray-400 mt-0.5">
                        <span className="capitalize">{doc.belongsTo || 'joint'}</span>
                        {doc.size ? <span>• {(doc.size / 1024).toFixed(1)} KB</span> : null}
                        {doc.uploadedAt ? <span>• {safeFormatDate(doc.uploadedAt, 'MMM d, yyyy')}</span> : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      doc.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                      doc.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {doc.status}
                    </span>

                    <Button
                      variant="outline"
                      size="sm"
                      className="!py-1 !px-2.5 text-xs"
                      onClick={() => handlePreview(doc)}
                    >
                      <Eye size={14} className="mr-1" />
                      Preview
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-gray-400 italic py-4 text-center">
              No documents uploaded yet.
            </p>
          )}
        </Card>
      </div>

      {/* Document Preview Modal */}
      {previewDocument && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-4 sm:px-6 py-3.5 border-b border-gray-200 flex items-center justify-between">
              <div className="min-w-0 flex-1 pr-4">
                <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate">
                  {getDocumentTypeLabel(previewDocument.type)}
                </h3>
                <p className="text-xs text-gray-500 truncate">{previewDocument.name}</p>
              </div>
              <div className="flex items-center gap-2">
                {previewUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="!p-1.5"
                    onClick={() => window.open(previewUrl, '_blank')}
                    title="Open in new tab"
                  >
                    <ExternalLink size={18} />
                  </Button>
                )}
                <button
                  onClick={() => {
                    setPreviewDocument(null);
                    setPreviewUrl(null);
                  }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-50 min-h-[300px]">
              {isLoadingPreview ? (
                <LoadingSpinner />
              ) : previewUrl ? (
                previewDocument.type === 'photo' || previewUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i) ? (
                  <img
                    src={previewUrl}
                    alt={previewDocument.name}
                    className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-sm"
                  />
                ) : (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[70vh] rounded-lg border border-gray-200 shadow-sm"
                    title={previewDocument.name}
                  />
                )
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle size={32} className="mx-auto text-gray-400 mb-2" />
                  <p>Unable to load document preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentApplicationViewPage;
