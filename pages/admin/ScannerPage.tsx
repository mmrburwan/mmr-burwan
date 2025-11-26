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
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin')}
            className="flex-shrink-0"
          >
            <ArrowLeft size={18} className="mr-2" />
            Back
          </Button>
        </div>
        <h1 className="font-serif text-4xl font-bold text-gray-900 mb-2">QR Code Scanner</h1>
        <p className="text-gray-600">Scan or enter QR code to check in appointments</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-8">
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Scan size={20} className="text-gold-600" />
              Scan QR Code
            </h3>
            <Input
              label="QR Code Data"
              placeholder="Paste QR code data or scan"
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              className="mb-4"
            />
            <Button
              variant="primary"
              onClick={handleScan}
              isLoading={isScanning}
              className="w-full"
            >
              <QrCode size={18} className="mr-2" />
              Scan Code
            </Button>
          </div>

          <div className="bg-gray-50 rounded-xl p-6">
            <p className="text-sm text-gray-600 mb-2">Instructions:</p>
            <ul className="text-sm text-gray-500 space-y-1 list-disc list-inside">
              <li>Scan the QR code from the appointment pass</li>
              <li>Or paste the QR code data manually</li>
              <li>Click "Scan Code" to validate</li>
            </ul>
          </div>
        </Card>

        <Card className="p-8">
          <h3 className="font-semibold text-gray-900 mb-4">Scan Result</h3>
          {scannedData ? (
            <div className="space-y-4">
              {scannedData.valid ? (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle size={24} className="text-green-600" />
                    <Badge variant="success">Valid QR Code</Badge>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                    <div>
                      <p className="text-sm text-gray-500">Appointment ID</p>
                      <p className="font-medium text-gray-900">{scannedData.appointmentId}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Date</p>
                      <p className="font-medium text-gray-900">{scannedData.date}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Time</p>
                      <p className="font-medium text-gray-900">{scannedData.time}</p>
                    </div>
                  </div>
                  {!scannedData.checkedIn ? (
                    <Button
                      variant="primary"
                      onClick={handleCheckIn}
                      className="w-full"
                    >
                      <CheckCircle size={18} className="mr-2" />
                      Check In
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 p-4 bg-green-50 rounded-xl">
                      <CheckCircle size={20} className="text-green-600" />
                      <span className="text-sm font-medium text-green-800">Checked In</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 p-4 bg-rose-50 rounded-xl">
                  <XCircle size={20} className="text-rose-600" />
                  <span className="text-sm font-medium text-rose-800">Invalid QR Code</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <QrCode size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No QR code scanned yet</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ScannerPage;

