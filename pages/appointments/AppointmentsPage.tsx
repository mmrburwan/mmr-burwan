import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { appointmentService } from '../../services/appointments';
import { useNotification } from '../../contexts/NotificationContext';
import { useTranslation } from '../../hooks/useTranslation';
import { AppointmentSlot, Appointment } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { Calendar, Clock, CheckCircle, ArrowLeft } from 'lucide-react';
import { isAfter, parseISO, isValid } from 'date-fns';
import { safeFormatDate } from '../../utils/dateUtils';

const AppointmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useNotification();
  const { t } = useTranslation('appointments');
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [userAppointment, setUserAppointment] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRescheduling, setIsRescheduling] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    const loadData = async () => {
      try {
        const [availableSlots, appointment] = await Promise.all([
          appointmentService.getAvailableSlots(),
          appointmentService.getUserAppointment(user.id),
        ]);
        setSlots(availableSlots);
        setUserAppointment(appointment);
      } catch (error) {
        console.error('Failed to load appointments:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, navigate]);

  const handleBook = async (slotId: string) => {
    if (userAppointment) {
      // Reschedule existing appointment
      navigate(`/appointments/book?slotId=${slotId}&reschedule=${userAppointment.id}`);
    } else {
      // Book new appointment
      navigate(`/appointments/book?slotId=${slotId}`);
    }
  };

  // Reload appointment data when returning from booking page
  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        appointmentService.getUserAppointment(user.id).then(setUserAppointment).catch(console.error);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user]);

  const groupedSlots = slots.reduce((acc, slot) => {
    if (!acc[slot.date]) {
      acc[slot.date] = [];
    }
    acc[slot.date].push(slot);
    return acc;
  }, {} as Record<string, AppointmentSlot[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="flex-shrink-0 !px-2 sm:!px-3"
          >
            <ArrowLeft size={16} className="sm:w-[18px] sm:h-[18px] mr-1 sm:mr-2" />
            <span className="text-xs sm:text-sm">{t('back')}</span>
          </Button>
        </div>
        <h1 className="font-serif text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1">{t('title')}</h1>
        <p className="text-xs sm:text-sm text-gray-600">{t('subtitle')}</p>
      </div>

      {userAppointment && (
        <Card className="p-3 sm:p-5 mb-4 sm:mb-6 bg-gold-50 border-gold-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1 flex items-center gap-2">
                <CheckCircle size={16} className="sm:w-5 sm:h-5 text-gold-600" />
                {isRescheduling ? 'Rescheduling' : 'Current Appointment'}
              </h3>
              <p className="text-xs sm:text-sm text-gray-700">
                {safeFormatDate(userAppointment.date, 'dd-MM-yyyy', userAppointment.date)} at {userAppointment.time}
              </p>
              {isRescheduling && (
                <p className="text-[10px] sm:text-xs text-gold-700 mt-1">
                  Select a new slot below
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="primary" size="sm" className="!text-xs sm:!text-sm" onClick={() => navigate('/pass')}>
                View Pass
              </Button>
              {!isRescheduling && (
                <Button
                  variant="outline"
                  size="sm"
                  className="!text-xs sm:!text-sm"
                  onClick={() => setIsRescheduling(true)}
                >
                  Reschedule
                </Button>
              )}
              {isRescheduling && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="!text-xs sm:!text-sm"
                  onClick={() => setIsRescheduling(false)}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-3 sm:space-y-4">
        {Object.entries(groupedSlots).map(([date, dateSlots]) => (
          <Card key={date} className="p-3 sm:p-5">
            <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
              <Calendar size={16} className="sm:w-5 sm:h-5 text-gold-600" />
              {safeFormatDate(date, 'EEE, MMM d', date)}
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3">
              {dateSlots.map((slot) => {
                const isAvailable = slot.booked < slot.capacity;
                const slotDateTime = slot.time.includes(':')
                  ? `${slot.date}T${slot.time}:00`
                  : `${slot.date}T${slot.time}`;
                let isPast = false;
                try {
                  const parsedDate = parseISO(slotDateTime);
                  isPast = isValid(parsedDate) ? isAfter(new Date(), parsedDate) : false;
                } catch (error) {
                  isPast = false;
                }

                return (
                  <button
                    key={slot.id}
                    onClick={() => !isPast && isAvailable && handleBook(slot.id)}
                    disabled={isPast || !isAvailable || (!!userAppointment && !isRescheduling)}
                    className={`
                      p-2 sm:p-3 rounded-lg sm:rounded-xl border-2 transition-all
                      ${isPast || !isAvailable || (!!userAppointment && !isRescheduling)
                        ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                        : 'border-gold-200 hover:border-gold-400 hover:bg-gold-50 cursor-pointer'
                      }
                    `}
                  >
                    <div className="flex items-center justify-center gap-1 sm:gap-2 mb-0.5 sm:mb-1">
                      <Clock size={12} className="sm:w-4 sm:h-4 text-gray-500" />
                      <span className="font-medium text-xs sm:text-sm text-gray-900">{slot.time}</span>
                    </div>
                    <p className="text-[10px] sm:text-xs text-gray-500 text-center">
                      {slot.capacity - slot.booked} left
                    </p>
                  </button>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      {slots.length === 0 && (
        <Card className="p-8 sm:p-12 text-center">
          <Calendar size={36} className="sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3 sm:mb-4" />
          <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1 sm:mb-2">{t('noAvailableSlots')}</h3>
          <p className="text-xs sm:text-sm text-gray-500">{t('checkBackLater')}</p>
        </Card>
      )}
    </div>
  );
};

export default AppointmentsPage;

