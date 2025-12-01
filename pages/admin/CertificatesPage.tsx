import React, { useState, useEffect } from 'react';
import { certificateService } from '../../services/certificates';
import { useNotification } from '../../contexts/NotificationContext';
import { Certificate } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import FileUpload from '../../components/ui/FileUpload';
import Badge from '../../components/ui/Badge';
import { FileText, Download, Eye } from 'lucide-react';
import { safeFormatDateObject } from '../../utils/dateUtils';

const CertificatesPage: React.FC = () => {
  const { showToast } = useNotification();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const loadCertificates = async () => {
      try {
        const certs = await certificateService.getAllCertificates();
        setCertificates(certs);
      } catch (error) {
        console.error('Failed to load certificates:', error);
      }
    };

    loadCertificates();
  }, []);

  const handleUpload = async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      // Mock: In real app, upload to storage first
      const mockUrl = URL.createObjectURL(files[0]);
      
      // For demo, use a mock user and application ID
      const cert = await certificateService.issueCertificate(
        'user-1',
        'app-1',
        mockUrl
      );
      
      setCertificates([...certificates, cert]);
      showToast('Certificate uploaded successfully', 'success');
    } catch (error) {
      showToast('Failed to upload certificate', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <h1 className="font-serif text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">Certificate Management</h1>
        <p className="text-xs sm:text-sm text-gray-600">Upload and manage marriage certificates</p>
      </div>

      <Card className="p-3 sm:p-4 lg:p-6 mb-3 sm:mb-4 lg:mb-6">
        <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-2 sm:mb-3 lg:mb-4">Upload Certificate</h3>
        <FileUpload
          accept=".pdf"
          maxSize={10 * 1024 * 1024}
          maxFiles={1}
          onFilesChange={handleUpload}
          label="Certificate PDF"
          helperText="Upload signed certificate PDF (max 10MB)"
        />
      </Card>

      <Card className="p-3 sm:p-4 lg:p-6">
        <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-2 sm:mb-3 lg:mb-4">All Certificates</h3>
        <div className="space-y-2 sm:space-y-3 lg:space-y-4">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="p-2.5 sm:p-3 lg:p-4 bg-gray-50 rounded-lg sm:rounded-xl flex items-center justify-between gap-2 sm:gap-3 lg:gap-4"
            >
              <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 min-w-0 flex-1">
                <div className="w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 rounded-lg bg-gold-100 flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-gold-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-xs sm:text-sm lg:text-base text-gray-900 truncate">{cert.name}</p>
                  <p className="text-[10px] sm:text-xs lg:text-sm text-gray-500">
                    Issued: {safeFormatDateObject(new Date(cert.issuedOn), 'MMM d, yyyy')}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1 truncate">
                    Verification ID: {cert.verificationId}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 flex-shrink-0">
                <Badge variant={cert.verified ? 'success' : 'warning'} className="!text-[10px] sm:!text-xs">
                  {cert.verified ? 'Verified' : 'Pending'}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="!text-[10px] sm:!text-xs !px-1.5 sm:!px-2"
                  onClick={() => window.open(cert.pdfUrl, '_blank')}
                >
                  <Eye size={12} className="sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                  <span className="hidden sm:inline">View</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="!text-[10px] sm:!text-xs !px-1.5 sm:!px-2"
                  onClick={async () => {
                    try {
                      const url = await certificateService.getSignedUrl(cert.id);
                      window.open(url, '_blank');
                    } catch (error) {
                      showToast('Failed to generate download link', 'error');
                    }
                  }}
                >
                  <Download size={12} className="sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
              </div>
            </div>
          ))}
        </div>

        {certificates.length === 0 && (
          <div className="text-center py-6 sm:py-8 lg:py-12">
            <FileText size={32} className="sm:w-12 sm:h-12 text-gray-300 mx-auto mb-2 sm:mb-3 lg:mb-4" />
            <p className="text-xs sm:text-sm text-gray-500">No certificates uploaded yet</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default CertificatesPage;

