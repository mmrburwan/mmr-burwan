import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { divorceApplicationService } from '../../services/divorceApplication';
import { documentService } from '../../services/documents';
import { DivorceApplication, Document } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ImageCropModal from '../../components/ui/ImageCropModal';
import {
  ArrowLeft,
  FileText,
  Eye,
  X,
  CheckCircle,
  Download,
  Calendar,
  User,
  Users,
  MapPin,
  Upload,
  RefreshCw,
  Plus,
  Loader2,
} from 'lucide-react';
import { safeFormatDate } from '../../utils/dateUtils';
import { formatAadhaar } from '../../utils/formatUtils';
import { downloadFileFromUrl } from '../../utils/download';
import { isTripleTalaq, formatDivorceTypeDisplay } from '../../utils/divorceUtils';

const ViewDivorceApplicationPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useNotification();
  const [application, setApplication] = useState<DivorceApplication | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Document upload / update states
  const [reuploadingDoc, setReuploadingDoc] = useState<string | null>(null);
  const [isUploadingNew, setIsUploadingNew] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [pendingCropFile, setPendingCropFile] = useState<{
    file: File;
    documentId?: string;
    type?: Document['type'];
    belongsTo?: 'user' | 'partner' | 'joint';
  } | null>(null);

  // Quick add document modal state
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [addDocCategory, setAddDocCategory] = useState<'user' | 'partner' | 'joint'>('user');
  const [addDocType, setAddDocType] = useState<Document['type']>('aadhaar');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAppData = async () => {
    if (!user) return;
    try {
      const app = await divorceApplicationService.getDivorceApplication(user.id);
      if (app) {
        setApplication(app);
        let docs: Document[] = [];
        try {
          docs = await documentService.getDivorceDocuments(app.id);
        } catch (e) {
          console.error('Failed to load divorce documents:', e);
        }
        if (!docs || docs.length === 0) {
          docs = app.documents || [];
        }
        setDocuments(docs);
      } else {
        showToast('No divorce application found', 'error');
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Failed to load divorce application:', error);
      showToast('Failed to load divorce application', 'error');
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/auth/login');
      return;
    }
    fetchAppData();
  }, [user, navigate]);

  const getDocumentTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      aadhaar: 'Aadhaar Card',
      tenth_certificate: 'Madhyamik Admit Card / Age Proof',
      voter_id: 'Voter ID',
      id: 'ID Document',
      photo: 'Passport Photograph',
      certificate: 'Marriage / Kabin Certificate',
      other: 'Other Supporting Document',
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

  const isImage = (mimeType?: string) => mimeType?.startsWith('image/');
  const isPDF = (mimeType?: string) => mimeType === 'application/pdf';

  // Handle re-uploading an existing document
  const handleReuploadDocument = async (documentId: string, file: File) => {
    if (!application) return;
    const doc = documents.find((d) => d.id === documentId);
    if (!doc) return;

    setReuploadingDoc(documentId);
    try {
      await documentService.uploadDivorceDocument(
        application.id,
        file,
        doc.type,
        doc.belongsTo,
        documentId
      );
      showToast('Document updated successfully', 'success');
      const updated = await documentService.getDivorceDocuments(application.id);
      setDocuments(updated);
    } catch (error: any) {
      console.error('Failed to re-upload document:', error);
      showToast(error.message || 'Failed to update document', 'error');
    } finally {
      setReuploadingDoc(null);
    }
  };

  const handleReuploadFileSelect = (documentId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
      if (file.size > MAX_FILE_SIZE) {
        showToast('File size exceeds 5MB limit. Please choose a smaller file.', 'error');
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

  // Handle uploading a brand-new document
  const handleUploadNewDocument = async (
    file: File,
    type: Document['type'],
    belongsTo: 'user' | 'partner' | 'joint'
  ) => {
    if (!application) return;
    setIsUploadingNew(true);
    try {
      await documentService.uploadDivorceDocument(application.id, file, type, belongsTo);
      showToast('Document uploaded successfully', 'success');
      const updated = await documentService.getDivorceDocuments(application.id);
      setDocuments(updated);
      setShowAddDocModal(false);
    } catch (error: any) {
      console.error('Failed to upload document:', error);
      showToast(error.message || 'Failed to upload document', 'error');
    } finally {
      setIsUploadingNew(false);
    }
  };

  const handleNewFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const MAX_FILE_SIZE = 5 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        showToast('File size exceeds 5MB limit.', 'error');
        event.target.value = '';
        return;
      }

      if (addDocType === 'photo') {
        setPendingCropFile({ file, type: addDocType, belongsTo: addDocCategory });
        setCropModalOpen(true);
        event.target.value = '';
        return;
      }

      handleUploadNewDocument(file, addDocType, addDocCategory);
    }
    event.target.value = '';
  };

  const handleCropComplete = async (croppedFile: File) => {
    if (!pendingCropFile) return;
    if (pendingCropFile.documentId) {
      await handleReuploadDocument(pendingCropFile.documentId, croppedFile);
    } else if (pendingCropFile.type && pendingCropFile.belongsTo) {
      await handleUploadNewDocument(croppedFile, pendingCropFile.type, pendingCropFile.belongsTo);
    }
    setPendingCropFile(null);
    setCropModalOpen(false);
  };

  const handleCropSkip = async () => {
    if (!pendingCropFile) return;
    if (pendingCropFile.documentId) {
      await handleReuploadDocument(pendingCropFile.documentId, pendingCropFile.file);
    } else if (pendingCropFile.type && pendingCropFile.belongsTo) {
      await handleUploadNewDocument(pendingCropFile.file, pendingCropFile.type, pendingCropFile.belongsTo);
    }
    setPendingCropFile(null);
    setCropModalOpen(false);
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
          <p className="text-gray-500">Divorce application not found</p>
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mt-4">
            <ArrowLeft size={18} className="mr-2" />
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const husband = application.userDetails || {};
  const wife = (application.partnerForm as any) || {};
  const husbandAddress = application.userAddress || {};
  const husbandCurrentAddress = application.userCurrentAddress || husbandAddress;
  const wifeAddress = application.partnerAddress || {};
  const wifeCurrentAddress = application.partnerCurrentAddress || wifeAddress;
  const declarations = application.declarations || {};

  const tripleTalaq = isTripleTalaq(application.divorceType);
  const talaqDate1 = (application.certificateDetails as any)?.talaqDate1 || application.talaqDate1 || (application.declarations as any)?.talaqDate1 || application.divorceDate;
  const talaqDate2 = (application.certificateDetails as any)?.talaqDate2 || application.talaqDate2 || (application.declarations as any)?.talaqDate2 || application.divorceDate;
  const talaqDate3 = (application.certificateDetails as any)?.talaqDate3 || application.talaqDate3 || (application.declarations as any)?.talaqDate3 || application.divorceDate;

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 lg:px-6 py-3 sm:py-6 lg:py-8">
      {/* Top Header */}
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
              Divorce Application Details
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
                {application.verified ? 'Verified' : 'Pending Verification'}
              </Badge>
            )}
            {application.verified && application.certificateNumber && (
              <div className="text-[10px] sm:text-xs lg:text-sm text-gray-600 min-w-0">
                <p className="truncate max-w-[140px] sm:max-w-none">Certificate: {application.certificateNumber}</p>
                {application.registrationDate && (
                  <p className="truncate max-w-[140px] sm:max-w-none">Reg. Date: {safeFormatDate(application.registrationDate, 'dd-MM-yyyy')}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3 sm:space-y-6">
        {/* Divorce Particulars: Type of Divorce FIRST line, then Date(s) SECOND line */}
        <Card className="p-3 sm:p-4 lg:p-6 bg-gold-50/30 border-gold-100">
          <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-2 sm:mb-3 flex items-center gap-2">
            <Calendar size={16} className="text-gold-600" />
            Divorce Particulars [তালাক / বিবাহ বিচ্ছেদের তথ্য]
          </h3>
          <div className="space-y-3">
            {/* First Line: Type of Divorce */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Type of Divorce</p>
                <p className="font-bold text-gold-900 uppercase tracking-wide text-xs sm:text-sm">
                  {formatDivorceTypeDisplay(application.divorceType)}
                </p>
              </div>
              {application.marriageCertificateNumber && (
                <div>
                  <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Marriage Certificate Ref</p>
                  <p className="font-mono font-medium text-gray-900 text-xs sm:text-sm">
                    {application.marriageCertificateNumber}
                  </p>
                </div>
              )}
            </div>

            {/* Second Line: Dates */}
            <div className="pt-2 border-t border-gold-200/50">
              {tripleTalaq || talaqDate2 || talaqDate3 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm">
                  <div>
                    <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Date of 1st Talaq</p>
                    <p className="font-medium text-gray-900">
                      {talaqDate1 ? safeFormatDate(talaqDate1, 'dd-MM-yyyy') : 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Date of 2nd Talaq</p>
                    <p className="font-medium text-gray-900">
                      {talaqDate2 ? safeFormatDate(talaqDate2, 'dd-MM-yyyy') : 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Date of 3rd Talaq</p>
                    <p className="font-medium text-gray-900">
                      {talaqDate3 ? safeFormatDate(talaqDate3, 'dd-MM-yyyy') : (talaqDate1 ? safeFormatDate(talaqDate1, 'dd-MM-yyyy') : 'Not provided')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-xs sm:text-sm">
                  <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Date of Divorce</p>
                  <p className="font-medium text-gray-900">
                    {application.divorceDate ? safeFormatDate(application.divorceDate, 'dd-MM-yyyy') : 'Not provided'}
                  </p>
                </div>
              )}
            </div>
          </div>
          {application.divorceReason && (
            <div className="mt-3 pt-3 border-t border-gold-200/50">
              <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Divorce Reason / Notes</p>
              <p className="text-xs sm:text-sm text-gray-700 bg-white/70 p-2.5 rounded-lg border border-gold-100">
                {application.divorceReason}
              </p>
            </div>
          )}
        </Card>

        {/* Husband Personal Details */}
        <Card className="p-2.5 sm:p-4 lg:p-6">
          <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-1.5 sm:mb-3 lg:mb-4 flex items-center gap-2">
            <User size={16} className="text-gold-600" />
            Details of Husband [স্বামীর বিবরণ]
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-3 lg:gap-4 text-xs sm:text-sm">
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Full Name</p>
              <p className="font-medium text-gray-900">
                {husband.firstName || '-'} {husband.lastName || ''}
              </p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Father's Name</p>
              <p className="font-medium text-gray-900">{husband.fatherName || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Date of Birth</p>
              <p className="font-medium text-gray-900">
                {husband.dateOfBirth ? safeFormatDate(husband.dateOfBirth, 'dd-MM-yyyy') : '-'}
              </p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Aadhaar Number</p>
              <p className="font-medium text-gray-900">{formatAadhaar(husband.aadhaarNumber) || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Mobile Number</p>
              <p className="font-medium text-gray-900">{husband.mobileNumber || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Voter EPIC No / Admit Card No</p>
              <p className="font-medium text-gray-900 font-mono">{husband.voterOrRollNo || '-'}</p>
            </div>
          </div>
        </Card>

        {/* Husband Addresses */}
        <Card className="p-2.5 sm:p-4 lg:p-6">
          <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-1.5 sm:mb-3 lg:mb-4 flex items-center gap-2">
            <MapPin size={16} className="text-gold-600" />
            Husband Addresses
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 lg:gap-6">
            <div>
              <p className="text-[11px] sm:text-sm font-medium text-gray-700 mb-1">Present Address</p>
              <p className="text-[11px] sm:text-sm text-gray-600 break-words">{formatAddress(husbandCurrentAddress)}</p>
            </div>
            <div>
              <p className="text-[11px] sm:text-sm font-medium text-gray-700 mb-1">Permanent Address</p>
              <p className="text-[11px] sm:text-sm text-gray-600 break-words">{formatAddress(husbandAddress)}</p>
            </div>
          </div>
        </Card>

        {/* Wife Personal Details */}
        <Card className="p-2.5 sm:p-4 lg:p-6">
          <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-1.5 sm:mb-3 lg:mb-4 flex items-center gap-2">
            <Users size={16} className="text-gold-600" />
            Details of Wife [স্ত্রীর বিবরণ]
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-3 lg:gap-4 text-xs sm:text-sm">
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Full Name</p>
              <p className="font-medium text-gray-900">
                {wife.firstName || '-'} {wife.lastName || ''}
              </p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Father's Name</p>
              <p className="font-medium text-gray-900">{wife.fatherName || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Date of Birth</p>
              <p className="font-medium text-gray-900">
                {wife.dateOfBirth ? safeFormatDate(wife.dateOfBirth, 'dd-MM-yyyy') : '-'}
              </p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Aadhaar Number</p>
              <p className="font-medium text-gray-900">{formatAadhaar(wife.aadhaarNumber || wife.idNumber) || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Mobile Number</p>
              <p className="font-medium text-gray-900">{wife.mobileNumber || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Voter EPIC No / Admit Card No</p>
              <p className="font-medium text-gray-900 font-mono">{wife.voterOrRollNo || '-'}</p>
            </div>
          </div>
        </Card>

        {/* Wife Addresses */}
        <Card className="p-2.5 sm:p-4 lg:p-6">
          <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-1.5 sm:mb-3 lg:mb-4 flex items-center gap-2">
            <MapPin size={16} className="text-gold-600" />
            Wife Addresses
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 lg:gap-6">
            <div>
              <p className="text-[11px] sm:text-sm font-medium text-gray-700 mb-1">Present Address</p>
              <p className="text-[11px] sm:text-sm text-gray-600 break-words">{formatAddress(wifeCurrentAddress)}</p>
            </div>
            <div>
              <p className="text-[11px] sm:text-sm font-medium text-gray-700 mb-1">Permanent Address</p>
              <p className="text-[11px] sm:text-sm text-gray-600 break-words">{formatAddress(wifeAddress)}</p>
            </div>
          </div>
        </Card>

        {/* Uploaded Documents with Full View & Update Capabilities */}
        <Card className="p-2.5 sm:p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 mb-3 border-b border-gray-200 gap-2">
            <div>
              <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900">
                Uploaded Documents
              </h3>
              <p className="text-[10px] sm:text-xs text-gray-500">
                View or update any uploaded documents for this divorce application
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs self-start sm:self-auto"
              onClick={() => {
                setAddDocCategory('user');
                setAddDocType('aadhaar');
                setShowAddDocModal(true);
              }}
            >
              <Plus size={14} className="mr-1" />
              Upload Document
            </Button>
          </div>

          <div className="space-y-4">
            {/* Husband Docs */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs sm:text-sm font-medium text-gray-800 flex items-center gap-1.5">
                  <User size={14} className="text-gold-600" />
                  Husband's Documents
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAddDocCategory('user');
                    setAddDocType('aadhaar');
                    setShowAddDocModal(true);
                  }}
                  className="text-[11px] text-gold-700 hover:text-gold-800 font-medium flex items-center gap-1"
                >
                  <Plus size={12} /> Add
                </button>
              </div>

              <div className="space-y-1.5">
                {documents
                  .filter((d) => d.belongsTo === 'user')
                  .sort((a, b) => {
                    const order: Record<string, number> = { aadhaar: 1, tenth_certificate: 2, voter_id: 3, photo: 4 };
                    return (order[a.type] || 99) - (order[b.type] || 99);
                  })
                  .map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-[11px] sm:text-sm text-gray-600 p-2 sm:p-3 rounded-lg bg-gray-50 border border-gray-100 min-w-0"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText size={14} className="text-gold-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <p className="font-medium text-[11px] sm:text-sm text-gray-900 truncate">
                            <span className="text-gray-500 font-normal">{getDocumentTypeLabel(doc.type)}:</span> {doc.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 flex-shrink-0">
                        <Badge
                          variant={doc.status === 'approved' ? 'success' : doc.status === 'rejected' ? 'error' : 'default'}
                          className="!text-[9px] sm:!text-xs"
                        >
                          {doc.status}
                        </Badge>

                        {/* View Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="!p-1 sm:!px-2 sm:!py-1 !text-[10px] sm:!text-xs"
                          onClick={async () => {
                            setPreviewDocument(doc);
                            setIsLoadingPreview(true);
                            setPreviewUrl(null);
                            try {
                              const signedUrl = await documentService.getDivorceSignedUrl(doc.id);
                              setPreviewUrl(signedUrl);
                            } catch (error: any) {
                              setPreviewUrl(doc.url);
                            } finally {
                              setIsLoadingPreview(false);
                            }
                          }}
                          title="View Document"
                        >
                          <Eye size={12} className="sm:mr-1" />
                          <span className="hidden sm:inline">View</span>
                        </Button>

                        {/* Update / Re-upload Button */}
                        <label className="cursor-pointer">
                          <span className="inline-flex items-center px-2 py-1 text-[10px] sm:text-xs font-medium text-gold-700 bg-gold-50 hover:bg-gold-100 rounded border border-gold-200 transition-colors">
                            {reuploadingDoc === doc.id ? (
                              <Loader2 size={12} className="animate-spin sm:mr-1" />
                            ) : (
                              <Upload size={12} className="sm:mr-1" />
                            )}
                            <span className="hidden sm:inline">Update</span>
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            accept={doc.type === 'photo' ? 'image/*' : 'image/*,.pdf'}
                            disabled={reuploadingDoc === doc.id}
                            onChange={(e) => handleReuploadFileSelect(doc.id, e)}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                {documents.filter((d) => d.belongsTo === 'user').length === 0 && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-center">
                    <p className="text-[11px] sm:text-sm text-gray-400 italic mb-1.5">No documents uploaded for husband</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="!text-[10px] sm:!text-xs"
                      onClick={() => {
                        setAddDocCategory('user');
                        setAddDocType('aadhaar');
                        setShowAddDocModal(true);
                      }}
                    >
                      <Upload size={12} className="mr-1" /> Upload Husband Document
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Wife Docs */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs sm:text-sm font-medium text-gray-800 flex items-center gap-1.5">
                  <User size={14} className="text-rose-600" />
                  Wife's Documents
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAddDocCategory('partner');
                    setAddDocType('aadhaar');
                    setShowAddDocModal(true);
                  }}
                  className="text-[11px] text-gold-700 hover:text-gold-800 font-medium flex items-center gap-1"
                >
                  <Plus size={12} /> Add
                </button>
              </div>

              <div className="space-y-1.5">
                {documents
                  .filter((d) => d.belongsTo === 'partner')
                  .sort((a, b) => {
                    const order: Record<string, number> = { aadhaar: 1, tenth_certificate: 2, voter_id: 3, photo: 4 };
                    return (order[a.type] || 99) - (order[b.type] || 99);
                  })
                  .map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-[11px] sm:text-sm text-gray-600 p-2 sm:p-3 rounded-lg bg-gray-50 border border-gray-100 min-w-0"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText size={14} className="text-gold-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <p className="font-medium text-[11px] sm:text-sm text-gray-900 truncate">
                            <span className="text-gray-500 font-normal">{getDocumentTypeLabel(doc.type)}:</span> {doc.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 flex-shrink-0">
                        <Badge
                          variant={doc.status === 'approved' ? 'success' : doc.status === 'rejected' ? 'error' : 'default'}
                          className="!text-[9px] sm:!text-xs"
                        >
                          {doc.status}
                        </Badge>

                        {/* View Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="!p-1 sm:!px-2 sm:!py-1 !text-[10px] sm:!text-xs"
                          onClick={async () => {
                            setPreviewDocument(doc);
                            setIsLoadingPreview(true);
                            setPreviewUrl(null);
                            try {
                              const signedUrl = await documentService.getDivorceSignedUrl(doc.id);
                              setPreviewUrl(signedUrl);
                            } catch (error: any) {
                              setPreviewUrl(doc.url);
                            } finally {
                              setIsLoadingPreview(false);
                            }
                          }}
                          title="View Document"
                        >
                          <Eye size={12} className="sm:mr-1" />
                          <span className="hidden sm:inline">View</span>
                        </Button>

                        {/* Update / Re-upload Button */}
                        <label className="cursor-pointer">
                          <span className="inline-flex items-center px-2 py-1 text-[10px] sm:text-xs font-medium text-gold-700 bg-gold-50 hover:bg-gold-100 rounded border border-gold-200 transition-colors">
                            {reuploadingDoc === doc.id ? (
                              <Loader2 size={12} className="animate-spin sm:mr-1" />
                            ) : (
                              <Upload size={12} className="sm:mr-1" />
                            )}
                            <span className="hidden sm:inline">Update</span>
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            accept={doc.type === 'photo' ? 'image/*' : 'image/*,.pdf'}
                            disabled={reuploadingDoc === doc.id}
                            onChange={(e) => handleReuploadFileSelect(doc.id, e)}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                {documents.filter((d) => d.belongsTo === 'partner').length === 0 && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-center">
                    <p className="text-[11px] sm:text-sm text-gray-400 italic mb-1.5">No documents uploaded for wife</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="!text-[10px] sm:!text-xs"
                      onClick={() => {
                        setAddDocCategory('partner');
                        setAddDocType('aadhaar');
                        setShowAddDocModal(true);
                      }}
                    >
                      <Upload size={12} className="mr-1" /> Upload Wife Document
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Joint Docs */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs sm:text-sm font-medium text-gray-800 flex items-center gap-1.5">
                  <Users size={14} className="text-gold-600" />
                  Joint / Marriage Documents
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAddDocCategory('joint');
                    setAddDocType('photo');
                    setShowAddDocModal(true);
                  }}
                  className="text-[11px] text-gold-700 hover:text-gold-800 font-medium flex items-center gap-1"
                >
                  <Plus size={12} /> Add
                </button>
              </div>

              <div className="space-y-1.5">
                {documents
                  .filter((d) => d.belongsTo === 'joint')
                  .map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-[11px] sm:text-sm text-gray-600 p-2 sm:p-3 rounded-lg bg-gray-50 border border-gray-100 min-w-0"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText size={14} className="text-gold-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <p className="font-medium text-[11px] sm:text-sm text-gray-900 truncate">
                            <span className="text-gray-500 font-normal">{getDocumentTypeLabel(doc.type)}:</span> {doc.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 flex-shrink-0">
                        <Badge
                          variant={doc.status === 'approved' ? 'success' : doc.status === 'rejected' ? 'error' : 'default'}
                          className="!text-[9px] sm:!text-xs"
                        >
                          {doc.status}
                        </Badge>

                        {/* View Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="!p-1 sm:!px-2 sm:!py-1 !text-[10px] sm:!text-xs"
                          onClick={async () => {
                            setPreviewDocument(doc);
                            setIsLoadingPreview(true);
                            setPreviewUrl(null);
                            try {
                              const signedUrl = await documentService.getDivorceSignedUrl(doc.id);
                              setPreviewUrl(signedUrl);
                            } catch (error: any) {
                              setPreviewUrl(doc.url);
                            } finally {
                              setIsLoadingPreview(false);
                            }
                          }}
                          title="View Document"
                        >
                          <Eye size={12} className="sm:mr-1" />
                          <span className="hidden sm:inline">View</span>
                        </Button>

                        {/* Update / Re-upload Button */}
                        <label className="cursor-pointer">
                          <span className="inline-flex items-center px-2 py-1 text-[10px] sm:text-xs font-medium text-gold-700 bg-gold-50 hover:bg-gold-100 rounded border border-gold-200 transition-colors">
                            {reuploadingDoc === doc.id ? (
                              <Loader2 size={12} className="animate-spin sm:mr-1" />
                            ) : (
                              <Upload size={12} className="sm:mr-1" />
                            )}
                            <span className="hidden sm:inline">Update</span>
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            accept={doc.type === 'photo' ? 'image/*' : 'image/*,.pdf'}
                            disabled={reuploadingDoc === doc.id}
                            onChange={(e) => handleReuploadFileSelect(doc.id, e)}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                {documents.filter((d) => d.belongsTo === 'joint').length === 0 && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-center">
                    <p className="text-[11px] sm:text-sm text-gray-400 italic mb-1.5">No joint documents / photograph uploaded</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="!text-[10px] sm:!text-xs"
                      onClick={() => {
                        setAddDocCategory('joint');
                        setAddDocType('photo');
                        setShowAddDocModal(true);
                      }}
                    >
                      <Upload size={12} className="mr-1" /> Upload Joint Photo / Marriage Doc
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Declarations */}
        {declarations && (
          <Card className="p-3 sm:p-4 lg:p-6">
            <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-2 sm:mb-3">Declarations</h3>
            <div className="space-y-2 text-xs sm:text-sm text-gray-700">
              <div className="flex items-start gap-2">
                <CheckCircle size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>All information provided in this divorce application is true and correct to the best of knowledge.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>The divorce has taken place legally in accordance with Islamic jurisprudence and applicable laws.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>Registration requested in accordance with Bengal Muhammadan Marriages & Divorces Registration Act 1876.</span>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Upload Document Modal */}
      {showAddDocModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowAddDocModal(false)}
        >
          <div
            className="relative bg-white rounded-xl shadow-2xl p-5 max-w-md w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 flex items-center gap-2">
                <Upload size={18} className="text-gold-600" />
                Upload New Document
              </h3>
              <button
                type="button"
                onClick={() => setShowAddDocModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Document Belongs To
                </label>
                <select
                  value={addDocCategory}
                  onChange={(e) => setAddDocCategory(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500"
                >
                  <option value="user">Husband</option>
                  <option value="partner">Wife</option>
                  <option value="joint">Joint / Marriage Document</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Document Type
                </label>
                <select
                  value={addDocType}
                  onChange={(e) => setAddDocType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500"
                >
                  {addDocCategory === 'joint' ? (
                    <>
                      <option value="photo">Couple / Joint Photo</option>
                      <option value="certificate">Marriage / Kabin Certificate</option>
                      <option value="other">Other Document</option>
                    </>
                  ) : (
                    <>
                      <option value="aadhaar">Aadhaar Card</option>
                      <option value="tenth_certificate">Madhyamik Admit Card / Age Proof</option>
                      <option value="voter_id">Voter ID</option>
                      <option value="photo">Passport Photograph</option>
                      <option value="other">Other Document</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Select File
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={addDocType === 'photo' ? 'image/*' : 'image/*,.pdf'}
                  className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gold-50 file:text-gold-700 hover:file:bg-gold-100"
                  onChange={handleNewFileSelect}
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Supported formats: JPEG, PNG, PDF (up to 5MB)
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddDocModal(false)}
                disabled={isUploadingNew}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Image Crop Modal */}
      {cropModalOpen && pendingCropFile && (
        <ImageCropModal
          isOpen={cropModalOpen}
          imageFile={pendingCropFile.file}
          onCropComplete={handleCropComplete}
          onCancel={() => {
            setPendingCropFile(null);
            setCropModalOpen(false);
          }}
          onSkip={handleCropSkip}
          aspectRatio={
            pendingCropFile.documentId
              ? (documents.find((d) => d.id === pendingCropFile.documentId)?.belongsTo === 'joint' ? 1.5 : 1)
              : (pendingCropFile.belongsTo === 'joint' ? 1.5 : 1)
          }
        />
      )}

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
    </div>
  );
};

export default ViewDivorceApplicationPage;
