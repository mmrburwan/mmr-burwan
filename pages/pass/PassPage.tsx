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
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Card className="p-8 text-center">
          <h2 className="font-serif text-2xl font-bold text-gray-900 mb-2">No Appointment Found</h2>
          <p className="text-gray-600 mb-6">
            You don't have an active appointment. Book one to get your pass.
          </p>
          <Button variant="primary" onClick={() => navigate('/appointments')}>
            Book Appointment
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="flex-shrink-0"
          >
            <ArrowLeft size={18} className="mr-2" />
            Back
          </Button>
        </div>
        <h1 className="font-serif text-4xl font-bold text-gray-900 mb-2">Your Appointment Pass</h1>
        <p className="text-gray-600">Official appointment pass for the registrar office</p>
      </div>

      <Card className="p-8 shadow-xl">
        {/* Header Section */}
        <div className="text-center mb-8 pb-6 border-b-2 border-gold-200">
          <div className="mb-4">
            <Badge variant={appointment.status === 'confirmed' ? 'success' : 'warning'}>
              {appointment.status.toUpperCase()}
            </Badge>
          </div>
          <h2 className="font-serif text-3xl font-bold text-gray-900 mb-2">
            {user?.name}
          </h2>
          <p className="text-gray-600 uppercase tracking-wide text-sm">Appointment Pass</p>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 font-medium">
              Office of the Muhammadan Marriage Registrar & Qaazi
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Vill. & P.O. Gramshalika, P.S. Burwan, Dist. Murshidabad, PIN - 742132
            </p>
          </div>
        </div>

        {/* Details Section */}
        <div className="bg-gradient-to-br from-gray-50 to-gold-50/30 rounded-xl p-6 mb-6 border border-gray-200">
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gold-100 flex items-center justify-center">
                  <Calendar size={20} className="text-gold-600" />
                </div>
                <span className="text-gray-700 font-medium">Appointment Date</span>
              </div>
              <span className="font-bold text-gray-900 text-lg">
                {safeFormatDate(appointment.date, 'EEEE, MMMM d, yyyy')}
              </span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gold-100 flex items-center justify-center">
                  <Clock size={20} className="text-gold-600" />
                </div>
                <span className="text-gray-700 font-medium">Appointment Time</span>
              </div>
              <span className="font-bold text-gray-900 text-lg">{appointment.time}</span>
            </div>
            {user?.email && (
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gold-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-gray-700 font-medium">Email</span>
                </div>
                <span className="font-semibold text-gray-900">{user.email}</span>
              </div>
            )}
          </div>

          {/* QR Code Section */}
          <div className="bg-white rounded-xl p-6 border-2 border-gold-200 shadow-sm">
            <p className="text-center text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
              Scan QR Code at Registrar Office
            </p>
            <div className="flex justify-center mb-4">
              <QRCode value={appointment.qrCodeData} size={250} />
            </div>
            <p className="text-center text-xs text-gray-500 font-mono">
              Verification ID: {appointment.id}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={async () => {
              if (!appointment || !user) return;
              
              setIsGeneratingPDF(true);
              try {
                // Generate QR code as data URL using qrcode library
                const qrCodeImage = await QRCodeLib.toDataURL(appointment.qrCodeData, {
                  width: 300,
                  margin: 2,
                  color: {
                    dark: '#2B230B',
                    light: '#FFFFFF',
                  },
                });
                
                // Generate PDF
                const pdfDoc = React.createElement(AppointmentPassPDF, {
                  appointment,
                  userName: user.name || user.email,
                  userEmail: user.email,
                  qrCodeImage,
                });
                
                const blob = await pdf(pdfDoc).toBlob();
                const pdfUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = pdfUrl;
                link.download = `Appointment-Pass-${appointment.id}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(pdfUrl);
              } catch (error) {
                console.error('Failed to generate PDF:', error);
                alert('Failed to generate PDF. Please try again.');
              } finally {
                setIsGeneratingPDF(false);
              }
            }}
            isLoading={isGeneratingPDF}
          >
            <Download size={18} className="mr-2" />
            Download PDF
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              // Mock share
              if (navigator.share) {
                navigator.share({
                  title: 'My Appointment Pass',
                  text: `Appointment on ${safeFormatDate(appointment.date, 'MMMM d, yyyy')} at ${appointment.time}`,
                });
              }
            }}
          >
            <Share2 size={18} className="mr-2" />
            Share
          </Button>
        </div>
      </Card>

      <Card className="p-6 mt-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-3 text-lg">Important Instructions</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold mt-0.5">•</span>
            <span>Please arrive <strong>15 minutes before</strong> your scheduled appointment time</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold mt-0.5">•</span>
            <span>Bring this pass, a <strong>valid government-issued photo ID</strong>, and all required documents</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold mt-0.5">•</span>
            <span>Present this QR code at the reception desk for verification</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold mt-0.5">•</span>
            <span>Late arrivals may result in rescheduling of your appointment</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold mt-0.5">•</span>
            <span>For any queries or changes, contact the office in advance</span>
          </li>
        </ul>
        <div className="mt-4 pt-4 border-t border-blue-200">
          <p className="text-xs text-blue-700">
            <strong>Office Hours:</strong> Monday - Saturday, 10:00 AM - 5:00 PM
          </p>
        </div>
      </Card>
    </div>
  );
};

export default PassPage;

