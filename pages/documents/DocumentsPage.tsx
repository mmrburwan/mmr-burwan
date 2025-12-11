import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { applicationService } from '../../services/application';
import { documentService } from '../../services/documents';
import { notificationService } from '../../services/notifications';
import { useNotification } from '../../contexts/NotificationContext';
import { useTranslation } from '../../hooks/useTranslation';
import { Document, Application, Notification } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { Upload, FileText, AlertCircle, ArrowLeft, XCircle, Info, UploadCloud, Eye, Download, X } from 'lucide-react';
import { safeFormatDate } from '../../utils/dateUtils';
import ImageCropModal from '../../components/ui/ImageCropModal';

const DocumentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useNotification();
  const { t } = useTranslation('documents');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [rejectedDocuments, setRejectedDocuments] = useState<Document[]>([]);
  const [rejectionNotifications, setRejectionNotifications] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingDocumentId, setUploadingDocumentId] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Map<string, File>>(new Map());
  const [selectedReuploadFiles, setSelectedReuploadFiles] = useState<Map<string, File>>(new Map()); // For rejected doc re-uploads
  const [isUploading, setIsUploading] = useState(false);
  const [isReuploadingAll, setIsReuploadingAll] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [pendingCropFile, setPendingCropFile] = useState<{ file: File; type: string; belongsTo: 'user' | 'partner' | 'joint'; docType: 'aadhaar' | 'tenth_certificate' | 'voter_id' | 'photo' } | null>(null);

  // Document type keys for tracking selected files
  const documentTypes = {
    userAadhaar: 'user-aadhaar',
    userSecondDoc: 'user-second-doc',
    partnerAadhaar: 'partner-aadhaar',
    partnerSecondDoc: 'partner-second-doc',
    jointPhoto: 'joint-photo',
  };

  useEffect(() => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    const loadData = async () => {
      try {
        const app = await applicationService.getApplication(user.id);
        if (app) {
          setApplication(app);
          setApplicationId(app.id);
          const docs = await documentService.getDocuments(app.id);
          setDocuments(docs);

          // Find rejected documents
          const rejected = docs.filter((d) => d.status === 'rejected');
          setRejectedDocuments(rejected);

          // Load rejection notifications
          if (rejected.length > 0) {
            try {
              const notifications = await notificationService.getNotifications(user.id);
              const rejectionMap = new Map<string, string>();
              
              notifications
                .filter((n) => n.type === 'document_rejected' && n.documentId)
                .forEach((n) => {
                  if (n.documentId) {
                    rejectionMap.set(n.documentId, n.message);
                  }
                });
              
              setRejectionNotifications(rejectionMap);
            } catch (error) {
              console.error('Failed to load rejection notifications:', error);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load documents:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, navigate]);

  // Maximum file size: 500KB
  const MAX_FILE_SIZE = 500 * 1024; // 500KB in bytes

  const handleFileSelection = (file: File, type: string, belongsTo: 'user' | 'partner' | 'joint', docType: 'aadhaar' | 'tenth_certificate' | 'voter_id' | 'photo') => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      showToast(`File size exceeds 500KB limit. Please compress or resize the image before uploading.`, 'error');
      return;
    }

    // Show crop modal for joint photos
    if (docType === 'photo' && belongsTo === 'joint') {
      setPendingCropFile({ file, type, belongsTo, docType });
      setCropModalOpen(true);
      return;
    }

    // Store the selected file with its type key
    setSelectedFiles(prev => {
      const newMap = new Map(prev);
      newMap.set(type, file);
      return newMap;
    });
  };

  const handleCropComplete = (croppedFile: File) => {
    if (!pendingCropFile) return;

    // Check file size again after cropping
    if (croppedFile.size > MAX_FILE_SIZE) {
      showToast(`Cropped file size exceeds 500KB limit. Please try again with a smaller image.`, 'error');
      setPendingCropFile(null);
      setCropModalOpen(false);
      return;
    }

    // Store the cropped file
    setSelectedFiles(prev => {
      const newMap = new Map(prev);
      newMap.set(pendingCropFile.type, croppedFile);
      return newMap;
    });

    setPendingCropFile(null);
    setCropModalOpen(false);
  };

  const handleCropSkip = () => {
    if (!pendingCropFile) return;

    // Use original file
    setSelectedFiles(prev => {
      const newMap = new Map(prev);
      newMap.set(pendingCropFile.type, pendingCropFile.file);
      return newMap;
    });

    setPendingCropFile(null);
    setCropModalOpen(false);
  };

  const handleRemoveSelectedFile = (type: string) => {
    setSelectedFiles(prev => {
      const newMap = new Map(prev);
      newMap.delete(type);
      return newMap;
    });
  };

  const handleSubmitDocuments = async () => {
    if (!applicationId) {
      showToast('Please start an application first', 'error');
      navigate('/application');
      return;
    }

    if (selectedFiles.size === 0) {
      showToast('Please select at least one document to upload', 'error');
      return;
    }

    setIsUploading(true);
    try {
      // Upload files with their proper types and belongsTo
      const uploadPromises: Array<{ file: File; type: 'aadhaar' | 'tenth_certificate' | 'voter_id' | 'photo'; belongsTo: 'user' | 'partner' | 'joint' }> = [];

      // Groom's Aadhaar
      if (selectedFiles.has(documentTypes.userAadhaar)) {
        uploadPromises.push({
          file: selectedFiles.get(documentTypes.userAadhaar)!,
          type: 'aadhaar',
          belongsTo: 'user',
        });
      }

      // Groom's Second Doc (10th Certificate or Voter ID)
      if (selectedFiles.has(documentTypes.userSecondDoc)) {
        const file = selectedFiles.get(documentTypes.userSecondDoc)!;
        const fileName = file.name.toLowerCase();
        const type = fileName.includes('voter') || fileName.includes('voterid') ? 'voter_id' : 'tenth_certificate';
        uploadPromises.push({
          file,
          type,
          belongsTo: 'user',
        });
      }

      // Bride's Aadhaar
      if (selectedFiles.has(documentTypes.partnerAadhaar)) {
        uploadPromises.push({
          file: selectedFiles.get(documentTypes.partnerAadhaar)!,
          type: 'aadhaar',
          belongsTo: 'partner',
        });
      }

      // Bride's Second Doc (10th Certificate or Voter ID)
      if (selectedFiles.has(documentTypes.partnerSecondDoc)) {
        const file = selectedFiles.get(documentTypes.partnerSecondDoc)!;
        const fileName = file.name.toLowerCase();
        const type = fileName.includes('voter') || fileName.includes('voterid') ? 'voter_id' : 'tenth_certificate';
        uploadPromises.push({
          file,
          type,
          belongsTo: 'partner',
        });
      }

      // Joint Photo
      if (selectedFiles.has(documentTypes.jointPhoto)) {
        uploadPromises.push({
          file: selectedFiles.get(documentTypes.jointPhoto)!,
          type: 'photo',
          belongsTo: 'joint',
        });
      }

      // Upload all files
      for (const { file, type, belongsTo } of uploadPromises) {
        try {
          await documentService.uploadDocument(applicationId, file, type, belongsTo);
        } catch (error: any) {
          showToast(`Failed to upload ${file.name}: ${error.message}`, 'error');
          // Continue with other files even if one fails
        }
      }

      // Clear selected files after successful upload
      setSelectedFiles(new Map());
      showToast('Documents uploaded successfully', 'success');

      // Refresh documents
      const updated = await documentService.getDocuments(applicationId);
      setDocuments(updated);
      
      // Update rejected documents list
      const rejected = updated.filter((d) => d.status === 'rejected');
      setRejectedDocuments(rejected);
      
      // Reload notifications if there are rejected documents
      if (rejected.length > 0 && user) {
        try {
          const notifications = await notificationService.getNotifications(user.id);
          const rejectionMap = new Map<string, string>();
          
          notifications
            .filter((n) => n.type === 'document_rejected' && n.documentId)
            .forEach((n) => {
              if (n.documentId) {
                rejectionMap.set(n.documentId, n.message);
              }
            });
          
          setRejectionNotifications(rejectionMap);
        } catch (error) {
          console.error('Failed to reload rejection notifications:', error);
        }
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to upload documents', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Select a file for re-upload (doesn't upload immediately)
  const handleSelectReuploadFile = (documentId: string, file: File) => {
    setSelectedReuploadFiles(prev => {
      const newMap = new Map(prev);
      newMap.set(documentId, file);
      return newMap;
    });
  };

  // Remove a selected re-upload file
  const handleRemoveReuploadFile = (documentId: string) => {
    setSelectedReuploadFiles(prev => {
      const newMap = new Map(prev);
      newMap.delete(documentId);
      return newMap;
    });
  };

  // Submit all selected re-upload files
  const handleSubmitReuploadFiles = async () => {
    if (!applicationId) {
      showToast('Please start an application first', 'error');
      return;
    }

    if (selectedReuploadFiles.size === 0) {
      showToast('Please select at least one document to re-upload', 'error');
      return;
    }

    setIsReuploadingAll(true);
    try {
      // Upload each selected file
      for (const [documentId, file] of selectedReuploadFiles.entries()) {
        try {
          await documentService.replaceRejectedDocument(documentId, file);
        } catch (error: any) {
          showToast(`Failed to replace document: ${error.message}`, 'error');
        }
      }

      showToast('Documents replaced successfully', 'success');
      
      // Clear selected files
      setSelectedReuploadFiles(new Map());
      
      // Refresh documents
      const updated = await documentService.getDocuments(applicationId);
      setDocuments(updated);
      
      // Update rejected documents list
      const rejected = updated.filter((d) => d.status === 'rejected');
      setRejectedDocuments(rejected);
      
      // Reload notifications
      if (user) {
        try {
          const notifications = await notificationService.getNotifications(user.id);
          const rejectionMap = new Map<string, string>();
          
          notifications
            .filter((n) => n.type === 'document_rejected' && n.documentId)
            .forEach((n) => {
              if (n.documentId) {
                rejectionMap.set(n.documentId, n.message);
              }
            });
          
          setRejectionNotifications(rejectionMap);
        } catch (error) {
          console.error('Failed to reload rejection notifications:', error);
        }
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to replace documents', 'error');
    } finally {
      setIsReuploadingAll(false);
    }
  };

  const handleRemove = async (documentId: string) => {
    // Prevent deletion if application is submitted
    if (isApplicationSubmitted) {
      showToast('Cannot delete documents after application submission. Please contact admin if needed.', 'error');
      return;
    }

    try {
      await documentService.deleteDocument(documentId);
      setDocuments(documents.filter((d) => d.id !== documentId));
      showToast('Document removed', 'success');
    } catch (error) {
      showToast('Failed to remove document', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold-500"></div>
      </div>
    );
  }

  if (!applicationId) {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <Card className="p-4 sm:p-6 text-center">
          <AlertCircle size={36} className="sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
          <h2 className="font-serif text-lg sm:text-xl font-bold text-gray-900 mb-1 sm:mb-2">No Application Found</h2>
          <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6">
            Start an application before uploading documents.
          </p>
          <Button variant="primary" size="sm" className="!text-xs sm:!text-sm" onClick={() => navigate('/application')}>
            Start Application
          </Button>
        </Card>
      </div>
    );
  }

  // Check if upload should be enabled
  // Upload is enabled if: application is not submitted OR there are rejected documents
  const isUploadEnabled = !application || 
    (application.status !== 'submitted' && 
     application.status !== 'under_review' && 
     application.status !== 'approved') ||
    rejectedDocuments.length > 0;

  // Check if application is submitted - users cannot delete documents after submission
  const isApplicationSubmitted = application && 
    (application.status === 'submitted' || 
     application.status === 'under_review' || 
     application.status === 'approved');

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

  const getPersonLabel = (belongsTo?: string): string => {
    if (!belongsTo) return '';
    switch (belongsTo) {
      case 'user':
        return 'Groom\'s';
      case 'partner':
        return 'Bride\'s';
      case 'joint':
        return 'Joint';
      default:
        return '';
    }
  };

  const getFullDocumentLabel = (doc: Document): string => {
    const typeLabel = getDocumentTypeLabel(doc.type);
    const personLabel = getPersonLabel(doc.belongsTo);
    return personLabel ? `${personLabel} ${typeLabel}` : typeLabel;
  };

  const isImage = (mimeType: string): boolean => {
    return mimeType?.startsWith('image/') || false;
  };

  const isPDF = (mimeType: string): boolean => {
    return mimeType === 'application/pdf' || false;
  };

  const handlePreviewDocument = async (doc: Document) => {
    console.log('Preview clicked, document:', doc);
    setPreviewDocument(doc);
    setIsLoadingPreview(true);
    setPreviewUrl(null);
    try {
      // Try to get signed URL for better security
      const signedUrl = await documentService.getSignedUrl(doc.id);
      console.log('Got signed URL:', signedUrl);
      setPreviewUrl(signedUrl);
    } catch (error: any) {
      console.error('Failed to get signed URL:', error);
      // Fallback to original URL
      console.log('Using fallback URL:', doc.url);
      setPreviewUrl(doc.url);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const closePreview = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewDocument(null);
    setPreviewUrl(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="flex-shrink-0 !px-2 sm:!px-3"
          >
            <ArrowLeft size={16} className="sm:w-[18px] sm:h-[18px] mr-1 sm:mr-2" />
            <span className="text-xs sm:text-sm">{t('back')}</span>
          </Button>
        </div>
        <h1 className="font-serif text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1">{t('title')}</h1>
        <p className="text-xs sm:text-sm text-gray-600">{t('subtitle')}</p>
      </div>

      {/* Rejection Instructions with Individual Upload */}
      {rejectedDocuments.length > 0 && (
        <Card className="p-3 sm:p-5 mb-4 sm:mb-6 bg-rose-50 border-rose-200">
          <div className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4">
            <XCircle size={16} className="sm:w-5 sm:h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-sm sm:text-base text-rose-900 mb-1 sm:mb-2">
                Documents Need Re-upload
              </h3>
              <p className="text-[10px] sm:text-xs text-rose-800 mb-1 sm:mb-2">
                Review reasons below and select new files.
              </p>
              <p className="text-[10px] sm:text-xs text-rose-700 mb-3 sm:mb-4">
                <span className="font-medium">Max file size: 500KB</span> per document
              </p>
              <div className="space-y-3 sm:space-y-4">
                {rejectedDocuments.map((doc) => {
                  const rejectionReason = rejectionNotifications.get(doc.id);
                  const selectedFile = selectedReuploadFiles.get(doc.id);
                  return (
                    <div key={doc.id} className="bg-white p-3 sm:p-4 rounded-lg sm:rounded-xl border border-rose-200">
                      <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                            <p className="font-semibold text-xs sm:text-sm text-gray-900">
                              {getFullDocumentLabel(doc)}
                            </p>
                            <Badge variant="error" size="sm">Rejected</Badge>
                          </div>
                          <p className="text-[10px] sm:text-xs text-gray-600 truncate">{doc.name}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handlePreviewDocument(doc);
                          }}
                          title="Preview"
                          className="!p-1.5"
                        >
                          <Eye size={14} className="sm:w-4 sm:h-4" />
                        </Button>
                      </div>
                      {rejectionReason && (
                        <div className="mb-3 p-2 sm:p-3 bg-rose-50 rounded-lg border border-rose-100">
                          <p className="text-[10px] sm:text-xs font-medium text-rose-900 mb-0.5">Reason:</p>
                          <p className="text-[10px] sm:text-xs text-rose-800 whitespace-pre-wrap line-clamp-2">
                            {rejectionReason}
                          </p>
                        </div>
                      )}
                      <div className="mt-2 sm:mt-3">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleSelectReuploadFile(doc.id, file);
                              }
                            }}
                            className="hidden"
                            id={`reupload-${doc.id}`}
                            disabled={isReuploadingAll}
                          />
                          <label
                            htmlFor={`reupload-${doc.id}`}
                            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg cursor-pointer text-xs sm:text-sm ${
                              isReuploadingAll 
                                ? 'opacity-50 cursor-not-allowed bg-gray-50' 
                                : 'hover:bg-gray-50 bg-white'
                            }`}
                          >
                            <Upload size={14} className="sm:w-4 sm:h-4" />
                            <span>Choose</span>
                          </label>
                          {selectedFile && (
                            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                              <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                              <span className="truncate max-w-[100px] sm:max-w-[150px]">{selectedFile.name}</span>
                              <button
                                onClick={() => handleRemoveReuploadFile(doc.id)}
                                className="text-rose-600 hover:text-rose-700 p-0.5"
                                disabled={isReuploadingAll}
                              >
                                <X size={12} className="sm:w-4 sm:h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Submit Button for Re-uploads */}
              {selectedReuploadFiles.size > 0 && (
                <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-rose-200 flex justify-center">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSubmitReuploadFiles}
                    disabled={isReuploadingAll}
                    className="min-w-[140px] sm:min-w-[180px] !text-xs sm:!text-sm"
                  >
                    {isReuploadingAll ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-1.5"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload size={14} className="sm:w-4 sm:h-4 mr-1.5" />
                        Submit
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Main Upload Section - Only show if no rejected documents */}
      {rejectedDocuments.length === 0 && isUploadEnabled && (
        <Card className="p-3 sm:p-5 mb-4 sm:mb-6">
          <h2 className="font-serif text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-3">Upload Documents</h2>
          <p className="text-[10px] sm:text-xs text-gray-500 mb-4 sm:mb-5">
            <span className="text-gold-600 font-medium">Max file size: 500KB</span> per document. Supported formats: Images and PDF.
          </p>
          
          {/* Groom's Documents */}
          <div className="mb-5 sm:mb-6">
            <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1">Groom's Documents</h3>
            <p className="text-[10px] sm:text-xs text-gray-600 mb-3 sm:mb-4">Aadhaar card + 10th certificate or Voter ID</p>
            
            <div className="space-y-3 sm:space-y-4">
              {/* Groom's Aadhaar */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  Aadhaar Card <span className="text-rose-600">*</span>
                </label>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <input type="file" accept="image/*,.pdf" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelection(file, documentTypes.userAadhaar, 'user', 'aadhaar'); }} className="hidden" id="user-aadhaar" disabled={!isUploadEnabled} />
                  <label htmlFor="user-aadhaar" className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg cursor-pointer text-xs sm:text-sm ${!isUploadEnabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}>
                    <Upload size={14} className="sm:w-4 sm:h-4" />
                    <span>Choose</span>
                  </label>
                  {selectedFiles.has(documentTypes.userAadhaar) && (
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                      <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="truncate max-w-[120px] sm:max-w-[180px]">{selectedFiles.get(documentTypes.userAadhaar)!.name}</span>
                      <button onClick={() => handleRemoveSelectedFile(documentTypes.userAadhaar)} className="text-rose-600 hover:text-rose-700 p-0.5"><X size={12} className="sm:w-4 sm:h-4" /></button>
                    </div>
                  )}
                </div>
              </div>

              {/* Groom's Second Document */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  10th Certificate / Voter ID <span className="text-rose-600">*</span>
                </label>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <input type="file" accept="image/*,.pdf" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const fileName = file.name.toLowerCase(); const type = fileName.includes('voter') || fileName.includes('voterid') ? 'voter_id' : 'tenth_certificate'; handleFileSelection(file, documentTypes.userSecondDoc, 'user', type); }}} className="hidden" id="user-second-doc" disabled={!isUploadEnabled} />
                  <label htmlFor="user-second-doc" className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg cursor-pointer text-xs sm:text-sm ${!isUploadEnabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}>
                    <Upload size={14} className="sm:w-4 sm:h-4" />
                    <span>Choose</span>
                  </label>
                  {selectedFiles.has(documentTypes.userSecondDoc) && (
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                      <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="truncate max-w-[120px] sm:max-w-[180px]">{selectedFiles.get(documentTypes.userSecondDoc)!.name}</span>
                      <button onClick={() => handleRemoveSelectedFile(documentTypes.userSecondDoc)} className="text-rose-600 hover:text-rose-700 p-0.5"><X size={12} className="sm:w-4 sm:h-4" /></button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bride's Documents */}
          <div className="mb-5 sm:mb-6 pt-4 sm:pt-5 border-t border-gray-200">
            <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1">Bride's Documents</h3>
            <p className="text-[10px] sm:text-xs text-gray-600 mb-3 sm:mb-4">Aadhaar card + 10th certificate or Voter ID</p>
            
            <div className="space-y-3 sm:space-y-4">
              {/* Bride's Aadhaar */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  Aadhaar Card <span className="text-rose-600">*</span>
                </label>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <input type="file" accept="image/*,.pdf" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelection(file, documentTypes.partnerAadhaar, 'partner', 'aadhaar'); }} className="hidden" id="partner-aadhaar" disabled={!isUploadEnabled} />
                  <label htmlFor="partner-aadhaar" className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg cursor-pointer text-xs sm:text-sm ${!isUploadEnabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}>
                    <Upload size={14} className="sm:w-4 sm:h-4" />
                    <span>Choose</span>
                  </label>
                  {selectedFiles.has(documentTypes.partnerAadhaar) && (
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                      <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="truncate max-w-[120px] sm:max-w-[180px]">{selectedFiles.get(documentTypes.partnerAadhaar)!.name}</span>
                      <button onClick={() => handleRemoveSelectedFile(documentTypes.partnerAadhaar)} className="text-rose-600 hover:text-rose-700 p-0.5"><X size={12} className="sm:w-4 sm:h-4" /></button>
                    </div>
                  )}
                </div>
              </div>

              {/* Bride's Second Document */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  10th Certificate / Voter ID <span className="text-rose-600">*</span>
                </label>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <input type="file" accept="image/*,.pdf" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const fileName = file.name.toLowerCase(); const type = fileName.includes('voter') || fileName.includes('voterid') ? 'voter_id' : 'tenth_certificate'; handleFileSelection(file, documentTypes.partnerSecondDoc, 'partner', type); }}} className="hidden" id="partner-second-doc" disabled={!isUploadEnabled} />
                  <label htmlFor="partner-second-doc" className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg cursor-pointer text-xs sm:text-sm ${!isUploadEnabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}>
                    <Upload size={14} className="sm:w-4 sm:h-4" />
                    <span>Choose</span>
                  </label>
                  {selectedFiles.has(documentTypes.partnerSecondDoc) && (
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                      <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="truncate max-w-[120px] sm:max-w-[180px]">{selectedFiles.get(documentTypes.partnerSecondDoc)!.name}</span>
                      <button onClick={() => handleRemoveSelectedFile(documentTypes.partnerSecondDoc)} className="text-rose-600 hover:text-rose-700 p-0.5"><X size={12} className="sm:w-4 sm:h-4" /></button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Joint Photograph */}
          <div className="pt-4 sm:pt-5 border-t border-gray-200">
            <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1">Joint Photograph</h3>
            <p className="text-[10px] sm:text-xs text-gray-600 mb-3 sm:mb-4">Photo of bride and groom together</p>
            
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                Joint Photo <span className="text-rose-600">*</span>
              </label>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelection(file, documentTypes.jointPhoto, 'joint', 'photo'); }} className="hidden" id="joint-photograph" disabled={!isUploadEnabled} />
                <label htmlFor="joint-photograph" className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg cursor-pointer text-xs sm:text-sm ${!isUploadEnabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}>
                  <Upload size={14} className="sm:w-4 sm:h-4" />
                  <span>Choose</span>
                </label>
                {selectedFiles.has(documentTypes.jointPhoto) && (
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                    <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="truncate max-w-[120px] sm:max-w-[180px]">{selectedFiles.get(documentTypes.jointPhoto)!.name}</span>
                    <button onClick={() => handleRemoveSelectedFile(documentTypes.jointPhoto)} className="text-rose-600 hover:text-rose-700 p-0.5"><X size={12} className="sm:w-4 sm:h-4" /></button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {!isUploadEnabled && rejectedDocuments.length === 0 && (
        <Card className="p-3 sm:p-5 mb-4 sm:mb-6">
          <div className="p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl">
            <div className="flex items-start gap-2 sm:gap-3">
              <Info size={16} className="sm:w-5 sm:h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-[10px] sm:text-xs text-blue-800">
                <p className="font-medium mb-0.5 sm:mb-1">Application Submitted</p>
                <p>Documents under review. You'll be notified if re-upload is needed.</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl">
        <div className="flex items-start gap-2 sm:gap-3">
          <AlertCircle size={16} className="sm:w-5 sm:h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-[10px] sm:text-xs text-blue-800">
            <p className="font-medium mb-0.5 sm:mb-1">Security & Privacy</p>
            <p>Documents are encrypted. URLs expire in 24 hours.</p>
          </div>
        </div>
      </div>

      {/* Final Submit Button */}
      {isUploadEnabled && selectedFiles.size > 0 && (
        <div className="mt-5 sm:mt-6 flex items-center justify-center">
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmitDocuments}
            disabled={isUploading}
            className="min-w-[140px] sm:min-w-[180px] !text-xs sm:!text-sm"
          >
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-1.5"></div>
                Uploading...
              </>
            ) : (
              <>
                <Upload size={14} className="sm:w-4 sm:h-4 mr-1.5" />
                Submit
              </>
            )}
          </Button>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDocument && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-2 sm:p-4"
          onClick={closePreview}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div
            className="bg-white rounded-lg sm:rounded-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
            style={{ zIndex: 101 }}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 p-2.5 sm:p-4 flex items-center justify-between z-10 gap-2">
              <h3 className="font-semibold text-xs sm:text-sm text-gray-900 truncate flex-1">
                {getFullDocumentLabel(previewDocument)}: {previewDocument.name}
              </h3>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <Badge
                  variant={
                    previewDocument.status === 'approved'
                      ? 'success'
                      : previewDocument.status === 'rejected'
                      ? 'error'
                      : 'default'
                  }
                  className="!text-[10px] sm:!text-xs"
                >
                  {previewDocument.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="!px-2 sm:!px-3 !text-xs"
                  onClick={() => {
                    const urlToDownload = previewUrl || previewDocument.url;
                    window.open(urlToDownload, '_blank');
                  }}
                >
                  <Download size={14} className="sm:w-4 sm:h-4 mr-1" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={closePreview} className="!p-1.5 sm:!p-2">
                  <X size={16} className="sm:w-[18px] sm:h-[18px]" />
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
                          console.log('Trying fallback URL:', previewDocument.url);
                          (e.target as HTMLImageElement).src = previewDocument.url;
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
                  <Button variant="primary" size="sm" className="!text-xs sm:!text-sm" onClick={() => window.open(previewDocument.url, '_blank')}>
                    <Download size={14} className="sm:w-4 sm:h-4 mr-1.5" />
                    Open in New Tab
                  </Button>
                </div>
              )}
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

export default DocumentsPage;

