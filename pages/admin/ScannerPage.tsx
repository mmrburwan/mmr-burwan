import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { auditService } from '../../services/audit';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import { QrCode, CheckCircle, XCircle, Scan, ArrowLeft } from 'lucide-react';

const ScannerPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useNotification();
  const [qrCode, setQrCode] = useState('');
  const [scannedData, setScannedData] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = async () => {
    if (!qrCode.trim()) {
      showToast('Please enter or scan a QR code', 'error');
      return;
    }

    setIsScanning(true);
    try {
      // Parse QR code data
      const data = JSON.parse(qrCode);
      
      // Validate appointment
      if (data.appointmentId && data.userId) {
        setScannedData({
          ...data,
          valid: true,
          checkedIn: false,
        });

        // Record in audit log
        await auditService.createLog({
          actorId: user?.id || 'admin-1',
          actorName: user?.name || 'Admin User',
          actorRole: 'admin',
          action: 'qr_code_scanned',
          resourceType: 'appointment',
          resourceId: data.appointmentId,
          details: { userId: data.userId },
        });

        showToast('QR code scanned successfully', 'success');
      } else {
        setScannedData({ valid: false });
        showToast('Invalid QR code', 'error');
      }
    } catch (error) {
      setScannedData({ valid: false });
      showToast('Invalid QR code format', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleCheckIn = async () => {
    if (!scannedData) return;

    try {
      await auditService.createLog({
        actorId: user?.id || 'admin-1',
        actorName: user?.name || 'Admin User',
        actorRole: 'admin',
        action: 'appointment_checked_in',
        resourceType: 'appointment',
        resourceId: scannedData.appointmentId,
        details: { userId: scannedData.userId },
      });

      setScannedData({ ...scannedData, checkedIn: true });
      showToast('Check-in successful', 'success');
    } catch (error) {
      showToast('Failed to record check-in', 'error');
    }
  };

  return (
    <div>
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <div className="flex items-center gap-2 sm:gap-4 mb-2 sm:mb-3 lg:mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin')}
            className="flex-shrink-0 !text-xs sm:!text-sm !px-2 sm:!px-3"
            size="sm"
          >
            <ArrowLeft size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Back
          </Button>
        </div>
        <h1 className="font-serif text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">QR Code Scanner</h1>
        <p className="text-xs sm:text-sm text-gray-600">Scan or enter QR code to check in appointments</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
        <Card className="p-3 sm:p-4 lg:p-6 xl:p-8">
          <div className="mb-3 sm:mb-4 lg:mb-6">
            <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-2 sm:mb-3 lg:mb-4 flex items-center gap-1.5 sm:gap-2">
              <Scan size={16} className="sm:w-5 sm:h-5 text-gold-600" />
              Scan QR Code
            </h3>
            <Input
              label="QR Code Data"
              placeholder="Paste QR code data or scan"
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              className="mb-2 sm:mb-3 lg:mb-4"
            />
            <Button
              variant="primary"
              onClick={handleScan}
              isLoading={isScanning}
              className="w-full !text-xs sm:!text-sm"
              size="sm"
            >
              <QrCode size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Scan Code
            </Button>
          </div>

          <div className="bg-gray-50 rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-6">
            <p className="text-xs sm:text-sm text-gray-600 mb-1.5 sm:mb-2">Instructions:</p>
            <ul className="text-[10px] sm:text-xs lg:text-sm text-gray-500 space-y-0.5 sm:space-y-1 list-disc list-inside">
              <li>Scan the QR code from the appointment pass</li>
              <li>Or paste the QR code data manually</li>
              <li>Click "Scan Code" to validate</li>
            </ul>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 lg:p-6 xl:p-8">
          <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-2 sm:mb-3 lg:mb-4">Scan Result</h3>
          {scannedData ? (
            <div className="space-y-2 sm:space-y-3 lg:space-y-4">
              {scannedData.valid ? (
                <>
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3 lg:mb-4">
                    <CheckCircle size={18} className="sm:w-5 sm:h-6 text-green-600" />
                    <Badge variant="success" className="!text-[10px] sm:!text-xs">Valid QR Code</Badge>
                  </div>
                  <div className="bg-gray-50 rounded-lg sm:rounded-xl p-2.5 sm:p-3 lg:p-4 space-y-1.5 sm:space-y-2">
                    <div>
                      <p className="text-[10px] sm:text-xs lg:text-sm text-gray-500">Appointment ID</p>
                      <p className="font-medium text-xs sm:text-sm text-gray-900 truncate">{scannedData.appointmentId}</p>
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs lg:text-sm text-gray-500">Date</p>
                      <p className="font-medium text-xs sm:text-sm text-gray-900">{scannedData.date}</p>
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs lg:text-sm text-gray-500">Time</p>
                      <p className="font-medium text-xs sm:text-sm text-gray-900">{scannedData.time}</p>
                    </div>
                  </div>
                  {!scannedData.checkedIn ? (
                    <Button
                      variant="primary"
                      onClick={handleCheckIn}
                      className="w-full !text-xs sm:!text-sm"
                      size="sm"
                    >
                      <CheckCircle size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                      Check In
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1.5 sm:gap-2 p-2.5 sm:p-3 lg:p-4 bg-green-50 rounded-lg sm:rounded-xl">
                      <CheckCircle size={16} className="sm:w-5 sm:h-5 text-green-600" />
                      <span className="text-xs sm:text-sm font-medium text-green-800">Checked In</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2 p-2.5 sm:p-3 lg:p-4 bg-rose-50 rounded-lg sm:rounded-xl">
                  <XCircle size={16} className="sm:w-5 sm:h-5 text-rose-600" />
                  <span className="text-xs sm:text-sm font-medium text-rose-800">Invalid QR Code</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8 lg:py-12">
              <QrCode size={32} className="sm:w-12 sm:h-12 text-gray-300 mx-auto mb-2 sm:mb-3 lg:mb-4" />
              <p className="text-xs sm:text-sm text-gray-500">No QR code scanned yet</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ScannerPage;

