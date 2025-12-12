import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useTranslation } from '../../hooks/useTranslation';
import { profileService } from '../../services/profile';
import { applicationService } from '../../services/application';
import { appointmentService } from '../../services/appointments';
import { certificateService } from '../../services/certificates';
import { documentService } from '../../services/documents';
import { supabase } from '../../lib/supabase';
import { Profile } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import PhoneInput from '../../components/ui/PhoneInput';
import { User, Mail, Phone, Download, Key, ArrowLeft, Calendar, Hash, MapPin, Heart, Edit2 } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { authService } from '../../services/auth';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const { showToast } = useNotification();
  const { t } = useTranslation('settings');
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    dateOfBirth: '',
    idNumber: '',
    addressStreet: '',
    addressCity: '',
    addressState: '',
    addressZipCode: '',
    addressCountry: 'India',
    partnerFirstName: '',
    partnerLastName: '',
  });

  // Email update state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      setIsLoading(true);
      try {
        const profileData = await profileService.getProfile(user.id);
        setProfile(profileData);

        if (profileData) {
          setFormData({
            name: user.name || '',
            phone: user.phone || '',
            dateOfBirth: profileData.dateOfBirth || '',
            idNumber: profileData.idNumber || '',
            addressStreet: profileData.address?.street || '',
            addressCity: profileData.address?.city || '',
            addressState: profileData.address?.state || '',
            addressZipCode: profileData.address?.zipCode || '',
            addressCountry: profileData.address?.country || 'India',
            partnerFirstName: profileData.partnerDetails?.firstName || '',
            partnerLastName: profileData.partnerDetails?.lastName || '',
          });
        } else {
          setFormData({
            name: user.name || '',
            phone: user.phone || '',
            dateOfBirth: '',
            idNumber: '',
            addressStreet: '',
            addressCity: '',
            addressState: '',
            addressZipCode: '',
            addressCountry: 'India',
            partnerFirstName: '',
            partnerLastName: '',
          });
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadProfile();
    }
  }, [user]);

  const handleSaveChanges = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      // First, verify we have a valid session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error('No active session. Please log in again.');
      }

      // Prepare update data - only include phone if it has a value
      const updateData: { name: string; phone?: string } = {
        name: formData.name,
      };

      if (formData.phone && formData.phone.trim()) {
        updateData.phone = formData.phone;
      }

      // Try to update user metadata (this might fail if user doesn't have permission)
      // But we'll continue with profile update even if this fails
      let authUpdateSuccess = false;
      const { data: updateResult, error: updateError } = await supabase.auth.updateUser({
        data: updateData,
      });

      if (updateError) {
        console.error('Supabase auth update error:', updateError);
        // Log the specific error for debugging
        console.error('Error details:', {
          message: updateError.message,
          status: updateError.status,
        });
      } else {
        authUpdateSuccess = true;
        // Update local user state with the updated user from Supabase
        if (updateResult?.user) {
          const updatedUser = {
            ...user,
            name: updateResult.user.user_metadata?.name || formData.name,
            phone: updateResult.user.user_metadata?.phone || formData.phone || '',
          };
          updateUser(updatedUser);
        }
      }

      // Always update profile in database (this uses RLS policies)
      const currentProfile = await profileService.getProfile(user.id);
      const nameParts = formData.name.split(' ');

      const profileUpdate: any = {
        firstName: nameParts[0] || formData.name,
        lastName: nameParts.slice(1).join(' ') || '',
      };

      // Add date of birth if provided
      if (formData.dateOfBirth) {
        profileUpdate.dateOfBirth = formData.dateOfBirth;
      }

      // Add ID number if provided
      if (formData.idNumber) {
        profileUpdate.idNumber = formData.idNumber;
      }

      // Add address if street and city are provided
      if (formData.addressStreet && formData.addressCity) {
        profileUpdate.address = {
          street: formData.addressStreet,
          city: formData.addressCity,
          state: formData.addressState || '',
          zipCode: formData.addressZipCode || '',
          country: formData.addressCountry || 'India',
        };
      }

      // Add partner details if first and last name are provided
      if (formData.partnerFirstName && formData.partnerLastName) {
        profileUpdate.partnerDetails = {
          ...(currentProfile?.partnerDetails || {}),
          firstName: formData.partnerFirstName,
          lastName: formData.partnerLastName,
        };
      }

      await profileService.updateProfile(user.id, profileUpdate);

      // Recalculate completion percentage after update
      const completion = await profileService.calculateCompletion(user.id);

      // Reload profile to get updated data
      const updatedProfile = await profileService.getProfile(user.id);
      setProfile(updatedProfile);

      // Update local state
      const updatedUser = {
        ...user,
        name: formData.name,
        phone: formData.phone || '',
      };
      updateUser(updatedUser);

      // Show success message
      if (authUpdateSuccess) {
        showToast('Profile updated successfully', 'success');
      } else {
        showToast('Profile updated, but some changes may require re-login to take effect', 'info');
      }
    } catch (error: any) {
      console.error('Failed to save:', error);
      // Provide more specific error messages
      const errorMessage = error.message || 'Failed to save changes. Please try again.';

      if (errorMessage.includes('permission') || errorMessage.includes('denied') || errorMessage.includes('RLS')) {
        showToast('Permission denied. Please ensure you are logged in correctly and try again.', 'error');
      } else if (errorMessage.includes('session')) {
        showToast('Your session has expired. Please log in again.', 'error');
      } else {
        showToast(errorMessage, 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadData = async () => {
    if (!user) return;

    setIsDownloading(true);
    try {
      // Collect all user data
      const [profile, application, appointment, certificate] = await Promise.all([
        profileService.getProfile(user.id),
        applicationService.getApplication(user.id),
        appointmentService.getUserAppointment(user.id),
        certificateService.getCertificate(user.id),
      ]);

      // Get documents if application exists
      const documents = application ? await documentService.getDocuments(application.id) : [];

      const userData = {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
          createdAt: user.createdAt,
        },
        profile,
        application,
        appointment,
        certificate,
        documents,
        downloadedAt: new Date().toISOString(),
      };

      // Create and download JSON file
      const dataStr = JSON.stringify(userData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mmr-burwan-data-${user.id}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('Data downloaded successfully', 'success');
    } catch (error) {
      console.error('Failed to download data:', error);
      showToast('Failed to download data. Please try again.', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleChangePassword = () => {
    showToast(t('messages.passwordChangeSoon'), 'info');
  };

  const handleUpdateEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    setIsUpdatingEmail(true);
    try {
      await authService.updateEmail(newEmail);
      showToast('Confirmation link sent to your new email address. Please check your inbox.', 'success');
      setIsEmailModalOpen(false);
      setNewEmail('');
    } catch (error: any) {
      console.error('Failed to update email:', error);
      showToast(error.message || 'Failed to update email', 'error');
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(user?.role === 'admin' ? '/admin' : '/dashboard')}
            className="flex-shrink-0 !px-2 sm:!px-3"
          >
            <ArrowLeft size={16} className="sm:w-[18px] sm:h-[18px] mr-1 sm:mr-2" />
            <span className="text-xs sm:text-sm">{t('back')}</span>
          </Button>
        </div>
        <h1 className="font-serif text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1">{t('title')}</h1>
        <p className="text-xs sm:text-sm text-gray-600">{t('subtitle')}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px] sm:min-h-[400px]">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-t-2 border-b-2 border-gold-500"></div>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {/* Basic Information */}
          <Card className="p-3 sm:p-5">
            <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
              <User size={16} className="sm:w-5 sm:h-5 text-gold-600" />
              Basic Information
            </h3>
            <div className="space-y-3 sm:space-y-4">
              <Input
                label="Full Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                leftIcon={<User size={16} className="sm:w-5 sm:h-5" />}
              />
              <div className="relative">
                <Input
                  label="Email"
                  type="email"
                  value={user?.email || ''}
                  leftIcon={<Mail size={16} className="sm:w-5 sm:h-5" />}
                  disabled
                />
                <div className="absolute top-[28px] right-2 sm:right-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEmailModalOpen(true)}
                    className="!py-1 !px-2 h-auto text-gold-600 hover:text-gold-700 hover:bg-gold-50"
                  >
                    <span className="text-xs font-medium">Change</span>
                  </Button>
                </div>
              </div>
              <PhoneInput
                label="Phone Number"
                value={formData.phone?.replace('+91', '').trim() || ''}
                onChange={(value) => setFormData({ ...formData, phone: value ? `+91${value}` : '' })}
                leftIcon={<Phone size={16} className="sm:w-5 sm:h-5" />}
              />
            </div>
          </Card>

          {/* Personal Details */}
          <Card className="p-3 sm:p-5">
            <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
              <Calendar size={16} className="sm:w-5 sm:h-5 text-gold-600" />
              Personal Details
            </h3>
            <div className="space-y-3 sm:space-y-4">
              <Input
                label="Date of Birth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                leftIcon={<Calendar size={16} className="sm:w-5 sm:h-5" />}
              />
              <Input
                label="Aadhaar Number"
                type="text"
                maxLength={12}
                value={formData.idNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 12);
                  setFormData({ ...formData, idNumber: value });
                }}
                leftIcon={<Hash size={16} className="sm:w-5 sm:h-5" />}
                placeholder="12-digit Aadhaar"
              />
            </div>
          </Card>

          {/* Address Information */}
          <Card className="p-3 sm:p-5">
            <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
              <MapPin size={16} className="sm:w-5 sm:h-5 text-gold-600" />
              Address
            </h3>
            <div className="space-y-3 sm:space-y-4">
              <Input
                label="Street Address"
                value={formData.addressStreet}
                onChange={(e) => setFormData({ ...formData, addressStreet: e.target.value })}
                leftIcon={<MapPin size={16} className="sm:w-5 sm:h-5" />}
                placeholder="Street address"
              />
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <Input
                  label="City"
                  value={formData.addressCity}
                  onChange={(e) => setFormData({ ...formData, addressCity: e.target.value })}
                  placeholder="City"
                />
                <Input
                  label="State"
                  value={formData.addressState}
                  onChange={(e) => setFormData({ ...formData, addressState: e.target.value })}
                  placeholder="State"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <Input
                  label="ZIP Code"
                  value={formData.addressZipCode}
                  onChange={(e) => setFormData({ ...formData, addressZipCode: e.target.value })}
                  placeholder="ZIP"
                />
                <Input
                  label="Country"
                  value={formData.addressCountry}
                  onChange={(e) => setFormData({ ...formData, addressCountry: e.target.value })}
                  placeholder="Country"
                />
              </div>
            </div>
          </Card>

          {/* Partner Details */}
          <Card className="p-3 sm:p-5">
            <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
              <Heart size={16} className="sm:w-5 sm:h-5 text-gold-600" />
              Partner Details
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <Input
                label="First Name"
                value={formData.partnerFirstName}
                onChange={(e) => setFormData({ ...formData, partnerFirstName: e.target.value })}
                placeholder="First name"
              />
              <Input
                label="Last Name"
                value={formData.partnerLastName}
                onChange={(e) => setFormData({ ...formData, partnerLastName: e.target.value })}
                placeholder="Last name"
              />
            </div>
          </Card>

          {/* Save Button */}
          <Card className="p-3 sm:p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">
                  Profile: <span className="font-semibold text-gray-900">{profile?.completionPercentage || 0}%</span>
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                  Complete all sections for 100%
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveChanges}
                isLoading={isSaving}
                className="w-full sm:w-auto !text-xs sm:!text-sm"
              >
                Save Changes
              </Button>
            </div>
          </Card>

          {/* Account Actions */}
          <Card className="p-3 sm:p-5">
            <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-3 sm:mb-4">Account Actions</h3>
            <div className="space-y-2 sm:space-y-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start !text-xs sm:!text-sm"
                onClick={handleChangePassword}
              >
                <Key size={14} className="sm:w-[18px] sm:h-[18px] mr-2" />
                Change Password
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start !text-xs sm:!text-sm"
                onClick={() => setIsEmailModalOpen(true)}
              >
                <Mail size={14} className="sm:w-[18px] sm:h-[18px] mr-2" />
                Change Email
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start !text-xs sm:!text-sm"
                onClick={handleDownloadData}
                isLoading={isDownloading}
              >
                <Download size={14} className="sm:w-[18px] sm:h-[18px] mr-2" />
                Download My Data
              </Button>
            </div>
          </Card>
        </div>
      )}
      <Modal
        isOpen={isEmailModalOpen}
        onClose={() => {
          setIsEmailModalOpen(false);
          setNewEmail('');
        }}
        title="Change Email Address"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm">
            Note: Changing your email will require you to verify the new email address.
            A confirmation link will be sent to the new email.
          </div>

          <Input
            label="New Email Address"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Enter new email"
            leftIcon={<Mail size={16} />}
          />

          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setIsEmailModalOpen(false);
                setNewEmail('');
              }}
              disabled={isUpdatingEmail}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUpdateEmail}
              isLoading={isUpdatingEmail}
              disabled={!newEmail || isUpdatingEmail}
            >
              Update Email
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SettingsPage;

