import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { adminService } from '../../services/admin';

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

// Parse certificate number with compact format support (no hyphens)
// Examples of valid formats (all starting with WBMSDBRW):
// "WBMSDBRWI1C20241620252" (all fields present)
// "WBMSDBRWI1C1621" (no years)
// "WBMSDBRWI12122" (no volumeLetter, no years - minimal format)
// Also supports legacy hyphenated format for backward compatibility
const parseCertificateNumber = (certNumber: string | undefined) => {
  const defaults = {
    bookNumber: 'I',
    volumeNumber: '',
    volumeLetter: '',
    volumeYear: '',
    serialNumber: '',
    serialYear: '',
    pageNumber: '',
  };

  if (!certNumber) {
    return defaults;
  }

  // Check if it's legacy hyphenated format
  if (certNumber.includes('-')) {
    // Legacy format: WB-MSD-BRW-...
    const parts = certNumber.split('-');
    if (parts.length >= 7 && parts[0] === 'WB' && parts[1] === 'MSD' && parts[2] === 'BRW') {
      // Handle legacy format - extract parts after prefix
      const afterPrefix = parts.slice(3);
      return {
        bookNumber: afterPrefix[0] || 'I',
        volumeNumber: afterPrefix[1] || '',
        volumeLetter: afterPrefix[2] && /^[A-Za-z]+$/.test(afterPrefix[2]) ? afterPrefix[2] : '',
        volumeYear: afterPrefix[3] && /^\d+$/.test(afterPrefix[3]) ? afterPrefix[3] : '',
        serialNumber: afterPrefix[4] || afterPrefix[2] || '',
        serialYear: afterPrefix[5] || '',
        pageNumber: afterPrefix[afterPrefix.length - 1] || '',
      };
    }
    return defaults;
  }

  // New compact format: WBMSDBRW followed by components
  if (!certNumber.startsWith('WBMSDBRW')) {
    return defaults;
  }

  // Remove the prefix
  const remainder = certNumber.slice(8); // "WBMSDBRW".length = 8

  // Extract book number (Roman numerals at the start)
  const bookMatch = remainder.match(/^([IVXLCDM]+)/);
  if (!bookMatch) {
    return defaults;
  }
  const bookNumber = bookMatch[1];
  let rest = remainder.slice(bookNumber.length);

  // Now we need to extract: volumeNumber, volumeLetter?, volumeYear?, serialNumber, serialYear?, pageNumber
  // Strategy: work from the end backwards since pageNumber is last

  // Match volumeNumber (1+ digits at the start of rest)
  const volNumMatch = rest.match(/^(\d+)/);
  if (!volNumMatch) {
    return defaults;
  }
  const volumeNumber = volNumMatch[1];
  rest = rest.slice(volumeNumber.length);

  // Check if next character is a letter (volumeLetter)
  let volumeLetter = '';
  const volLetterMatch = rest.match(/^([A-Za-z]+)/);
  if (volLetterMatch) {
    volumeLetter = volLetterMatch[1];
    rest = rest.slice(volumeLetter.length);
  }

  // Now we have remaining digits that could be: volumeYear + serialNumber + serialYear + pageNumber
  // or just: serialNumber + pageNumber
  // or: volumeYear + serialNumber + pageNumber
  // etc.

  // Since parsing is ambiguous without separators, we'll use heuristics:
  // - If we have a 4-digit sequence, treat first occurrence as volumeYear
  // - 4-digit sequence later could be serialYear
  // - Numbers between are serialNumber
  // - Last number is pageNumber

  // For now, use a simple approach: split remaining digits intelligently
  // We assume typical formats and try to extract reasonably

  let volumeYear = '';
  let serialNumber = '';
  let serialYear = '';
  let pageNumber = '';

  // If remaining is just digits, try to parse
  if (/^\d+$/.test(rest)) {
    const digits = rest;
    const len = digits.length;

    // Minimum is serialNumber + pageNumber (at least 2 chars each? flexible)
    if (len >= 2) {
      // Check if starts with 4-digit year
      if (len >= 6 && /^\d{4}/.test(digits)) {
        volumeYear = digits.slice(0, 4);
        const afterVolYear = digits.slice(4);

        // Check if there's another 4-digit year in the middle
        if (afterVolYear.length >= 6) {
          // Could be serialNum + serialYear(4) + page or other combinations
          // Try: serialNum (1-3 digits) + serialYear(4) + page (rest)
          const serialYearMatch = afterVolYear.match(/^(\d{1,3})(\d{4})(\d+)$/);
          if (serialYearMatch) {
            serialNumber = serialYearMatch[1];
            serialYear = serialYearMatch[2];
            pageNumber = serialYearMatch[3];
          } else {
            // Just split in half-ish
            const mid = Math.floor(afterVolYear.length / 2);
            serialNumber = afterVolYear.slice(0, mid) || afterVolYear.slice(0, 1);
            pageNumber = afterVolYear.slice(mid) || afterVolYear.slice(-1);
          }
        } else {
          // Short remaining: just serialNumber + pageNumber
          const mid = Math.floor(afterVolYear.length / 2);
          serialNumber = afterVolYear.slice(0, mid || 1);
          pageNumber = afterVolYear.slice(mid || 1);
        }
      } else {
        // No 4-digit year at start, just serialNumber + pageNumber
        // Assume last 1-3 digits are pageNumber, rest is serialNumber
        const pageLen = Math.min(3, Math.floor(len / 2)) || 1;
        serialNumber = digits.slice(0, len - pageLen);
        pageNumber = digits.slice(-pageLen);
      }
    }
  }

  return {
    bookNumber,
    volumeNumber,
    volumeLetter,
    volumeYear,
    serialNumber,
    serialYear,
    pageNumber,
  };
};

const verifySchema = z.object({
  bookNumber: z.string(),
  volumeNumber: z.string(),
  volumeLetter: z.string(),
  volumeYear: z.string(),
  serialNumber: z.string(),
  serialYear: z.string(),
  pageNumber: z.string(),
  registrationDate: z.string().min(1, 'Registration date is required'),
  registrarName: z.string().min(1, 'Registrar selection is required'),
});

interface VerifyApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (certificateNumber: string, registrationDate: string, registrarName: string) => Promise<void>;
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
      tenth_certificate: 'Madhyamik Admit Card',
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
    setError,
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
      registrarName: 'minhajul_islam_khan', // Default to Minhajul Islam Khan
    },
  });

  // Watch all form values to generate preview
  const formValues = watch();
  const certificateNumberPreview = useMemo(() => {
    const { bookNumber, volumeNumber, volumeLetter, volumeYear, serialNumber, serialYear, pageNumber } = formValues;
    if (bookNumber && volumeNumber && serialNumber && pageNumber) {
      // Build certificate number without hyphens
      // Filter out all empty/falsy values
      const parts = [
        'WBMSDBRW',
        bookNumber,
        volumeNumber,
        volumeLetter,
        volumeYear,
        serialNumber,
        serialYear,
        pageNumber
      ].filter(Boolean);
      return parts.join(''); // No hyphens
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
        registrarName: 'minhajul_islam_khan', // Default to Minhajul Islam Khan
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
      // Construct the full certificate number without hyphens
      const parts = [
        'WBMSDBRW',
        data.bookNumber,
        data.volumeNumber,
        data.volumeLetter,
        data.volumeYear,
        data.serialNumber,
        data.serialYear,
        data.pageNumber
      ].filter(Boolean);
      const fullCertificateNumber = parts.join(''); // No hyphens

      // check if certificate number already exists
      const exists = await adminService.checkCertificateNumber(fullCertificateNumber, applicationId);

      if (exists) {
        // Show error message
        setError('root', {
          type: 'manual',
          message: `Certificate number ${fullCertificateNumber} already exists. Please use a different number.`
        });
        setIsSubmitting(false);
        return;
      }

      await onConfirm(fullCertificateNumber, data.registrationDate, data.registrarName);
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4 lg:space-y-6">
        <div className="space-y-3 sm:space-y-4 lg:space-y-6">

          {/* Rejected Documents Warning */}
          {hasRejectedDocuments && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-lg sm:rounded-xl p-2.5 sm:p-3 lg:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <XCircle size={18} className="sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-rose-900 mb-1 sm:mb-2">
                    Cannot Verify Application
                  </h3>
                  <p className="text-[10px] sm:text-xs lg:text-sm text-rose-800 mb-2 sm:mb-3">
                    The following document(s) have been rejected and the client has not re-uploaded them yet. Please wait for the client to re-upload these documents before verifying the application.
                  </p>
                  <div className="space-y-1.5 sm:space-y-2">
                    {rejectedDocuments.map((doc) => {
                      const personLabel = getPersonLabel(doc.belongsTo);
                      const documentLabel = getDocumentTypeLabel(doc.type);
                      const documentTitle = personLabel
                        ? `${personLabel} ${documentLabel}`
                        : documentLabel;
                      return (
                        <div key={doc.id} className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs lg:text-sm text-rose-700 bg-rose-100 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2">
                          <AlertTriangle size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="font-medium truncate">{documentTitle}</span>
                          <span className="text-rose-600 truncate">({doc.name})</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Duplicate Certificate Error */}
          {errors.root && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-lg sm:rounded-xl p-2.5 sm:p-3 lg:p-4 animate-pulse">
              <div className="flex items-start gap-2 sm:gap-3">
                <AlertTriangle size={18} className="sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-rose-900">
                    Certificate Number Error
                  </h3>
                  <p className="text-[10px] sm:text-xs lg:text-sm text-rose-800 mt-1">
                    {errors.root.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Certificate Number Preview */}
          {certificateNumberPreview && (
            <div className="bg-gold-50 border border-gold-200 rounded-lg p-2 sm:p-2.5 lg:p-3">
              <p className="text-[10px] sm:text-xs font-medium text-gray-600 mb-0.5 sm:mb-1">Certificate Number Preview:</p>
              <p className="text-xs sm:text-sm font-mono font-semibold text-gray-900 break-all">{certificateNumberPreview}</p>
            </div>
          )}

          {/* Book Number */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
              Book Number
            </label>
            <select
              {...register('bookNumber')}
              disabled={isSubmitting}
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              {ROMAN_NUMERALS.map((roman, index) => (
                <option key={index} value={roman}>
                  {roman} ({index + 1})
                </option>
              ))}
            </select>
            {errors.bookNumber && (
              <p className="text-[10px] sm:text-xs text-rose-600 mt-0.5 sm:mt-1">{errors.bookNumber.message}</p>
            )}
          </div>

          {/* Volume Number */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
              Volume Number
            </label>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div>
                <Input
                  {...register('volumeNumber')}
                  error={errors.volumeNumber?.message}
                  disabled={isSubmitting}
                  className="text-center"
                />
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 text-center">Number</p>
              </div>
              <div>
                <input
                  {...register('volumeLetter')}
                  disabled={isSubmitting}
                  className="w-full px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 lg:py-2.5 text-xs sm:text-sm border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed text-center"
                />
                {errors.volumeLetter && (
                  <p className="text-[10px] sm:text-xs text-rose-600 mt-0.5 sm:mt-1">{errors.volumeLetter.message}</p>
                )}
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 text-center">Letter</p>
              </div>
              <div>
                <input
                  {...register('volumeYear')}
                  placeholder="Optional"
                  disabled={isSubmitting}
                  className="w-full px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 lg:py-2.5 text-xs sm:text-sm border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed text-center"
                />
                {errors.volumeYear && (
                  <p className="text-[10px] sm:text-xs text-rose-600 mt-0.5 sm:mt-1">{errors.volumeYear.message}</p>
                )}
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 text-center">Number (Optional)</p>
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-1 sm:mt-2">
              Format: <span className="font-mono">1-C</span> or <span className="font-mono">1-C-{'{number}'}</span> (dashes added automatically)
            </p>
          </div>

          {/* Serial Number */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
              Serial Number
            </label>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div>
                <Input
                  {...register('serialNumber')}
                  error={errors.serialNumber?.message}
                  disabled={isSubmitting}
                  className="text-center"
                />
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 text-center">Number</p>
              </div>
              <div>
                <input
                  {...register('serialYear')}
                  placeholder="Optional"
                  disabled={isSubmitting}
                  className="w-full px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 lg:py-2.5 text-xs sm:text-sm border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed text-center"
                />
                {errors.serialYear && (
                  <p className="text-[10px] sm:text-xs text-rose-600 mt-0.5 sm:mt-1">{errors.serialYear.message}</p>
                )}
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 text-center">Number (Optional)</p>
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-1 sm:mt-2">
              Format: <span className="font-mono">16</span> or <span className="font-mono">16-{'{number}'}</span> (dash added automatically)
            </p>
          </div>

          {/* Page Number */}
          <div>
            <Input
              label="Page Number"
              {...register('pageNumber')}
              error={errors.pageNumber?.message}
              disabled={isSubmitting}
              className="text-center"
            />
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
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
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
              This date will be displayed on the certificate PDF
            </p>
          </div>

          {/* Registrar Selection */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
              Registrar Name
            </label>
            <select
              {...register('registrarName')}
              disabled={isSubmitting}
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="minhajul_islam_khan">Minhajul Islam Khan</option>
              <option value="md_ismail_khan">MD Ismail Khan</option>
            </select>
            {errors.registrarName && (
              <p className="text-[10px] sm:text-xs text-rose-600 mt-0.5 sm:mt-1">{errors.registrarName.message}</p>
            )}
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
              Select the registrar who verified this application
            </p>
          </div>
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
            disabled={isSubmitting || hasRejectedDocuments}
            className="flex-1 !text-xs sm:!text-sm"
            size="sm"
          >
            <CheckCircle size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">{hasRejectedDocuments ? 'Cannot Verify (Rejected Documents)' : 'Verify Application'}</span>
            <span className="sm:hidden">{hasRejectedDocuments ? 'Cannot Verify' : 'Verify'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default VerifyApplicationModal;

