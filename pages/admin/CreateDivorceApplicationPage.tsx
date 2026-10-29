import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { supabase } from '../../lib/supabase';
import { divorceApplicationService } from '../../services/divorceApplication';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { FileX, Search, CheckCircle2, AlertCircle, ArrowRight, User, Users, FileText } from 'lucide-react';
import StateDistrictSelector from '../../components/StateDistrictSelector';

const divorceSchema = z.object({
  // Search / Link
  marriageCertificateNumber: z.string().optional(),
  
  // Husband Details
  husbandFirstName: z.string().min(1, 'Husband first name is required'),
  husbandLastName: z.string().optional(),
  husbandFatherName: z.string().min(1, "Husband father's name is required"),
  husbandDob: z.string().min(1, 'Husband date of birth is required'),
  husbandAadhaar: z.string().min(12, 'Valid 12-digit Aadhaar number required'),
  husbandMobile: z.string().min(10, 'Valid 10-digit mobile number required'),
  husbandEmail: z.string().email('Invalid email').optional().or(z.literal('')),

  // Wife Details
  wifeFirstName: z.string().min(1, 'Wife first name is required'),
  wifeLastName: z.string().optional(),
  wifeFatherName: z.string().min(1, "Wife father's name is required"),
  wifeDob: z.string().min(1, 'Wife date of birth is required'),
  wifeAadhaar: z.string().min(12, 'Valid 12-digit Aadhaar number required'),
  wifeMobile: z.string().optional(),

  // Husband Address
  husbandVillage: z.string().min(1, 'Village/Street is required'),
  husbandPostOffice: z.string().min(1, 'Post Office is required'),
  husbandPoliceStation: z.string().min(1, 'Police Station is required'),
  husbandDistrict: z.string().min(1, 'District is required'),
  husbandState: z.string().min(1, 'State is required'),
  husbandPin: z.string().min(6, 'Valid 6-digit PIN code required'),

  // Wife Address
  wifeVillage: z.string().min(1, 'Village/Street is required'),
  wifePostOffice: z.string().min(1, 'Post Office is required'),
  wifePoliceStation: z.string().min(1, 'Police Station is required'),
  wifeDistrict: z.string().min(1, 'District is required'),
  wifeState: z.string().min(1, 'State is required'),
  wifePin: z.string().min(6, 'Valid 6-digit PIN code required'),

  // Divorce Particulars
  divorceDate: z.string().min(1, 'Date of divorce is required'),
  divorceType: z.enum(['talaq', 'khula', 'mutual', 'mubarat', 'other']),
  divorceReason: z.string().optional(),
});

type DivorceFormData = z.infer<typeof divorceSchema>;

interface CreateDivorceApplicationPageProps {
  isEmbedded?: boolean;
}

const CreateDivorceApplicationPage: React.FC<CreateDivorceApplicationPageProps> = ({ isEmbedded = false }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useNotification();

  const [searchCertNumber, setSearchCertNumber] = useState('');
  const [isSearchingMarriage, setIsSearchingMarriage] = useState(false);
  const [linkedMarriage, setLinkedMarriage] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DivorceFormData>({
    resolver: zodResolver(divorceSchema),
    defaultValues: {
      divorceType: 'talaq',
      divorceDate: new Date().toISOString().split('T')[0],
      husbandState: 'WEST BENGAL',
      wifeState: 'WEST BENGAL',
    },
  });

  const handleSearchMarriage = async () => {
    if (!searchCertNumber.trim()) {
      showToast('Please enter a Marriage Certificate Number to search', 'error');
      return;
    }

    setIsSearchingMarriage(true);
    try {
      const normalized = searchCertNumber.trim().toUpperCase().replace(/-/g, '');
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('certificate_number', normalized)
        .maybeSingle();

      if (error || !data) {
        showToast('Marriage application not found for this certificate number', 'error');
        setLinkedMarriage(null);
        return;
      }

      setLinkedMarriage(data);
      showToast('Marriage record found! Pre-filling husband and wife details.', 'success');

      // Pre-fill form fields
      setValue('marriageCertificateNumber', data.certificate_number || searchCertNumber.trim());

      const userDetails = data.user_details || {};
      const partnerForm = data.partner_form || {};
      const userAddr = data.user_address || {};
      const partnerAddr = data.partner_address || {};

      setValue('husbandFirstName', userDetails.firstName || '');
      setValue('husbandLastName', userDetails.lastName || '');
      setValue('husbandFatherName', userDetails.fatherName || '');
      setValue('husbandDob', userDetails.dateOfBirth || '');
      setValue('husbandAadhaar', userDetails.aadhaarNumber || '');
      setValue('husbandMobile', userDetails.mobileNumber || '');
      setValue('husbandEmail', data.proxy_user_email || '');

      setValue('wifeFirstName', partnerForm.firstName || '');
      setValue('wifeLastName', partnerForm.lastName || '');
      setValue('wifeFatherName', partnerForm.fatherName || '');
      setValue('wifeDob', partnerForm.dateOfBirth || '');
      setValue('wifeAadhaar', partnerForm.aadhaarNumber || partnerForm.idNumber || '');
      setValue('wifeMobile', partnerForm.mobileNumber || '');

      setValue('husbandVillage', userAddr.villageStreet || userAddr.street || '');
      setValue('husbandPostOffice', userAddr.postOffice || userAddr.city || '');
      setValue('husbandPoliceStation', userAddr.policeStation || '');
      setValue('husbandDistrict', userAddr.district || 'MURSHIDABAD');
      setValue('husbandState', userAddr.state || 'WEST BENGAL');
      setValue('husbandPin', userAddr.zipCode || '');

      setValue('wifeVillage', partnerAddr.villageStreet || partnerAddr.street || '');
      setValue('wifePostOffice', partnerAddr.postOffice || partnerAddr.city || '');
      setValue('wifePoliceStation', partnerAddr.policeStation || '');
      setValue('wifeDistrict', partnerAddr.district || 'MURSHIDABAD');
      setValue('wifeState', partnerAddr.state || 'WEST BENGAL');
      setValue('wifePin', partnerAddr.zipCode || '');
    } catch (err: any) {
      console.error('Error finding marriage:', err);
      showToast('Error finding marriage application', 'error');
    } finally {
      setIsSearchingMarriage(false);
    }
  };

  const onSubmit = async (formData: DivorceFormData) => {
    if (!user) {
      showToast('Admin authentication required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // Determine the applicant user_id:
      // If linked to marriage, use the marriage application's user_id
      // Otherwise, use current admin user or proxy user
      let targetUserId = linkedMarriage?.user_id;

      if (!targetUserId) {
        // Fallback to admin id or query by email if provided
        targetUserId = user.id;
      }

      const userDetails = {
        firstName: formData.husbandFirstName.trim(),
        lastName: (formData.husbandLastName || '').trim(),
        fatherName: formData.husbandFatherName.trim(),
        dateOfBirth: formData.husbandDob,
        aadhaarNumber: formData.husbandAadhaar.replace(/\s/g, ''),
        mobileNumber: formData.husbandMobile,
      };

      const partnerForm = {
        firstName: formData.wifeFirstName.trim(),
        lastName: (formData.wifeLastName || '').trim(),
        fatherName: formData.wifeFatherName.trim(),
        dateOfBirth: formData.wifeDob,
        aadhaarNumber: formData.wifeAadhaar.replace(/\s/g, ''),
        idNumber: formData.wifeAadhaar.replace(/\s/g, ''),
        mobileNumber: formData.wifeMobile || '',
      };

      const userAddress = {
        villageStreet: formData.husbandVillage.trim(),
        postOffice: formData.husbandPostOffice.trim(),
        policeStation: formData.husbandPoliceStation.trim(),
        district: formData.husbandDistrict.trim(),
        state: formData.husbandState.trim(),
        zipCode: formData.husbandPin.trim(),
        country: 'India',
      };

      const partnerAddress = {
        villageStreet: formData.wifeVillage.trim(),
        postOffice: formData.wifePostOffice.trim(),
        policeStation: formData.wifePoliceStation.trim(),
        district: formData.wifeDistrict.trim(),
        state: formData.wifeState.trim(),
        zipCode: formData.wifePin.trim(),
        country: 'India',
      };

      const application = await divorceApplicationService.createDivorceApplication({
        userId: targetUserId,
        adminId: user.id,
        marriageApplicationId: linkedMarriage?.id || undefined,
        marriageCertificateNumber: formData.marriageCertificateNumber || undefined,
        userDetails,
        partnerForm,
        userAddress,
        userCurrentAddress: userAddress,
        partnerAddress,
        partnerCurrentAddress: partnerAddress,
        divorceDate: formData.divorceDate,
        divorceReason: formData.divorceReason,
        divorceType: formData.divorceType,
        declarations: {
          accuracy: true,
          legal: true,
          divorceDate: formData.divorceDate,
        },
        proxyUserEmail: formData.husbandEmail || undefined,
      });

      showToast('Divorce application registered successfully!', 'success');
      navigate(`/admin/divorce/applications/${application.id}`);
    } catch (error: any) {
      console.error('Failed to create divorce application:', error);
      showToast(error.message || 'Failed to create divorce application', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      {!isEmbedded && (
        <div>
          <div className="flex items-center gap-2 text-sm text-gold-600 font-medium mb-1">
            <FileX size={16} />
            <span>Admin Portal / Divorce Section</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900">
            Apply For Divorce Registration
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Register a divorce under the Bengal Muhammadan Marriages and Divorces Registration Act, 1876.
          </p>
        </div>
      )}

      {/* Step 1: Search Existing Marriage (Optional but recommended) */}
      <Card className="p-4 sm:p-6 border-gold-200 bg-gold-50/30">
        <div className="flex items-center gap-2 mb-3">
          <Search size={18} className="text-gold-600" />
          <h2 className="text-base font-semibold text-gray-900">
            Quick Auto-Fill from Registered Marriage
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-gray-600 mb-4">
          Enter an existing Marriage Certificate Number to automatically fetch Husband, Wife, and Address details.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="e.g. WBMSDBRWI1C2024..."
              value={searchCertNumber}
              onChange={(e) => setSearchCertNumber(e.target.value)}
              disabled={isSearchingMarriage}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleSearchMarriage}
            isLoading={isSearchingMarriage}
            disabled={isSearchingMarriage}
          >
            Fetch Marriage Data
          </Button>
        </div>

        {linkedMarriage && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-800 text-xs sm:text-sm font-medium">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>
                Linked to Marriage Cert: <strong>{linkedMarriage.certificate_number}</strong>
                {linkedMarriage.user_details?.firstName && ` (${linkedMarriage.user_details.firstName} & ${linkedMarriage.partner_form?.firstName})`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLinkedMarriage(null)}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear Link
            </button>
          </div>
        )}
      </Card>

      {/* Main Application Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Husband Details */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-gray-100">
            <User size={18} className="text-gold-600" />
            <h2 className="text-base font-semibold text-gray-900">
              Husband Details (স্বামীর বিবরণ)
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="First Name"
              {...register('husbandFirstName')}
              error={errors.husbandFirstName?.message}
              required
            />
            <Input
              label="Last Name"
              {...register('husbandLastName')}
              error={errors.husbandLastName?.message}
            />
            <Input
              label="Father's Name (S/O)"
              {...register('husbandFatherName')}
              error={errors.husbandFatherName?.message}
              required
            />
            <Input
              label="Date of Birth"
              type="date"
              {...register('husbandDob')}
              error={errors.husbandDob?.message}
              required
            />
            <Input
              label="Aadhaar Number (12 digits)"
              {...register('husbandAadhaar')}
              error={errors.husbandAadhaar?.message}
              required
            />
            <Input
              label="Mobile Number"
              {...register('husbandMobile')}
              error={errors.husbandMobile?.message}
              required
            />
            <Input
              label="Email Address (Optional)"
              type="email"
              {...register('husbandEmail')}
              error={errors.husbandEmail?.message}
            />
          </div>

          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mt-6 mb-3">
            Husband's Address
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="Village / Street"
              {...register('husbandVillage')}
              error={errors.husbandVillage?.message}
              required
            />
            <Input
              label="Post Office (P.O)"
              {...register('husbandPostOffice')}
              error={errors.husbandPostOffice?.message}
              required
            />
            <Input
              label="Police Station (P.S)"
              {...register('husbandPoliceStation')}
              error={errors.husbandPoliceStation?.message}
              required
            />
            <Input
              label="District"
              {...register('husbandDistrict')}
              error={errors.husbandDistrict?.message}
              required
            />
            <Input
              label="State"
              {...register('husbandState')}
              error={errors.husbandState?.message}
              required
            />
            <Input
              label="PIN Code"
              {...register('husbandPin')}
              error={errors.husbandPin?.message}
              required
            />
          </div>
        </Card>

        {/* Wife Details */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-gray-100">
            <Users size={18} className="text-gold-600" />
            <h2 className="text-base font-semibold text-gray-900">
              Wife Details (স্ত্রীর বিবরণ)
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="First Name"
              {...register('wifeFirstName')}
              error={errors.wifeFirstName?.message}
              required
            />
            <Input
              label="Last Name"
              {...register('wifeLastName')}
              error={errors.wifeLastName?.message}
            />
            <Input
              label="Father's Name (D/O)"
              {...register('wifeFatherName')}
              error={errors.wifeFatherName?.message}
              required
            />
            <Input
              label="Date of Birth"
              type="date"
              {...register('wifeDob')}
              error={errors.wifeDob?.message}
              required
            />
            <Input
              label="Aadhaar / ID Number"
              {...register('wifeAadhaar')}
              error={errors.wifeAadhaar?.message}
              required
            />
            <Input
              label="Mobile Number (Optional)"
              {...register('wifeMobile')}
              error={errors.wifeMobile?.message}
            />
          </div>

          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mt-6 mb-3">
            Wife's Address
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="Village / Street"
              {...register('wifeVillage')}
              error={errors.wifeVillage?.message}
              required
            />
            <Input
              label="Post Office (P.O)"
              {...register('wifePostOffice')}
              error={errors.wifePostOffice?.message}
              required
            />
            <Input
              label="Police Station (P.S)"
              {...register('wifePoliceStation')}
              error={errors.wifePoliceStation?.message}
              required
            />
            <Input
              label="District"
              {...register('wifeDistrict')}
              error={errors.wifeDistrict?.message}
              required
            />
            <Input
              label="State"
              {...register('wifeState')}
              error={errors.wifeState?.message}
              required
            />
            <Input
              label="PIN Code"
              {...register('wifePin')}
              error={errors.wifePin?.message}
              required
            />
          </div>
        </Card>

        {/* Divorce Particulars */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-gray-100">
            <FileText size={18} className="text-gold-600" />
            <h2 className="text-base font-semibold text-gray-900">
              Divorce Particulars (তালাকের বিবরণ)
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="Date of Divorce"
              type="date"
              {...register('divorceDate')}
              error={errors.divorceDate?.message}
              required
            />

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Type of Divorce (তালাকের ধরন) *
              </label>
              <select
                {...register('divorceType')}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
              >
                <option value="talaq">Talaq (বাই-ইন / রাজঈ)</option>
                <option value="khula">Khula (খোলা)</option>
                <option value="mutual">Mutual Consent (আপোষে)</option>
                <option value="mubarat">Mubarat (মুবারাত)</option>
                <option value="other">Other Legal Dissolution</option>
              </select>
            </div>

            <Input
              label="Original Marriage Cert No (Optional)"
              {...register('marriageCertificateNumber')}
              error={errors.marriageCertificateNumber?.message}
              placeholder="e.g. WBMSDBRW..."
            />
          </div>

          <div className="mt-4">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Divorce Reason / Notes (Optional)
            </label>
            <textarea
              {...register('divorceReason')}
              rows={3}
              placeholder="Enter any additional notes, Talaqnama date, or particulars..."
              className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
            />
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/admin/divorce/applications')}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            className="px-6"
          >
            Create Divorce Application
            <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateDivorceApplicationPage;

