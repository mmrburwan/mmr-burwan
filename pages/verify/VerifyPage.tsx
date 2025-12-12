import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { certificateService } from '../../services/certificates';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { CheckCircle, XCircle, Search, MapPin, Calendar, Users } from 'lucide-react';
import { safeFormatDateObject } from '../../utils/dateUtils';

interface CertificateVerificationData {
  certificateNumber: string;
  registrationDate: string;
  userDetails: any;
  partnerForm: any;
  userAddress: any;
  partnerAddress: any;
  declarations: any;
}

const VerifyPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation('verify');
  const navigate = useNavigate();
  const [certificateNumber, setCertificateNumber] = useState(id || '');
  const [certificateData, setCertificateData] = useState<CertificateVerificationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [hasSearched, setHasSearched] = useState(!!id);
  const [error, setError] = useState('');

  const formatAddress = (address: any) => {
    if (!address) return 'N/A';
    const parts = [];
    if (address.villageStreet) parts.push(address.villageStreet);
    if (address.postOffice) parts.push(`P.O. ${address.postOffice}`);
    if (address.policeStation) parts.push(`P.S. ${address.policeStation}`);
    if (address.district) parts.push(`Dist. ${address.district}`);
    if (address.state) parts.push(address.state);
    if (address.zipCode) parts.push(`PIN- ${address.zipCode}`);
    return parts.length > 0 ? parts.join(', ') : 'N/A';
  };

  useEffect(() => {
    const loadCertificate = async () => {
      if (!id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const data = await certificateService.getCertificateByCertificateNumber(id);

        if (data) {
          setCertificateData(data);
          setIsValid(true);
        } else {
          setIsValid(false);
          setError('Certificate not found. Please verify the certificate number and try again.');
        }

        setHasSearched(true);
      } catch (err: any) {
        console.error('Failed to verify certificate:', err);
        setError(err.message || 'Failed to verify certificate. Please try again.');
        setIsValid(false);
        setHasSearched(true);
        setCertificateData(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadCertificate();
  }, [id]);

  const handleVerify = async () => {
    if (!certificateNumber.trim()) {
      setError('Please enter a certificate number');
      return;
    }

    // Validate certificate number format
    if (!certificateNumber.trim().startsWith('WB-MSD-BRW-')) {
      setError('Please enter a valid certificate number starting with WB-MSD-BRW-');
      return;
    }

    setIsLoading(true);
    setError('');
    setHasSearched(false);

    try {
      const data = await certificateService.getCertificateByCertificateNumber(certificateNumber.trim());

      if (data) {
        setCertificateData(data);
        setIsValid(true);
        navigate(`/verify/${certificateNumber.trim()}`);
      } else {
        setIsValid(false);
        setError('Certificate not found. Please verify the certificate number and try again.');
      }

      setHasSearched(true);
    } catch (err: any) {
      console.error('Failed to verify certificate:', err);
      setError(err.message || 'Failed to verify certificate. Please try again.');
      setIsValid(false);
      setHasSearched(true);
      setCertificateData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setCertificateNumber('');
    setCertificateData(null);
    setIsValid(false);
    setHasSearched(false);
    setError('');
    navigate('/verify');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 pt-16 sm:pt-20 pb-6 sm:pb-10">
      <div className="mb-4 sm:mb-6 text-center">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{t('title')}</h1>
        <p className="text-xs sm:text-sm text-gray-600">{t('subtitle')}</p>
      </div>

      {!hasSearched ? (
        <Card className="p-4 sm:p-6">
          <div className="space-y-3 sm:space-y-4">
            <Input
              label={t('certificateNumber')}
              placeholder={t('certificateNumberPlaceholder')}
              value={certificateNumber}
              onChange={(e) => {
                setCertificateNumber(e.target.value);
                setError('');
              }}
              onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleVerify()}
              leftIcon={<Search size={16} className="sm:w-[18px] sm:h-[18px]" />}
              error={error}
              disabled={isLoading}
            />

            {error && (
              <div className="p-2 sm:p-3 rounded-lg bg-rose-50 border border-rose-200">
                <p className="text-xs sm:text-sm text-rose-600">{error}</p>
              </div>
            )}

            <Button
              variant="primary"
              onClick={handleVerify}
              isLoading={isLoading}
              className="w-full"
              size="md"
            >
              {!isLoading && <Search size={14} className="mr-1.5 sm:w-4 sm:h-4" />}
              {isLoading ? t('verifying') : t('verify')}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {isValid && certificateData ? (
            <Card className="p-4 sm:p-6">
              {/* Success Header */}
              <div className="text-center mb-4 sm:mb-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-2 sm:mb-3 animate-fade-in">
                  <CheckCircle size={24} className="sm:w-8 sm:h-8 text-green-600" />
                </div>
                <h2 className="font-serif text-lg sm:text-xl font-bold text-gray-900 mb-1">
                  Certificate Verified
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 mb-3">
                  This certificate is valid and issued by MMR Burwan office.
                </p>
                <div className="inline-block bg-gray-900 rounded-lg sm:rounded-xl px-3 sm:px-5 py-2 sm:py-3 shadow-lg">
                  <p className="text-[8px] sm:text-[10px] text-gray-400 uppercase tracking-widest mb-1 font-medium">Certificate Number</p>
                  <p className="font-serif text-sm sm:text-lg font-black text-white tracking-wide break-all">
                    {certificateData.certificateNumber}
                  </p>
                </div>
              </div>

              {/* Certificate Details */}
              <div className="bg-gradient-to-br from-gray-50 to-rose-50/30 rounded-xl sm:rounded-2xl p-3 sm:p-5 space-y-3 sm:space-y-4 border border-gray-200">
                {/* Groom Details */}
                <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-200">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                    <Users size={14} className="sm:w-4 sm:h-4 text-indigo-600" />
                    <h4 className="font-serif font-semibold text-sm sm:text-base text-gray-900">Groom Details</h4>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 uppercase tracking-wider font-medium">Name</p>
                      <p className="font-semibold text-xs sm:text-sm text-gray-900">
                        {certificateData.userDetails?.firstName} {certificateData.userDetails?.lastName}
                      </p>
                      {certificateData.userDetails?.fatherName && (
                        <p className="text-[11px] sm:text-xs text-gray-600">Son of {certificateData.userDetails.fatherName}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 uppercase tracking-wider font-medium">Address</p>
                      <p className="text-[11px] sm:text-xs text-gray-700 leading-relaxed">
                        {formatAddress(certificateData.userAddress)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bride Details */}
                <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-200">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                    <Users size={14} className="sm:w-4 sm:h-4 text-rose-600" />
                    <h4 className="font-serif font-semibold text-sm sm:text-base text-gray-900">Bride Details</h4>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 uppercase tracking-wider font-medium">Name</p>
                      <p className="font-semibold text-xs sm:text-sm text-gray-900">
                        {certificateData.partnerForm?.firstName} {certificateData.partnerForm?.lastName}
                      </p>
                      {certificateData.partnerForm?.fatherName && (
                        <p className="text-[11px] sm:text-xs text-gray-600">Daughter of {certificateData.partnerForm.fatherName}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 uppercase tracking-wider font-medium">Address</p>
                      <p className="text-[11px] sm:text-xs text-gray-700 leading-relaxed">
                        {formatAddress(certificateData.partnerAddress)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Registration Date */}
                <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-200">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                    <Calendar size={14} className="sm:w-4 sm:h-4 text-gold-600" />
                    <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider font-medium">Registration Date</p>
                  </div>
                  <p className="font-semibold text-xs sm:text-sm text-gray-900">
                    {certificateData.registrationDate
                      ? safeFormatDateObject(new Date(certificateData.registrationDate), 'MMMM d, yyyy')
                      : 'N/A'}
                  </p>
                </div>

                {/* Registration Office Details */}
                <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-200">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                    <MapPin size={14} className="sm:w-4 sm:h-4 text-indigo-600" />
                    <h4 className="font-serif font-semibold text-sm sm:text-base text-gray-900">Registration Office</h4>
                  </div>
                  <div className="space-y-1 text-[11px] sm:text-xs">
                    <p className="font-semibold text-gray-900">
                      Office of the Muhammadan Marriage Registrar & Qaazi
                    </p>
                    <p className="font-semibold text-gray-900">
                      Name: MINHAJUL ISLAM KHAN
                    </p>
                    <p className="font-semibold text-gray-900">
                      Licence No: 04L(St.)/LW/O/St./4M-123/2019
                    </p>
                    <p className="text-gray-700">
                      Vill. & P.O. Gramshalika, P.S. Burwan, Dist. Murshidabad, PIN- 742132
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-gray-500 italic mt-1">
                      Under The Bengal Muhammadan Marriages and Divorces Registration Act- 1876.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-4">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleReset}
                  className="w-full"
                >
                  Verify Another Certificate
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-4 sm:p-6 text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <XCircle size={24} className="sm:w-8 sm:h-8 text-rose-600" />
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">
                Certificate Not Found
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6">
                The certificate "{certificateNumber || id}" could not be found or is invalid.
              </p>

              {error && (
                <div className="p-2 sm:p-3 rounded-lg bg-rose-50 border border-rose-200 mb-4">
                  <p className="text-xs sm:text-sm text-rose-600">{error}</p>
                </div>
              )}

              <Button
                variant="primary"
                size="md"
                onClick={handleReset}
                className="w-full"
              >
                Try Another Number
              </Button>
            </Card>
          )}
        </div>
      )}

      <div className="mt-4 text-center">
        <p className="text-[11px] sm:text-xs text-gray-500">
          Need help? <a href="/help" className="text-gold-600 hover:text-gold-700">Contact Support</a>
        </p>
      </div>
    </div>
  );
};

export default VerifyPage;
