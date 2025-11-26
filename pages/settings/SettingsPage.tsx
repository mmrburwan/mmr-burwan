import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { profileService } from '../../services/profile';
import { applicationService } from '../../services/application';
import { appointmentService } from '../../services/appointments';
import { certificateService } from '../../services/certificates';
import { documentService } from '../../services/documents';
import { supabase } from '../../lib/supabase';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import PhoneInput from '../../components/ui/PhoneInput';
import { User, Mail, Phone, LogOut, Download, Key, ArrowLeft } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const { showToast } = useNotification();
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
      });
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
      const profile = await profileService.getProfile(user.id);
      const nameParts = formData.name.split(' ');
      
      if (profile) {
        await profileService.updateProfile(user.id, {
          firstName: nameParts[0] || formData.name,
          lastName: nameParts.slice(1).join(' ') || '',
        });
        
        // Recalculate completion percentage after update
        await profileService.calculateCompletion(user.id);
      } else {
        // If no profile exists, create one with basic info
        await profileService.updateProfile(user.id, {
          firstName: nameParts[0] || formData.name,
          lastName: nameParts.slice(1).join(' ') || '',
        });
        await profileService.calculateCompletion(user.id);
      }

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
    showToast('Password change feature will be available soon', 'info');
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate(user?.role === 'admin' ? '/admin' : '/dashboard')}
            className="flex-shrink-0"
          >
            <ArrowLeft size={18} className="mr-2" />
            Back
          </Button>
        </div>
        <h1 className="font-serif text-4xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage your account settings</p>
      </div>

      <div className="space-y-6">
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <User size={20} className="text-gold-600" />
            Profile Information
          </h3>
          <div className="space-y-4">
            <Input
              label="Full Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              leftIcon={<User size={20} />}
            />
            <Input
              label="Email"
              type="email"
              value={user?.email || ''}
              leftIcon={<Mail size={20} />}
              disabled
            />
            <PhoneInput
              label="Phone Number"
              value={formData.phone?.replace('+91', '').trim() || ''}
              onChange={(value) => setFormData({ ...formData, phone: value ? `+91${value}` : '' })}
              leftIcon={<Phone size={20} />}
            />
            <Button 
              variant="primary" 
              onClick={handleSaveChanges}
              isLoading={isSaving}
            >
              Save Changes
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-6">Account Actions</h3>
          <div className="space-y-4">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={handleChangePassword}
            >
              <Key size={18} className="mr-2" />
              Change Password
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={handleDownloadData}
              isLoading={isDownloading}
            >
              <Download size={18} className="mr-2" />
              Download My Data
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-rose-600 hover:text-rose-700"
              onClick={logout}
            >
              <LogOut size={18} className="mr-2" />
              Sign Out
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;

