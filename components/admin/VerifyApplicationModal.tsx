import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

// Generate roman numerals from 1 to 50
const generateRomanNumerals = (): string[] => {
  const romanNumerals: string[] = [];
  const values = [
    { value: 50, numeral: 'L' },
    { value: 40, numeral: 'XL' },
    { value: 10, numeral: 'X' },
    { value: 9, numeral: 'IX' },
    { value: 5, numeral: 'V' },
    { value: 4, numeral: 'IV' },
    { value: 1, numeral: 'I' },
  ];

  for (let i = 1; i <= 50; i++) {
    let num = i;
    let roman = '';
    for (const { value, numeral } of values) {
      while (num >= value) {
        roman += numeral;
        num -= value;
      }
    }
    romanNumerals.push(roman);
  }

  return romanNumerals;
};

const ROMAN_NUMERALS = generateRomanNumerals();

// Parse certificate number: "WB-MSD-BRW-I-1-C-2024-16-2025-21" or "WB-MSD-BRW-I-1-C--16--21" (with empty volumeYear/serialYear)
const parseCertificateNumber = (certNumber: string | undefined) => {
  if (!certNumber) {
    return {
      bookNumber: 'I',
      volumeNumber: '',
      volumeLetter: 'C',
      volumeYear: '', // Optional, default to empty
      serialNumber: '',
      serialYear: '', // Optional, default to empty
      pageNumber: '',
    };
  }

  // Format: WB-MSD-BRW-{book}-{volumeNumber}-{volumeLetter}-{volumeYear}-{serialNumber}-{serialYear}-{pageNumber}
  // volumeYear and serialYear can be empty strings
  const parts = certNumber.split('-');
  if (parts.length >= 10 && parts[0] === 'WB' && parts[1] === 'MSD' && parts[2] === 'BRW') {
    return {
      bookNumber: parts[3] || 'I',
      volumeNumber: parts[4] || '',
      volumeLetter: parts[5] || 'C',
      volumeYear: parts[6] || '', // Optional, can be empty
      serialNumber: parts[7] || '',
      serialYear: parts[8] || '', // Optional, can be empty
      pageNumber: parts[9] || '',
    };
  }

  // Fallback to defaults
  return {
    bookNumber: 'I',
    volumeNumber: '',
    volumeLetter: 'C',
    volumeYear: '', // Optional
    serialNumber: '',
    serialYear: '', // Optional
    pageNumber: '',
  };
};

const verifySchema = z.object({
  bookNumber: z.string().min(1, 'Book number is required'),
  volumeNumber: z.string().min(1, 'Volume number is required'),
  volumeLetter: z.string().min(1, 'Volume letter is required'),
  volumeYear: z.string().regex(/^$|^\d+$/, 'Volume number must be digits only or empty'),
  serialNumber: z.string().min(1, 'Serial number is required'),
  serialYear: z.string().regex(/^$|^\d+$/, 'Serial number must be digits only or empty'),
  pageNumber: z.string().min(1, 'Page number is required'),
  registrationDate: z.string().min(1, 'Registration date is required'),
});

interface VerifyApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (certificateNumber: string, registrationDate: string) => Promise<void>;
  applicationId: string;
  currentCertificateNumber?: string;
  currentRegistrationDate?: string;
  documents?: Array<{
    id: string;
    type: string;
    name: string;
    status: 'pending' | 'approved' | 'rejected';
    belongsTo?: 'user' | 'partner' | 'joint';
    isReuploaded?: boolean;
  }>;
}

const VerifyApplicationModal: React.FC<VerifyApplicationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  applicationId,
  currentCertificateNumber,
  currentRegistrationDate,
  documents = [],
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check for rejected documents that haven't been re-uploaded
  const rejectedDocuments = useMemo(() => {
    return documents.filter(
      (doc) => doc.status === 'rejected' && !doc.isReuploaded
    );
  }, [documents]);

  const hasRejectedDocuments = rejectedDocuments.length > 0;

  // Get document type label
  const getDocumentTypeLabel = (type: string): string => {
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

  // Get person label (groom/bride/joint)
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

  const parsedCert = useMemo(() => parseCertificateNumber(currentCertificateNumber), [currentCertificateNumber]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm({
    resolver: zodResolver(verifySchema),
    defaultValues: {
      bookNumber: parsedCert.bookNumber,
      volumeNumber: parsedCert.volumeNumber,
      volumeLetter: parsedCert.volumeLetter,
      volumeYear: parsedCert.volumeYear,
      serialNumber: parsedCert.serialNumber,
      serialYear: parsedCert.serialYear,
      pageNumber: parsedCert.pageNumber,
      registrationDate: currentRegistrationDate || '',
    },
  });

  // Watch all form values to generate preview
  const formValues = watch();
  const certificateNumberPreview = useMemo(() => {
    const { bookNumber, volumeNumber, volumeLetter, volumeYear, serialNumber, serialYear, pageNumber } = formValues;
    if (bookNumber && volumeNumber && volumeLetter && serialNumber && pageNumber) {
      // Build certificate number, handling optional volumeYear and serialYear
      const parts = [
        'WB',
        'MSD',
        'BRW',
        bookNumber,
        volumeNumber,
        volumeLetter,
        volumeYear || '', // Optional
        serialNumber,
        serialYear || '', // Optional
        pageNumber
      ];
      return parts.join('-');
    }
    return '';
  }, [formValues]);

  // Reset form when modal opens/closes or certificate number changes
  useEffect(() => {
    if (isOpen) {
      const parsed = parseCertificateNumber(currentCertificateNumber);
      reset({
        bookNumber: parsed.bookNumber,
        volumeNumber: parsed.volumeNumber,
        volumeLetter: parsed.volumeLetter,
        volumeYear: parsed.volumeYear,
        serialNumber: parsed.serialNumber,
        serialYear: parsed.serialYear,
        pageNumber: parsed.pageNumber,
        registrationDate: currentRegistrationDate || '',
      });
    }
  }, [isOpen, currentCertificateNumber, currentRegistrationDate, reset]);

  const onSubmit = async (data: any) => {
    // Prevent submission if there are rejected documents
    if (hasRejectedDocuments) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Construct the full certificate number, handling optional volumeYear and serialYear
      const parts = [
        'WB',
        'MSD',
        'BRW',
        data.bookNumber,
        data.volumeNumber,
        data.volumeLetter,
        data.volumeYear || '', // Optional
        data.serialNumber,
        data.serialYear || '', // Optional
        data.pageNumber
      ];
      const fullCertificateNumber = parts.join('-');
      await onConfirm(fullCertificateNumber, data.registrationDate);
      reset();
      onClose();
    } catch (error: any) {
      console.error('Verification failed:', error);
      // Error will be handled by the parent component (ApplicationDetailsPage)
      // which will show a toast notification
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Verify Application"
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-6">
          {/* Rejected Documents Warning */}
          {hasRejectedDocuments && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <XCircle size={24} className="text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-rose-900 mb-2">
                    Cannot Verify Application
                  </h3>
                  <p className="text-sm text-rose-800 mb-3">
                    The following document(s) have been rejected and the client has not re-uploaded them yet. Please wait for the client to re-upload these documents before verifying the application.
                  </p>
                  <div className="space-y-2">
                    {rejectedDocuments.map((doc) => {
                      const personLabel = getPersonLabel(doc.belongsTo);
                      const documentLabel = getDocumentTypeLabel(doc.type);
                      const documentTitle = personLabel 
                        ? `${personLabel} ${documentLabel}`
                        : documentLabel;
                      return (
                        <div key={doc.id} className="flex items-center gap-2 text-sm text-rose-700 bg-rose-100 rounded-lg px-3 py-2">
                          <AlertTriangle size={16} className="flex-shrink-0" />
                          <span className="font-medium">{documentTitle}</span>
                          <span className="text-rose-600">({doc.name})</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Certificate Number Preview */}
          {certificateNumberPreview && (
            <div className="bg-gold-50 border border-gold-200 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-600 mb-1">Certificate Number Preview:</p>
              <p className="text-sm font-mono font-semibold text-gray-900">{certificateNumberPreview}</p>
            </div>
          )}

          {/* Book Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Book Number <span className="text-rose-600">*</span>
            </label>
            <select
              {...register('bookNumber')}
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              {ROMAN_NUMERALS.map((roman, index) => (
                <option key={index} value={roman}>
                  {roman} ({index + 1})
                </option>
              ))}
            </select>
            {errors.bookNumber && (
              <p className="text-xs text-rose-600 mt-1">{errors.bookNumber.message}</p>
            )}
          </div>

          {/* Volume Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Volume Number <span className="text-rose-600">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Input
                  {...register('volumeNumber')}
                  error={errors.volumeNumber?.message}
                  placeholder="1"
                  required
                  disabled={isSubmitting}
                  className="text-center"
                />
                <p className="text-xs text-gray-500 mt-1 text-center">Number</p>
              </div>
              <div>
                <input
                  {...register('volumeLetter')}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase().slice(0, 1);
                    setValue('volumeLetter', value, { shouldValidate: true });
                  }}
                  value={formValues.volumeLetter || ''}
                  placeholder="C"
                  required
                  disabled={isSubmitting}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed text-center uppercase"
                />
                {errors.volumeLetter && (
                  <p className="text-xs text-rose-600 mt-1">{errors.volumeLetter.message}</p>
                )}
                <p className="text-xs text-gray-500 mt-1 text-center">Letter</p>
              </div>
              <div>
                <input
                  {...register('volumeYear')}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setValue('volumeYear', value, { shouldValidate: true });
                  }}
                  value={formValues.volumeYear || ''}
                  placeholder="Optional"
                  disabled={isSubmitting}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed text-center"
                />
                {errors.volumeYear && (
                  <p className="text-xs text-rose-600 mt-1">{errors.volumeYear.message}</p>
                )}
                <p className="text-xs text-gray-500 mt-1 text-center">Number (Optional)</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Format: <span className="font-mono">1-C</span> or <span className="font-mono">1-C-{'{number}'}</span> (dashes added automatically)
            </p>
          </div>

          {/* Serial Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Serial Number <span className="text-rose-600">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Input
                  {...register('serialNumber')}
                  error={errors.serialNumber?.message}
                  placeholder="16"
                  required
                  disabled={isSubmitting}
                  className="text-center"
                />
                <p className="text-xs text-gray-500 mt-1 text-center">Number</p>
              </div>
              <div>
                <input
                  {...register('serialYear')}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setValue('serialYear', value, { shouldValidate: true });
                  }}
                  value={formValues.serialYear || ''}
                  placeholder="Optional"
                  disabled={isSubmitting}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed text-center"
                />
                {errors.serialYear && (
                  <p className="text-xs text-rose-600 mt-1">{errors.serialYear.message}</p>
                )}
                <p className="text-xs text-gray-500 mt-1 text-center">Number (Optional)</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Format: <span className="font-mono">16</span> or <span className="font-mono">16-{'{number}'}</span> (dash added automatically)
            </p>
          </div>

          {/* Page Number */}
          <div>
            <Input
              label="Page Number"
              {...register('pageNumber')}
              error={errors.pageNumber?.message}
              placeholder="21"
              required
              disabled={isSubmitting}
              className="text-center"
            />
            <p className="text-xs text-gray-500 mt-1">
              Page number in the register
            </p>
          </div>

          {/* Registration Date */}
          <div>
            <Input
              label="Registration Date"
              type="date"
              {...register('registrationDate')}
              error={errors.registrationDate?.message}
              required
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500 mt-1">
              This date will be displayed on the certificate PDF
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={isSubmitting || hasRejectedDocuments}
            className="flex-1"
          >
            <CheckCircle size={18} className="mr-2" />
            {hasRejectedDocuments ? 'Cannot Verify (Rejected Documents)' : 'Verify Application'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default VerifyApplicationModal;

