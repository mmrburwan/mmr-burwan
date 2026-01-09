import { supabase } from '../lib/supabase';
import { Profile, Address, PartnerDetails } from '../types';

export const profileService = {
  async getProfile(userId: string): Promise<Profile | null> {
    // Note: profiles table uses 'id' as PK which equals auth.users.id
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw new Error(error.message);
    }

    if (!data) return null;

    return {
      id: data.id,
      userId: data.id, // id IS the userId in this table
      firstName: data.first_name || '',
      lastName: data.last_name || '',
      dateOfBirth: data.date_of_birth || '',
      idNumber: data.id_number || '',
      address: data.address as Address || {
        villageStreet: '',
        postOffice: '',
        policeStation: '',
        district: '',
        state: '',
        zipCode: '',
        country: 'India',
      },
      partnerDetails: data.partner_details as PartnerDetails | undefined,
      completionPercentage: data.completion_percentage || 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
    // Note: profiles table uses 'id' as PK which equals auth.users.id
    const profileData: any = {
      id: userId, // Use 'id' not 'user_id'
      first_name: updates.firstName,
      last_name: updates.lastName,
      date_of_birth: updates.dateOfBirth,
      id_number: updates.idNumber,
      address: updates.address,
      partner_details: updates.partnerDetails,
      completion_percentage: updates.completionPercentage,
      updated_at: new Date().toISOString(),
    };

    // Remove undefined values to avoid overwriting
    Object.keys(profileData).forEach(key => {
      if (profileData[key] === undefined) {
        delete profileData[key];
      }
    });

    // Try UPDATE first using 'id' column
    const { data: updatedData, error: updateError } = await supabase
      .from('profiles')
      .update(profileData)
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (updateError) throw new Error(updateError.message);

    if (updatedData) {
      return this.mapProfile(updatedData);
    }

    // If no update happened (profile doesn't exist), INSERT
    // Make sure to include the id for insert
    profileData.id = userId;

    const { data: insertedData, error: insertError } = await supabase
      .from('profiles')
      .insert(profileData)
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);

    return this.mapProfile(insertedData);
  },

  async updateAddress(userId: string, address: Address): Promise<Profile> {
    return this.updateProfile(userId, { address });
  },

  async updatePartnerDetails(userId: string, partnerDetails: PartnerDetails): Promise<Profile> {
    return this.updateProfile(userId, { partnerDetails });
  },

  async calculateCompletion(userId: string, currentProfile?: Profile | null): Promise<{ percentage: number; profile?: Profile }> {
    let profile = currentProfile;

    if (!profile) {
      profile = await this.getProfile(userId);
    }

    if (!profile) {
      return { percentage: 0 };
    }

    let completed = 0;
    const total = 5; // We check 5 fields

    // Check each field
    // 1. Name (first and last)
    if (profile.firstName && profile.lastName &&
      profile.firstName.trim() && profile.lastName.trim()) {
      completed++;
    }

    // 2. Date of birth
    if (profile.dateOfBirth && profile.dateOfBirth.trim()) {
      completed++;
    }

    // 3. ID number
    if (profile.idNumber && profile.idNumber.trim()) {
      completed++;
    }

    // 4. Address (street and city required)
    if (profile.address?.street && profile.address?.city &&
      profile.address.street.trim() && profile.address.city.trim()) {
      completed++;
    }

    // 5. Partner details (check if partner has at least first name and last name)
    if (profile.partnerDetails &&
      profile.partnerDetails.firstName &&
      profile.partnerDetails.lastName &&
      profile.partnerDetails.firstName.trim() &&
      profile.partnerDetails.lastName.trim()) {
      completed++;
    }

    const percentage = Math.round((completed / total) * 100);

    // only update if changed to save a write
    if (profile.completionPercentage !== percentage) {
      const updatedProfile = await this.updateProfile(userId, { completionPercentage: percentage });
      return { percentage, profile: updatedProfile };
    }

    return { percentage, profile };
  },

  mapProfile(data: any): Profile {
    return {
      id: data.id,
      userId: data.id, // id IS the userId in profiles table
      firstName: data.first_name || '',
      lastName: data.last_name || '',
      dateOfBirth: data.date_of_birth || '',
      idNumber: data.id_number || '',
      address: data.address as Address || {
        villageStreet: '',
        postOffice: '',
        policeStation: '',
        district: '',
        state: '',
        zipCode: '',
        country: 'India',
      },
      partnerDetails: data.partner_details as PartnerDetails | undefined,
      completionPercentage: data.completion_percentage || 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },
};
