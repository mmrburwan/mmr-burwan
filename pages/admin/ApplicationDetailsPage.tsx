import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { applicationService } from '../../services/application';
import { documentService } from '../../services/documents';
import { adminService } from '../../services/admin';
import { Application, Document } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import { ArrowLeft, FileText, CheckCircle, X, Eye, Edit2, Save, XCircle, Download } from 'lucide-react';
import { safeFormatDate } from '../../utils/dateUtils';

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

  // Edit form state
  const [editForm, setEditForm] = useState<any>({});

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
          });
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

  const handleRejectDocument = async (documentId: string) => {
    if (!user) return;
    
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    setIsProcessingDoc(documentId);
    try {
      await adminService.rejectDocument(documentId, reason, user.id, user.name || user.email);
      const updated = await documentService.getDocuments(application!.id);
      setDocuments(updated);
      showToast('Document rejected', 'success');
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
      });
    }
    setIsEditing(false);
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

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/admin')}
          className="mb-4"
        >
          <ArrowLeft size={18} className="mr-2" />
          Back to Dashboard
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-4xl font-bold text-gray-900 mb-2">Application Details</h1>
            <p className="text-gray-600">Application ID: {application.id}</p>
          </div>
          <div className="flex items-center gap-3">
            {!isEditing ? (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Edit2 size={18} className="mr-2" />
                Edit Application
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="primary" onClick={handleSaveEdit}>
                  <Save size={18} className="mr-2" />
                  Save Changes
                </Button>
                <Button variant="outline" onClick={handleCancelEdit}>
                  <X size={18} className="mr-2" />
                  Cancel
                </Button>
              </div>
            )}
            <Badge variant={application.status === 'submitted' ? 'info' : application.status === 'approved' ? 'success' : 'default'}>
              {application.status}
            </Badge>
            {application.verified !== undefined && (
              <Badge variant={application.verified ? 'success' : 'default'}>
                {application.verified ? 'Verified' : 'Unverified'}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* User Aadhaar Details */}
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">User's Aadhaar Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">Full Name</p>
              {isEditing ? (
                <div className="grid grid-cols-2 gap-2">
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
                <p className="font-medium text-gray-900">
                  {userDetails.firstName || '-'} {userDetails.lastName || ''}
                </p>
              )}
            </div>
            <div>
              <p className="text-gray-500 mb-1">Date of Birth</p>
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

        {/* Partner Aadhaar Details */}
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Partner's Aadhaar Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">Full Name</p>
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
                <p className="font-medium text-gray-900">
                  {partnerForm.firstName || '-'} {partnerForm.lastName || ''}
                </p>
              )}
            </div>
            <div>
              <p className="text-gray-500 mb-1">Date of Birth</p>
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

        {/* User Addresses */}
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">User's Addresses</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Permanent Address</p>
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={userAddress.street || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      userAddress: { ...userAddress, street: e.target.value }
                    })}
                    placeholder="Street"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={userAddress.city || ''}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        userAddress: { ...userAddress, city: e.target.value }
                      })}
                      placeholder="City"
                    />
                    <Input
                      value={userAddress.state || ''}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        userAddress: { ...userAddress, state: e.target.value }
                      })}
                      placeholder="State"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={userAddress.zipCode || ''}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        userAddress: { ...userAddress, zipCode: e.target.value }
                      })}
                      placeholder="Zip Code"
                    />
                    <Input
                      value={userAddress.country || ''}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        userAddress: { ...userAddress, country: e.target.value }
                      })}
                      placeholder="Country"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600 space-y-1">
                  <p>{userAddress.street || '-'}</p>
                  <p>{userAddress.city || '-'}, {userAddress.state || '-'}</p>
                  <p>{userAddress.zipCode || '-'}, {userAddress.country || '-'}</p>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Current Address</p>
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={userCurrentAddress.street || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      userCurrentAddress: { ...userCurrentAddress, street: e.target.value }
                    })}
                    placeholder="Street"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={userCurrentAddress.city || ''}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        userCurrentAddress: { ...userCurrentAddress, city: e.target.value }
                      })}
                      placeholder="City"
                    />
                    <Input
                      value={userCurrentAddress.state || ''}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        userCurrentAddress: { ...userCurrentAddress, state: e.target.value }
                      })}
                      placeholder="State"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={userCurrentAddress.zipCode || ''}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        userCurrentAddress: { ...userCurrentAddress, zipCode: e.target.value }
                      })}
                      placeholder="Zip Code"
                    />
                    <Input
                      value={userCurrentAddress.country || ''}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        userCurrentAddress: { ...userCurrentAddress, country: e.target.value }
                      })}
                      placeholder="Country"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600 space-y-1">
                  <p>{userCurrentAddress.street || '-'}</p>
                  <p>{userCurrentAddress.city || '-'}, {userCurrentAddress.state || '-'}</p>
                  <p>{userCurrentAddress.zipCode || '-'}, {userCurrentAddress.country || '-'}</p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Partner Addresses */}
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Partner's Addresses</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Permanent Address</p>
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={partnerAddress.street || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      partnerAddress: { ...partnerAddress, street: e.target.value }
                    })}
                    placeholder="Street"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={partnerAddress.city || ''}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        partnerAddress: { ...partnerAddress, city: e.target.value }
                      })}
                      placeholder="City"
                    />
                    <Input
                      value={partnerAddress.state || ''}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        partnerAddress: { ...partnerAddress, state: e.target.value }
                      })}
                      placeholder="State"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={partnerAddress.zipCode || ''}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        partnerAddress: { ...partnerAddress, zipCode: e.target.value }
                      })}
                      placeholder="Zip Code"
                    />
                    <Input
                      value={partnerAddress.country || ''}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        partnerAddress: { ...partnerAddress, country: e.target.value }
                      })}
                      placeholder="Country"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600 space-y-1">
                  <p>{partnerAddress.street || '-'}</p>
                  <p>{partnerAddress.city || '-'}, {partnerAddress.state || '-'}</p>
                  <p>{partnerAddress.zipCode || '-'}, {partnerAddress.country || '-'}</p>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Current Address</p>
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={partnerCurrentAddress.street || ''}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      partnerCurrentAddress: { ...partnerCurrentAddress, street: e.target.value }
                    })}
                    placeholder="Street"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={partnerCurrentAddress.city || ''}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        partnerCurrentAddress: { ...partnerCurrentAddress, city: e.target.value }
                      })}
                      placeholder="City"
                    />
                    <Input
                      value={partnerCurrentAddress.state || ''}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        partnerCurrentAddress: { ...partnerCurrentAddress, state: e.target.value }
                      })}
                      placeholder="State"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={partnerCurrentAddress.zipCode || ''}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        partnerCurrentAddress: { ...partnerCurrentAddress, zipCode: e.target.value }
                      })}
                      placeholder="Zip Code"
                    />
                    <Input
                      value={partnerCurrentAddress.country || ''}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        partnerCurrentAddress: { ...partnerCurrentAddress, country: e.target.value }
                      })}
                      placeholder="Country"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600 space-y-1">
                  <p>{partnerCurrentAddress.street || '-'}</p>
                  <p>{partnerCurrentAddress.city || '-'}, {partnerCurrentAddress.state || '-'}</p>
                  <p>{partnerCurrentAddress.zipCode || '-'}, {partnerCurrentAddress.country || '-'}</p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Documents */}
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Uploaded Documents</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">User's Documents</p>
              <div className="space-y-2">
                {documents.filter(d => d.belongsTo === 'user').map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    <FileText size={18} className="text-gold-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">
                        {getDocumentTypeLabel(doc.type)}: {doc.name}
                      </p>
                    </div>
                    <Badge variant={doc.status === 'approved' ? 'success' : doc.status === 'rejected' ? 'error' : 'default'} className="flex-shrink-0">
                      {doc.status}
                    </Badge>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
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
                        <Eye size={16} />
                      </Button>
                      {doc.status === 'pending' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApproveDocument(doc.id)}
                            disabled={isProcessingDoc === doc.id}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Approve"
                          >
                            <CheckCircle size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRejectDocument(doc.id)}
                            disabled={isProcessingDoc === doc.id}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Reject"
                          >
                            <XCircle size={16} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {documents.filter(d => d.belongsTo === 'user').length === 0 && (
                  <p className="text-sm text-gray-400 italic">No documents uploaded</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Partner's Documents</p>
              <div className="space-y-2">
                {documents.filter(d => d.belongsTo === 'partner').map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    <FileText size={18} className="text-gold-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">
                        {getDocumentTypeLabel(doc.type)}: {doc.name}
                      </p>
                    </div>
                    <Badge variant={doc.status === 'approved' ? 'success' : doc.status === 'rejected' ? 'error' : 'default'} className="flex-shrink-0">
                      {doc.status}
                    </Badge>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
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
                        <Eye size={16} />
                      </Button>
                      {doc.status === 'pending' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApproveDocument(doc.id)}
                            disabled={isProcessingDoc === doc.id}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Approve"
                          >
                            <CheckCircle size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRejectDocument(doc.id)}
                            disabled={isProcessingDoc === doc.id}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Reject"
                          >
                            <XCircle size={16} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {documents.filter(d => d.belongsTo === 'partner').length === 0 && (
                  <p className="text-sm text-gray-400 italic">No documents uploaded</p>
                )}
              </div>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => {
          setPreviewDocument(null);
          setPreviewUrl(null);
        }}>
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
              <h3 className="font-semibold text-gray-900">
                {getDocumentTypeLabel(previewDocument.type)}: {previewDocument.name}
              </h3>
              <div className="flex items-center gap-2">
                <Badge variant={previewDocument.status === 'approved' ? 'success' : previewDocument.status === 'rejected' ? 'error' : 'default'}>
                  {previewDocument.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const urlToDownload = previewUrl || previewDocument.url;
                    window.open(urlToDownload, '_blank');
                  }}
                >
                  <Download size={18} className="mr-2" />
                  Download
                </Button>
                <Button variant="ghost" size="sm" onClick={() => {
                  setPreviewDocument(null);
                  setPreviewUrl(null);
                }}>
                  <X size={18} />
                </Button>
              </div>
            </div>
            <div className="p-6">
              {isLoadingPreview ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold-500"></div>
                </div>
              ) : previewUrl ? (
                <>
                  {isImage(previewDocument.mimeType) ? (
                    <img
                      src={previewUrl}
                      alt={previewDocument.name}
                      className="max-w-full h-auto rounded-lg shadow-lg mx-auto"
                      onError={(e) => {
                        console.error('Failed to load image:', e);
                        (e.target as HTMLImageElement).src = previewDocument.url;
                      }}
                    />
                  ) : isPDF(previewDocument.mimeType) ? (
                    <iframe
                      src={previewUrl}
                      className="w-full h-[70vh] rounded-lg border border-gray-200"
                      title={previewDocument.name}
                      onError={() => {
                        console.error('Failed to load PDF');
                      }}
                    />
                  ) : (
                    <div className="text-center py-12">
                      <FileText size={48} className="text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4">Preview not available for this file type</p>
                      <Button variant="primary" onClick={() => window.open(previewUrl, '_blank')}>
                        <Download size={18} className="mr-2" />
                        Download to View
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <FileText size={48} className="text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">Failed to load document preview</p>
                  <Button variant="primary" onClick={() => window.open(previewDocument.url, '_blank')}>
                    <Download size={18} className="mr-2" />
                    Download to View
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationDetailsPage;
