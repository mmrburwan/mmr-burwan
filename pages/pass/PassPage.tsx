import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { appointmentService } from '../../services/appointments';
import { Appointment } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import QRCode from '../../components/ui/QRCode';
import Badge from '../../components/ui/Badge';
import { Calendar, Clock, Download, Share2, ArrowLeft } from 'lucide-react';
import { safeFormatDate } from '../../utils/dateUtils';
import { pdf } from '@react-pdf/renderer';
import { AppointmentPassPDF } from '../../components/pass/AppointmentPassPDF';
import QRCodeLib from 'qrcode';

const PassPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    const loadAppointment = async () => {
      try {
        const apt = await appointmentService.getUserAppointment(user.id);
        setAppointment(apt);
      } catch (error) {
        console.error('Failed to load appointment:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAppointment();
  }, [user, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold-500"></div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="max-w-2xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <Card className="p-4 sm:p-6 text-center">
          <h2 className="font-serif text-lg sm:text-xl font-bold text-gray-900 mb-1 sm:mb-2">No Appointment Found</h2>
          <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6">
            Book an appointment to get your pass.
          </p>
          <Button variant="primary" size="sm" className="!text-xs sm:!text-sm" onClick={() => navigate('/appointments')}>
            Book Appointment
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="flex-shrink-0 !px-2 sm:!px-3"
          >
            <ArrowLeft size={16} className="sm:w-[18px] sm:h-[18px] mr-1 sm:mr-2" />
            <span className="text-xs sm:text-sm">Back</span>
          </Button>
        </div>
        <h1 className="font-serif text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-0.5 sm:mb-1">Appointment Pass</h1>
        <p className="text-xs sm:text-sm text-gray-600">Official pass for registrar office</p>
      </div>

      <Card className="p-4 sm:p-6 shadow-xl">
        {/* Header Section */}
        <div className="text-center mb-4 sm:mb-6 pb-3 sm:pb-4 border-b-2 border-gold-200">
          <div className="mb-2 sm:mb-3">
            <Badge variant={appointment.status === 'confirmed' ? 'success' : 'warning'}>
              {appointment.status.toUpperCase()}
            </Badge>
          </div>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-gray-900 mb-1">
            {user?.name}
          </h2>
          <p className="text-gray-600 uppercase tracking-wide text-[10px] sm:text-xs">Appointment Pass</p>
          <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-200">
            <p className="text-[9px] sm:text-xs text-gray-500 font-medium">
              Muhammadan Marriage Registrar & Qaazi
            </p>
            <p className="text-[9px] sm:text-xs text-gray-500 mt-0.5">
              Gramshalika, Burwan, Murshidabad - 742132
            </p>
          </div>
        </div>

        {/* Details Section */}
        <div className="bg-gradient-to-br from-gray-50 to-gold-50/30 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-4 sm:mb-5 border border-gray-200">
          <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-5">
            <div className="flex items-center justify-between py-2 sm:py-2.5 border-b border-gray-200">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gold-100 flex items-center justify-center">
                  <Calendar size={14} className="sm:w-4 sm:h-4 text-gold-600" />
                </div>
                <span className="text-xs sm:text-sm text-gray-700 font-medium">Date</span>
              </div>
              <span className="font-bold text-xs sm:text-sm text-gray-900">
                {safeFormatDate(appointment.date, 'dd-MM-yyyy')}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 sm:py-2.5 border-b border-gray-200">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gold-100 flex items-center justify-center">
                  <Clock size={14} className="sm:w-4 sm:h-4 text-gold-600" />
                </div>
                <span className="text-xs sm:text-sm text-gray-700 font-medium">Time</span>
              </div>
              <span className="font-bold text-xs sm:text-sm text-gray-900">{appointment.time}</span>
            </div>
            {user?.email && (
              <div className="flex items-center justify-between py-2 sm:py-2.5">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gold-100 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-xs sm:text-sm text-gray-700 font-medium">Email</span>
                </div>
                <span className="font-semibold text-[10px] sm:text-xs text-gray-900 truncate max-w-[120px] sm:max-w-[180px]">{user.email}</span>
              </div>
            )}
          </div>

          {/* QR Code Section */}
          <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 border-2 border-gold-200 shadow-sm">
            <p className="text-center text-[10px] sm:text-xs font-semibold text-gray-700 mb-2 sm:mb-3 uppercase tracking-wide">
              Scan at Registrar Office
            </p>
            <div className="flex justify-center mb-2 sm:mb-3">
              <QRCode value={appointment.qrCodeData} size={180} />
            </div>
            <p className="text-center text-[9px] sm:text-xs text-gray-500 font-mono truncate">
              ID: {appointment.id}
            </p>
          </div>
        </div>

        <div className="flex gap-2 sm:gap-3">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 !text-xs sm:!text-sm"
            onClick={async () => {
              if (!appointment || !user) return;
              setIsGeneratingPDF(true);
              try {
                const qrCodeImage = await QRCodeLib.toDataURL(appointment.qrCodeData, { width: 300, margin: 2, color: { dark: '#2B230B', light: '#FFFFFF' } });
                const pdfDoc = React.createElement(AppointmentPassPDF, { appointment, userName: user.name || user.email, userEmail: user.email, qrCodeImage });
                const blob = await pdf(pdfDoc).toBlob();
                const pdfUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = pdfUrl;
                link.download = `Pass-${appointment.id}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(pdfUrl);
              } catch (error) { console.error('Failed to generate PDF:', error); alert('Failed to generate PDF.'); } finally { setIsGeneratingPDF(false); }
            }}
            isLoading={isGeneratingPDF}
          >
            <Download size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 !text-xs sm:!text-sm"
            onClick={() => { if (navigator.share) { navigator.share({ title: 'Appointment Pass', text: `Appointment on ${safeFormatDate(appointment.date, 'dd-MM-yyyy')} at ${appointment.time}` }); } }}
          >
            <Share2 size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Share
          </Button>
        </div>
      </Card>

      <Card className="p-3 sm:p-4 mt-3 sm:mt-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
        <h3 className="font-semibold text-sm sm:text-base text-blue-900 mb-2 sm:mb-3">Instructions</h3>
        <ul className="space-y-1.5 sm:space-y-2 text-[10px] sm:text-xs text-blue-800">
          <li className="flex items-start gap-1.5 sm:gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Arrive <strong>15 mins early</strong></span>
          </li>
          <li className="flex items-start gap-1.5 sm:gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Bring <strong>photo ID</strong> & documents</span>
          </li>
          <li className="flex items-start gap-1.5 sm:gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Show QR at reception</span>
          </li>
          <li className="flex items-start gap-1.5 sm:gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Late arrivals may be rescheduled</span>
          </li>
        </ul>
        <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-blue-200">
          <p className="text-[9px] sm:text-xs text-blue-700">
            <strong>Hours:</strong> Mon-Sat, 10AM-5PM
          </p>
        </div>
      </Card>
    </div>
  );
};

export default PassPage;

