import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
}) => {
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

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm sm:max-w-md',
    md: 'max-w-sm sm:max-w-lg',
    lg: 'max-w-md sm:max-w-2xl',
    xl: 'max-w-lg sm:max-w-4xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop - very subtle */}
      <div className="fixed inset-0 bg-black/10" />
      
      {/* Modal */}
      <div
        className={`
          relative z-10 w-full ${sizeClasses[size]} my-auto
          bg-white rounded-xl sm:rounded-2xl lg:rounded-3xl shadow-2xl
          animate-fade-up
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-3 sm:p-4 lg:p-6 border-b border-gray-200">
            {title && (
              <h2 className="font-serif text-base sm:text-lg lg:text-xl font-semibold text-gray-900">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close modal"
              >
                <X size={18} className="sm:w-5 sm:h-5" />
              </button>
            )}
          </div>
        )}
        
        {/* Content */}
        <div className="p-3 sm:p-4 lg:p-6 overflow-y-auto max-h-[calc(100vh-6rem)] sm:max-h-[calc(100vh-8rem)]">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;

