import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../contexts/AuthContext';
import { ApplicationProvider, useApplication } from '../../contexts/ApplicationContext';
import { useNotification } from '../../contexts/NotificationContext';
import { documentService } from '../../services/documents';
import { safeFormatDate } from '../../utils/dateUtils';
import Stepper from '../../components/ui/Stepper';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import PhoneInput from '../../components/ui/PhoneInput';
import Checkbox from '../../components/ui/Checkbox';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { ArrowRight, ArrowLeft, Save, Upload, X, FileText, Edit, CheckCircle } from 'lucide-react';

const applicationSteps = [
  { id: 'details', label: 'Partner & User Details', description: 'Personal information' },
  { id: 'address', label: 'Address', description: 'Permanent & Current Address' },
  { id: 'documents', label: 'Documents', description: 'Upload required documents' },
  { id: 'declarations', label: 'Confirmation', description: 'Legal declarations' },
  { id: 'review', label: 'Review', description: 'Review & submit' },
];

// User Details Schema
const userDetailsSchema = z.object({
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  fatherName: z.string().min(2, 'Father name is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  aadhaarNumber: z.string().regex(/^\d{12}$/, 'Aadhaar number must be exactly 12 digits'),
  mobileNumber: z.string().regex(/^\d{10}$/, 'Mobile number must be exactly 10 digits'),
});

// Partner Details Schema
const partnerDetailsSchema = z.object({
  partnerFirstName: z.string().min(2, 'First name is required'),
  partnerLastName: z.string().min(2, 'Last name is required'),
  partnerFatherName: z.string().min(2, 'Father name is required'),
  partnerDateOfBirth: z.string().min(1, 'Date of birth is required'),
  partnerAadhaarNumber: z.string().regex(/^\d{12}$/, 'Aadhaar number must be exactly 12 digits'),
  partnerMobileNumber: z.string().regex(/^\d{10}$/, 'Mobile number must be exactly 10 digits'),
});

// Combined Details Schema
const detailsSchema = userDetailsSchema.merge(partnerDetailsSchema);

// Address Schema
const addressSchema = z.object({
  // User addresses
  userPermanentStreet: z.string().min(5, 'Street address is required'),
  userPermanentCity: z.string().min(2, 'City is required'),
  userPermanentState: z.string().min(2, 'State is required'),
  userPermanentZipCode: z.string().min(5, 'ZIP code is required'),
  userPermanentCountry: z.string().min(2, 'Country is required'),
  userCurrentStreet: z.string().min(5, 'Street address is required'),
  userCurrentCity: z.string().min(2, 'City is required'),
  userCurrentState: z.string().min(2, 'State is required'),
  userCurrentZipCode: z.string().min(5, 'ZIP code is required'),
  userCurrentCountry: z.string().min(2, 'Country is required'),
  userSameAsPermanent: z.boolean().optional(),
  // Partner addresses
  partnerPermanentStreet: z.string().min(5, 'Street address is required'),
  partnerPermanentCity: z.string().min(2, 'City is required'),
  partnerPermanentState: z.string().min(2, 'State is required'),
  partnerPermanentZipCode: z.string().min(5, 'ZIP code is required'),
  partnerPermanentCountry: z.string().min(2, 'Country is required'),
  partnerCurrentStreet: z.string().min(5, 'Street address is required'),
  partnerCurrentCity: z.string().min(2, 'City is required'),
  partnerCurrentState: z.string().min(2, 'State is required'),
  partnerCurrentZipCode: z.string().min(5, 'ZIP code is required'),
  partnerCurrentCountry: z.string().min(2, 'Country is required'),
  partnerSameAsPermanent: z.boolean().optional(),
});

const declarationsSchema = z.object({
  consent: z.boolean().refine((val) => val === true, 'You must provide consent'),
  accuracy: z.boolean().refine((val) => val === true, 'You must confirm accuracy'),
  legal: z.boolean().refine((val) => val === true, 'You must confirm legal status'),
});

interface DocumentFile {
  file: File;
  type: 'aadhaar' | 'tenth_certificate' | 'voter_id';
  belongsTo: 'user' | 'partner';
  id: string;
}

const ApplicationFormContent: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { application, updateDraft, submitApplication, isLoading } = useApplication();
  const { showToast } = useNotification();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [applicationDocuments, setApplicationDocuments] = useState<any[]>([]);
  
  // Redirect to dashboard if application is submitted and user tries to edit
  useEffect(() => {
    if (application?.status === 'submitted' || application?.status === 'approved' || application?.status === 'under_review') {
      // Only allow viewing review step, redirect if trying to edit
      if (currentStep !== 4) {
        setCurrentStep(4);
        showToast('Application has been submitted and cannot be edited', 'info');
      }
    }
  }, [application?.status, currentStep, showToast]);

  const detailsForm = useForm({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      firstName: (application?.userDetails as any)?.firstName || user?.name?.split(' ')[0] || '',
      lastName: (application?.userDetails as any)?.lastName || user?.name?.split(' ').slice(1).join(' ') || '',
      fatherName: (application?.userDetails as any)?.fatherName || '',
      dateOfBirth: (application?.userDetails as any)?.dateOfBirth || '',
      aadhaarNumber: (application?.userDetails as any)?.aadhaarNumber || '',
      mobileNumber: (application?.userDetails as any)?.mobileNumber || '',
      partnerFirstName: application?.partnerForm?.firstName || '',
      partnerLastName: application?.partnerForm?.lastName || '',
      partnerFatherName: (application?.partnerForm as any)?.fatherName || '',
      partnerDateOfBirth: application?.partnerForm?.dateOfBirth || '',
      partnerAadhaarNumber: (application?.partnerForm as any)?.aadhaarNumber || '',
      partnerMobileNumber: (application?.partnerForm as any)?.mobileNumber || '',
    },
  });

  const addressForm = useForm({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      userPermanentStreet: application?.userAddress?.street || application?.address?.street || '',
      userPermanentCity: application?.userAddress?.city || application?.address?.city || '',
      userPermanentState: application?.userAddress?.state || application?.address?.state || '',
      userPermanentZipCode: application?.userAddress?.zipCode || application?.address?.zipCode || '',
      userPermanentCountry: application?.userAddress?.country || application?.address?.country || 'India',
      userCurrentStreet: application?.userCurrentAddress?.street || (application as any)?.currentAddress?.street || '',
      userCurrentCity: application?.userCurrentAddress?.city || (application as any)?.currentAddress?.city || '',
      userCurrentState: application?.userCurrentAddress?.state || (application as any)?.currentAddress?.state || '',
      userCurrentZipCode: application?.userCurrentAddress?.zipCode || (application as any)?.currentAddress?.zipCode || '',
      userCurrentCountry: application?.userCurrentAddress?.country || (application as any)?.currentAddress?.country || 'India',
      userSameAsPermanent: false,
      partnerPermanentStreet: application?.partnerAddress?.street || application?.partnerForm?.address?.street || '',
      partnerPermanentCity: application?.partnerAddress?.city || application?.partnerForm?.address?.city || '',
      partnerPermanentState: application?.partnerAddress?.state || application?.partnerForm?.address?.state || '',
      partnerPermanentZipCode: application?.partnerAddress?.zipCode || application?.partnerForm?.address?.zipCode || '',
      partnerPermanentCountry: application?.partnerAddress?.country || application?.partnerForm?.address?.country || 'India',
      partnerCurrentStreet: application?.partnerCurrentAddress?.street || '',
      partnerCurrentCity: application?.partnerCurrentAddress?.city || '',
      partnerCurrentState: application?.partnerCurrentAddress?.state || '',
      partnerCurrentZipCode: application?.partnerCurrentAddress?.zipCode || '',
      partnerCurrentCountry: application?.partnerCurrentAddress?.country || 'India',
      partnerSameAsPermanent: false,
    },
  });

  const declarationsForm = useForm({
    resolver: zodResolver(declarationsSchema),
    defaultValues: application?.declarations || { consent: false, accuracy: false, legal: false },
  });

  // Watch for address changes
  const userSameAsPermanent = addressForm.watch('userSameAsPermanent');
  const partnerSameAsPermanent = addressForm.watch('partnerSameAsPermanent');

  useEffect(() => {
    if (userSameAsPermanent) {
      const permanent = addressForm.getValues();
      addressForm.setValue('userCurrentStreet', permanent.userPermanentStreet);
      addressForm.setValue('userCurrentCity', permanent.userPermanentCity);
      addressForm.setValue('userCurrentState', permanent.userPermanentState);
      addressForm.setValue('userCurrentZipCode', permanent.userPermanentZipCode);
      addressForm.setValue('userCurrentCountry', permanent.userPermanentCountry);
    }
  }, [userSameAsPermanent, addressForm]);

  useEffect(() => {
    if (partnerSameAsPermanent) {
      const permanent = addressForm.getValues();
      addressForm.setValue('partnerCurrentStreet', permanent.partnerPermanentStreet);
      addressForm.setValue('partnerCurrentCity', permanent.partnerPermanentCity);
      addressForm.setValue('partnerCurrentState', permanent.partnerPermanentState);
      addressForm.setValue('partnerCurrentZipCode', permanent.partnerPermanentZipCode);
      addressForm.setValue('partnerCurrentCountry', permanent.partnerPermanentCountry);
    }
  }, [partnerSameAsPermanent, addressForm]);

  // Load documents when on review step
  useEffect(() => {
    if (currentStep === 4 && application) {
      const loadDocuments = async () => {
        try {
          const docs = await documentService.getDocuments(application.id);
          setApplicationDocuments(docs);
        } catch (error) {
          console.error('Failed to load documents:', error);
        }
      };
      loadDocuments();
    }
  }, [currentStep, application]);

  const isSubmitted = application?.status === 'submitted' || application?.status === 'approved' || application?.status === 'under_review';

  const handleNext = async () => {
    if (isSubmitted && currentStep < 4) {
      // If submitted, only allow going to review step
      setCurrentStep(4);
      return;
    }
    if (currentStep === 0) {
      const isValid = await detailsForm.trigger();
      if (isValid) {
        const data = detailsForm.getValues();
        setIsSaving(true);
        try {
          await updateDraft({
            userDetails: {
              firstName: data.firstName,
              lastName: data.lastName,
              fatherName: data.fatherName,
              dateOfBirth: data.dateOfBirth,
              aadhaarNumber: data.aadhaarNumber,
              mobileNumber: data.mobileNumber,
            },
            partnerForm: {
              firstName: data.partnerFirstName,
              lastName: data.partnerLastName,
              fatherName: data.partnerFatherName,
              dateOfBirth: data.partnerDateOfBirth,
              idNumber: data.partnerAadhaarNumber,
              aadhaarNumber: data.partnerAadhaarNumber,
              mobileNumber: data.partnerMobileNumber,
              address: application?.partnerForm?.address || {
                street: '',
                city: '',
                state: '',
                zipCode: '',
                country: 'India',
              },
            },
          });
          setCurrentStep(currentStep + 1);
        } catch (error: any) {
          console.error('Failed to save application:', error);
          const errorMessage = error.message || 'Failed to save. Please try again.';
          showToast(errorMessage, 'error');
        } finally {
          setIsSaving(false);
        }
      }
    } else if (currentStep === 1) {
      const isValid = await addressForm.trigger();
      if (isValid) {
        const data = addressForm.getValues();
        setIsSaving(true);
        try {
          await updateDraft({
            userAddress: {
              street: data.userPermanentStreet,
              city: data.userPermanentCity,
              state: data.userPermanentState,
              zipCode: data.userPermanentZipCode,
              country: data.userPermanentCountry,
            },
            userCurrentAddress: {
              street: data.userCurrentStreet,
              city: data.userCurrentCity,
              state: data.userCurrentState,
              zipCode: data.userCurrentZipCode,
              country: data.userCurrentCountry,
            },
            partnerAddress: {
              street: data.partnerPermanentStreet,
              city: data.partnerPermanentCity,
              state: data.partnerPermanentState,
              zipCode: data.partnerPermanentZipCode,
              country: data.partnerPermanentCountry,
            },
            partnerCurrentAddress: {
              street: data.partnerCurrentStreet,
              city: data.partnerCurrentCity,
              state: data.partnerCurrentState,
              zipCode: data.partnerCurrentZipCode,
              country: data.partnerCurrentCountry,
            },
          });
          setCurrentStep(currentStep + 1);
        } catch (error) {
          showToast('Failed to save. Please try again.', 'error');
        } finally {
          setIsSaving(false);
        }
      }
    } else if (currentStep === 2) {
      // Validate documents
      const userAadhaar = documents.find(d => d.belongsTo === 'user' && d.type === 'aadhaar');
      const userSecondDoc = documents.find(d => d.belongsTo === 'user' && (d.type === 'tenth_certificate' || d.type === 'voter_id'));
      const partnerAadhaar = documents.find(d => d.belongsTo === 'partner' && d.type === 'aadhaar');
      const partnerSecondDoc = documents.find(d => d.belongsTo === 'partner' && (d.type === 'tenth_certificate' || d.type === 'voter_id'));

      if (!userAadhaar || !userSecondDoc || !partnerAadhaar || !partnerSecondDoc) {
        showToast('Please upload all required documents', 'error');
        return;
      }

      // Upload documents
      setIsSaving(true);
      try {
        if (application) {
          for (const doc of documents) {
            await documentService.uploadDocument(application.id, doc.file, doc.type, doc.belongsTo);
          }
        }
        setCurrentStep(currentStep + 1);
      } catch (error) {
        showToast('Failed to upload documents. Please try again.', 'error');
      } finally {
        setIsSaving(false);
      }
    } else if (currentStep === 3) {
      const isValid = await declarationsForm.trigger();
      if (isValid) {
        const data = declarationsForm.getValues();
        setIsSaving(true);
        try {
          await updateDraft({ declarations: data });
          setCurrentStep(currentStep + 1);
        } catch (error) {
          showToast('Failed to save. Please try again.', 'error');
        } finally {
          setIsSaving(false);
        }
      }
    } else if (currentStep === 4) {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0 && !isSubmitted) {
      setCurrentStep(currentStep - 1);
    } else if (isSubmitted && currentStep === 4) {
      // If submitted, don't allow going back from review
      return;
    }
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await submitApplication();
      showToast('Application submitted successfully!', 'success');
      navigate('/dashboard');
    } catch (error) {
      showToast('Failed to submit application. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = (file: File, type: 'aadhaar' | 'tenth_certificate' | 'voter_id', belongsTo: 'user' | 'partner') => {
    const newDoc: DocumentFile = {
      id: `doc-${Date.now()}-${Math.random()}`,
      file,
      type,
      belongsTo,
    };
    setDocuments([...documents.filter(d => !(d.belongsTo === belongsTo && d.type === type)), newDoc]);
  };

  const handleRemoveDocument = (id: string) => {
    setDocuments(documents.filter(d => d.id !== id));
  };

  const getDocumentName = (type: string, belongsTo: string) => {
    const person = belongsTo === 'user' ? 'Your' : "Partner's";
    if (type === 'aadhaar') return `${person} Aadhaar Card`;
    if (type === 'tenth_certificate') return `${person} 10th Class Certificate`;
    if (type === 'voter_id') return `${person} Voter ID`;
    return '';
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-8">
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Your Details</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    {...detailsForm.register('firstName')}
                    error={detailsForm.formState.errors.firstName?.message}
                    required
                    disabled={isSubmitted}
                  />
                  <Input
                    label="Last Name"
                    {...detailsForm.register('lastName')}
                    error={detailsForm.formState.errors.lastName?.message}
                    required
                    disabled={isSubmitted}
                  />
                </div>
                <Input
                  label="Father's Name"
                  {...detailsForm.register('fatherName')}
                  error={detailsForm.formState.errors.fatherName?.message}
                  required
                  disabled={isSubmitted}
                />
                <Input
                  label="Date of Birth"
                  type="date"
                  {...detailsForm.register('dateOfBirth')}
                  error={detailsForm.formState.errors.dateOfBirth?.message}
                  required
                  disabled={isSubmitted}
                />
                <Input
                  label="Aadhaar Number"
                  type="text"
                  maxLength={12}
                  {...detailsForm.register('aadhaarNumber', {
                    onChange: (e) => {
                      e.target.value = e.target.value.replace(/\D/g, '');
                    },
                  })}
                  error={detailsForm.formState.errors.aadhaarNumber?.message}
                  placeholder="Enter 12-digit Aadhaar number"
                  required
                  disabled={isSubmitted}
                />
                <PhoneInput
                  label="Mobile Number"
                  value={detailsForm.watch('mobileNumber') || ''}
                  onChange={(value) => {
                    if (!isSubmitted) {
                      detailsForm.setValue('mobileNumber', value, { shouldValidate: true });
                    }
                  }}
                  error={detailsForm.formState.errors.mobileNumber?.message}
                  required
                  disabled={isSubmitted}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Partner's Details</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    {...detailsForm.register('partnerFirstName')}
                    error={detailsForm.formState.errors.partnerFirstName?.message}
                    required
                    disabled={isSubmitted}
                  />
                  <Input
                    label="Last Name"
                    {...detailsForm.register('partnerLastName')}
                    error={detailsForm.formState.errors.partnerLastName?.message}
                    required
                    disabled={isSubmitted}
                  />
                </div>
                <Input
                  label="Father's Name"
                  {...detailsForm.register('partnerFatherName')}
                  error={detailsForm.formState.errors.partnerFatherName?.message}
                  required
                  disabled={isSubmitted}
                />
                <Input
                  label="Date of Birth"
                  type="date"
                  {...detailsForm.register('partnerDateOfBirth')}
                  error={detailsForm.formState.errors.partnerDateOfBirth?.message}
                  required
                  disabled={isSubmitted}
                />
                <Input
                  label="Aadhaar Number"
                  type="text"
                  maxLength={12}
                  {...detailsForm.register('partnerAadhaarNumber', {
                    onChange: (e) => {
                      e.target.value = e.target.value.replace(/\D/g, '');
                    },
                  })}
                  error={detailsForm.formState.errors.partnerAadhaarNumber?.message}
                  placeholder="Enter 12-digit Aadhaar number"
                  required
                  disabled={isSubmitted}
                />
                <PhoneInput
                  label="Mobile Number"
                  value={detailsForm.watch('partnerMobileNumber') || ''}
                  onChange={(value) => {
                    if (!isSubmitted) {
                      detailsForm.setValue('partnerMobileNumber', value, { shouldValidate: true });
                    }
                  }}
                  error={detailsForm.formState.errors.partnerMobileNumber?.message}
                  required
                  disabled={isSubmitted}
                />
              </div>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-8">
            {/* User Addresses */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Your Permanent Address</h3>
              <div className="space-y-4">
                <Input
                  label="Street Address"
                  {...addressForm.register('userPermanentStreet')}
                  disabled={isSubmitted}
                  error={addressForm.formState.errors.userPermanentStreet?.message}
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="City"
                    {...addressForm.register('userPermanentCity')}
                  disabled={isSubmitted}
                    error={addressForm.formState.errors.userPermanentCity?.message}
                    required
                  />
                  <Input
                    label="State"
                    {...addressForm.register('userPermanentState')}
                  disabled={isSubmitted}
                    error={addressForm.formState.errors.userPermanentState?.message}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="ZIP Code"
                    {...addressForm.register('userPermanentZipCode')}
                  disabled={isSubmitted}
                    error={addressForm.formState.errors.userPermanentZipCode?.message}
                    required
                  />
                  <Input
                    label="Country"
                    {...addressForm.register('userPermanentCountry')}
                  disabled={isSubmitted}
                    error={addressForm.formState.errors.userPermanentCountry?.message}
                    defaultValue="India"
                    required
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200 mt-6">
                <h3 className="font-semibold text-gray-900 mb-4">Your Current Address</h3>
                <div className="mb-4">
                  <Checkbox
                    label="Same as permanent address"
                    checked={userSameAsPermanent || false}
                    onChange={(e) => addressForm.setValue('userSameAsPermanent', e.target.checked)}
                  />
                </div>
                <div className="space-y-4">
                  <Input
                    label="Street Address"
                    {...addressForm.register('userCurrentStreet')}
                  disabled={isSubmitted}
                    error={addressForm.formState.errors.userCurrentStreet?.message}
                    required
                    disabled={userSameAsPermanent}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="City"
                      {...addressForm.register('userCurrentCity')}
                  disabled={isSubmitted}
                      error={addressForm.formState.errors.userCurrentCity?.message}
                      required
                      disabled={userSameAsPermanent}
                    />
                    <Input
                      label="State"
                      {...addressForm.register('userCurrentState')}
                  disabled={isSubmitted}
                      error={addressForm.formState.errors.userCurrentState?.message}
                      required
                      disabled={userSameAsPermanent}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="ZIP Code"
                      {...addressForm.register('userCurrentZipCode')}
                  disabled={isSubmitted}
                      error={addressForm.formState.errors.userCurrentZipCode?.message}
                      required
                      disabled={userSameAsPermanent}
                    />
                    <Input
                      label="Country"
                      {...addressForm.register('userCurrentCountry')}
                  disabled={isSubmitted}
                      error={addressForm.formState.errors.userCurrentCountry?.message}
                      defaultValue="India"
                      required
                      disabled={userSameAsPermanent}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Partner Addresses */}
            <div className="pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Partner's Permanent Address</h3>
              <div className="space-y-4">
                <Input
                  label="Street Address"
                  {...addressForm.register('partnerPermanentStreet')}
                  disabled={isSubmitted}
                  error={addressForm.formState.errors.partnerPermanentStreet?.message}
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="City"
                    {...addressForm.register('partnerPermanentCity')}
                  disabled={isSubmitted}
                    error={addressForm.formState.errors.partnerPermanentCity?.message}
                    required
                  />
                  <Input
                    label="State"
                    {...addressForm.register('partnerPermanentState')}
                  disabled={isSubmitted}
                    error={addressForm.formState.errors.partnerPermanentState?.message}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="ZIP Code"
                    {...addressForm.register('partnerPermanentZipCode')}
                  disabled={isSubmitted}
                    error={addressForm.formState.errors.partnerPermanentZipCode?.message}
                    required
                  />
                  <Input
                    label="Country"
                    {...addressForm.register('partnerPermanentCountry')}
                  disabled={isSubmitted}
                    error={addressForm.formState.errors.partnerPermanentCountry?.message}
                    defaultValue="India"
                    required
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200 mt-6">
                <h3 className="font-semibold text-gray-900 mb-4">Partner's Current Address</h3>
                <div className="mb-4">
                  <Checkbox
                    label="Same as permanent address"
                    checked={partnerSameAsPermanent || false}
                    onChange={(e) => addressForm.setValue('partnerSameAsPermanent', e.target.checked)}
                  />
                </div>
                <div className="space-y-4">
                  <Input
                    label="Street Address"
                    {...addressForm.register('partnerCurrentStreet')}
                  disabled={isSubmitted}
                    error={addressForm.formState.errors.partnerCurrentStreet?.message}
                    required
                    disabled={partnerSameAsPermanent}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="City"
                      {...addressForm.register('partnerCurrentCity')}
                  disabled={isSubmitted}
                      error={addressForm.formState.errors.partnerCurrentCity?.message}
                      required
                      disabled={partnerSameAsPermanent}
                    />
                    <Input
                      label="State"
                      {...addressForm.register('partnerCurrentState')}
                  disabled={isSubmitted}
                      error={addressForm.formState.errors.partnerCurrentState?.message}
                      required
                      disabled={partnerSameAsPermanent}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="ZIP Code"
                      {...addressForm.register('partnerCurrentZipCode')}
                  disabled={isSubmitted}
                      error={addressForm.formState.errors.partnerCurrentZipCode?.message}
                      required
                      disabled={partnerSameAsPermanent}
                    />
                    <Input
                      label="Country"
                      {...addressForm.register('partnerCurrentCountry')}
                  disabled={isSubmitted}
                      error={addressForm.formState.errors.partnerCurrentCountry?.message}
                      defaultValue="India"
                      required
                      disabled={partnerSameAsPermanent}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-8">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Your Documents</h3>
              <p className="text-sm text-gray-600 mb-6">Upload your Aadhaar card and either 10th class certificate or Voter ID</p>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Aadhaar Card <span className="text-rose-600">*</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, 'aadhaar', 'user');
                      }}
                      className="hidden"
                      id="user-aadhaar"
                    />
                    <label
                      htmlFor="user-aadhaar"
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      <Upload size={18} />
                      <span>Choose File</span>
                    </label>
                    {documents.find(d => d.belongsTo === 'user' && d.type === 'aadhaar') && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <FileText size={16} />
                        <span>{documents.find(d => d.belongsTo === 'user' && d.type === 'aadhaar')?.file.name}</span>
                        <button
                          onClick={() => handleRemoveDocument(documents.find(d => d.belongsTo === 'user' && d.type === 'aadhaar')!.id)}
                          className="text-rose-600 hover:text-rose-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    10th Class Certificate or Voter ID <span className="text-rose-600">*</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const fileName = file.name.toLowerCase();
                          const type = fileName.includes('voter') || fileName.includes('voterid') ? 'voter_id' : 'tenth_certificate';
                          handleFileUpload(file, type, 'user');
                        }
                      }}
                      className="hidden"
                      id="user-second-doc"
                    />
                    <label
                      htmlFor="user-second-doc"
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      <Upload size={18} />
                      <span>Choose File</span>
                    </label>
                    {documents.find(d => d.belongsTo === 'user' && (d.type === 'tenth_certificate' || d.type === 'voter_id')) && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <FileText size={16} />
                        <span>{documents.find(d => d.belongsTo === 'user' && (d.type === 'tenth_certificate' || d.type === 'voter_id'))?.file.name}</span>
                        <button
                          onClick={() => handleRemoveDocument(documents.find(d => d.belongsTo === 'user' && (d.type === 'tenth_certificate' || d.type === 'voter_id'))!.id)}
                          className="text-rose-600 hover:text-rose-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">Partner's Documents</h3>
              <p className="text-sm text-gray-600 mb-6">Upload partner's Aadhaar card and either 10th class certificate or Voter ID</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Aadhaar Card <span className="text-rose-600">*</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, 'aadhaar', 'partner');
                      }}
                      className="hidden"
                      id="partner-aadhaar"
                    />
                    <label
                      htmlFor="partner-aadhaar"
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      <Upload size={18} />
                      <span>Choose File</span>
                    </label>
                    {documents.find(d => d.belongsTo === 'partner' && d.type === 'aadhaar') && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <FileText size={16} />
                        <span>{documents.find(d => d.belongsTo === 'partner' && d.type === 'aadhaar')?.file.name}</span>
                        <button
                          onClick={() => handleRemoveDocument(documents.find(d => d.belongsTo === 'partner' && d.type === 'aadhaar')!.id)}
                          className="text-rose-600 hover:text-rose-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    10th Class Certificate or Voter ID <span className="text-rose-600">*</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const fileName = file.name.toLowerCase();
                          const type = fileName.includes('voter') || fileName.includes('voterid') ? 'voter_id' : 'tenth_certificate';
                          handleFileUpload(file, type, 'partner');
                        }
                      }}
                      className="hidden"
                      id="partner-second-doc"
                    />
                    <label
                      htmlFor="partner-second-doc"
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      <Upload size={18} />
                      <span>Choose File</span>
                    </label>
                    {documents.find(d => d.belongsTo === 'partner' && (d.type === 'tenth_certificate' || d.type === 'voter_id')) && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <FileText size={16} />
                        <span>{documents.find(d => d.belongsTo === 'partner' && (d.type === 'tenth_certificate' || d.type === 'voter_id'))?.file.name}</span>
                        <button
                          onClick={() => handleRemoveDocument(documents.find(d => d.belongsTo === 'partner' && (d.type === 'tenth_certificate' || d.type === 'voter_id'))!.id)}
                          className="text-rose-600 hover:text-rose-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <h3 className="font-semibold text-gray-900 mb-4">Legal Declarations</h3>
            <p className="text-sm text-gray-600 mb-6">
              Please read and confirm the following declarations:
            </p>
            <Checkbox
              label="I consent to the processing of my personal data for marriage registration purposes."
              {...declarationsForm.register('consent')}
              error={declarationsForm.formState.errors.consent?.message}
            />
            <Checkbox
              label="I confirm that all information provided is accurate and truthful."
              {...declarationsForm.register('accuracy')}
              error={declarationsForm.formState.errors.accuracy?.message}
            />
            <Checkbox
              label="I confirm that I am legally eligible to enter into marriage."
              {...declarationsForm.register('legal')}
              error={declarationsForm.formState.errors.legal?.message}
            />
          </div>
        );
      case 4:
        const userData = detailsForm.getValues();
        const addressData = addressForm.getValues();
        const isSubmitted = application?.status === 'submitted' || application?.status === 'approved' || application?.status === 'under_review';
        
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-gray-900">Review Your Application</h3>
              {!isSubmitted && (
                <Badge variant="info">Draft - You can still edit</Badge>
              )}
            </div>

            {/* User Details */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">Your Details</h4>
                {!isSubmitted && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentStep(0)}
                  >
                    <Edit size={16} className="mr-1" />
                    Edit
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">Full Name</p>
                  <p className="font-medium text-gray-900">{userData.firstName} {userData.lastName}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Father's Name</p>
                  <p className="font-medium text-gray-900">{userData.fatherName}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Date of Birth</p>
                  <p className="font-medium text-gray-900">{safeFormatDate(userData.dateOfBirth, 'MMMM d, yyyy')}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Aadhaar Number</p>
                  <p className="font-medium text-gray-900">{userData.aadhaarNumber}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Mobile Number</p>
                  <p className="font-medium text-gray-900">{userData.mobileNumber}</p>
                </div>
              </div>
            </Card>

            {/* Partner Details */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">Partner's Details</h4>
                {!isSubmitted && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCurrentStep(0);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <Edit size={16} className="mr-1" />
                    Edit
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">Full Name</p>
                  <p className="font-medium text-gray-900">{userData.partnerFirstName} {userData.partnerLastName}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Father's Name</p>
                  <p className="font-medium text-gray-900">{userData.partnerFatherName}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Date of Birth</p>
                  <p className="font-medium text-gray-900">{safeFormatDate(userData.partnerDateOfBirth, 'MMMM d, yyyy')}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Aadhaar Number</p>
                  <p className="font-medium text-gray-900">{userData.partnerAadhaarNumber}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Mobile Number</p>
                  <p className="font-medium text-gray-900">{userData.partnerMobileNumber}</p>
                </div>
              </div>
            </Card>

            {/* User Addresses */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">Your Addresses</h4>
                {!isSubmitted && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCurrentStep(1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <Edit size={16} className="mr-1" />
                    Edit
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Permanent Address</p>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>{addressData.userPermanentStreet}</p>
                    <p>{addressData.userPermanentCity}, {addressData.userPermanentState}</p>
                    <p>{addressData.userPermanentZipCode}, {addressData.userPermanentCountry}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Current Address</p>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>{addressData.userCurrentStreet}</p>
                    <p>{addressData.userCurrentCity}, {addressData.userCurrentState}</p>
                    <p>{addressData.userCurrentZipCode}, {addressData.userCurrentCountry}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Partner Addresses */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">Partner's Addresses</h4>
                {!isSubmitted && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCurrentStep(1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <Edit size={16} className="mr-1" />
                    Edit
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Permanent Address</p>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>{addressData.partnerPermanentStreet}</p>
                    <p>{addressData.partnerPermanentCity}, {addressData.partnerPermanentState}</p>
                    <p>{addressData.partnerPermanentZipCode}, {addressData.partnerPermanentCountry}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Current Address</p>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>{addressData.partnerCurrentStreet}</p>
                    <p>{addressData.partnerCurrentCity}, {addressData.partnerCurrentState}</p>
                    <p>{addressData.partnerCurrentZipCode}, {addressData.partnerCurrentCountry}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Documents */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">Uploaded Documents</h4>
                {!isSubmitted && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCurrentStep(2);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <Edit size={16} className="mr-1" />
                    Edit
                  </Button>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Your Documents</p>
                  <div className="space-y-2">
                    {/* Show saved documents from applicationDocuments */}
                    {applicationDocuments
                      .filter(d => d.belongsTo === 'user')
                      .map(doc => (
                        <div key={doc.id} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                          <FileText size={16} />
                          <span>
                            {doc.type === 'aadhaar' && 'Aadhaar Card'}
                            {doc.type === 'tenth_certificate' && '10th Certificate'}
                            {doc.type === 'voter_id' && 'Voter ID'}
                            : {doc.name}
                          </span>
                          <CheckCircle size={16} className="text-green-600 ml-auto" />
                        </div>
                      ))}
                    {/* Show unsaved documents from current session (only if not already in applicationDocuments) */}
                    {documents
                      .filter(d => {
                        if (d.belongsTo !== 'user') return false;
                        // Only show if not already saved
                        const isAlreadySaved = applicationDocuments.some(
                          ad => ad.belongsTo === d.belongsTo && ad.type === d.type
                        );
                        return !isAlreadySaved;
                      })
                      .map(doc => (
                        <div key={doc.id} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                          <FileText size={16} />
                          <span>
                            {doc.type === 'aadhaar' && 'Aadhaar Card'}
                            {doc.type === 'tenth_certificate' && '10th Certificate'}
                            {doc.type === 'voter_id' && 'Voter ID'}
                            : {doc.file.name}
                          </span>
                          <CheckCircle size={16} className="text-green-600 ml-auto" />
                        </div>
                      ))}
                    {applicationDocuments.filter(d => d.belongsTo === 'user').length === 0 && 
                     documents.filter(d => d.belongsTo === 'user').length === 0 && (
                      <p className="text-sm text-gray-400 italic">No documents uploaded yet</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Partner's Documents</p>
                  <div className="space-y-2">
                    {/* Show saved documents from applicationDocuments */}
                    {applicationDocuments
                      .filter(d => d.belongsTo === 'partner')
                      .map(doc => (
                        <div key={doc.id} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                          <FileText size={16} />
                          <span>
                            {doc.type === 'aadhaar' && 'Aadhaar Card'}
                            {doc.type === 'tenth_certificate' && '10th Certificate'}
                            {doc.type === 'voter_id' && 'Voter ID'}
                            : {doc.name}
                          </span>
                          <CheckCircle size={16} className="text-green-600 ml-auto" />
                        </div>
                      ))}
                    {/* Show unsaved documents from current session (only if not already in applicationDocuments) */}
                    {documents
                      .filter(d => {
                        if (d.belongsTo !== 'partner') return false;
                        // Only show if not already saved
                        const isAlreadySaved = applicationDocuments.some(
                          ad => ad.belongsTo === d.belongsTo && ad.type === d.type
                        );
                        return !isAlreadySaved;
                      })
                      .map(doc => (
                        <div key={doc.id} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                          <FileText size={16} />
                          <span>
                            {doc.type === 'aadhaar' && 'Aadhaar Card'}
                            {doc.type === 'tenth_certificate' && '10th Certificate'}
                            {doc.type === 'voter_id' && 'Voter ID'}
                            : {doc.file.name}
                          </span>
                          <CheckCircle size={16} className="text-green-600 ml-auto" />
                        </div>
                      ))}
                    {applicationDocuments.filter(d => d.belongsTo === 'partner').length === 0 && 
                     documents.filter(d => d.belongsTo === 'partner').length === 0 && (
                      <p className="text-sm text-gray-400 italic">No documents uploaded yet</p>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Declarations */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">Declarations</h4>
                {!isSubmitted && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCurrentStep(3);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <Edit size={16} className="mr-1" />
                    Edit
                  </Button>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-gray-600">I consent to the processing of my personal data for marriage registration purposes.</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-gray-600">I confirm that all information provided is accurate and truthful.</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-gray-600">I confirm that I am legally eligible to enter into marriage.</p>
                </div>
              </div>
            </Card>

            {isSubmitted && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                <p className="text-sm text-rose-800">
                  <strong>Note:</strong> This application has been submitted and cannot be edited.
                </p>
              </div>
            )}

            {!isSubmitted && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                <p className="text-sm text-rose-800">
                  <strong>Note:</strong> Please review all information before submitting. Once submitted, you cannot make changes.
                </p>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="font-serif text-4xl font-bold text-gray-900 mb-2">Marriage Registration Application</h1>
        <p className="text-gray-600">Complete all steps to submit your application</p>
      </div>

      <Stepper
        steps={applicationSteps}
        currentStep={currentStep}
        completedSteps={Array.from({ length: currentStep }, (_, i) => i)}
        className="mb-8"
      />

      <Card className="p-8">
        {renderStep()}

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 0 || (currentStep === applicationSteps.length - 1 && (application?.status === 'submitted' || application?.status === 'approved' || application?.status === 'under_review'))}
          >
            <ArrowLeft size={18} className="mr-2" />
            Back
          </Button>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              disabled={isSubmitted}
              onClick={async () => {
                if (isSubmitted) {
                  showToast('Application has been submitted and cannot be edited', 'info');
                  return;
                }
                try {
                  if (currentStep === 0) {
                    const isValid = await detailsForm.trigger();
                    if (isValid) {
                      const data = detailsForm.getValues();
                      await updateDraft({
                        userDetails: {
                          firstName: data.firstName,
                          lastName: data.lastName,
                          fatherName: data.fatherName,
                          dateOfBirth: data.dateOfBirth,
                          aadhaarNumber: data.aadhaarNumber,
                          mobileNumber: data.mobileNumber,
                        },
                        partnerForm: {
                          firstName: data.partnerFirstName,
                          lastName: data.partnerLastName,
                          fatherName: data.partnerFatherName,
                          dateOfBirth: data.partnerDateOfBirth,
                          idNumber: data.partnerAadhaarNumber,
                          aadhaarNumber: data.partnerAadhaarNumber,
                          mobileNumber: data.partnerMobileNumber,
                          address: application?.partnerForm?.address || {
                            street: '',
                            city: '',
                            state: '',
                            zipCode: '',
                            country: 'India',
                          },
                        },
                      });
                      showToast('Draft saved', 'success');
                    } else {
                      showToast('Please fill all required fields correctly', 'error');
                    }
                  } else if (currentStep === 1) {
                    const isValid = await addressForm.trigger();
                    if (isValid) {
                      const data = addressForm.getValues();
                      await updateDraft({
                        userAddress: {
                          street: data.userPermanentStreet,
                          city: data.userPermanentCity,
                          state: data.userPermanentState,
                          zipCode: data.userPermanentZipCode,
                          country: data.userPermanentCountry,
                        },
                        userCurrentAddress: {
                          street: data.userCurrentStreet,
                          city: data.userCurrentCity,
                          state: data.userCurrentState,
                          zipCode: data.userCurrentZipCode,
                          country: data.userCurrentCountry,
                        },
                        partnerAddress: {
                          street: data.partnerPermanentStreet,
                          city: data.partnerPermanentCity,
                          state: data.partnerPermanentState,
                          zipCode: data.partnerPermanentZipCode,
                          country: data.partnerPermanentCountry,
                        },
                        partnerCurrentAddress: {
                          street: data.partnerCurrentStreet,
                          city: data.partnerCurrentCity,
                          state: data.partnerCurrentState,
                          zipCode: data.partnerCurrentZipCode,
                          country: data.partnerCurrentCountry,
                        },
                      });
                      showToast('Draft saved', 'success');
                    } else {
                      showToast('Please fill all required fields correctly', 'error');
                    }
                  }
                } catch (error: any) {
                  console.error('Failed to save draft:', error);
                  const errorMessage = error.message || 'Failed to save. Please try again.';
                  showToast(errorMessage, 'error');
                }
              }}
            >
              <Save size={18} className="mr-2" />
              Save Draft
            </Button>
            <Button
              variant="primary"
              onClick={handleNext}
              isLoading={isSaving}
              disabled={currentStep === applicationSteps.length - 1 && (application?.status === 'submitted' || application?.status === 'approved' || application?.status === 'under_review')}
            >
              {currentStep === applicationSteps.length - 1 
                ? (application?.status === 'submitted' || application?.status === 'approved' || application?.status === 'under_review')
                  ? 'Already Submitted'
                  : 'Submit Application'
                : 'Next'}
              {currentStep < applicationSteps.length - 1 && <ArrowRight size={18} className="ml-2" />}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

const ApplicationPage: React.FC = () => {
  const { user } = useAuth();
  
  if (!user) {
    return null;
  }

  return (
    <ApplicationProvider userId={user.id}>
      <ApplicationFormContent />
    </ApplicationProvider>
  );
};

export default ApplicationPage;
