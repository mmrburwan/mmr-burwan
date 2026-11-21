import React, { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Copy, Check, Eye, EyeOff } from 'lucide-react';
import Button from '../ui/Button';
import { CheckCircle } from 'lucide-react';
import Card from '../ui/Card';

interface AdminApplicationSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  credentials: {
    email: string;
    password: string;
  };
  isDivorce?: boolean;
}

const AdminApplicationSuccessModal: React.FC<AdminApplicationSuccessModalProps> = ({
  isOpen,
  onClose,
  applicationId,
  credentials,
  isDivorce = false,
}) => {
  const navigate = useNavigate();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(true); // Show password by default

  const handleClose = useCallback(() => {
    navigate('/admin');
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

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };


  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full max-w-md sm:max-w-lg my-auto bg-white rounded-xl sm:rounded-2xl shadow-2xl animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
          <h2 className="font-serif text-base sm:text-lg font-semibold text-gray-900">
            Application Created Successfully
          </h2>
          <button
            onClick={handleClose}
            className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
          >
            <X size={18} className="sm:w-5 sm:h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle className="w-7 h-7 sm:w-10 sm:h-10 text-green-600" />
            </div>
          </div>

          <p className="text-center text-gray-600 text-xs sm:text-sm mb-6">
            The application has been created successfully. Please save the credentials below and share them securely with the applicant.
          </p>

          <Card className="p-4 sm:p-5 mb-4">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] sm:text-xs text-gray-500 mb-1 block">Application ID</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-50 rounded text-[10px] sm:text-xs font-mono text-gray-900 break-all">
                    {applicationId}
                  </code>
                  <button
                    onClick={() => copyToClipboard(applicationId, 'applicationId')}
                    className="p-1.5 sm:p-2 text-gray-600 hover:text-gold-600 hover:bg-gold-50 rounded transition-colors"
                    title="Copy Application ID"
                  >
                    {copiedField === 'applicationId' ? (
                      <Check size={14} className="sm:w-4 sm:h-4 text-green-600" />
                    ) : (
                      <Copy size={14} className="sm:w-4 sm:h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] sm:text-xs text-gray-500 mb-1 block">Email</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-50 rounded text-[10px] sm:text-xs font-mono text-gray-900 break-all">
                    {credentials.email}
                  </code>
                  <button
                    onClick={() => copyToClipboard(credentials.email, 'email')}
                    className="p-1.5 sm:p-2 text-gray-600 hover:text-gold-600 hover:bg-gold-50 rounded transition-colors"
                    title="Copy Email"
                  >
                    {copiedField === 'email' ? (
                      <Check size={14} className="sm:w-4 sm:h-4 text-green-600" />
                    ) : (
                      <Copy size={14} className="sm:w-4 sm:h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] sm:text-xs text-gray-500 mb-1 block">Password</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-50 rounded text-[10px] sm:text-xs font-mono text-gray-900 break-all">
                    {showPassword ? credentials.password : '•'.repeat(credentials.password.length)}
                  </code>
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1.5 sm:p-2 text-gray-600 hover:text-gold-600 hover:bg-gold-50 rounded transition-colors"
                    title={showPassword ? "Hide Password" : "Show Password"}
                  >
                    {showPassword ? (
                      <EyeOff size={14} className="sm:w-4 sm:h-4" />
                    ) : (
                      <Eye size={14} className="sm:w-4 sm:h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => copyToClipboard(credentials.password, 'password')}
                    className="p-1.5 sm:p-2 text-gray-600 hover:text-gold-600 hover:bg-gold-50 rounded transition-colors"
                    title="Copy Password"
                  >
                    {copiedField === 'password' ? (
                      <Check size={14} className="sm:w-4 sm:h-4 text-green-600" />
                    ) : (
                      <Copy size={14} className="sm:w-4 sm:h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex justify-center">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                navigate(isDivorce ? `/admin/divorce/applications/${applicationId}` : `/admin/applications/${applicationId}`);
                onClose();
              }}
              className="text-xs sm:text-sm"
            >
              View Application
            </Button>
          </div>

          <p className="text-center text-[10px] sm:text-xs text-gray-500 mt-4">
            Please share these credentials securely with the applicant. They can use these to log in and access their application.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminApplicationSuccessModal;

