import React, { useState } from 'react';
import Modal from './ui/Modal';
import Input from './ui/Input';
import Button from './ui/Button';
import { CheckCircle, XCircle, Search, X, MapPin, Calendar, Users } from 'lucide-react';
import { certificateService } from '../services/certificates';
import { safeFormatDateObject, safeFormatDate } from '../utils/dateUtils';

interface VerifyDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CertificateVerificationData {
  certificateNumber: string;
  registrationDate: string;
  userDetails: any;
  partnerForm: any;
  userAddress: any;
  partnerAddress: any;
  declarations: any;
}

const VerifyDocumentModal: React.FC<VerifyDocumentModalProps> = ({ isOpen, onClose }) => {
  const [certificateNumber, setCertificateNumber] = useState('');
  const [certificateData, setCertificateData] = useState<CertificateVerificationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
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
    return parts.length > 0 ? parts.join(', ').toUpperCase() : 'N/A';
  };

  const handleVerify = async () => {
    if (!certificateNumber.trim()) {
      setError('Please enter a certificate number');
      return;
    }

    // Validate certificate number format - accept both compact (WBMSDBRW) and legacy (WB-MSD-BRW-) formats
    const isValidFormat = certificateNumber.trim().startsWith('WBMSDBRW') || certificateNumber.trim().startsWith('WB-MSD-BRW-');
    if (!isValidFormat) {
      setError('Please enter a valid certificate number starting with WBMSDBRW or WB-MSD-BRW-');
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
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      showCloseButton={false}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="relative text-center mb-6">
          <button
            onClick={handleClose}
            className="absolute top-0 right-0 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
          <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <Search size={28} className="text-indigo-600" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-gray-900 mb-2">
            Verify Certificate
          </h2>
          <p className="text-gray-600 text-sm">
            Enter your certificate number to verify and view certificate details
          </p>
        </div>

        {!hasSearched ? (
          /* Verification Form */
          <div className="space-y-6">
            <Input
              label="Certificate Number"
              placeholder="Enter certificate number (e.g., WBMSDBRWV5C20252572026599)"
              value={certificateNumber}
              onChange={(e) => {
                setCertificateNumber(e.target.value);
                setError('');
              }}
              onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleVerify()}
              leftIcon={<Search size={18} />}
              error={error}
              disabled={isLoading}
            />

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                <p className="text-sm text-rose-600">{error}</p>
              </div>
            )}

            <Button
              variant="primary"
              onClick={handleVerify}
              isLoading={isLoading}
              className="w-full"
              size="lg"
            >
              {!isLoading && <Search size={18} className="mr-2" />}
              {isLoading ? 'Verifying...' : 'Verify Certificate'}
            </Button>
          </div>
        ) : (
          /* Results */
          <div className="space-y-6">
            {isValid && certificateData ? (
              <div className="space-y-6">
                {/* Success Header */}
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4 animate-fade-in">
                    <CheckCircle size={40} className="text-green-600" />
                  </div>
                  <h3 className="font-serif text-xl font-bold text-gray-900 mb-2">
                    Certificate Verified
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    This certificate is valid and has been issued by the MMR Burwan office.
                  </p>
                  <div className="inline-block bg-gray-900 rounded-xl px-6 py-4 shadow-lg">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2 font-medium">Certificate Number</p>
                    <p className="font-serif text-3xl font-black text-white tracking-wide">
                      {certificateData.certificateNumber}
                    </p>
                  </div>
                </div>

                {/* Certificate Details */}
                <div className="bg-gradient-to-br from-gray-50 to-rose-50/30 rounded-2xl p-6 space-y-6 border border-gray-200">
                  {/* Groom Details */}
                  <div className="bg-white rounded-xl p-5 border border-gray-200">
                    <div className="flex items-center gap-2 mb-4">
                      <Users size={18} className="text-indigo-600" />
                      <h4 className="font-serif font-semibold text-lg text-gray-900">Groom Details</h4>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-medium">Name</p>
                        <p className="font-semibold text-gray-900 uppercase">
                          {certificateData.userDetails?.firstName} {certificateData.userDetails?.lastName}
                        </p>
                        {certificateData.userDetails?.fatherName && (
                          <p className="text-sm text-gray-600 uppercase">SON OF {certificateData.userDetails.fatherName}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-medium">Address</p>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {formatAddress(certificateData.userAddress)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bride Details */}
                  <div className="bg-white rounded-xl p-5 border border-gray-200">
                    <div className="flex items-center gap-2 mb-4">
                      <Users size={18} className="text-rose-600" />
                      <h4 className="font-serif font-semibold text-lg text-gray-900">Bride Details</h4>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-medium">Name</p>
                        <p className="font-semibold text-gray-900 uppercase">
                          {certificateData.partnerForm?.firstName} {certificateData.partnerForm?.lastName}
                        </p>
                        {certificateData.partnerForm?.fatherName && (
                          <p className="text-sm text-gray-600 uppercase">DAUGHTER OF {certificateData.partnerForm.fatherName}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-medium">Address</p>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {formatAddress(certificateData.partnerAddress)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Registration Date */}
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar size={16} className="text-gold-600" />
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Registration Date</p>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {certificateData.registrationDate
                        ? safeFormatDateObject(new Date(certificateData.registrationDate), 'dd-MM-yyyy')
                        : 'N/A'}
                    </p>
                  </div>

                  {/* Registration Office Details */}
                  <div className="bg-white rounded-xl p-5 border border-gray-200">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin size={18} className="text-indigo-600" />
                      <h4 className="font-serif font-semibold text-lg text-gray-900">Registration Office</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p className="font-semibold text-gray-900">
                        Office of the Muhammadan Marriage Registrar & Qaazi
                      </p>
                      <p className="text-gray-700">
                        Vill. & P.O. Gramshalika, P.S. Burwan, Dist. Murshidabad, PIN- 742132
                      </p>
                      <p className="text-xs text-gray-500 italic mt-2">
                        Under The Bengal Muhammadan Marriages and Divorces Registration Act- 1876.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <Button
                  variant="primary"
                  onClick={handleReset}
                  className="w-full"
                >
                  Verify Another Certificate
                </Button>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-4 animate-fade-in">
                    <XCircle size={40} className="text-rose-600" />
                  </div>
                  <h3 className="font-serif text-xl font-bold text-gray-900 mb-2">
                    Certificate Not Found
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    The certificate with number "{certificateNumber}" could not be found or is invalid.
                  </p>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                    <p className="text-sm text-rose-600">{error}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="primary"
                    onClick={handleReset}
                    className="flex-1"
                  >
                    Try Another Number
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    className="flex-1"
                  >
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Footer Help Text */}
        <div className="pt-4 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-500">
            Need help? <a href="/help" className="text-indigo-600 hover:text-indigo-700 font-medium" onClick={(e) => { e.preventDefault(); handleClose(); window.location.href = '/help'; }}>Contact Support</a>
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default VerifyDocumentModal;
