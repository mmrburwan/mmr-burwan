import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';
import { XCircle, CheckCircle, Info, Upload, Award, Download, Loader2 } from 'lucide-react';
import { Notification } from '../../types';
import { safeFormatDate } from '../../utils/dateUtils';
import { applicationService } from '../../services/application';
import { downloadCertificate } from '../../utils/certificateGenerator';
import { useAuth } from '../../contexts/AuthContext';
import Button from './Button';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notification: Notification | null;
  onMarkAsRead?: (notificationId: string) => void;
  onNavigate?: () => void;
}

const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  notification,
  onMarkAsRead,
  onNavigate,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (!notification || !isOpen) return null;

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'document_rejected':
        return <XCircle size={18} className="sm:w-6 sm:h-6 text-rose-600" />;
      case 'document_approved':
        return <CheckCircle size={18} className="sm:w-6 sm:h-6 text-green-600" />;
      case 'application_approved':
        return <CheckCircle size={18} className="sm:w-6 sm:h-6 text-green-600" />;
      case 'application_rejected':
        return <XCircle size={18} className="sm:w-6 sm:h-6 text-rose-600" />;
      case 'application_verified':
        return <Award size={18} className="sm:w-6 sm:h-6 text-gold-600" />;
      case 'certificate_ready':
        return <Award size={18} className="sm:w-6 sm:h-6 text-gold-600" />;
      default:
        return <Info size={18} className="sm:w-6 sm:h-6 text-blue-600" />;
    }
  };

  const handleClose = () => {
    if (!notification.read && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={notification.title}
      size="md"
    >
      <div className="space-y-3 sm:space-y-4 lg:space-y-6">
        {/* Notification Header */}
        <div className="flex items-start gap-2.5 sm:gap-4 p-2.5 sm:p-4 bg-gray-50 rounded-lg sm:rounded-xl">
          <div className="flex-shrink-0 mt-0.5">
            {getNotificationIcon(notification.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1 sm:mb-2 gap-2">
              <h3 className="font-semibold text-xs sm:text-sm text-gray-900 truncate">{notification.title}</h3>
              {!notification.read && (
                <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-100 text-blue-700 text-[10px] sm:text-xs font-medium rounded-full flex-shrink-0">
                  New
                </span>
              )}
            </div>
            <p className="text-[10px] sm:text-xs text-gray-500">
              {safeFormatDate(notification.createdAt, 'MMM d, yyyy h:mm a')}
            </p>
          </div>
        </div>

        {/* Notification Message */}
        <div className="p-2.5 sm:p-4 bg-white border border-gray-200 rounded-lg sm:rounded-xl">
          <p className="text-[10px] sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Message:</p>
          <p className="text-[11px] sm:text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {notification.message}
          </p>
        </div>

        {/* Download Error Message */}
        {downloadError && (
          <div className="p-2 sm:p-3 bg-rose-50 border border-rose-200 rounded-lg sm:rounded-xl">
            <p className="text-[10px] sm:text-sm text-rose-700">{downloadError}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-gray-200">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            className="flex-1 !text-xs sm:!text-sm"
          >
            Close
          </Button>
          {notification.type === 'document_rejected' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const targetPath = '/documents';
                onClose();
                if (onNavigate) {
                  onNavigate();
                }
                requestAnimationFrame(() => {
                  navigate(targetPath);
                });
              }}
              className="flex-1 !text-xs sm:!text-sm"
            >
              <Upload size={14} className="sm:w-4 sm:h-4 mr-1.5" />
              Upload Doc
            </Button>
          )}
          {notification.type === 'certificate_ready' && user && (
            <Button
              variant="primary"
              size="sm"
              disabled={isDownloading}
              onClick={async () => {
                if (!user) return;
                setIsDownloading(true);
                setDownloadError(null);
                try {
                  const application = await applicationService.getApplication(user.id);
                  if (!application) throw new Error('Application not found');
                  if (!application.verified) throw new Error('Application is not yet verified');
                  
                  // Check if certificate exists
                  const { certificateService } = await import('../../services/certificates');
                  const certificate = await certificateService.getCertificateByApplicationId(application.id);
                  if (!certificate) {
                    throw new Error('Certificate is not yet available. Please wait for the administrator to generate it.');
                  }
                  
                  await downloadCertificate(application);
                  onClose();
                  if (onNavigate) onNavigate();
                } catch (error: any) {
                  console.error('Failed to download certificate:', error);
                  setDownloadError(error.message || 'Failed to download certificate');
                } finally {
                  setIsDownloading(false);
                }
              }}
              className="flex-1 !text-xs sm:!text-sm bg-gold-500 hover:bg-gold-600"
            >
              {isDownloading ? (
                <>
                  <Loader2 size={14} className="sm:w-4 sm:h-4 mr-1.5 animate-spin" />
                  <span className="hidden sm:inline">Downloading...</span>
                  <span className="sm:hidden">Loading</span>
                </>
              ) : (
                <>
                  <Download size={14} className="sm:w-4 sm:h-4 mr-1.5" />
                  <span className="hidden sm:inline">Download Certificate</span>
                  <span className="sm:hidden">Download</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default NotificationModal;

