import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { appointmentService } from '../../services/appointments';
import { useNotification } from '../../contexts/NotificationContext';
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
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [userAppointment, setUserAppointment] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const handleBook = (slotId: string) => {
    navigate(`/appointments/book?slotId=${slotId}`);
  };

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
    <div className="max-w-6xl mx-auto px-6 py-8">
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
        <h1 className="font-serif text-4xl font-bold text-gray-900 mb-2">Book Appointment</h1>
        <p className="text-gray-600">Select an available time slot for your registration</p>
      </div>

      {userAppointment && (
        <Card className="p-6 mb-8 bg-gold-50 border-gold-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <CheckCircle size={20} className="text-gold-600" />
                You have an appointment
              </h3>
              <p className="text-gray-700">
                {safeFormatDate(userAppointment.date, 'MMMM d, yyyy', userAppointment.date)} at {userAppointment.time}
              </p>
            </div>
            <Button variant="primary" onClick={() => navigate('/pass')}>
              View Pass
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-6">
        {Object.entries(groupedSlots).map(([date, dateSlots]) => (
          <Card key={date} className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar size={20} className="text-gold-600" />
              {safeFormatDate(date, 'EEEE, MMMM d, yyyy', date)}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {dateSlots.map((slot) => {
                const isAvailable = slot.booked < slot.capacity;
                // Ensure proper ISO format: date should be YYYY-MM-DD and time HH:MM
                const slotDateTime = slot.time.includes(':') 
                  ? `${slot.date}T${slot.time}:00` 
                  : `${slot.date}T${slot.time}`;
                let isPast = false;
                try {
                  const parsedDate = parseISO(slotDateTime);
                  isPast = isValid(parsedDate) ? isAfter(new Date(), parsedDate) : false;
                } catch (error) {
                  // If parsing fails, assume it's not in the past
                  isPast = false;
                }
                
                return (
                  <button
                    key={slot.id}
                    onClick={() => !isPast && isAvailable && handleBook(slot.id)}
                    disabled={isPast || !isAvailable || !!userAppointment}
                    className={`
                      p-4 rounded-xl border-2 transition-all
                      ${isPast || !isAvailable || userAppointment
                        ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                        : 'border-gold-200 hover:border-gold-400 hover:bg-gold-50 cursor-pointer'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Clock size={16} className="text-gray-500" />
                      <span className="font-medium text-gray-900">{slot.time}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {slot.capacity - slot.booked} available
                    </p>
                  </button>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      {slots.length === 0 && (
        <Card className="p-12 text-center">
          <Calendar size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">No Available Slots</h3>
          <p className="text-gray-500">Please check back later for new appointment slots.</p>
        </Card>
      )}
    </div>
  );
};

export default AppointmentsPage;

