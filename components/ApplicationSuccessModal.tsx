import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import Button from './ui/Button';
import { CheckCircle, Calendar } from 'lucide-react';

interface ApplicationSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId?: string;
}

const ApplicationSuccessModal: React.FC<ApplicationSuccessModalProps> = ({
  isOpen,
  onClose,
  applicationId,
}) => {
  const navigate = useNavigate();

  const handleClose = useCallback(() => {
    navigate('/dashboard');
    onClose();
  }, [navigate, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleClose]);

  const handleGoToAppointments = () => {
    navigate('/appointments');
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking directly on the backdrop, not on modal content
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={handleBackdropClick}
    >
      {/* Darker backdrop to indicate screen is blocked */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal - Compact for mobile */}
      <div
        className="relative z-10 w-full max-w-xs sm:max-w-md my-auto bg-white rounded-xl sm:rounded-2xl shadow-2xl animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with close button */}
        <div className="flex items-center justify-end p-2 sm:p-3 border-b border-gray-200">
          <button
            onClick={handleClose}
            className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
          >
            <X size={18} className="sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Content - Compact for mobile */}
        <div className="p-4 sm:p-6 text-center">
          {/* Success Icon - Compact for mobile */}
          <div className="flex justify-center mb-3 sm:mb-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle className="w-7 h-7 sm:w-10 sm:h-10 text-green-600" />
            </div>
          </div>

          {/* Title - Compact for mobile */}
          <h2 className="font-serif text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-3 px-1">
            Application Submitted Successfully
          </h2>

          {/* Message - Compact for mobile */}
          <p className="text-gray-600 text-xs sm:text-sm mb-4 sm:mb-6 leading-relaxed px-1">
            Your marriage registration application has been submitted successfully.
            To proceed with the next steps, please book an appointment in the appointments section.
          </p>

          {/* Buttons - Compact for mobile */}
          <div className="flex flex-col gap-2 sm:gap-3 justify-center items-stretch sm:items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
              className="w-full sm:w-auto sm:min-w-[120px] text-xs sm:text-sm"
            >
              Close
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleGoToAppointments}
              className="w-full sm:w-auto sm:min-w-[160px] text-xs sm:text-sm"
            >
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
              Go to Appointments
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (applicationId) {
                  navigate(`/application/${applicationId}/acknowledgement`);
                  onClose();
                } else {
                  console.error("No application ID found for redirect");
                  navigate('/dashboard');
                  onClose();
                }
              }}
              className="w-full sm:w-auto sm:min-w-[160px] text-xs sm:text-sm"
              disabled={!applicationId}
            >
              View Acknowledgement Slip
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplicationSuccessModal;

