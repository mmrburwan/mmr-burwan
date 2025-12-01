import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';
import { XCircle, Mail } from 'lucide-react';

const rejectSchema = z.object({
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500, 'Reason must not exceed 500 characters'),
  sendEmail: z.boolean().default(false),
});

interface RejectDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, sendEmail: boolean) => Promise<void>;
  documentName: string;
  documentType: string;
  userEmail?: string;
}

const RejectDocumentModal: React.FC<RejectDocumentModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  documentName,
  documentType,
  userEmail,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm({
    resolver: zodResolver(rejectSchema),
    defaultValues: {
      reason: '',
      sendEmail: false,
    },
  });

  const sendEmail = watch('sendEmail');

  const onSubmit = async (data: { reason: string; sendEmail: boolean }) => {
    setIsSubmitting(true);
    try {
      await onConfirm(data.reason, data.sendEmail);
      reset();
      onClose();
    } catch (error) {
      console.error('Rejection failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Reject Document"
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4 lg:space-y-6">
        <div className="space-y-3 sm:space-y-4">
          <div className="p-2.5 sm:p-3 lg:p-4 bg-rose-50 border border-rose-200 rounded-lg sm:rounded-xl">
            <div className="flex items-start gap-2 sm:gap-3">
              <XCircle size={16} className="sm:w-5 sm:h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-rose-900 mb-0.5 sm:mb-1">
                  Rejecting: {getDocumentTypeLabel(documentType)}
                </p>
                <p className="text-[10px] sm:text-xs text-rose-700 truncate">
                  {documentName}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
              Reason for Rejection <span className="text-rose-600">*</span>
            </label>
            <textarea
              {...register('reason')}
              rows={4}
              className={`
                w-full px-3 sm:px-4 py-2 sm:py-2.5 lg:py-3 text-xs sm:text-sm rounded-lg sm:rounded-xl border transition-all duration-200
                ${errors.reason 
                  ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500' 
                  : 'border-gray-200 focus:border-gold-500 focus:ring-gold-500'
                }
                focus:outline-none focus:ring-2 focus:ring-offset-0
                placeholder:text-gray-400
                resize-none
              `}
              placeholder="Please provide a detailed reason for rejecting this document. This will be sent to the user as a notification."
              disabled={isSubmitting}
            />
            {errors.reason && (
              <p className="mt-1 text-[10px] sm:text-xs text-rose-600">{errors.reason.message}</p>
            )}
            <p className="mt-1 text-[10px] sm:text-xs text-gray-500">
              Minimum 10 characters required. This reason will be visible to the user.
            </p>
          </div>

          {userEmail && (
            <div className="p-2.5 sm:p-3 lg:p-4 bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl">
              <Checkbox
                {...register('sendEmail')}
                label={
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Mail size={14} className="sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-gray-700">
                      Send email notification to user
                    </span>
                  </div>
                }
                disabled={isSubmitting}
              />
              {sendEmail && (
                <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-blue-700 ml-6 sm:ml-8">
                  An email will be sent to <span className="font-medium truncate">{userEmail}</span> with the rejection reason.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 !text-xs sm:!text-sm"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            className="flex-1 !text-xs sm:!text-sm"
            size="sm"
          >
            <XCircle size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Reject Document</span>
            <span className="sm:hidden">Reject</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default RejectDocumentModal;

