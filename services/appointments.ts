import { supabase } from '../lib/supabase';
import { AppointmentSlot, Appointment } from '../types';
import { profileService } from './profile';

export const appointmentService = {
  async getAvailableSlots(startDate?: string, endDate?: string): Promise<AppointmentSlot[]> {
    let query = supabase
      .from('appointment_slots')
      .select('*')
      .eq('is_holiday', false)
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return data
      .filter((slot) => slot.booked < slot.capacity)
      .map((slot) => ({
        id: slot.id,
        date: slot.date,
        time: slot.time,
        capacity: slot.capacity,
        booked: slot.booked || 0,
        isHoliday: slot.is_holiday || false,
      }));
  },

  async bookAppointment(userId: string, slotId: string): Promise<Appointment> {
    // Get slot details
    const { data: slot, error: slotError } = await supabase
      .from('appointment_slots')
      .select('*')
      .eq('id', slotId)
      .single();

    if (slotError) {
      throw new Error('Slot not found');
    }

    if (slot.booked >= slot.capacity) {
      throw new Error('Slot is fully booked');
    }

    // Check if user already has a confirmed appointment
    const { data: existingAppointments } = await supabase
      .from('appointments')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'confirmed');

    if (existingAppointments && existingAppointments.length > 0) {
      throw new Error('You already have a confirmed appointment');
    }

    // Update slot booked count
    const { error: updateError } = await supabase
      .from('appointment_slots')
      .update({ booked: slot.booked + 1 })
      .eq('id', slotId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Create appointment
    const qrCodeData = JSON.stringify({
      appointmentId: `apt-${Date.now()}`,
      userId,
      date: slot.date,
      time: slot.time,
    });

    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert({
        user_id: userId,
        slot_id: slotId,
        date: slot.date,
        time: slot.time,
        status: 'confirmed',
        qr_code_data: qrCodeData,
      })
      .select()
      .single();

    if (appointmentError) {
      // Rollback slot booking
      await supabase
        .from('appointment_slots')
        .update({ booked: slot.booked })
        .eq('id', slotId);
      throw new Error(appointmentError.message);
    }

    return {
      id: appointment.id,
      userId: appointment.user_id,
      slotId: appointment.slot_id,
      date: appointment.date,
      time: appointment.time,
      status: appointment.status,
      qrCodeData: appointment.qr_code_data,
      createdAt: appointment.created_at,
    };
  },

  async getUserAppointment(userId: string): Promise<Appointment | null> {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(error.message);
    }

    if (!data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      slotId: data.slot_id,
      date: data.date,
      time: data.time,
      status: data.status,
      qrCodeData: data.qr_code_data,
      createdAt: data.created_at,
    };
  },

  async getAllAppointments(): Promise<Appointment[]> {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return data.map((apt) => ({
      id: apt.id,
      userId: apt.user_id,
      slotId: apt.slot_id,
      date: apt.date,
      time: apt.time,
      status: apt.status,
      qrCodeData: apt.qr_code_data,
      createdAt: apt.created_at,
    }));
  },

  async createSlot(slot: Omit<AppointmentSlot, 'id' | 'booked'>): Promise<AppointmentSlot> {
    const { data, error } = await supabase
      .from('appointment_slots')
      .insert({
        date: slot.date,
        time: slot.time,
        capacity: slot.capacity,
        booked: 0,
        is_holiday: slot.isHoliday || false,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      id: data.id,
      date: data.date,
      time: data.time,
      capacity: data.capacity,
      booked: data.booked || 0,
      isHoliday: data.is_holiday || false,
    };
  },

  async cancelAppointment(appointmentId: string): Promise<void> {
    // Get appointment
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('slot_id')
      .eq('id', appointmentId)
      .single();

    if (fetchError) {
      throw new Error('Appointment not found');
    }

    // Update appointment status
    const { error: updateError } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointmentId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Get slot and decrement booked count
    const { data: slot } = await supabase
      .from('appointment_slots')
      .select('booked')
      .eq('id', appointment.slot_id)
      .single();

    if (slot) {
      await supabase
        .from('appointment_slots')
        .update({ booked: Math.max(0, slot.booked - 1) })
        .eq('id', appointment.slot_id);
    }
  },

  async getAppointmentWithUserDetails(appointmentId: string): Promise<{
    appointment: Appointment;
    user: {
      id: string;
      email: string;
      name: string;
      phone?: string;
      dateOfBirth?: string;
      idNumber?: string;
    };
  } | null> {
    // Get appointment first
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (appointmentError) {
      throw new Error('Appointment not found');
    }

    // Get profile in parallel with appointment data processing
    const userProfile = await profileService.getProfile(appointment.user_id);

    // Get user name from profile
    const userName = userProfile 
      ? `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || 'Unknown User'
      : 'Unknown User';

    // Try to get phone from application (non-blocking, but we'll wait briefly)
    let phoneNumber: string | undefined;
    try {
      const { data: appData } = await supabase
        .from('applications')
        .select('user_details')
        .eq('user_id', appointment.user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (appData?.user_details?.mobileNumber) {
        phoneNumber = appData.user_details.mobileNumber;
      }
    } catch (error) {
      // Ignore errors - phone is optional
    }

    return {
      appointment: {
        id: appointment.id,
        userId: appointment.user_id,
        slotId: appointment.slot_id,
        date: appointment.date,
        time: appointment.time,
        status: appointment.status,
        qrCodeData: appointment.qr_code_data,
        createdAt: appointment.created_at,
      },
      user: {
        id: appointment.user_id,
        email: `User ID: ${appointment.user_id.substring(0, 8)}...`,
        name: userName,
        phone: phoneNumber,
        dateOfBirth: userProfile?.dateOfBirth,
        idNumber: userProfile?.idNumber,
      },
    };
  },
};
