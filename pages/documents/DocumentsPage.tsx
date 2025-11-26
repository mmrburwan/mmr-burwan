import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { applicationService } from '../../services/application';
import { documentService } from '../../services/documents';
import { useNotification } from '../../contexts/NotificationContext';
import { Document } from '../../types';
import FileUpload from '../../components/ui/FileUpload';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { Upload, FileText, AlertCircle, ArrowLeft } from 'lucide-react';

const DocumentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useNotification();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    const loadData = async () => {
      try {
        const application = await applicationService.getApplication(user.id);
        if (application) {
          setApplicationId(application.id);
          const docs = await documentService.getDocuments(application.id);
          setDocuments(docs);
        }
      } catch (error) {
        console.error('Failed to load documents:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, navigate]);

  const handleFileUpload = async (files: File[]) => {
    if (!applicationId) {
      showToast('Please start an application first', 'error');
      navigate('/application');
      return;
    }

    for (const file of files) {
      try {
        const docType = file.type.startsWith('image/') ? 'photo' : 
                       file.name.endsWith('.pdf') ? 'id' : 'other';
        await documentService.uploadDocument(applicationId, file, docType);
        showToast(`${file.name} uploaded successfully`, 'success');
      } catch (error) {
        showToast(`Failed to upload ${file.name}`, 'error');
      }
    }

    // Refresh documents
    const updated = await documentService.getDocuments(applicationId);
    setDocuments(updated);
  };

  const handleRemove = async (documentId: string) => {
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
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Card className="p-8 text-center">
          <AlertCircle size={48} className="text-gray-400 mx-auto mb-4" />
          <h2 className="font-serif text-2xl font-bold text-gray-900 mb-2">No Application Found</h2>
          <p className="text-gray-600 mb-6">
            Please start an application before uploading documents.
          </p>
          <Button variant="primary" onClick={() => navigate('/application')}>
            Start Application
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="flex-shrink-0"
          >
            <ArrowLeft size={18} className="mr-2" />
            Back
          </Button>
        </div>
        <h1 className="font-serif text-4xl font-bold text-gray-900 mb-2">Upload Documents</h1>
        <p className="text-gray-600">Upload all required documents for your marriage registration</p>
      </div>

      <Card className="p-8 mb-8">
        <FileUpload
          accept="image/*,.pdf"
          maxSize={10 * 1024 * 1024}
          maxFiles={10}
          onFilesChange={handleFileUpload}
          existingFiles={documents.map((d) => ({
            name: d.name,
            url: d.url,
            type: d.mimeType,
          }))}
          onRemoveFile={(index) => handleRemove(documents[index].id)}
          label="Document Upload"
          helperText="Accepted formats: PDF, JPG, PNG. Maximum file size: 10MB"
        />
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText size={20} className="text-gold-600" />
          Required Documents
        </h3>
        <div className="space-y-3">
          {[
            { name: 'National ID (Front & Back)', type: 'id' },
            { name: 'Passport-sized Photos (2 copies)', type: 'photo' },
            { name: 'Birth Certificate', type: 'certificate' },
            { name: 'Previous Marriage Certificate (if applicable)', type: 'certificate' },
          ].map((req, index) => {
            const uploaded = documents.find((d) => d.type === req.type);
            return (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
              >
                <span className="text-sm text-gray-700">{req.name}</span>
                {uploaded ? (
                  <Badge variant="success">Uploaded</Badge>
                ) : (
                  <Badge variant="warning">Pending</Badge>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Security & Privacy</p>
            <p>
              All documents are encrypted and stored securely. Signed URLs expire after 24 hours.
              Your personal information is protected according to government privacy standards.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentsPage;

