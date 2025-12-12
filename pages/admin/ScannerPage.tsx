import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { auditService } from '../../services/audit';
import { applicationService } from '../../services/application';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { Html5Qrcode } from 'html5-qrcode';
import jsQR from 'jsqr';
import { QrCode, CheckCircle, XCircle, Scan, ArrowLeft, Camera, CameraOff, Eye } from 'lucide-react';

const ScannerPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useNotification();
  const [scannedData, setScannedData] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [useAlternativeScanner, setUseAlternativeScanner] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const lastScannedQrRef = useRef<string | null>(null);

  // Stop camera scanning (alternative jsQR method)
  const stopAlternativeCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraActive(false);
    // Reset last scanned QR when stopping camera
    lastScannedQrRef.current = null;
    showToast('Camera stopped', 'info');
  };

  // Stop camera scanning (html5-qrcode method)
  const stopCamera = async () => {
    try {
      if (useAlternativeScanner) {
        stopAlternativeCamera();
        return;
      }

      if (html5QrCodeRef.current && isCameraActive) {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
        setIsCameraActive(false);
        // Reset last scanned QR when stopping camera
        lastScannedQrRef.current = null;
        showToast('Camera stopped', 'info');
      }
    } catch (error) {
      console.error('Error stopping camera:', error);
    }
  };

  // Start camera using jsQR (alternative method)
  const startAlternativeCamera = async () => {
    try {
      setIsCameraStarting(true);
      setCameraError(null);
      setUseAlternativeScanner(true);

      // Wait for DOM to be ready and ensure refs are set
      let retries = 0;
      while ((!videoRef.current || !canvasRef.current) && retries < 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video) {
        setIsCameraStarting(false);
        const errorMsg = 'Video element not ready. Please refresh the page.';
        setCameraError(errorMsg);
        showToast(errorMsg, 'error');
        console.error('Video element not found after retries');
        return;
      }

      if (!canvas) {
        setIsCameraStarting(false);
        const errorMsg = 'Canvas element not ready. Please refresh the page.';
        setCameraError(errorMsg);
        showToast(errorMsg, 'error');
        console.error('Canvas element not found after retries');
        return;
      }

      console.log('Video and canvas elements found, starting camera...');
      console.log('Navigator:', navigator);
      console.log('Navigator.mediaDevices:', navigator.mediaDevices);
      console.log('getUserMedia type:', typeof navigator.mediaDevices?.getUserMedia);
      console.log('Window location:', window.location.href);
      console.log('Protocol:', window.location.protocol);

      // Get user media - try directly, Chrome definitely supports this
      let stream: MediaStream;

      try {
        // Direct call - Chrome supports this
        if (!navigator.mediaDevices) {
          console.error('navigator.mediaDevices is undefined!');
          throw new Error('MediaDevices API not available. Are you using localhost or HTTPS?');
        }

        if (typeof navigator.mediaDevices.getUserMedia !== 'function') {
          console.error('getUserMedia is not a function!', navigator.mediaDevices.getUserMedia);
          throw new Error('getUserMedia function not found. Please refresh the page.');
        }

        console.log('Calling getUserMedia directly...');
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        console.log('getUserMedia succeeded!', stream);
      } catch (apiError: any) {
        console.error('getUserMedia error details:', {
          name: apiError?.name,
          message: apiError?.message,
          stack: apiError?.stack,
          error: apiError
        });

        // Provide helpful error message
        if (apiError?.name === 'NotAllowedError' || apiError?.name === 'PermissionDeniedError') {
          throw new Error('Camera permission denied. Please click the camera icon in the address bar and allow access.');
        } else if (apiError?.name === 'NotFoundError') {
          throw new Error('No camera found. Please connect a camera device.');
        } else if (apiError?.name === 'NotReadableError') {
          throw new Error('Camera is in use by another application. Please close other apps using the camera.');
        } else {
          throw new Error(`Camera access failed: ${apiError?.message || apiError?.name || 'Unknown error'}. Check browser console (F12) for details.`);
        }
      }

      console.log('Camera stream obtained successfully');

      streamRef.current = stream;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true'); // Important for iOS

      await video.play();

      const context = canvas.getContext('2d');
      if (!context) {
        setIsCameraStarting(false);
        setCameraError('Could not get canvas context');
        return;
      }

      // Start scanning loop
      const scan = () => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.height = video.videoHeight;
          canvas.width = video.videoWidth;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code) {
            processScannedData(code.data);
          }
        }
      };

      scanIntervalRef.current = window.setInterval(scan, 100);
      setIsCameraActive(true);
      setIsCameraStarting(false);
      setUseAlternativeScanner(true);
    } catch (error: any) {
      setIsCameraStarting(false);
      console.error('Alternative camera error:', error);
      console.error('Error details:', {
        name: error?.name,
        message: error?.message,
        stack: error?.stack
      });

      let errorMsg = 'Failed to start camera. ';
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        errorMsg = 'Camera permission denied. Please click the camera icon in the address bar and allow camera access, then refresh the page.';
      } else if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
        errorMsg = 'No camera found on this device. Please connect a camera and try again.';
      } else if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
        errorMsg = 'Camera is being used by another application. Please close other apps using the camera and try again.';
      } else if (error?.message?.includes('not supported') || error?.message?.includes('not found')) {
        errorMsg = `Camera API issue: ${error.message}. Please ensure you are accessing via localhost or HTTPS.`;
      } else {
        errorMsg = `Camera error: ${error?.message || error?.name || 'Unknown error'}. Please check browser console (F12) for details.`;
      }

      setCameraError(errorMsg);
      showToast(errorMsg, 'error');
    }
  };

  // Process scanned QR code data
  const processScannedData = async (qrData: string) => {
    // Prevent processing the same QR code multiple times
    if (lastScannedQrRef.current === qrData) {
      return;
    }

    setIsScanning(true);
    try {
      // Parse QR code data
      const data = JSON.parse(qrData);

      // Handle Acknowledgement Slip QR
      if (data.type === 'acknowledgement' || (data.applicationId && !data.appointmentId)) {
        lastScannedQrRef.current = qrData;

        // Validate Application Exists
        try {
          const app = await applicationService.getApplicationById(data.applicationId);
          if (app) {
            setScannedData({
              type: 'acknowledgement',
              valid: true,
              applicationId: app.id,
              date: new Date(app.submitted_at || Date.now()).toLocaleDateString(),
              time: new Date(app.submitted_at || Date.now()).toLocaleTimeString(),
              details: app
            });
            showToast('Application found', 'success');

            // Audit Log
            await auditService.createLog({
              actorId: user?.id || 'admin-1',
              actorName: user?.name || 'Admin User',
              actorRole: 'admin',
              action: 'qr_code_scanned',
              resourceType: 'application',
              resourceId: app.id,
              details: { type: 'acknowledgement' },
            });

          } else {
            setScannedData({ valid: false });
            showToast('Application not found', 'error');
          }
        } catch (e) {
          setScannedData({ valid: false });
          showToast('Error fetching application', 'error');
        }
        return;
      }

      // Validate appointment
      if (data.appointmentId && data.userId) {
        // Mark this QR code as processed
        lastScannedQrRef.current = qrData;

        // Try to fetch the application for this user
        let applicationId: string | null = null;
        try {
          const application = await applicationService.getApplication(data.userId);
          if (application) {
            applicationId = application.id;
          }
        } catch (error) {
          // Application might not exist, that's okay
          console.log('No application found for user:', data.userId);
        }

        setScannedData({
          ...data,
          type: 'appointment',
          valid: true,
          checkedIn: false,
          applicationId,
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

        // Don't stop camera - keep it running for next scan
      } else {
        // Mark invalid QR codes too to prevent repeated error notifications
        lastScannedQrRef.current = qrData;
        setScannedData({ valid: false });
        showToast('Invalid QR code', 'error');
      }
    } catch (error) {
      // Mark invalid QR codes too to prevent repeated error notifications
      lastScannedQrRef.current = qrData;
      setScannedData({ valid: false });
      showToast('Invalid QR code format', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  // Start camera scanning
  const startCamera = async () => {
    if (isCameraStarting || isCameraActive) return;

    setIsCameraStarting(true);
    setCameraError(null);
    try {
      // Check for camera API support - Chrome definitely has this
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        // Try legacy API
        const legacyGetUserMedia = (navigator as any).getUserMedia ||
          (navigator as any).webkitGetUserMedia ||
          (navigator as any).mozGetUserMedia;

        if (!legacyGetUserMedia) {
          setIsCameraStarting(false);
          const errorMsg = 'Camera API not available. Please ensure you are using HTTPS or localhost.';
          setCameraError(errorMsg);
          showToast(errorMsg, 'error');
          // Try alternative method anyway
          await startAlternativeCamera();
          return;
        }
      }

      // Get available cameras with better error handling
      let devices;
      try {
        devices = await Html5Qrcode.getCameras();
      } catch (getCamerasError: any) {
        console.error('Error getting cameras:', getCamerasError);
        // Try to request permission first
        try {
          await navigator.mediaDevices.getUserMedia({ video: true });
          // Retry getting cameras after permission granted
          devices = await Html5Qrcode.getCameras();
        } catch (permissionError: any) {
          setIsCameraStarting(false);
          if (permissionError.name === 'NotAllowedError' || permissionError.name === 'PermissionDeniedError') {
            showToast('Camera permission denied. Please allow camera access in your browser settings.', 'error');
          } else if (permissionError.name === 'NotFoundError' || permissionError.name === 'DevicesNotFoundError') {
            showToast('No camera found on this device.', 'error');
          } else {
            showToast(`Camera access error: ${permissionError.message || 'Unknown error'}. Please check your browser settings.`, 'error');
          }
          return;
        }
      }

      if (devices && devices.length > 0) {
        const selectedCameraId = cameraId || devices[0].id;
        setCameraId(selectedCameraId);

        // Clear any existing instance
        if (html5QrCodeRef.current) {
          try {
            await html5QrCodeRef.current.stop();
          } catch (e) {
            // Ignore stop errors
          }
        }

        const html5QrCode = new Html5Qrcode('qr-reader');
        html5QrCodeRef.current = html5QrCode;

        try {
          // Try with videoConstraints first (for mobile devices)
          let config: any = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          };

          // Try starting with videoConstraints
          try {
            await html5QrCode.start(
              selectedCameraId,
              {
                ...config,
                videoConstraints: {
                  facingMode: 'environment', // Prefer back camera on mobile
                },
              },
              (decodedText) => {
                processScannedData(decodedText);
              },
              (errorMessage) => {
                // Ignore scanning errors (they're expected when no QR code is visible)
              }
            );
          } catch (constraintError: any) {
            // If videoConstraints fails, try without it
            console.log('Trying without videoConstraints:', constraintError);
            await html5QrCode.start(
              selectedCameraId,
              config,
              (decodedText) => {
                processScannedData(decodedText);
              },
              (errorMessage) => {
                // Ignore scanning errors (they're expected when no QR code is visible)
              }
            );
          }

          setIsCameraActive(true);
          setIsCameraStarting(false);
        } catch (startError: any) {
          setIsCameraStarting(false);
          console.error('Error starting camera:', startError);

          // Clean up on error
          if (html5QrCodeRef.current) {
            try {
              await html5QrCodeRef.current.stop();
            } catch (e) {
              // Ignore cleanup errors
            }
            html5QrCodeRef.current = null;
          }

          if (startError?.message?.includes('Permission denied') || startError?.name === 'NotAllowedError') {
            showToast('Camera permission denied. Please allow camera access in browser settings and refresh the page.', 'error');
          } else if (startError?.message?.includes('not found') || startError?.name === 'NotFoundError') {
            showToast('Camera not found. Please check if your camera is connected and not being used by another app.', 'error');
          } else if (startError?.message?.includes('Could not start video stream')) {
            showToast('Could not access camera. Make sure no other app is using the camera and try again.', 'error');
          } else {
            showToast(`Failed to start camera: ${startError?.message || 'Unknown error'}. Please check browser console for details.`, 'error');
          }
        }
      } else {
        setIsCameraStarting(false);
        const errorMsg = 'No camera found. Please check your device has a camera connected.';
        setCameraError(errorMsg);
        showToast(errorMsg, 'error');
        // Try alternative method
        console.log('Trying alternative scanner method...');
        await startAlternativeCamera();
      }
    } catch (error: any) {
      setIsCameraStarting(false);
      console.error('Camera initialization error:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      let userMessage = '';

      if (errorMessage.includes('Permission denied') || error?.name === 'NotAllowedError') {
        userMessage = 'Camera permission denied. Please allow camera access in your browser settings.';
      } else if (errorMessage.includes('not found') || error?.name === 'NotFoundError') {
        userMessage = 'No camera found on this device.';
      } else {
        userMessage = `Failed to start camera: ${errorMessage}. Trying alternative method...`;
      }

      setCameraError(userMessage);
      showToast(userMessage, 'error');

      // Try alternative method as fallback
      console.log('Html5Qrcode failed, trying alternative scanner...');
      try {
        await startAlternativeCamera();
      } catch (altError) {
        console.error('Alternative scanner also failed:', altError);
      }
    }
  };

  // Initialize scanner setup (don't auto-start - browsers require user interaction for camera access)
  useEffect(() => {
    // Set up alternative scanner by default
    setUseAlternativeScanner(true);

    // Cleanup camera on unmount
    return () => {
      if (useAlternativeScanner) {
        stopAlternativeCamera();
      } else if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => { });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleViewApplication = () => {
    if (!scannedData || !scannedData.applicationId) {
      showToast('No application found for this user', 'error');
      return;
    }

    navigate(`/admin/applications/${scannedData.applicationId}`);
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
        <p className="text-xs sm:text-sm text-gray-600">Scan QR code with camera to check in appointments</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
        <Card className="p-3 sm:p-4 lg:p-6 xl:p-8">
          <div className="mb-3 sm:mb-4 lg:mb-6">
            <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-2 sm:mb-3 lg:mb-4 flex items-center gap-1.5 sm:gap-2">
              <Scan size={16} className="sm:w-5 sm:h-5 text-gold-600" />
              Scan QR Code
            </h3>

            {/* Camera Scanner Section */}
            <div className="mb-3 sm:mb-4 lg:mb-6">
              <div className="bg-gray-50 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-2 sm:mb-3">
                <div ref={scannerContainerRef} className="relative">
                  {/* Html5Qrcode scanner (hidden when using alternative) */}
                  {!useAlternativeScanner && (
                    <div
                      id="qr-reader"
                      className="w-full rounded-lg overflow-hidden bg-black"
                      style={{ minHeight: '250px', maxHeight: '400px' }}
                    ></div>
                  )}

                  {/* Alternative jsQR scanner - Always render but conditionally show */}
                  <div
                    className={`relative w-full rounded-lg overflow-hidden bg-black ${useAlternativeScanner ? '' : 'hidden'}`}
                    style={{ minHeight: '250px', maxHeight: '400px' }}
                  >
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      autoPlay
                      playsInline
                      muted
                    />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>

                  {!isCameraActive && !isCameraStarting && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 rounded-lg">
                      <div className="text-center text-white px-4">
                        <Camera size={48} className="mx-auto mb-2 opacity-50" />
                        <p className="text-xs sm:text-sm mb-2">Camera not active</p>
                        {cameraError && (
                          <p className="text-[10px] sm:text-xs text-rose-300 mb-3 max-w-xs mx-auto">
                            {cameraError}
                          </p>
                        )}
                        <div className="flex gap-2 justify-center">
                          <Button
                            variant="primary"
                            onClick={startAlternativeCamera}
                            disabled={isScanning || isCameraStarting}
                            className="!text-xs sm:!text-sm mt-2"
                            size="sm"
                          >
                            <Camera size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                            Start Camera
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {isCameraStarting && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 rounded-lg">
                      <div className="text-center text-white">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mx-auto mb-2"></div>
                        <p className="text-xs sm:text-sm">Starting camera...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {isCameraActive && (
                <div className="flex gap-2 sm:gap-3">
                  <Button
                    variant="ghost"
                    onClick={stopCamera}
                    disabled={isScanning}
                    className="flex-1 !text-xs sm:!text-sm"
                    size="sm"
                  >
                    <CameraOff size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    Stop Camera
                  </Button>
                </div>
              )}
            </div>
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
                      <p className="text-[10px] sm:text-xs lg:text-sm text-gray-500">
                        {scannedData.type === 'acknowledgement' ? 'Application ID' : 'Appointment ID'}
                      </p>
                      <p className="font-medium text-xs sm:text-sm text-gray-900 truncate">
                        {scannedData.type === 'acknowledgement' ? scannedData.applicationId : scannedData.appointmentId}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs lg:text-sm text-gray-500">{scannedData.type === 'acknowledgement' ? 'Submitted Date' : 'Date'}</p>
                      <p className="font-medium text-xs sm:text-sm text-gray-900">{scannedData.date}</p>
                    </div>
                    {scannedData.time && (
                      <div>
                        <p className="text-[10px] sm:text-xs lg:text-sm text-gray-500">Time</p>
                        <p className="font-medium text-xs sm:text-sm text-gray-900">{scannedData.time}</p>
                      </div>
                    )}
                  </div>
                  {scannedData.applicationId ? (
                    <Button
                      variant="primary"
                      onClick={handleViewApplication}
                      className="w-full !text-xs sm:!text-sm"
                      size="sm"
                    >
                      <Eye size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                      View Application
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1.5 sm:gap-2 p-2.5 sm:p-3 lg:p-4 bg-gray-50 rounded-lg sm:rounded-xl">
                      <XCircle size={16} className="sm:w-5 sm:h-5 text-gray-400" />
                      <span className="text-xs sm:text-sm font-medium text-gray-600">No application submitted</span>
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

