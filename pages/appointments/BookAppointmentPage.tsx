import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { appointmentService } from '../../services/appointments';
import { useNotification } from '../../contexts/NotificationContext';
import { AppointmentSlot } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import QRCode from '../../components/ui/QRCode';
import { Calendar, Clock, CheckCircle, ArrowRight } from 'lucide-react';
import { safeFormatDate } from '../../utils/dateUtils';

const BookAppointmentPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useNotification();
  const { t } = useTranslation('appointments');
  const [slot, setSlot] = useState<AppointmentSlot | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [appointment, setAppointment] = useState<any>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    const slotId = searchParams.get('slotId');
    const rescheduleId = searchParams.get('reschedule');

    if (!slotId) {
      navigate('/appointments');
      return;
    }

    setIsRescheduling(!!rescheduleId);
    setAppointmentId(rescheduleId);

    // Fetch slot details from available slots
    const fetchSlot = async () => {
      try {
        const slots = await appointmentService.getAvailableSlots();
        const foundSlot = slots.find(s => s.id === slotId);
        if (foundSlot) {
          setSlot(foundSlot);
        } else {
          showToast('Slot not found or no longer available', 'error');
          navigate('/appointments');
        }
      } catch (error: any) {
        showToast(error.message || 'Failed to load slot details', 'error');
        navigate('/appointments');
      }
    };

    fetchSlot();
  }, [user, navigate, searchParams, showToast]);

  const handleBook = async () => {
    if (!slot || !user) return;

    setIsBooking(true);
    try {
      let booked;
      if (isRescheduling && appointmentId) {
        booked = await appointmentService.rescheduleAppointment(appointmentId, slot.id);
        showToast('Appointment rescheduled successfully!', 'success');
      } else {
        booked = await appointmentService.bookAppointment(user.id, slot.id);
        showToast('Appointment booked successfully!', 'success');
      }
      setAppointment(booked);
    } catch (error: any) {
      showToast(error.message || (isRescheduling ? 'Failed to reschedule appointment' : 'Failed to book appointment'), 'error');
    } finally {
      setIsBooking(false);
    }
  };

  if (!slot) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold-500"></div>
      </div>
    );
  }

  if (appointment) {
    return (
      <div className="max-w-2xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <Card className="p-4 sm:p-6 text-center">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <CheckCircle size={24} className="sm:w-7 sm:h-7 text-green-600" />
          </div>
          <h1 className="font-serif text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">
            {isRescheduling ? 'Rescheduled!' : 'Confirmed!'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6">
            {isRescheduling
              ? 'Your appointment has been rescheduled.'
              : 'Your appointment is booked.'}
          </p>

          <div className="bg-gray-50 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex items-center justify-center gap-2 mb-1 sm:mb-2">
              <Calendar size={16} className="sm:w-5 sm:h-5 text-gold-600" />
              <span className="font-semibold text-sm sm:text-base text-gray-900">
                {safeFormatDate(appointment.date, 'MMM d, yyyy')}
              </span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Clock size={16} className="sm:w-5 sm:h-5 text-gold-600" />
              <span className="font-semibold text-sm sm:text-base text-gray-900">{appointment.time}</span>
            </div>
          </div>

          <div className="mb-4 sm:mb-6 flex justify-center">
            <QRCode value={appointment.qrCodeData} size={160} />
          </div>

          <p className="text-[10px] sm:text-xs text-gray-500 mb-4 sm:mb-6">
            {t('showQRCode')}
          </p>

          <div className="flex gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" className="flex-1 !text-xs sm:!text-sm" onClick={() => navigate('/appointments')}>
              {t('back')}
            </Button>
            <Button variant="primary" size="sm" className="flex-1 !text-xs sm:!text-sm" onClick={() => navigate('/pass')}>
              {t('viewPass')}
              <ArrowRight size={14} className="ml-1 sm:w-4 sm:h-4" />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="font-serif text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1">
          {isRescheduling ? t('reschedule') : t('confirmBooking')}
        </h1>
        <p className="text-xs sm:text-sm text-gray-600">
          {isRescheduling ? t('reviewNewDetails') : t('reviewAppointment')}
        </p>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="mb-4 sm:mb-6">
          <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-3 sm:mb-4">{t('details')}</h3>
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <Calendar size={16} className="sm:w-5 sm:h-5 text-gold-600" />
              <span className="text-xs sm:text-sm text-gray-700">
                {safeFormatDate(slot.date, 'EEE, MMM d, yyyy')}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Clock size={16} className="sm:w-5 sm:h-5 text-gold-600" />
              <span className="text-xs sm:text-sm text-gray-700">{slot.time}</span>
            </div>
          </div>
        </div>

        <div className="bg-rose-50 border border-rose-200 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
          <p className="text-[10px] sm:text-xs text-rose-800">
            <strong>{t('important')}:</strong> {t('importantNote')}
          </p>
        </div>

        <div className="flex gap-2 sm:gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/appointments')} className="flex-1 !text-xs sm:!text-sm">
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleBook}
            isLoading={isBooking}
            className="flex-1 !text-xs sm:!text-sm"
          >
            {isRescheduling ? t('confirm') : t('book')}
            <ArrowRight size={14} className="ml-1 sm:w-4 sm:h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default BookAppointmentPage;

