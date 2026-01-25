import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { CheckCircle } from 'lucide-react';

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

// Parse certificate number with flexible format support
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

  const parts = certNumber.split('-');

  // Must start with WB-MSD-BRW and have at least 7 parts
  if (parts.length < 7 || parts[0] !== 'WB' || parts[1] !== 'MSD' || parts[2] !== 'BRW') {
    return defaults;
  }

  const bookNumber = parts[3] || 'I';
  const remainingParts = parts.slice(4);

  const isYear = (val: string) => /^\d{4}$/.test(val);
  const isLetter = (val: string) => /^[A-Za-z]+$/.test(val);

  let volumeNumber = '';
  let volumeLetter = '';
  let volumeYear = '';
  let serialNumber = '';
  let serialYear = '';
  let pageNumber = '';

  const len = remainingParts.length;

  if (len >= 3) {
    volumeNumber = remainingParts[0] || '';
    pageNumber = remainingParts[len - 1] || '';

    const middleParts = remainingParts.slice(1, len - 1);

    if (middleParts.length === 1) {
      serialNumber = middleParts[0];
    } else if (middleParts.length === 2) {
      const [p1, p2] = middleParts;

      if (isLetter(p1)) {
        volumeLetter = p1;
        serialNumber = p2;
      } else if (isYear(p1)) {
        volumeYear = p1;
        serialNumber = p2;
      } else if (isYear(p2)) {
        serialNumber = p1;
        serialYear = p2;
      } else {
        volumeLetter = p1;
        serialNumber = p2;
      }
    } else if (middleParts.length === 3) {
      const [p1, p2, p3] = middleParts;

      if (isLetter(p1)) {
        volumeLetter = p1;
        if (isYear(p2)) {
          volumeYear = p2;
          serialNumber = p3;
        } else if (isYear(p3)) {
          serialNumber = p2;
          serialYear = p3;
        } else {
          // Neither is a 4-digit year - treat as volLetter-serialNum-serialYear
          serialNumber = p2;
          serialYear = p3;
        }
      } else if (isYear(p1)) {
        volumeYear = p1;
        serialNumber = p2;
        serialYear = p3;
      } else {
        volumeLetter = p1;
        serialNumber = p2;
        serialYear = p3;
      }
    } else if (middleParts.length === 4) {
      const [p1, p2, p3, p4] = middleParts;
      if (isLetter(p1)) {
        volumeLetter = p1;
        volumeYear = p2;
        serialNumber = p3;
        serialYear = p4;
      } else {
        if (isYear(p1)) {
          volumeYear = p1;
          serialNumber = p2;
          serialYear = p3;
        } else {
          volumeLetter = p1;
          volumeYear = p2;
          serialNumber = p3;
          serialYear = p4;
        }
      }
    } else if (middleParts.length >= 5) {
      volumeLetter = middleParts[0];
      volumeYear = middleParts[1];
      serialNumber = middleParts[2];
      serialYear = middleParts[3];
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

const certificateSchema = z.object({
  bookNumber: z.string().min(1, 'Book number is required'),
  volumeNumber: z.string().optional(),
  volumeLetter: z.string().optional(),
  volumeYear: z.string().optional(),
  serialNumber: z.string().optional(),
  serialYear: z.string().optional(),
  pageNumber: z.string().optional(),
});


interface SelectCertificateNumberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (certificateNumber: string) => void;
}

const SelectCertificateNumberModal: React.FC<SelectCertificateNumberModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualEntry, setManualEntry] = useState('');
  const [useManualEntry, setUseManualEntry] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm({
    resolver: zodResolver(certificateSchema),
    defaultValues: {
      bookNumber: 'I',
      volumeNumber: '',
      volumeLetter: '',
      volumeYear: '',
      serialNumber: '',
      serialYear: '',
      pageNumber: '',
    },
  });

  const formValues = watch();
  const certificateNumberPreview = useMemo(() => {
    if (useManualEntry && manualEntry.trim()) {
      return manualEntry.trim();
    }
    const { bookNumber, volumeNumber, volumeLetter, volumeYear, serialNumber, serialYear, pageNumber } = formValues;

    // Construct parts array with available values (no hyphens)
    const parts = [
      'WBMSDBRW',
      bookNumber || 'I',
      volumeNumber,
      volumeLetter,
      volumeYear,
      serialNumber,
      serialYear,
      pageNumber
    ].filter(Boolean); // Remove empty values

    if (parts.length > 1) { // Only return if we have more than just the prefix
      return parts.join(''); // No hyphens
    }
    return '';
  }, [formValues, manualEntry, useManualEntry]);

  useEffect(() => {
    if (isOpen) {
      reset({
        bookNumber: 'I',
        volumeNumber: '',
        volumeLetter: '',
        volumeYear: '',
        serialNumber: '',
        serialYear: '',
        pageNumber: '',
      });
      setManualEntry('');
      setUseManualEntry(false);
    }
  }, [isOpen, reset]);

  const handleUseAsUsername = () => {
    if (!certificateNumberPreview) {
      return;
    }

    // Store certificate email in sessionStorage FIRST (same pattern as registration -> login)
    const certificateEmail = `${certificateNumberPreview}@mmrburwan.com`;
    sessionStorage.setItem('pendingCertificateEmail', certificateEmail);

    // Use the certificate number as username - bypass form validation
    // Call onSelect to notify parent (which will increment trigger)
    onSelect(certificateNumberPreview);

    // Reset form
    reset();

    // Close modal after a small delay to ensure sessionStorage is set and parent processes
    setTimeout(() => {
      onClose();
    }, 50);
  };

  const handleFormEntrySubmit = () => {
    if (!certificateNumberPreview) {
      return;
    }

    // Store certificate email in sessionStorage (same pattern as registration -> login)
    const certificateEmail = `${certificateNumberPreview}@mmrburwan.com`;
    sessionStorage.setItem('pendingCertificateEmail', certificateEmail);

    // Call onSelect to notify parent (which will increment trigger)
    onSelect(certificateNumberPreview);

    // Reset form
    reset();

    // Close modal after a small delay to ensure sessionStorage is set and parent processes
    setTimeout(() => {
      onClose();
    }, 50);
  };

  const onSubmit = async (data: any) => {
    // For form entry mode, bypass validation and use preview directly
    // This ensures it works the same way as manual entry
    if (!useManualEntry) {
      handleFormEntrySubmit();
    }
  };

  const handleClose = () => {
    reset();
    setManualEntry('');
    setUseManualEntry(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Select Certificate Number from Local Records"
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4 lg:space-y-6">
        <div className="space-y-3 sm:space-y-4 lg:space-y-6">
          <p className="text-xs sm:text-sm text-gray-600">
            Enter a certificate number from your local offline office records to use as the username. The email will be set as <span className="font-mono font-semibold text-gold-700">certificate-number@mmrburwan.com</span>
          </p>

          {/* Toggle between manual entry and form fields */}
          <div className="flex items-center gap-3 pb-2 border-b border-gray-200">
            <button
              type="button"
              onClick={() => setUseManualEntry(false)}
              className={`flex-1 px-3 py-2 text-xs sm:text-sm rounded-lg transition-colors ${!useManualEntry
                ? 'bg-gold-100 text-gold-900 font-medium'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              Form Entry
            </button>
            <button
              type="button"
              onClick={() => setUseManualEntry(true)}
              className={`flex-1 px-3 py-2 text-xs sm:text-sm rounded-lg transition-colors ${useManualEntry
                ? 'bg-gold-100 text-gold-900 font-medium'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              Manual Entry
            </button>
          </div>

          {useManualEntry ? (
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                Certificate Number <span className="text-rose-600">*</span>
              </label>
              <Input
                value={manualEntry}
                onChange={(e) => {
                  setManualEntry(e.target.value);
                }}
                placeholder="WB-MSD-BRW-I-1-C-16-21"
                className="text-sm font-mono"
              />
              <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
                Enter the full certificate number
              </p>
            </div>
          ) : (
            <>
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
                  Book Number <span className="text-rose-600">*</span>
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
                      placeholder="1"
                      disabled={isSubmitting}
                      className="text-center"
                    />
                    <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 text-center">Number</p>
                  </div>
                  <div>
                    <input
                      {...register('volumeLetter')}
                      placeholder="C"
                      disabled={isSubmitting}
                      className="w-full px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 lg:py-2.5 text-xs sm:text-sm border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed text-center uppercase"
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
                    <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 text-center">Year (Optional)</p>
                  </div>
                </div>
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
                      placeholder="16"
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
                    <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 text-center">Year (Optional)</p>
                  </div>
                </div>
              </div>

              {/* Page Number */}
              <div>
                <Input
                  label="Page Number"
                  {...register('pageNumber')}
                  error={errors.pageNumber?.message}
                  placeholder="21"
                  disabled={isSubmitting}
                  className="text-center"
                />
              </div>
            </>
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
            type="button"
            variant="primary"
            isLoading={isSubmitting}
            disabled={isSubmitting || !certificateNumberPreview}
            onClick={useManualEntry ? handleUseAsUsername : handleFormEntrySubmit}
            className="flex-1 !text-xs sm:!text-sm"
            size="sm"
          >
            <CheckCircle size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Use as Username
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default SelectCertificateNumberModal;

