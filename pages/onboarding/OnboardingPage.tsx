import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../contexts/AuthContext';
import { profileService } from '../../services/profile';
import { useNotification } from '../../contexts/NotificationContext';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import Stepper from '../../components/ui/Stepper';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';

const steps = [
  { id: 'personal', label: 'Personal', description: 'Your details' },
  { id: 'partner', label: 'Partner', description: 'Partner information' },
  { id: 'address', label: 'Address', description: 'Residential address' },
  { id: 'checklist', label: 'Documents', description: 'Required documents' },
];

const personalSchema = z.object({
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  idNumber: z.string().min(5, 'ID number is required'),
});

const partnerSchema = z.object({
  partnerFirstName: z.string().min(2, 'First name is required'),
  partnerLastName: z.string().min(2, 'Last name is required'),
  partnerDateOfBirth: z.string().min(1, 'Date of birth is required'),
  partnerIdNumber: z.string().min(5, 'ID number is required'),
});

const addressSchema = z.object({
  street: z.string().min(5, 'Street address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  zipCode: z.string().min(5, 'ZIP code is required'),
  country: z.string().min(2, 'Country is required'),
});

type PersonalData = z.infer<typeof personalSchema>;
type PartnerData = z.infer<typeof partnerSchema>;
type AddressData = z.infer<typeof addressSchema>;

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useNotification();
  const [currentStep, setCurrentStep] = useState(0);
  const [onboardingData, setOnboardingData] = useLocalStorage('onboarding_data', {
    personal: {} as PersonalData,
    partner: {} as PartnerData,
    address: {} as AddressData,
  });
  const [isSaving, setIsSaving] = useState(false);

  const personalForm = useForm<PersonalData>({
    resolver: zodResolver(personalSchema),
    defaultValues: onboardingData.personal,
  });

  const partnerForm = useForm<PartnerData>({
    resolver: zodResolver(partnerSchema),
    defaultValues: onboardingData.partner,
  });

  const addressForm = useForm<AddressData>({
    resolver: zodResolver(addressSchema),
    defaultValues: onboardingData.address,
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth/login');
    }
  }, [user, navigate]);

  const saveStep = async (stepData: any, stepName: string) => {
    setIsSaving(true);
    try {
      const updated = { ...onboardingData, [stepName]: stepData };
      setOnboardingData(updated);
      
      if (user) {
        if (stepName === 'personal') {
          await profileService.updateProfile(user.id, {
            firstName: stepData.firstName,
            lastName: stepData.lastName,
            dateOfBirth: stepData.dateOfBirth,
            idNumber: stepData.idNumber,
          });
          // Recalculate completion after saving personal info
          await profileService.calculateCompletion(user.id);
        } else if (stepName === 'partner') {
          await profileService.updatePartnerDetails(user.id, {
            firstName: stepData.partnerFirstName,
            lastName: stepData.partnerLastName,
            dateOfBirth: stepData.partnerDateOfBirth,
            idNumber: stepData.partnerIdNumber,
            address: onboardingData.address,
          });
          // Recalculate completion after saving partner details
          await profileService.calculateCompletion(user.id);
        } else if (stepName === 'address') {
          await profileService.updateAddress(user.id, stepData);
          // Recalculate completion after saving address
          await profileService.calculateCompletion(user.id);
        }
      }
    } catch (error) {
      console.error('Failed to save:', error);
      throw error; // Re-throw to show error to user
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = async () => {
    let isValid = false;
    let stepData: any = {};

    if (currentStep === 0) {
      isValid = await personalForm.trigger();
      stepData = personalForm.getValues();
    } else if (currentStep === 1) {
      isValid = await partnerForm.trigger();
      stepData = partnerForm.getValues();
    } else if (currentStep === 2) {
      isValid = await addressForm.trigger();
      stepData = addressForm.getValues();
    }

    if (isValid) {
      const stepNames = ['personal', 'partner', 'address'];
      await saveStep(stepData, stepNames[currentStep]);
      
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        await handleComplete();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (user) {
      try {
        // Ensure all data is saved before calculating completion
        const profile = await profileService.getProfile(user.id);
        if (!profile) {
          showToast('Profile not found. Please try again.', 'error');
          return;
        }
        
        // Recalculate and save completion percentage
        const completion = await profileService.calculateCompletion(user.id);
        console.log('Profile completion calculated:', completion);
        
        showToast('Onboarding completed!', 'success');
        navigate('/dashboard');
      } catch (error: any) {
        console.error('Failed to complete onboarding:', error);
        showToast(error.message || 'Failed to complete onboarding. Please try again.', 'error');
      }
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-3 sm:space-y-4">
            <Input
              label="First Name"
              {...personalForm.register('firstName')}
              error={personalForm.formState.errors.firstName?.message}
              required
            />
            <Input
              label="Last Name"
              {...personalForm.register('lastName')}
              error={personalForm.formState.errors.lastName?.message}
              required
            />
            <Input
              label="Date of Birth"
              type="date"
              {...personalForm.register('dateOfBirth')}
              error={personalForm.formState.errors.dateOfBirth?.message}
              required
            />
            <Input
              label="ID Number"
              {...personalForm.register('idNumber')}
              error={personalForm.formState.errors.idNumber?.message}
              required
            />
          </div>
        );
      case 1:
        return (
          <div className="space-y-3 sm:space-y-4">
            <Input
              label="Partner First Name"
              {...partnerForm.register('partnerFirstName')}
              error={partnerForm.formState.errors.partnerFirstName?.message}
              required
            />
            <Input
              label="Partner Last Name"
              {...partnerForm.register('partnerLastName')}
              error={partnerForm.formState.errors.partnerLastName?.message}
              required
            />
            <Input
              label="Partner Date of Birth"
              type="date"
              {...partnerForm.register('partnerDateOfBirth')}
              error={partnerForm.formState.errors.partnerDateOfBirth?.message}
              required
            />
            <Input
              label="Partner ID Number"
              {...partnerForm.register('partnerIdNumber')}
              error={partnerForm.formState.errors.partnerIdNumber?.message}
              required
            />
          </div>
        );
      case 2:
        return (
          <div className="space-y-3 sm:space-y-4">
            <Input
              label="Street Address"
              {...addressForm.register('street')}
              error={addressForm.formState.errors.street?.message}
              required
            />
            <Input
              label="City"
              {...addressForm.register('city')}
              error={addressForm.formState.errors.city?.message}
              required
            />
            <Input
              label="State"
              {...addressForm.register('state')}
              error={addressForm.formState.errors.state?.message}
              required
            />
            <Input
              label="ZIP Code"
              {...addressForm.register('zipCode')}
              error={addressForm.formState.errors.zipCode?.message}
              required
            />
            <Input
              label="Country"
              {...addressForm.register('country')}
              error={addressForm.formState.errors.country?.message}
              defaultValue="India"
              required
            />
          </div>
        );
      case 3:
        return (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-2 sm:mb-3">Required Documents</h3>
            <div className="space-y-2">
              {[
                'National ID (Front & Back)',
                'Passport-sized photos (2 copies)',
                'Birth certificate',
                'Previous marriage certificate (if applicable)',
              ].map((doc, index) => (
                <div key={index} className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-gray-50 rounded-lg sm:rounded-xl">
                  <Check size={16} className="sm:w-5 sm:h-5 text-gold-600 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-700">{doc}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] sm:text-xs text-gray-500 mt-3 sm:mt-4">
              You can upload these documents after completing your application.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-gold-50 py-6 sm:py-10 px-3 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4 sm:mb-6 text-center">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Complete Your Profile</h1>
          <p className="text-xs sm:text-sm text-gray-600">Let's get you started with a few details</p>
        </div>

        <Stepper
          steps={steps}
          currentStep={currentStep}
          completedSteps={Array.from({ length: currentStep }, (_, i) => i)}
          className="mb-6 sm:mb-10"
        />

        <Card className="p-4 sm:p-6">
          <div className="mb-4 sm:mb-5">
            <h2 className="font-serif text-lg sm:text-xl font-semibold text-gray-900">
              {steps[currentStep].label}
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5">{steps[currentStep].description}</p>
          </div>

          {renderStep()}

          <div className="flex items-center justify-between mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-gray-200">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              disabled={currentStep === 0}
            >
              <ArrowLeft size={14} className="mr-1 sm:w-4 sm:h-4" />
              Back
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleNext}
              isLoading={isSaving}
            >
              {currentStep === steps.length - 1 ? 'Complete' : 'Next'}
              {currentStep < steps.length - 1 && <ArrowRight size={14} className="ml-1 sm:w-4 sm:h-4" />}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default OnboardingPage;

