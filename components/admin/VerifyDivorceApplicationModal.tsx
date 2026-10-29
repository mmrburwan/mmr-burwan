import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { adminService } from '../../services/admin';
import { CertificateDetails } from '../../types';
import { safeFormatDate } from '../../utils/dateUtils';

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

const parseCertificateNumber = (certNumber?: string): {
  bookNumber: string;
  volumeNumber: string;
  volumeLetter: string;
  volumeYear: string;
  serialNumber: string;
  serialYear: string;
  pageNumber: string;
} => {
  const defaults = {
    bookNumber: 'I',
    volumeNumber: '',
    volumeLetter: '',
    volumeYear: '',
    serialNumber: '',
    serialYear: '',
    pageNumber: '',
  };

  if (!certNumber) return defaults;

  if (certNumber.includes('-')) {
    const parts = certNumber.split('-');
    if (parts.length >= 7 && parts[0] === 'WB' && parts[1] === 'MSD' && parts[2] === 'BRW') {
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

  if (!certNumber.startsWith('WBMSDBRW')) {
    return defaults;
  }

  const remainder = certNumber.slice(8);
  const bookMatch = remainder.match(/^([IVXLCDM]+)/);
  if (!bookMatch) return defaults;
  const bookNumber = bookMatch[1];
  let rest = remainder.slice(bookNumber.length);

  const volNumMatch = rest.match(/^(\d+)/);
  if (!volNumMatch) return defaults;
  const volumeNumber = volNumMatch[1];
  rest = rest.slice(volumeNumber.length);

  let volumeLetter = '';
  const volLetterMatch = rest.match(/^([A-Za-z]+)/);
  if (volLetterMatch) {
    volumeLetter = volLetterMatch[1];
    rest = rest.slice(volumeLetter.length);
  }

  let volumeYear = '';
  let serialNumber = '';
  let serialYear = '';
  let pageNumber = '';

  const digits = rest.replace(/\D/g, '');
  if (digits.length >= 4) {
    const yearMatch = digits.match(/^(20\d{2})/);
    if (yearMatch) {
      volumeYear = yearMatch[1];
      const afterYear = digits.slice(4);
      const yearMatch2 = afterYear.match(/(20\d{2})/);
      if (yearMatch2 && yearMatch2.index !== undefined) {
        serialNumber = afterYear.slice(0, yearMatch2.index);
        serialYear = yearMatch2[1];
        pageNumber = afterYear.slice(yearMatch2.index + 4);
      } else {
        const len = afterYear.length;
        const pageLen = Math.min(3, Math.floor(len / 2)) || 1;
        serialNumber = afterYear.slice(0, len - pageLen);
        pageNumber = afterYear.slice(-pageLen);
      }
    } else {
      const len = digits.length;
      const yearMatch2 = digits.match(/(20\d{2})/);
      if (yearMatch2 && yearMatch2.index !== undefined) {
        serialNumber = digits.slice(0, yearMatch2.index);
        serialYear = yearMatch2[1];
        pageNumber = digits.slice(yearMatch2.index + 4);
      } else {
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

interface VerifyDivorceApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (certificateNumber: string, registrationDate: string, registrarName: string, certificateDetails: CertificateDetails) => Promise<void>;
  applicationId: string;
  currentCertificateNumber?: string;
  currentRegistrationDate?: string;
  divorceDate?: string;
  divorceType?: string;
}

const VerifyDivorceApplicationModal: React.FC<VerifyDivorceApplicationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  applicationId,
  currentCertificateNumber,
  currentRegistrationDate,
  divorceDate,
  divorceType,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedCert = useMemo(() => parseCertificateNumber(currentCertificateNumber), [currentCertificateNumber]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
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
      registrarName: 'minhajul_islam_khan',
    },
  });

  const formValues = watch();
  const certificateNumberPreview = useMemo(() => {
    const { bookNumber, volumeNumber, volumeLetter, volumeYear, serialNumber, serialYear, pageNumber } = formValues;
    if (bookNumber && volumeNumber && serialNumber && pageNumber) {
      // Standard prefix WBMSDBRW as requested (NO NEED TO ADD DVR)
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
      return parts.join('').toUpperCase();
    }
    return '';
  }, [formValues]);

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
        registrarName: 'minhajul_islam_khan',
      });
    }
  }, [isOpen, currentCertificateNumber, currentRegistrationDate, reset]);

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
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
      const fullCertificateNumber = parts.join('').toUpperCase();

      const exists = await adminService.checkDivorceCertificateNumber(fullCertificateNumber, applicationId);

      if (exists) {
        setError('root', {
          type: 'manual',
          message: `Certificate number ${fullCertificateNumber} already exists. Please use a different number.`
        });
        setIsSubmitting(false);
        return;
      }

      const certificateDetails: CertificateDetails = {
        bookNumber: data.bookNumber ? String(data.bookNumber).toUpperCase() : '',
        volumeNumber: data.volumeNumber ? String(data.volumeNumber).toUpperCase() : '',
        volumeLetter: data.volumeLetter ? String(data.volumeLetter).toUpperCase() : '',
        volumeYear: data.volumeYear || '',
        serialNumber: data.serialNumber ? String(data.serialNumber).toUpperCase() : '',
        serialYear: data.serialYear || '',
        pageNumber: data.pageNumber,
      };

      await onConfirm(fullCertificateNumber, data.registrationDate, data.registrarName, certificateDetails);
      reset();
      onClose();
    } catch (error: any) {
      console.error('Divorce verification failed:', error);
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
      title="Verify Divorce Application"
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4 lg:space-y-6">
        <div className="space-y-3 sm:space-y-4 lg:space-y-6">
          {certificateNumberPreview && (
            <div className="bg-gold-50 border border-gold-200 rounded-lg p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs font-bold text-gold-700 uppercase tracking-wider mb-1">
                Certificate Number Preview
              </p>
              <p className="text-sm sm:text-base font-mono font-bold text-gray-900 break-all bg-white border border-gold-100 rounded-md px-3 py-2">
                {certificateNumberPreview}
              </p>
            </div>
          )}

          {/* Divorce Particulars Info */}
          <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-2.5 sm:p-3">
            <label className="block text-[10px] sm:text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1">
              Divorce Details (তালাক সংক্রান্ত বিবরণ)
            </label>
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-amber-200 rounded-md px-3 py-2">
              <p className="text-xs sm:text-sm font-medium text-amber-900">
                Date: {divorceDate ? safeFormatDate(divorceDate, 'dd-MM-yyyy') : 'Not Provided'}
              </p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                Type: {divorceType ? divorceType.toUpperCase() : 'TALAQ'}
              </span>
            </div>
          </div>

          {errors.root && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-lg sm:rounded-xl p-2.5 sm:p-3 lg:p-4 animate-pulse">
              <div className="flex items-start gap-2 sm:gap-3">
                <AlertTriangle size={18} className="text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-xs sm:text-sm text-rose-900">
                    Certificate Number Error
                  </h3>
                  <p className="text-[10px] sm:text-xs text-rose-800 mt-1">
                    {errors.root.message}
                  </p>
                </div>
              </div>
            </div>
          )}

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
              This date will be displayed on the divorce certificate PDF
            </p>
          </div>

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
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 text-center">Number</p>
              </div>
              <div>
                <input
                  {...register('volumeLetter')}
                  disabled={isSubmitting}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed text-center"
                />
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 text-center">Letter</p>
              </div>
              <div>
                <input
                  {...register('volumeYear')}
                  disabled={isSubmitting}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed text-center"
                />
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 text-center">Number (Optional)</p>
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
                  disabled={isSubmitting}
                  className="text-center"
                />
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 text-center">Number</p>
              </div>
              <div>
                <input
                  {...register('serialYear')}
                  disabled={isSubmitting}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed text-center"
                />
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 text-center">Number (Optional)</p>
              </div>
            </div>
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
            disabled={isSubmitting}
            className="flex-1 !text-xs sm:!text-sm"
            size="sm"
          >
            <CheckCircle size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Verify Divorce Application
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default VerifyDivorceApplicationModal;

