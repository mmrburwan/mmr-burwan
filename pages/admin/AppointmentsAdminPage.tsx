import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { appointmentService } from '../../services/appointments';
import { useNotification } from '../../contexts/NotificationContext';
import { AppointmentSlot, Appointment } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import QRCode from '../../components/ui/QRCode';
import { Calendar, Plus, Clock, User, Mail, Phone, Eye, CheckCircle, XCircle, AlertCircle, IdCard, CalendarDays, ArrowLeft } from 'lucide-react';
import { safeFormatDate, safeFormatDateObject } from '../../utils/dateUtils';

const AppointmentsAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useNotification();
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSlot, setNewSlot] = useState({ date: '', time: '', capacity: 5 });
  const [selectedAppointment, setSelectedAppointment] = useState<{
    appointment: Appointment;
    user: {
      id: string;
      email: string;
      name: string;
      phone?: string;
    };
  } | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [slotsData, appointmentsData] = await Promise.all([
          appointmentService.getAvailableSlots(),
          appointmentService.getAllAppointments(),
        ]);
        setSlots(slotsData);
        setAppointments(appointmentsData);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };

    loadData();
  }, []);

  const handleCreateSlot = async () => {
    try {
      await appointmentService.createSlot(newSlot);
      showToast('Slot created successfully', 'success');
      setIsModalOpen(false);
      setNewSlot({ date: '', time: '', capacity: 5 });
      // Reload slots
      const updated = await appointmentService.getAvailableSlots();
      setSlots(updated);
    } catch (error) {
      showToast('Failed to create slot', 'error');
    }
  };

  const handleViewAppointmentDetails = async (appointmentId: string) => {
    // Open modal immediately with loading state
    setIsDetailsModalOpen(true);
    setIsLoadingDetails(true);
    setSelectedAppointment(null);
    
    try {
      const details = await appointmentService.getAppointmentWithUserDetails(appointmentId);
      setSelectedAppointment(details);
    } catch (error: any) {
      showToast(error.message || 'Failed to load appointment details', 'error');
      setIsDetailsModalOpen(false);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
      confirmed: 'success',
      pending: 'warning',
      completed: 'info',
      cancelled: 'error',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">Appointment Management</h1>
            <p className="text-xs sm:text-sm text-gray-600">Create and manage appointment slots</p>
          </div>
          <Button variant="primary" onClick={() => setIsModalOpen(true)} size="sm" className="!text-xs sm:!text-sm !px-2 sm:!px-3">
            <Plus size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Create Slot</span>
            <span className="sm:hidden">Create</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
        <Card className="p-3 sm:p-4 lg:p-6">
          <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-2 sm:mb-3 lg:mb-4">Available Slots</h3>
          <div className="space-y-2 sm:space-y-3">
            {slots.map((slot) => (
              <div key={slot.id} className="p-2.5 sm:p-3 lg:p-4 bg-gray-50 rounded-lg sm:rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-xs sm:text-sm lg:text-base text-gray-900 truncate">
                      {safeFormatDate(slot.date, 'MMM d, yyyy')} at {slot.time}
                    </p>
                    <p className="text-[10px] sm:text-xs lg:text-sm text-gray-500">
                      {slot.capacity - slot.booked} of {slot.capacity} available
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-3 sm:p-4 lg:p-6">
          <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-2 sm:mb-3 lg:mb-4">Booked Appointments</h3>
          <div className="space-y-2 sm:space-y-3">
            {appointments.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-gray-500">
                <Calendar size={24} className="sm:w-8 sm:h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-xs sm:text-sm">No appointments booked yet</p>
              </div>
            ) : (
              appointments.map((apt) => (
                <div 
                  key={apt.id} 
                  className="p-2.5 sm:p-3 lg:p-4 bg-gray-50 rounded-lg sm:rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => handleViewAppointmentDetails(apt.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                        <Calendar size={14} className="sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                        <p className="font-medium text-xs sm:text-sm lg:text-base text-gray-900 truncate">
                          {safeFormatDate(apt.date, 'MMM d, yyyy')} at {apt.time}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        {getStatusBadge(apt.status)}
                        <span className="text-[10px] sm:text-xs text-gray-400 truncate">
                          ID: {apt.id.substring(0, 8)}...
                        </span>
                      </div>
                    </div>
                    <Eye size={16} className="sm:w-4 sm:h-5 text-gray-400 flex-shrink-0" />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Slot"
      >
        <div className="space-y-4">
          <Input
            label="Date"
            type="date"
            value={newSlot.date}
            onChange={(e) => setNewSlot({ ...newSlot, date: e.target.value })}
            required
          />
          <Input
            label="Time"
            type="time"
            value={newSlot.time}
            onChange={(e) => setNewSlot({ ...newSlot, time: e.target.value })}
            required
          />
          <Input
            label="Capacity"
            type="number"
            value={newSlot.capacity}
            onChange={(e) => setNewSlot({ ...newSlot, capacity: parseInt(e.target.value) })}
            required
          />
          <Button variant="primary" onClick={handleCreateSlot} className="w-full">
            Create Slot
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedAppointment(null);
        }}
        title="Appointment Details"
        size="xl"
      >
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
          {isLoadingDetails ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold-500 mb-4"></div>
              <p className="text-sm text-gray-600">Loading appointment details...</p>
            </div>
          ) : selectedAppointment ? (
            <div className="space-y-6">
              {/* User Information */}
              <div className="bg-gray-50 rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-5">
                <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-2 sm:mb-3 lg:mb-4 flex items-center gap-1.5 sm:gap-2">
                  <User size={14} className="sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-gold-600" />
                  User Information
                </h3>
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-full bg-gold-100 flex items-center justify-center flex-shrink-0">
                      <User size={14} className="sm:w-5 sm:h-5 text-gold-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs lg:text-sm text-gray-500 mb-0.5 sm:mb-1">Full Name</p>
                      <p className="font-medium text-gray-900">{selectedAppointment.user.name}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Mail size={14} className="sm:w-5 sm:h-5 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs lg:text-sm text-gray-500 mb-0.5 sm:mb-1">Email / User ID</p>
                      <p className="font-medium text-xs sm:text-sm text-gray-900 break-all">{selectedAppointment.user.email}</p>
                    </div>
                  </div>
                  {selectedAppointment.user.phone && (
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Phone size={14} className="sm:w-5 sm:h-5 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] sm:text-xs lg:text-sm text-gray-500 mb-0.5 sm:mb-1">Phone Number</p>
                        <p className="font-medium text-xs sm:text-sm text-gray-900 truncate">{selectedAppointment.user.phone}</p>
                      </div>
                    </div>
                  )}
                  {selectedAppointment.user.dateOfBirth && (
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <CalendarDays size={14} className="sm:w-5 sm:h-5 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] sm:text-xs lg:text-sm text-gray-500 mb-0.5 sm:mb-1">Date of Birth</p>
                        <p className="font-medium text-xs sm:text-sm text-gray-900">
                          {safeFormatDate(selectedAppointment.user.dateOfBirth, 'MMMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                  )}
                  {selectedAppointment.user.idNumber && (
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <IdCard size={14} className="sm:w-5 sm:h-5 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] sm:text-xs lg:text-sm text-gray-500 mb-0.5 sm:mb-1">ID Number</p>
                        <p className="font-medium text-xs sm:text-sm text-gray-900 truncate">{selectedAppointment.user.idNumber}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            {/* Appointment Information */}
            <div className="bg-gray-50 rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-5">
              <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-2 sm:mb-3 lg:mb-4 flex items-center gap-1.5 sm:gap-2">
                <Calendar size={14} className="sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-gold-600" />
                Appointment Information
              </h3>
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between py-1.5 sm:py-2 border-b border-gray-200">
                  <span className="text-[10px] sm:text-xs lg:text-sm text-gray-600">Date</span>
                  <span className="font-medium text-xs sm:text-sm text-gray-900 truncate ml-2">
                    {safeFormatDate(selectedAppointment.appointment.date, 'MMMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 sm:py-2 border-b border-gray-200">
                  <span className="text-[10px] sm:text-xs lg:text-sm text-gray-600">Time</span>
                  <span className="font-medium text-xs sm:text-sm text-gray-900">{selectedAppointment.appointment.time}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 sm:py-2 border-b border-gray-200">
                  <span className="text-[10px] sm:text-xs lg:text-sm text-gray-600">Status</span>
                  {getStatusBadge(selectedAppointment.appointment.status)}
                </div>
                <div className="flex items-center justify-between py-1.5 sm:py-2 border-b border-gray-200">
                  <span className="text-[10px] sm:text-xs lg:text-sm text-gray-600">Appointment ID</span>
                  <span className="font-mono text-[10px] sm:text-xs text-gray-600 truncate ml-2">{selectedAppointment.appointment.id}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 sm:py-2">
                  <span className="text-[10px] sm:text-xs lg:text-sm text-gray-600">Booked On</span>
                  <span className="text-[10px] sm:text-xs text-gray-900 truncate ml-2">
                    {safeFormatDateObject(new Date(selectedAppointment.appointment.createdAt), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
              </div>
            </div>

              {/* QR Code */}
              <div className="bg-gray-50 rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-5">
                <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900 mb-2 sm:mb-3 lg:mb-4 flex items-center gap-1.5 sm:gap-2">
                  <CheckCircle size={14} className="sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-gold-600" />
                  QR Code
                </h3>
                <div className="flex justify-center py-2 sm:py-3 lg:py-4">
                  <QRCode value={selectedAppointment.appointment.qrCodeData} size={120} className="sm:!w-[160px] sm:!h-[160px] lg:!w-[180px] lg:!h-[180px]" />
                </div>
                <p className="text-[10px] sm:text-xs text-gray-500 text-center mt-2 sm:mt-3">
                  Scan this QR code to verify the appointment
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle size={32} className="mx-auto mb-2 text-gray-300" />
              <p>No appointment details available</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default AppointmentsAdminPage;

