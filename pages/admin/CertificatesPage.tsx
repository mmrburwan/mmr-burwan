import React, { useState, useEffect } from 'react';
import { certificateService } from '../../services/certificates';
import { useNotification } from '../../contexts/NotificationContext';
import { Certificate } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { FileText, Download, Eye, Users, Calendar, Hash } from 'lucide-react';
import { safeFormatDateObject } from '../../utils/dateUtils';

const CertificatesPage: React.FC = () => {
  const { showToast } = useNotification();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCertificates = async () => {
      try {
        setIsLoading(true);
        const certs = await certificateService.getAllCertificates();
        setCertificates(certs);
      } catch (error) {
        console.error('Failed to load certificates:', error);
        showToast('Failed to load certificates', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadCertificates();
  }, [showToast]);

  const handleDownload = async (cert: Certificate) => {
    try {
      const url = await certificateService.getSignedUrl(cert.id);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Marriage-Certificate-${cert.certificateNumber || cert.verificationId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Certificate downloaded successfully', 'success');
    } catch (error) {
      showToast('Failed to generate download link', 'error');
    }
  };

  const handleView = async (cert: Certificate) => {
    try {
      const url = await certificateService.getSignedUrl(cert.id);
      window.open(url, '_blank');
    } catch (error) {
      showToast('Failed to open certificate', 'error');
    }
  };

  return (
    <div>
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <h1 className="font-serif text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">Verified Certificates</h1>
        <p className="text-xs sm:text-sm text-gray-600">View and download all verified marriage certificates</p>
      </div>

      <Card className="p-3 sm:p-4 lg:p-6">
        <div className="flex items-center justify-between mb-3 sm:mb-4 lg:mb-6">
          <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900">
            All Verified Certificates ({certificates.length})
          </h3>
        </div>

        {isLoading ? (
          <div className="text-center py-8 sm:py-12 lg:py-16">
            <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-t-2 border-b-2 border-gold-500 mx-auto mb-3 sm:mb-4"></div>
            <p className="text-xs sm:text-sm text-gray-500">Loading certificates...</p>
          </div>
        ) : certificates.length === 0 ? (
          <div className="text-center py-6 sm:py-8 lg:py-12">
            <FileText size={32} className="sm:w-12 sm:h-12 text-gray-300 mx-auto mb-2 sm:mb-3 lg:mb-4" />
            <p className="text-xs sm:text-sm text-gray-500">No verified certificates yet</p>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-1">Certificates will appear here after applications are verified</p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3 lg:space-y-4">
            {certificates.map((cert) => (
              <div
                key={cert.id}
                className="p-3 sm:p-4 lg:p-5 bg-gray-50 hover:bg-gray-100 rounded-lg sm:rounded-xl transition-colors border border-gray-200"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                  <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-lg bg-gold-100 flex items-center justify-center flex-shrink-0">
                      <FileText size={20} className="sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-gold-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                        <p className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900">{cert.name}</p>
                        <Badge variant="success" className="!text-[10px] sm:!text-xs">
                          Verified
                        </Badge>
                      </div>
                      
                      {cert.certificateNumber && (
                        <div className="flex items-center gap-1.5 mb-1 sm:mb-1.5">
                          <Hash size={12} className="sm:w-3.5 sm:h-3.5 text-gray-400 flex-shrink-0" />
                          <p className="text-[10px] sm:text-xs lg:text-sm text-gray-700 font-mono">
                            {cert.certificateNumber}
                          </p>
                        </div>
                      )}
                      
                      {(cert.groomName || cert.brideName) && (
                        <div className="flex items-center gap-1.5 mb-1 sm:mb-1.5">
                          <Users size={12} className="sm:w-3.5 sm:h-3.5 text-gray-400 flex-shrink-0" />
                          <p className="text-[10px] sm:text-xs lg:text-sm text-gray-600">
                            {cert.groomName && cert.brideName 
                              ? `${cert.groomName} & ${cert.brideName}`
                              : cert.groomName || cert.brideName || 'N/A'}
                          </p>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} className="sm:w-3.5 sm:h-3.5 text-gray-400 flex-shrink-0" />
                          <p className="text-[10px] sm:text-xs text-gray-500">
                            Issued: {safeFormatDateObject(new Date(cert.issuedOn), 'MMM d, yyyy')}
                          </p>
                        </div>
                        {cert.registrationDate && (
                          <div className="flex items-center gap-1.5">
                            <Calendar size={12} className="sm:w-3.5 sm:h-3.5 text-gray-400 flex-shrink-0" />
                            <p className="text-[10px] sm:text-xs text-gray-500">
                              Registered: {safeFormatDateObject(new Date(cert.registrationDate), 'MMM d, yyyy')}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <p className="text-[10px] sm:text-xs text-gray-400 mt-1.5 sm:mt-2 truncate">
                        Verification ID: {cert.verificationId}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 sm:ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="!text-[10px] sm:!text-xs !px-2 sm:!px-3"
                      onClick={() => handleView(cert)}
                    >
                      <Eye size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                      <span className="hidden sm:inline">View</span>
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      className="!text-[10px] sm:!text-xs !px-2 sm:!px-3"
                      onClick={() => handleDownload(cert)}
                    >
                      <Download size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                      <span className="hidden sm:inline">Download</span>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default CertificatesPage;

