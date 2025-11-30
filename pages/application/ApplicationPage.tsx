import React, { useState, useEffect, useMemo } from 'react';
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
import Modal from '../../components/ui/Modal';
import { ArrowRight, ArrowLeft, Save, Upload, X, FileText, Edit, CheckCircle, Eye, Download, LogOut } from 'lucide-react';

const applicationSteps = [
  { id: 'groom', label: 'Groom Details' },
  { id: 'bride', label: 'Bride Details' },
  { id: 'documents', label: 'Documents' },
  { id: 'declarations', label: 'Confirmation' },
  { id: 'review', label: 'Review' },
];

// Groom Details Schema (User personal + address)
const groomSchema = z.object({
  // Personal details
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  fatherName: z.string().min(2, 'Father name is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  aadhaarNumber: z.string().regex(/^\d{12}$/, 'Aadhaar number must be exactly 12 digits'),
  mobileNumber: z.string().regex(/^\d{10}$/, 'Mobile number must be exactly 10 digits'),
  // Address details
  permanentVillageStreet: z.string().min(3, 'Village/Street is required'),
  permanentPostOffice: z.string().min(2, 'Post Office is required'),
  permanentPoliceStation: z.string().min(2, 'Police Station is required'),
  permanentDistrict: z.string().min(2, 'District is required'),
  permanentState: z.string().min(2, 'State is required'),
  permanentZipCode: z.string().regex(/^\d{6}$/, 'ZIP code must be exactly 6 digits'),
  permanentCountry: z.string().min(2, 'Country is required'),
  currentVillageStreet: z.string().min(3, 'Village/Street is required'),
  currentPostOffice: z.string().min(2, 'Post Office is required'),
  currentPoliceStation: z.string().min(2, 'Police Station is required'),
  currentDistrict: z.string().min(2, 'District is required'),
  currentState: z.string().min(2, 'State is required'),
  currentZipCode: z.string().regex(/^\d{6}$/, 'ZIP code must be exactly 6 digits'),
  currentCountry: z.string().min(2, 'Country is required'),
  sameAsPermanent: z.boolean().optional(),
  marriageDate: z.string().min(1, 'Marriage date is required'),
});

// Bride Details Schema (Partner personal + address)
const brideSchema = z.object({
  // Personal details
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  fatherName: z.string().min(2, 'Father name is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  aadhaarNumber: z.string().regex(/^\d{12}$/, 'Aadhaar number must be exactly 12 digits'),
  mobileNumber: z.string().regex(/^\d{10}$/, 'Mobile number must be exactly 10 digits'),
  // Address details
  permanentVillageStreet: z.string().min(3, 'Village/Street is required'),
  permanentPostOffice: z.string().min(2, 'Post Office is required'),
  permanentPoliceStation: z.string().min(2, 'Police Station is required'),
  permanentDistrict: z.string().min(2, 'District is required'),
  permanentState: z.string().min(2, 'State is required'),
  permanentZipCode: z.string().regex(/^\d{6}$/, 'ZIP code must be exactly 6 digits'),
  permanentCountry: z.string().min(2, 'Country is required'),
  currentVillageStreet: z.string().min(3, 'Village/Street is required'),
  currentPostOffice: z.string().min(2, 'Post Office is required'),
  currentPoliceStation: z.string().min(2, 'Police Station is required'),
  currentDistrict: z.string().min(2, 'District is required'),
  currentState: z.string().min(2, 'State is required'),
  currentZipCode: z.string().regex(/^\d{6}$/, 'ZIP code must be exactly 6 digits'),
  currentCountry: z.string().min(2, 'Country is required'),
  sameAsPermanent: z.boolean().optional(),
});

const declarationsSchema = z.object({
  consent: z.boolean().refine((val) => val === true, 'You must provide consent'),
  accuracy: z.boolean().refine((val) => val === true, 'You must confirm accuracy'),
  legal: z.boolean().refine((val) => val === true, 'You must confirm legal status'),
});

interface DocumentFile {
  file: File;
  type: 'aadhaar' | 'tenth_certificate' | 'voter_id' | 'photo';
  belongsTo: 'user' | 'partner' | 'joint';
  id: string;
}

const ApplicationFormContent: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { application, updateDraft, submitApplication, isLoading, refreshApplication } = useApplication();
  const { showToast } = useNotification();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [applicationDocuments, setApplicationDocuments] = useState<any[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<DocumentFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  
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

  const groomForm = useForm({
    resolver: zodResolver(groomSchema),
    mode: 'onChange', // Validate on change for real-time feedback
    defaultValues: {
      firstName: (application?.userDetails as any)?.firstName || user?.name?.split(' ')[0] || '',
      lastName: (application?.userDetails as any)?.lastName || user?.name?.split(' ').slice(1).join(' ') || '',
      fatherName: (application?.userDetails as any)?.fatherName || '',
      dateOfBirth: (application?.userDetails as any)?.dateOfBirth || '',
      aadhaarNumber: (application?.userDetails as any)?.aadhaarNumber || '',
      mobileNumber: (application?.userDetails as any)?.mobileNumber || '',
      permanentVillageStreet: (application?.userAddress as any)?.villageStreet || application?.userAddress?.street || application?.address?.street || '',
      permanentPostOffice: (application?.userAddress as any)?.postOffice || '',
      permanentPoliceStation: (application?.userAddress as any)?.policeStation || '',
      permanentDistrict: (application?.userAddress as any)?.district || application?.userAddress?.city || application?.address?.city || '',
      permanentState: application?.userAddress?.state || application?.address?.state || '',
      permanentZipCode: application?.userAddress?.zipCode || application?.address?.zipCode || '',
      permanentCountry: application?.userAddress?.country || application?.address?.country || 'India',
      currentVillageStreet: (application?.userCurrentAddress as any)?.villageStreet || application?.userCurrentAddress?.street || (application as any)?.currentAddress?.street || '',
      currentPostOffice: (application?.userCurrentAddress as any)?.postOffice || '',
      currentPoliceStation: (application?.userCurrentAddress as any)?.policeStation || '',
      currentDistrict: (application?.userCurrentAddress as any)?.district || application?.userCurrentAddress?.city || (application as any)?.currentAddress?.city || '',
      currentState: application?.userCurrentAddress?.state || (application as any)?.currentAddress?.state || '',
      currentZipCode: application?.userCurrentAddress?.zipCode || (application as any)?.currentAddress?.zipCode || '',
      currentCountry: application?.userCurrentAddress?.country || (application as any)?.currentAddress?.country || 'India',
      sameAsPermanent: false,
      marriageDate: (application?.declarations as any)?.marriageDate || (application?.declarations as any)?.marriageRegistrationDate || '',
    },
  });

  const brideForm = useForm({
    resolver: zodResolver(brideSchema),
    mode: 'onChange', // Validate on change for real-time feedback
    defaultValues: {
      firstName: application?.partnerForm?.firstName || '',
      lastName: application?.partnerForm?.lastName || '',
      fatherName: (application?.partnerForm as any)?.fatherName || '',
      dateOfBirth: application?.partnerForm?.dateOfBirth || '',
      aadhaarNumber: (application?.partnerForm as any)?.aadhaarNumber || '',
      mobileNumber: (application?.partnerForm as any)?.mobileNumber || '',
      permanentVillageStreet: (application?.partnerAddress as any)?.villageStreet || application?.partnerAddress?.street || application?.partnerForm?.address?.street || '',
      permanentPostOffice: (application?.partnerAddress as any)?.postOffice || '',
      permanentPoliceStation: (application?.partnerAddress as any)?.policeStation || '',
      permanentDistrict: (application?.partnerAddress as any)?.district || application?.partnerAddress?.city || application?.partnerForm?.address?.city || '',
      permanentState: application?.partnerAddress?.state || application?.partnerForm?.address?.state || '',
      permanentZipCode: application?.partnerAddress?.zipCode || application?.partnerForm?.address?.zipCode || '',
      permanentCountry: application?.partnerAddress?.country || application?.partnerForm?.address?.country || 'India',
      currentVillageStreet: (application?.partnerCurrentAddress as any)?.villageStreet || application?.partnerCurrentAddress?.street || '',
      currentPostOffice: (application?.partnerCurrentAddress as any)?.postOffice || '',
      currentPoliceStation: (application?.partnerCurrentAddress as any)?.policeStation || '',
      currentDistrict: (application?.partnerCurrentAddress as any)?.district || application?.partnerCurrentAddress?.city || '',
      currentState: application?.partnerCurrentAddress?.state || '',
      currentZipCode: application?.partnerCurrentAddress?.zipCode || '',
      currentCountry: application?.partnerCurrentAddress?.country || 'India',
      sameAsPermanent: false,
    },
  });

  const declarationsForm = useForm({
    resolver: zodResolver(declarationsSchema),
    mode: 'onChange', // Validate on change for real-time feedback
    defaultValues: {
      consent: application?.declarations?.consent || false,
      accuracy: application?.declarations?.accuracy || false,
      legal: application?.declarations?.legal || false,
    },
  });

  // Watch form values to trigger re-renders for validation state updates
  const groomFormValues = groomForm.watch();
  const brideFormValues = brideForm.watch();
  const declarationsFormValues = declarationsForm.watch();

  // Watch for address changes
  const groomSameAsPermanent = groomForm.watch('sameAsPermanent');
  const brideSameAsPermanent = brideForm.watch('sameAsPermanent');

  useEffect(() => {
    if (groomSameAsPermanent) {
      const permanent = groomForm.getValues();
      groomForm.setValue('currentVillageStreet', permanent.permanentVillageStreet);
      groomForm.setValue('currentPostOffice', permanent.permanentPostOffice);
      groomForm.setValue('currentPoliceStation', permanent.permanentPoliceStation);
      groomForm.setValue('currentDistrict', permanent.permanentDistrict);
      groomForm.setValue('currentState', permanent.permanentState);
      groomForm.setValue('currentZipCode', permanent.permanentZipCode);
      groomForm.setValue('currentCountry', permanent.permanentCountry);
    }
  }, [groomSameAsPermanent, groomForm]);

  useEffect(() => {
    if (brideSameAsPermanent) {
      const permanent = brideForm.getValues();
      brideForm.setValue('currentVillageStreet', permanent.permanentVillageStreet);
      brideForm.setValue('currentPostOffice', permanent.permanentPostOffice);
      brideForm.setValue('currentPoliceStation', permanent.permanentPoliceStation);
      brideForm.setValue('currentDistrict', permanent.permanentDistrict);
      brideForm.setValue('currentState', permanent.permanentState);
      brideForm.setValue('currentZipCode', permanent.permanentZipCode);
      brideForm.setValue('currentCountry', permanent.permanentCountry);
    }
  }, [brideSameAsPermanent, brideForm]);

  // Update form values when application data loads or changes
  useEffect(() => {
    if (application && !isLoading) {
      // Update groom form
      const groomData = {
        firstName: (application?.userDetails as any)?.firstName || user?.name?.split(' ')[0] || '',
        lastName: (application?.userDetails as any)?.lastName || user?.name?.split(' ').slice(1).join(' ') || '',
        fatherName: (application?.userDetails as any)?.fatherName || '',
        dateOfBirth: (application?.userDetails as any)?.dateOfBirth || '',
        aadhaarNumber: (application?.userDetails as any)?.aadhaarNumber || '',
        mobileNumber: (application?.userDetails as any)?.mobileNumber || '',
        permanentVillageStreet: (application?.userAddress as any)?.villageStreet || application?.userAddress?.street || application?.address?.street || '',
        permanentPostOffice: (application?.userAddress as any)?.postOffice || '',
        permanentPoliceStation: (application?.userAddress as any)?.policeStation || '',
        permanentDistrict: (application?.userAddress as any)?.district || application?.userAddress?.city || application?.address?.city || '',
        permanentState: application?.userAddress?.state || application?.address?.state || '',
        permanentZipCode: application?.userAddress?.zipCode || application?.address?.zipCode || '',
        permanentCountry: application?.userAddress?.country || application?.address?.country || 'India',
        currentVillageStreet: (application?.userCurrentAddress as any)?.villageStreet || application?.userCurrentAddress?.street || (application as any)?.currentAddress?.street || '',
        currentPostOffice: (application?.userCurrentAddress as any)?.postOffice || '',
        currentPoliceStation: (application?.userCurrentAddress as any)?.policeStation || '',
        currentDistrict: (application?.userCurrentAddress as any)?.district || application?.userCurrentAddress?.city || (application as any)?.currentAddress?.city || '',
        currentState: application?.userCurrentAddress?.state || (application as any)?.currentAddress?.state || '',
        currentZipCode: application?.userCurrentAddress?.zipCode || (application as any)?.currentAddress?.zipCode || '',
        currentCountry: application?.userCurrentAddress?.country || (application as any)?.currentAddress?.country || 'India',
        sameAsPermanent: false,
        marriageDate: (application?.declarations as any)?.marriageDate || (application?.declarations as any)?.marriageRegistrationDate || '',
      };
      groomForm.reset(groomData);

      // Update bride form
      const brideData = {
        firstName: application?.partnerForm?.firstName || '',
        lastName: application?.partnerForm?.lastName || '',
        fatherName: (application?.partnerForm as any)?.fatherName || '',
        dateOfBirth: application?.partnerForm?.dateOfBirth || '',
        aadhaarNumber: (application?.partnerForm as any)?.aadhaarNumber || '',
        mobileNumber: (application?.partnerForm as any)?.mobileNumber || '',
        permanentVillageStreet: (application?.partnerAddress as any)?.villageStreet || application?.partnerAddress?.street || application?.partnerForm?.address?.street || '',
        permanentPostOffice: (application?.partnerAddress as any)?.postOffice || '',
        permanentPoliceStation: (application?.partnerAddress as any)?.policeStation || '',
        permanentDistrict: (application?.partnerAddress as any)?.district || application?.partnerAddress?.city || application?.partnerForm?.address?.city || '',
        permanentState: application?.partnerAddress?.state || application?.partnerForm?.address?.state || '',
        permanentZipCode: application?.partnerAddress?.zipCode || application?.partnerForm?.address?.zipCode || '',
        permanentCountry: application?.partnerAddress?.country || application?.partnerForm?.address?.country || 'India',
        currentVillageStreet: (application?.partnerCurrentAddress as any)?.villageStreet || application?.partnerCurrentAddress?.street || '',
        currentPostOffice: (application?.partnerCurrentAddress as any)?.postOffice || '',
        currentPoliceStation: (application?.partnerCurrentAddress as any)?.policeStation || '',
        currentDistrict: (application?.partnerCurrentAddress as any)?.district || application?.partnerCurrentAddress?.city || '',
        currentState: application?.partnerCurrentAddress?.state || '',
        currentZipCode: application?.partnerCurrentAddress?.zipCode || '',
        currentCountry: application?.partnerCurrentAddress?.country || 'India',
        sameAsPermanent: false,
      };
      brideForm.reset(brideData);

      // Update declarations form
      declarationsForm.reset({
        consent: application?.declarations?.consent || false,
        accuracy: application?.declarations?.accuracy || false,
        legal: application?.declarations?.legal || false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [application, isLoading]);

  // Load documents when application loads or when on documents/review step
  useEffect(() => {
    if (application && (currentStep === 2 || currentStep === 4)) {
      const loadDocuments = async () => {
        setIsLoadingDocuments(true);
        try {
          const docs = await documentService.getDocuments(application.id);
          setApplicationDocuments(docs);
        } catch (error) {
          console.error('Failed to load documents:', error);
        } finally {
          setIsLoadingDocuments(false);
        }
      };
      loadDocuments();
    }
  }, [currentStep, application?.id]);

  // Set initial step based on application progress when application loads (only once)
  useEffect(() => {
    if (application && !isLoading && currentStep === 0) {
      // Calculate current step based on filled data (same logic as dashboard)
      let calculatedStep = 0;
      
      // Check if groom details are filled
      const groomDetailsFilled = application.userDetails?.firstName && application.userDetails?.lastName && application.userDetails?.fatherName &&
                                 application.userDetails?.dateOfBirth && application.userDetails?.aadhaarNumber && application.userDetails?.mobileNumber &&
                                 (application.userAddress?.villageStreet || application.userAddress?.street) && application.userAddress?.postOffice && application.userAddress?.policeStation &&
                                 (application.userAddress?.district || application.userAddress?.city) && application.userAddress?.state && application.userAddress?.zipCode && application.userAddress?.country &&
                                 (application.userCurrentAddress?.villageStreet || application.userCurrentAddress?.street) && application.userCurrentAddress?.postOffice && application.userCurrentAddress?.policeStation &&
                                 (application.userCurrentAddress?.district || application.userCurrentAddress?.city) && application.userCurrentAddress?.state && application.userCurrentAddress?.zipCode && application.userCurrentAddress?.country &&
                                 application.declarations?.marriageDate;
      
      if (!groomDetailsFilled) {
        calculatedStep = 0;
      } else {
        // Check if bride details are filled
        const brideDetailsFilled = application.partnerForm?.firstName && application.partnerForm?.lastName && application.partnerForm?.fatherName &&
                                   application.partnerForm?.dateOfBirth && (application.partnerForm?.aadhaarNumber || (application.partnerForm as any)?.idNumber) && (application.partnerForm as any)?.mobileNumber &&
                                   (application.partnerAddress?.villageStreet || application.partnerAddress?.street) && application.partnerAddress?.postOffice && application.partnerAddress?.policeStation &&
                                   (application.partnerAddress?.district || application.partnerAddress?.city) && application.partnerAddress?.state && application.partnerAddress?.zipCode && application.partnerAddress?.country &&
                                   (application.partnerCurrentAddress?.villageStreet || application.partnerCurrentAddress?.street) && application.partnerCurrentAddress?.postOffice && application.partnerCurrentAddress?.policeStation &&
                                   (application.partnerCurrentAddress?.district || application.partnerCurrentAddress?.city) && application.partnerCurrentAddress?.state && application.partnerCurrentAddress?.zipCode && application.partnerCurrentAddress?.country;
        
        if (!brideDetailsFilled) {
          calculatedStep = 1;
        } else {
          // Check if documents are uploaded
          const documents = application.documents || [];
          const userAadhaar = documents.find(d => d.belongsTo === 'user' && d.type === 'aadhaar');
          const userSecondDoc = documents.find(d => d.belongsTo === 'user' && (d.type === 'tenth_certificate' || d.type === 'voter_id'));
          const partnerAadhaar = documents.find(d => d.belongsTo === 'partner' && d.type === 'aadhaar');
          const partnerSecondDoc = documents.find(d => d.belongsTo === 'partner' && (d.type === 'tenth_certificate' || d.type === 'voter_id'));
          const jointPhotograph = documents.find(d => d.belongsTo === 'joint' && d.type === 'photo');
          
          if (!userAadhaar || !userSecondDoc || !partnerAadhaar || !partnerSecondDoc || !jointPhotograph) {
            calculatedStep = 2;
          } else {
            // Check if declarations are filled
            const hasDeclarations = application.declarations?.consent && 
                                    application.declarations?.accuracy && 
                                    application.declarations?.legal;
            
            if (!hasDeclarations) {
              calculatedStep = 3;
            } else {
              calculatedStep = 4;
            }
          }
        }
      }
      
      // Only set step if it's different from current (to avoid unnecessary re-renders)
      if (calculatedStep !== currentStep) {
        setCurrentStep(calculatedStep);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [application?.id, isLoading]);

  const isSubmitted = application?.status === 'submitted' || application?.status === 'approved' || application?.status === 'under_review';

  // Check for unsaved changes - MUST be before any early returns
  const hasUnsavedChanges = useMemo(() => {
    if (!application) return false;
    
    if (currentStep === 0) {
      const values = groomFormValues;
      const saved = application;
      return !!(
        (values.firstName && values.firstName !== (saved.userDetails as any)?.firstName) ||
        (values.lastName && values.lastName !== (saved.userDetails as any)?.lastName) ||
        (values.fatherName && values.fatherName !== (saved.userDetails as any)?.fatherName) ||
        (values.dateOfBirth && values.dateOfBirth !== (saved.userDetails as any)?.dateOfBirth) ||
        (values.aadhaarNumber && values.aadhaarNumber !== (saved.userDetails as any)?.aadhaarNumber) ||
        (values.mobileNumber && values.mobileNumber !== (saved.userDetails as any)?.mobileNumber) ||
        (values.permanentVillageStreet && values.permanentVillageStreet !== ((saved.userAddress as any)?.villageStreet || saved.userAddress?.street)) ||
        (values.permanentPostOffice && values.permanentPostOffice !== (saved.userAddress as any)?.postOffice) ||
        (values.permanentPoliceStation && values.permanentPoliceStation !== (saved.userAddress as any)?.policeStation) ||
        (values.permanentDistrict && values.permanentDistrict !== ((saved.userAddress as any)?.district || saved.userAddress?.city)) ||
        (values.permanentState && values.permanentState !== saved.userAddress?.state) ||
        (values.permanentZipCode && values.permanentZipCode !== saved.userAddress?.zipCode) ||
        (values.currentVillageStreet && values.currentVillageStreet !== ((saved.userCurrentAddress as any)?.villageStreet || saved.userCurrentAddress?.street)) ||
        (values.currentPostOffice && values.currentPostOffice !== (saved.userCurrentAddress as any)?.postOffice) ||
        (values.currentPoliceStation && values.currentPoliceStation !== (saved.userCurrentAddress as any)?.policeStation) ||
        (values.currentDistrict && values.currentDistrict !== ((saved.userCurrentAddress as any)?.district || saved.userCurrentAddress?.city)) ||
        (values.currentState && values.currentState !== saved.userCurrentAddress?.state) ||
        (values.currentZipCode && values.currentZipCode !== saved.userCurrentAddress?.zipCode) ||
        (values.marriageDate && values.marriageDate !== (saved.declarations as any)?.marriageDate)
      );
    } else if (currentStep === 1) {
      const values = brideFormValues;
      const saved = application;
      return !!(
        (values.firstName && values.firstName !== saved.partnerForm?.firstName) ||
        (values.lastName && values.lastName !== saved.partnerForm?.lastName) ||
        (values.fatherName && values.fatherName !== (saved.partnerForm as any)?.fatherName) ||
        (values.dateOfBirth && values.dateOfBirth !== saved.partnerForm?.dateOfBirth) ||
        (values.aadhaarNumber && values.aadhaarNumber !== ((saved.partnerForm as any)?.aadhaarNumber || (saved.partnerForm as any)?.idNumber)) ||
        (values.mobileNumber && values.mobileNumber !== (saved.partnerForm as any)?.mobileNumber) ||
        (values.permanentVillageStreet && values.permanentVillageStreet !== ((saved.partnerAddress as any)?.villageStreet || saved.partnerAddress?.street)) ||
        (values.permanentPostOffice && values.permanentPostOffice !== (saved.partnerAddress as any)?.postOffice) ||
        (values.permanentPoliceStation && values.permanentPoliceStation !== (saved.partnerAddress as any)?.policeStation) ||
        (values.permanentDistrict && values.permanentDistrict !== ((saved.partnerAddress as any)?.district || saved.partnerAddress?.city)) ||
        (values.permanentState && values.permanentState !== saved.partnerAddress?.state) ||
        (values.permanentZipCode && values.permanentZipCode !== saved.partnerAddress?.zipCode) ||
        (values.currentVillageStreet && values.currentVillageStreet !== ((saved.partnerCurrentAddress as any)?.villageStreet || saved.partnerCurrentAddress?.street)) ||
        (values.currentPostOffice && values.currentPostOffice !== (saved.partnerCurrentAddress as any)?.postOffice) ||
        (values.currentPoliceStation && values.currentPoliceStation !== (saved.partnerCurrentAddress as any)?.policeStation) ||
        (values.currentDistrict && values.currentDistrict !== ((saved.partnerCurrentAddress as any)?.district || saved.partnerCurrentAddress?.city)) ||
        (values.currentState && values.currentState !== saved.partnerCurrentAddress?.state) ||
        (values.currentZipCode && values.currentZipCode !== saved.partnerCurrentAddress?.zipCode)
      );
    } else if (currentStep === 2) {
      // Check if documents have changed
      const savedDocs = application.documents || [];
      return documents.length > 0 && documents.length !== savedDocs.length;
    } else if (currentStep === 3) {
      const values = declarationsFormValues;
      const saved = application.declarations || {};
      return !!(
        (values.consent && values.consent !== saved.consent) ||
        (values.accuracy && values.accuracy !== saved.accuracy) ||
        (values.legal && values.legal !== saved.legal)
      );
    }
    return false;
  }, [currentStep, groomFormValues, brideFormValues, declarationsFormValues, documents, application]);

  // Check if current step is valid - memoized to update when form values change
  const isCurrentStepValid = useMemo(() => {
    if (isSubmitted) return true; // Allow navigation if already submitted
    
    if (currentStep === 0) {
      // Check if all groom form fields are filled
      const values = groomFormValues;
      return !!(
        values.firstName?.trim() && 
        values.lastName?.trim() && 
        values.fatherName?.trim() && 
        values.dateOfBirth && 
        values.aadhaarNumber?.trim() && 
        values.mobileNumber?.trim() &&
        values.permanentVillageStreet?.trim() && 
        values.permanentPostOffice?.trim() && 
        values.permanentPoliceStation?.trim() && 
        values.permanentDistrict?.trim() && 
        values.permanentState?.trim() && 
        values.permanentZipCode?.trim() && 
        values.permanentCountry?.trim() &&
        values.currentVillageStreet?.trim() && 
        values.currentPostOffice?.trim() && 
        values.currentPoliceStation?.trim() && 
        values.currentDistrict?.trim() && 
        values.currentState?.trim() && 
        values.currentZipCode?.trim() && 
        values.currentCountry?.trim() &&
        values.marriageDate
      );
    } else if (currentStep === 1) {
      // Check if all bride form fields are filled
      const values = brideFormValues;
      return !!(
        values.firstName?.trim() && 
        values.lastName?.trim() && 
        values.fatherName?.trim() && 
        values.dateOfBirth && 
        values.aadhaarNumber?.trim() && 
        values.mobileNumber?.trim() &&
        values.permanentVillageStreet?.trim() && 
        values.permanentPostOffice?.trim() && 
        values.permanentPoliceStation?.trim() && 
        values.permanentDistrict?.trim() && 
        values.permanentState?.trim() && 
        values.permanentZipCode?.trim() && 
        values.permanentCountry?.trim() &&
        values.currentVillageStreet?.trim() && 
        values.currentPostOffice?.trim() && 
        values.currentPoliceStation?.trim() && 
        values.currentDistrict?.trim() && 
        values.currentState?.trim() && 
        values.currentZipCode?.trim() && 
        values.currentCountry?.trim()
      );
    } else if (currentStep === 2) {
      // Check if all documents are uploaded (either in current session or previously saved)
      // Check current session documents
      const userAadhaar = documents.find(d => d.belongsTo === 'user' && d.type === 'aadhaar');
      const userSecondDoc = documents.find(d => d.belongsTo === 'user' && (d.type === 'tenth_certificate' || d.type === 'voter_id'));
      const partnerAadhaar = documents.find(d => d.belongsTo === 'partner' && d.type === 'aadhaar');
      const partnerSecondDoc = documents.find(d => d.belongsTo === 'partner' && (d.type === 'tenth_certificate' || d.type === 'voter_id'));
      const jointPhotograph = documents.find(d => d.belongsTo === 'joint' && d.type === 'photo');
      
      // Check previously saved documents
      const savedUserAadhaar = applicationDocuments.find(d => d.belongsTo === 'user' && d.type === 'aadhaar');
      const savedUserSecondDoc = applicationDocuments.find(d => d.belongsTo === 'user' && (d.type === 'tenth_certificate' || d.type === 'voter_id'));
      const savedPartnerAadhaar = applicationDocuments.find(d => d.belongsTo === 'partner' && d.type === 'aadhaar');
      const savedPartnerSecondDoc = applicationDocuments.find(d => d.belongsTo === 'partner' && (d.type === 'tenth_certificate' || d.type === 'voter_id'));
      const savedJointPhotograph = applicationDocuments.find(d => d.belongsTo === 'joint' && d.type === 'photo');
      
      // Document is valid if it exists in either current session or saved documents
      return !!(
        (userAadhaar || savedUserAadhaar) &&
        (userSecondDoc || savedUserSecondDoc) &&
        (partnerAadhaar || savedPartnerAadhaar) &&
        (partnerSecondDoc || savedPartnerSecondDoc) &&
        (jointPhotograph || savedJointPhotograph)
      );
    } else if (currentStep === 3) {
      // Check if all declarations are filled
      const values = declarationsFormValues;
      return !!(values.consent && values.accuracy && values.legal);
    }
    return true; // Review step is always valid
  }, [currentStep, isSubmitted, groomFormValues, brideFormValues, declarationsFormValues, documents, applicationDocuments]);

  const handleNextClick = async () => {
    // If button is disabled, trigger validation and show toast
    if (!isCurrentStepValid && !isSubmitted) {
      if (currentStep === 0) {
        await groomForm.trigger();
        const errors = groomForm.formState.errors;
        const errorFields = Object.keys(errors).filter(key => errors[key as keyof typeof errors]);
        if (errorFields.length > 0) {
          const fieldNames = errorFields.map(field => {
            // Convert field names to readable format
            const readable = field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            return readable;
          });
          showToast(`Please fill all required fields. Missing: ${fieldNames.join(', ')}`, 'error');
        } else {
          showToast('Please complete all required fields before proceeding', 'error');
        }
      } else if (currentStep === 1) {
        await brideForm.trigger();
        const errors = brideForm.formState.errors;
        const errorFields = Object.keys(errors).filter(key => errors[key as keyof typeof errors]);
        if (errorFields.length > 0) {
          const fieldNames = errorFields.map(field => {
            const readable = field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            return readable;
          });
          showToast(`Please fill all required fields. Missing: ${fieldNames.join(', ')}`, 'error');
        } else {
          showToast('Please complete all required fields before proceeding', 'error');
        }
      } else if (currentStep === 2) {
        // Check both current session and saved documents
        const userAadhaar = documents.find(d => d.belongsTo === 'user' && d.type === 'aadhaar') || applicationDocuments.find(d => d.belongsTo === 'user' && d.type === 'aadhaar');
        const userSecondDoc = documents.find(d => d.belongsTo === 'user' && (d.type === 'tenth_certificate' || d.type === 'voter_id')) || applicationDocuments.find(d => d.belongsTo === 'user' && (d.type === 'tenth_certificate' || d.type === 'voter_id'));
        const partnerAadhaar = documents.find(d => d.belongsTo === 'partner' && d.type === 'aadhaar') || applicationDocuments.find(d => d.belongsTo === 'partner' && d.type === 'aadhaar');
        const partnerSecondDoc = documents.find(d => d.belongsTo === 'partner' && (d.type === 'tenth_certificate' || d.type === 'voter_id')) || applicationDocuments.find(d => d.belongsTo === 'partner' && (d.type === 'tenth_certificate' || d.type === 'voter_id'));
        const jointPhotograph = documents.find(d => d.belongsTo === 'joint' && d.type === 'photo') || applicationDocuments.find(d => d.belongsTo === 'joint' && d.type === 'photo');
        
        const missingDocs = [];
        if (!userAadhaar) missingDocs.push("Groom's Aadhaar Card");
        if (!userSecondDoc) missingDocs.push("Groom's 10th Certificate or Voter ID");
        if (!partnerAadhaar) missingDocs.push("Bride's Aadhaar Card");
        if (!partnerSecondDoc) missingDocs.push("Bride's 10th Certificate or Voter ID");
        if (!jointPhotograph) missingDocs.push("Joint Photograph");
        
        showToast(`Please upload all required documents: ${missingDocs.join(', ')}`, 'error');
      } else if (currentStep === 3) {
        await declarationsForm.trigger();
        const errors = declarationsForm.formState.errors;
        const errorFields = Object.keys(errors).filter(key => errors[key as keyof typeof errors]);
        if (errorFields.length > 0) {
          const fieldNames = errorFields.map(field => {
            const readable = field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            return readable;
          });
          showToast(`Please fill all required fields. Missing: ${fieldNames.join(', ')}`, 'error');
        } else {
          showToast('Please complete all required fields before proceeding', 'error');
        }
      }
      return;
    }
    
    // If valid, proceed with normal handleNext
    await handleNext();
  };

  const handleNext = async () => {
    if (isSubmitted && currentStep < 4) {
      // If submitted, only allow going to review step
      setCurrentStep(4);
      return;
    }
    if (currentStep === 0) {
      // Groom details step
      const isValid = await groomForm.trigger();
      if (!isValid) {
        showToast('Please fill all required fields correctly', 'error');
        return;
      }
      if (isValid) {
        const data = groomForm.getValues();
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
            userAddress: {
              villageStreet: data.permanentVillageStreet,
              postOffice: data.permanentPostOffice,
              policeStation: data.permanentPoliceStation,
              district: data.permanentDistrict,
              state: data.permanentState,
              zipCode: data.permanentZipCode,
              country: data.permanentCountry,
            },
            userCurrentAddress: {
              villageStreet: data.currentVillageStreet,
              postOffice: data.currentPostOffice,
              policeStation: data.currentPoliceStation,
              district: data.currentDistrict,
              state: data.currentState,
              zipCode: data.currentZipCode,
              country: data.currentCountry,
            },
            declarations: {
              ...(application?.declarations || {}),
              marriageDate: data.marriageDate,
            },
          });
          // Refresh application to ensure form values are synced
          await refreshApplication();
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
      // Bride details step
      const isValid = await brideForm.trigger();
      if (!isValid) {
        showToast('Please fill all required fields correctly', 'error');
        return;
      }
      if (isValid) {
        const data = brideForm.getValues();
        setIsSaving(true);
        try {
          await updateDraft({
            partnerForm: {
              firstName: data.firstName,
              lastName: data.lastName,
              fatherName: data.fatherName,
              dateOfBirth: data.dateOfBirth,
              idNumber: data.aadhaarNumber,
              aadhaarNumber: data.aadhaarNumber,
              mobileNumber: data.mobileNumber,
              address: {
                villageStreet: data.permanentVillageStreet,
                postOffice: data.permanentPostOffice,
                policeStation: data.permanentPoliceStation,
                district: data.permanentDistrict,
                state: data.permanentState,
                zipCode: data.permanentZipCode,
                country: data.permanentCountry,
              },
            },
            partnerAddress: {
              villageStreet: data.permanentVillageStreet,
              postOffice: data.permanentPostOffice,
              policeStation: data.permanentPoliceStation,
              district: data.permanentDistrict,
              state: data.permanentState,
              zipCode: data.permanentZipCode,
              country: data.permanentCountry,
            },
            partnerCurrentAddress: {
              villageStreet: data.currentVillageStreet,
              postOffice: data.currentPostOffice,
              policeStation: data.currentPoliceStation,
              district: data.currentDistrict,
              state: data.currentState,
              zipCode: data.currentZipCode,
              country: data.currentCountry,
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
    } else if (currentStep === 2) {
      // Validate documents (check both current session and saved documents)
      const userAadhaar = documents.find(d => d.belongsTo === 'user' && d.type === 'aadhaar') || applicationDocuments.find(d => d.belongsTo === 'user' && d.type === 'aadhaar');
      const userSecondDoc = documents.find(d => d.belongsTo === 'user' && (d.type === 'tenth_certificate' || d.type === 'voter_id')) || applicationDocuments.find(d => d.belongsTo === 'user' && (d.type === 'tenth_certificate' || d.type === 'voter_id'));
      const partnerAadhaar = documents.find(d => d.belongsTo === 'partner' && d.type === 'aadhaar') || applicationDocuments.find(d => d.belongsTo === 'partner' && d.type === 'aadhaar');
      const partnerSecondDoc = documents.find(d => d.belongsTo === 'partner' && (d.type === 'tenth_certificate' || d.type === 'voter_id')) || applicationDocuments.find(d => d.belongsTo === 'partner' && (d.type === 'tenth_certificate' || d.type === 'voter_id'));
      const jointPhotograph = documents.find(d => d.belongsTo === 'joint' && d.type === 'photo') || applicationDocuments.find(d => d.belongsTo === 'joint' && d.type === 'photo');

      if (!userAadhaar || !userSecondDoc || !partnerAadhaar || !partnerSecondDoc || !jointPhotograph) {
        showToast('Please upload all required documents including joint photograph', 'error');
        return;
      }

      // Upload documents
      setIsSaving(true);
      try {
        if (application) {
          // Only upload documents that haven't been saved yet
          if (documents.length > 0) {
            for (const doc of documents) {
              await documentService.uploadDocument(application.id, doc.file, doc.type, doc.belongsTo);
            }
            showToast('Documents uploaded successfully!', 'success');
            
            // Clear local documents state after successful upload to prevent re-uploads
            setDocuments([]);
            
            // Reload documents from database to ensure state is in sync
            const updatedDocs = await documentService.getDocuments(application.id);
            setApplicationDocuments(updatedDocs);
          }
        }
        setCurrentStep(currentStep + 1);
      } catch (error: any) {
        console.error('Document upload error:', error);
        const errorMessage = error?.message || 'Failed to upload documents. Please try again.';
        showToast(errorMessage, 'error');
      } finally {
        setIsSaving(false);
      }
    } else if (currentStep === 3) {
      const isValid = await declarationsForm.trigger();
      if (!isValid) {
        showToast('Please fill all required fields correctly', 'error');
        return;
      }
      if (isValid) {
        const data = declarationsForm.getValues();
        setIsSaving(true);
        try {
          await updateDraft({ 
            declarations: {
              ...(application?.declarations || {}), // Preserve existing fields like marriageDate
              consent: data.consent,
              accuracy: data.accuracy,
              legal: data.legal,
            }
          });
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

  const handleFileUpload = (file: File, type: 'aadhaar' | 'tenth_certificate' | 'voter_id' | 'photo', belongsTo: 'user' | 'partner' | 'joint') => {
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

  const handlePreviewDocument = async (doc: DocumentFile | any) => {
    setPreviewDocument(doc);
    setIsLoadingPreview(true);
    setPreviewUrl(null);
    
    try {
      if ('file' in doc && doc.file instanceof File) {
        // For local files (not yet uploaded)
        const url = URL.createObjectURL(doc.file);
        setPreviewUrl(url);
      } else if ('url' in doc && doc.url) {
        // For already uploaded documents - try to get signed URL
        if (doc.id && application) {
          try {
            const signedUrl = await documentService.getSignedUrl(doc.id);
            setPreviewUrl(signedUrl);
          } catch (error) {
            // Fallback to original URL
            setPreviewUrl(doc.url);
          }
        } else {
          setPreviewUrl(doc.url);
        }
      } else if (doc instanceof File) {
        // Direct file object
        const url = URL.createObjectURL(doc);
        setPreviewUrl(url);
      }
    } catch (error) {
      console.error('Failed to load preview:', error);
      if ('url' in doc && doc.url) {
        setPreviewUrl(doc.url);
      }
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const closePreview = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewDocument(null);
    setPreviewUrl(null);
  };

  const getDocumentName = (type: string, belongsTo: string) => {
    if (belongsTo === 'joint' && type === 'photo') return 'Joint Photograph';
    const person = belongsTo === 'user' ? "Groom's" : "Bride's";
    if (type === 'aadhaar') return `${person} Aadhaar Card`;
    if (type === 'tenth_certificate') return `${person} 10th Class Certificate`;
    if (type === 'voter_id') return `${person} Voter ID`;
    return '';
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      aadhaar: 'Aadhaar Card',
      tenth_certificate: '10th Certificate',
      voter_id: 'Voter ID',
      photo: 'Photograph',
      id: 'ID Document',
      certificate: 'Certificate',
      other: 'Other Document',
    };
    return labels[type] || 'Document';
  };

  const isImage = (mimeType: string | undefined) => {
    return mimeType?.startsWith('image/') || false;
  };

  const isPDF = (mimeType: string | undefined) => {
    return mimeType === 'application/pdf' || false;
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-8">
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Groom Personal Details</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    {...groomForm.register('firstName')}
                    error={groomForm.formState.errors.firstName?.message}
                    required
                    disabled={isSubmitted}
                  />
                  <Input
                    label="Last Name"
                    {...groomForm.register('lastName')}
                    error={groomForm.formState.errors.lastName?.message}
                    required
                    disabled={isSubmitted}
                  />
                </div>
                <Input
                  label="Father's Name"
                  {...groomForm.register('fatherName')}
                  error={groomForm.formState.errors.fatherName?.message}
                  required
                  disabled={isSubmitted}
                />
                <Input
                  label="Date of Birth"
                  type="date"
                  {...groomForm.register('dateOfBirth')}
                  error={groomForm.formState.errors.dateOfBirth?.message}
                  required
                  disabled={isSubmitted}
                />
                <Input
                  label="Aadhaar Number"
                  type="text"
                  maxLength={12}
                  {...groomForm.register('aadhaarNumber', {
                    onChange: (e) => {
                      e.target.value = e.target.value.replace(/\D/g, '');
                    },
                  })}
                  error={groomForm.formState.errors.aadhaarNumber?.message}
                  placeholder="Enter 12-digit Aadhaar number"
                  required
                  disabled={isSubmitted}
                />
                <PhoneInput
                  label="Mobile Number"
                  value={groomForm.watch('mobileNumber') || ''}
                  onChange={(value) => {
                    if (!isSubmitted) {
                      groomForm.setValue('mobileNumber', value, { shouldValidate: true });
                    }
                  }}
                  error={groomForm.formState.errors.mobileNumber?.message}
                  required
                  disabled={isSubmitted}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Groom Permanent Address</h3>
              <div className="space-y-4">
                <Input
                  label="Village/Street"
                  {...groomForm.register('permanentVillageStreet')}
                  disabled={isSubmitted}
                  error={groomForm.formState.errors.permanentVillageStreet?.message}
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Post Office"
                    {...groomForm.register('permanentPostOffice')}
                    disabled={isSubmitted}
                    error={groomForm.formState.errors.permanentPostOffice?.message}
                    required
                  />
                  <Input
                    label="Police Station"
                    {...groomForm.register('permanentPoliceStation')}
                    disabled={isSubmitted}
                    error={groomForm.formState.errors.permanentPoliceStation?.message}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="District"
                    {...groomForm.register('permanentDistrict')}
                    disabled={isSubmitted}
                    error={groomForm.formState.errors.permanentDistrict?.message}
                    required
                  />
                  <Input
                    label="State"
                    {...groomForm.register('permanentState')}
                    disabled={isSubmitted}
                    error={groomForm.formState.errors.permanentState?.message}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="ZIP Code"
                    maxLength={6}
                    {...groomForm.register('permanentZipCode', {
                      onChange: (e) => {
                        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      },
                    })}
                    disabled={isSubmitted}
                    error={groomForm.formState.errors.permanentZipCode?.message}
                    required
                  />
                  <Input
                    label="Country"
                    {...groomForm.register('permanentCountry')}
                    disabled={isSubmitted}
                    error={groomForm.formState.errors.permanentCountry?.message}
                    defaultValue="India"
                    required
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200 mt-6">
                <h3 className="font-semibold text-gray-900 mb-4">Groom Current Address</h3>
                <div className="mb-4">
                  <Checkbox
                    label="Same as permanent address"
                    checked={groomSameAsPermanent || false}
                    onChange={(e) => groomForm.setValue('sameAsPermanent', e.target.checked)}
                  />
                </div>
                <div className="space-y-4">
                  <Input
                    label="Village/Street"
                    {...groomForm.register('currentVillageStreet')}
                    disabled={isSubmitted || groomSameAsPermanent}
                    error={groomForm.formState.errors.currentVillageStreet?.message}
                    required
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Post Office"
                      {...groomForm.register('currentPostOffice')}
                      disabled={isSubmitted || groomSameAsPermanent}
                      error={groomForm.formState.errors.currentPostOffice?.message}
                      required
                    />
                    <Input
                      label="Police Station"
                      {...groomForm.register('currentPoliceStation')}
                      disabled={isSubmitted || groomSameAsPermanent}
                      error={groomForm.formState.errors.currentPoliceStation?.message}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="District"
                      {...groomForm.register('currentDistrict')}
                      disabled={isSubmitted || groomSameAsPermanent}
                      error={groomForm.formState.errors.currentDistrict?.message}
                      required
                    />
                    <Input
                      label="State"
                      {...groomForm.register('currentState')}
                      disabled={isSubmitted || groomSameAsPermanent}
                      error={groomForm.formState.errors.currentState?.message}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="ZIP Code"
                      maxLength={6}
                      {...groomForm.register('currentZipCode', {
                        onChange: (e) => {
                          e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        },
                      })}
                      disabled={isSubmitted || groomSameAsPermanent}
                      error={groomForm.formState.errors.currentZipCode?.message}
                      required
                    />
                    <Input
                      label="Country"
                      {...groomForm.register('currentCountry')}
                      disabled={isSubmitted || groomSameAsPermanent}
                      error={groomForm.formState.errors.currentCountry?.message}
                      defaultValue="India"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Marriage Date</h3>
              <div className="space-y-4">
                <Input
                  label="Marriage Date"
                  type="date"
                  {...groomForm.register('marriageDate')}
                  error={groomForm.formState.errors.marriageDate?.message}
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
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Bride Personal Details</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    {...brideForm.register('firstName')}
                    error={brideForm.formState.errors.firstName?.message}
                    required
                    disabled={isSubmitted}
                  />
                  <Input
                    label="Last Name"
                    {...brideForm.register('lastName')}
                    error={brideForm.formState.errors.lastName?.message}
                    required
                    disabled={isSubmitted}
                  />
                </div>
                <Input
                  label="Father's Name"
                  {...brideForm.register('fatherName')}
                  error={brideForm.formState.errors.fatherName?.message}
                  required
                  disabled={isSubmitted}
                />
                <Input
                  label="Date of Birth"
                  type="date"
                  {...brideForm.register('dateOfBirth')}
                  error={brideForm.formState.errors.dateOfBirth?.message}
                  required
                  disabled={isSubmitted}
                />
                <Input
                  label="Aadhaar Number"
                  type="text"
                  maxLength={12}
                  {...brideForm.register('aadhaarNumber', {
                    onChange: (e) => {
                      e.target.value = e.target.value.replace(/\D/g, '');
                    },
                  })}
                  error={brideForm.formState.errors.aadhaarNumber?.message}
                  placeholder="Enter 12-digit Aadhaar number"
                  required
                  disabled={isSubmitted}
                />
                <PhoneInput
                  label="Mobile Number"
                  value={brideForm.watch('mobileNumber') || ''}
                  onChange={(value) => {
                    if (!isSubmitted) {
                      brideForm.setValue('mobileNumber', value, { shouldValidate: true });
                    }
                  }}
                  error={brideForm.formState.errors.mobileNumber?.message}
                  required
                  disabled={isSubmitted}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Bride Permanent Address</h3>
              <div className="space-y-4">
                <Input
                  label="Village/Street"
                  {...brideForm.register('permanentVillageStreet')}
                  disabled={isSubmitted}
                  error={brideForm.formState.errors.permanentVillageStreet?.message}
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Post Office"
                    {...brideForm.register('permanentPostOffice')}
                    disabled={isSubmitted}
                    error={brideForm.formState.errors.permanentPostOffice?.message}
                    required
                  />
                  <Input
                    label="Police Station"
                    {...brideForm.register('permanentPoliceStation')}
                    disabled={isSubmitted}
                    error={brideForm.formState.errors.permanentPoliceStation?.message}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="District"
                    {...brideForm.register('permanentDistrict')}
                    disabled={isSubmitted}
                    error={brideForm.formState.errors.permanentDistrict?.message}
                    required
                  />
                  <Input
                    label="State"
                    {...brideForm.register('permanentState')}
                    disabled={isSubmitted}
                    error={brideForm.formState.errors.permanentState?.message}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="ZIP Code"
                    maxLength={6}
                    {...brideForm.register('permanentZipCode', {
                      onChange: (e) => {
                        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      },
                    })}
                    disabled={isSubmitted}
                    error={brideForm.formState.errors.permanentZipCode?.message}
                    required
                  />
                  <Input
                    label="Country"
                    {...brideForm.register('permanentCountry')}
                    disabled={isSubmitted}
                    error={brideForm.formState.errors.permanentCountry?.message}
                    defaultValue="India"
                    required
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200 mt-6">
                <h3 className="font-semibold text-gray-900 mb-4">Bride Current Address</h3>
                <div className="mb-4">
                  <Checkbox
                    label="Same as permanent address"
                    checked={brideSameAsPermanent || false}
                    onChange={(e) => brideForm.setValue('sameAsPermanent', e.target.checked)}
                  />
                </div>
                <div className="space-y-4">
                  <Input
                    label="Village/Street"
                    {...brideForm.register('currentVillageStreet')}
                    disabled={isSubmitted || brideSameAsPermanent}
                    error={brideForm.formState.errors.currentVillageStreet?.message}
                    required
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Post Office"
                      {...brideForm.register('currentPostOffice')}
                      disabled={isSubmitted || brideSameAsPermanent}
                      error={brideForm.formState.errors.currentPostOffice?.message}
                      required
                    />
                    <Input
                      label="Police Station"
                      {...brideForm.register('currentPoliceStation')}
                      disabled={isSubmitted || brideSameAsPermanent}
                      error={brideForm.formState.errors.currentPoliceStation?.message}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="District"
                      {...brideForm.register('currentDistrict')}
                      disabled={isSubmitted || brideSameAsPermanent}
                      error={brideForm.formState.errors.currentDistrict?.message}
                      required
                    />
                    <Input
                      label="State"
                      {...brideForm.register('currentState')}
                      disabled={isSubmitted || brideSameAsPermanent}
                      error={brideForm.formState.errors.currentState?.message}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="ZIP Code"
                      maxLength={6}
                      {...brideForm.register('currentZipCode', {
                        onChange: (e) => {
                          e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        },
                      })}
                      disabled={isSubmitted || brideSameAsPermanent}
                      error={brideForm.formState.errors.currentZipCode?.message}
                      required
                    />
                    <Input
                      label="Country"
                      {...brideForm.register('currentCountry')}
                      disabled={isSubmitted || brideSameAsPermanent}
                      error={brideForm.formState.errors.currentCountry?.message}
                      defaultValue="India"
                      required
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
              <h3 className="font-semibold text-gray-900 mb-2">Groom's Documents</h3>
              <p className="text-sm text-gray-600 mb-6">Upload groom's Aadhaar card and either 10th class certificate or Voter ID</p>
              
              {isLoadingDocuments && (
                <div className="flex items-center justify-center py-4 mb-4 bg-gray-50 rounded-lg">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gold-500"></div>
                  <span className="ml-2 text-sm text-gray-500">Loading saved documents...</span>
                </div>
              )}
              
              {/* Show saved documents from database */}
              {!isLoadingDocuments && applicationDocuments.filter(d => d.belongsTo === 'user').length > 0 && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-2">Previously Saved Documents:</p>
                  <div className="space-y-2">
                    {applicationDocuments
                      .filter(d => d.belongsTo === 'user')
                      .map(doc => (
                        <div key={doc.id} className="flex items-center gap-2 text-sm text-gray-600">
                          <FileText size={16} />
                          <span className="cursor-pointer hover:text-gray-900" onClick={() => handlePreviewDocument(doc)}>
                            {doc.type === 'aadhaar' && 'Aadhaar Card'}
                            {doc.type === 'tenth_certificate' && '10th Certificate'}
                            {doc.type === 'voter_id' && 'Voter ID'}
                            : {doc.name}
                          </span>
                          <button
                            onClick={() => handlePreviewDocument(doc)}
                            className="text-blue-600 hover:text-blue-700 p-1 ml-auto"
                            title="Preview"
                          >
                            <Eye size={16} />
                          </button>
                          <CheckCircle size={16} className="text-green-600" />
                        </div>
                      ))}
                  </div>
                </div>
              )}
              
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
                    {documents.find(d => d.belongsTo === 'user' && d.type === 'aadhaar') && (() => {
                      const doc = documents.find(d => d.belongsTo === 'user' && d.type === 'aadhaar')!;
                      return (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <FileText size={16} />
                          <span className="cursor-pointer hover:text-gray-900" onClick={() => handlePreviewDocument(doc)}>
                            {doc.file.name}
                          </span>
                          <button
                            onClick={() => handlePreviewDocument(doc)}
                            className="text-blue-600 hover:text-blue-700 p-1"
                            title="Preview"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleRemoveDocument(doc.id)}
                            className="text-rose-600 hover:text-rose-700 p-1"
                            title="Remove"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      );
                    })()}
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
                    {documents.find(d => d.belongsTo === 'user' && (d.type === 'tenth_certificate' || d.type === 'voter_id')) && (() => {
                      const doc = documents.find(d => d.belongsTo === 'user' && (d.type === 'tenth_certificate' || d.type === 'voter_id'))!;
                      return (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <FileText size={16} />
                          <span className="cursor-pointer hover:text-gray-900" onClick={() => handlePreviewDocument(doc)}>
                            {doc.file.name}
                          </span>
                          <button
                            onClick={() => handlePreviewDocument(doc)}
                            className="text-blue-600 hover:text-blue-700 p-1"
                            title="Preview"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleRemoveDocument(doc.id)}
                            className="text-rose-600 hover:text-rose-700 p-1"
                            title="Remove"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">Bride's Documents</h3>
              <p className="text-sm text-gray-600 mb-6">Upload bride's Aadhaar card and either 10th class certificate or Voter ID</p>
              
              {isLoadingDocuments && (
                <div className="flex items-center justify-center py-4 mb-4 bg-gray-50 rounded-lg">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gold-500"></div>
                  <span className="ml-2 text-sm text-gray-500">Loading saved documents...</span>
                </div>
              )}
              
              {/* Show saved documents from database */}
              {!isLoadingDocuments && applicationDocuments.filter(d => d.belongsTo === 'partner').length > 0 && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-2">Previously Saved Documents:</p>
                  <div className="space-y-2">
                    {applicationDocuments
                      .filter(d => d.belongsTo === 'partner')
                      .map(doc => (
                        <div key={doc.id} className="flex items-center gap-2 text-sm text-gray-600">
                          <FileText size={16} />
                          <span className="cursor-pointer hover:text-gray-900" onClick={() => handlePreviewDocument(doc)}>
                            {doc.type === 'aadhaar' && 'Aadhaar Card'}
                            {doc.type === 'tenth_certificate' && '10th Certificate'}
                            {doc.type === 'voter_id' && 'Voter ID'}
                            : {doc.name}
                          </span>
                          <button
                            onClick={() => handlePreviewDocument(doc)}
                            className="text-blue-600 hover:text-blue-700 p-1 ml-auto"
                            title="Preview"
                          >
                            <Eye size={16} />
                          </button>
                          <CheckCircle size={16} className="text-green-600" />
                        </div>
                      ))}
                  </div>
                </div>
              )}
              
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
                    {documents.find(d => d.belongsTo === 'partner' && d.type === 'aadhaar') && (() => {
                      const doc = documents.find(d => d.belongsTo === 'partner' && d.type === 'aadhaar')!;
                      return (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <FileText size={16} />
                          <span className="cursor-pointer hover:text-gray-900" onClick={() => handlePreviewDocument(doc)}>
                            {doc.file.name}
                          </span>
                          <button
                            onClick={() => handlePreviewDocument(doc)}
                            className="text-blue-600 hover:text-blue-700 p-1"
                            title="Preview"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleRemoveDocument(doc.id)}
                            className="text-rose-600 hover:text-rose-700 p-1"
                            title="Remove"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      );
                    })()}
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
                    {documents.find(d => d.belongsTo === 'partner' && (d.type === 'tenth_certificate' || d.type === 'voter_id')) && (() => {
                      const doc = documents.find(d => d.belongsTo === 'partner' && (d.type === 'tenth_certificate' || d.type === 'voter_id'))!;
                      return (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <FileText size={16} />
                          <span className="cursor-pointer hover:text-gray-900" onClick={() => handlePreviewDocument(doc)}>
                            {doc.file.name}
                          </span>
                          <button
                            onClick={() => handlePreviewDocument(doc)}
                            className="text-blue-600 hover:text-blue-700 p-1"
                            title="Preview"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleRemoveDocument(doc.id)}
                            className="text-rose-600 hover:text-rose-700 p-1"
                            title="Remove"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">Joint Photograph</h3>
              <p className="text-sm text-gray-600 mb-6">Upload a joint photograph of the bride and groom</p>
              
              {isLoadingDocuments && (
                <div className="flex items-center justify-center py-4 mb-4 bg-gray-50 rounded-lg">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gold-500"></div>
                  <span className="ml-2 text-sm text-gray-500">Loading saved documents...</span>
                </div>
              )}
              
              {/* Show saved documents from database */}
              {!isLoadingDocuments && applicationDocuments.filter(d => d.belongsTo === 'joint' && d.type === 'photo').length > 0 && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-2">Previously Saved Document:</p>
                  <div className="space-y-2">
                    {applicationDocuments
                      .filter(d => d.belongsTo === 'joint' && d.type === 'photo')
                      .map(doc => (
                        <div key={doc.id} className="flex items-center gap-2 text-sm text-gray-600">
                          <FileText size={16} />
                          <span className="cursor-pointer hover:text-gray-900" onClick={() => handlePreviewDocument(doc)}>
                            Joint Photograph: {doc.name}
                          </span>
                          <button
                            onClick={() => handlePreviewDocument(doc)}
                            className="text-blue-600 hover:text-blue-700 p-1 ml-auto"
                            title="Preview"
                          >
                            <Eye size={16} />
                          </button>
                          <CheckCircle size={16} className="text-green-600" />
                        </div>
                      ))}
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Joint Photograph <span className="text-rose-600">*</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, 'photo', 'joint');
                      }}
                      className="hidden"
                      id="joint-photograph"
                    />
                    <label
                      htmlFor="joint-photograph"
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      <Upload size={18} />
                      <span>Choose File</span>
                    </label>
                    {documents.find(d => d.belongsTo === 'joint' && d.type === 'photo') && (() => {
                      const doc = documents.find(d => d.belongsTo === 'joint' && d.type === 'photo')!;
                      return (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <FileText size={16} />
                          <span className="cursor-pointer hover:text-gray-900" onClick={() => handlePreviewDocument(doc)}>
                            {doc.file.name}
                          </span>
                          <button
                            onClick={() => handlePreviewDocument(doc)}
                            className="text-blue-600 hover:text-blue-700 p-1"
                            title="Preview"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleRemoveDocument(doc.id)}
                            className="text-rose-600 hover:text-rose-700 p-1"
                            title="Remove"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <div>
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
          </div>
        );
      case 4:
        const groomData = groomForm.getValues();
        const brideData = brideForm.getValues();
        const declarationsData = declarationsForm.getValues();
        
        // Get marriage date from form or saved application data
        // Check form first, then saved application, with fallback to empty string
        const formMarriageDate = groomForm.watch('marriageDate');
        const savedMarriageDate = (application?.declarations as any)?.marriageDate || (application?.declarations as any)?.marriageRegistrationDate;
        const marriageDate = formMarriageDate || savedMarriageDate || '';
        
        // Debug: Log the date values to help troubleshoot
        if (process.env.NODE_ENV === 'development') {
          console.log('Marriage Date Debug:', {
            formValue: formMarriageDate,
            savedValue: savedMarriageDate,
            finalValue: marriageDate,
            applicationDeclarations: application?.declarations,
            applicationId: application?.id,
            groomFormValues: groomForm.getValues()
          });
          console.log('Full application object:', JSON.stringify(application, null, 2));
        }
        
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-gray-900">Review Your Application</h3>
              {!isSubmitted && (
                <Badge variant="info">Draft - You can still edit</Badge>
              )}
            </div>

            {/* Marriage Information */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">Marriage Information</h4>
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
                  <p className="text-gray-500 mb-1">Marriage Date</p>
                  <p className="font-medium text-gray-900">
                    {marriageDate && marriageDate.trim() !== '' 
                      ? safeFormatDate(marriageDate, 'MMMM d, yyyy', 'Invalid date format') 
                      : 'Not provided'}
                  </p>
                </div>
              </div>
            </Card>

            {/* Groom Details */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">Groom Details</h4>
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
              <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                <div>
                  <p className="text-gray-500 mb-1">Full Name</p>
                  <p className="font-medium text-gray-900">{groomData.firstName} {groomData.lastName}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Father's Name</p>
                  <p className="font-medium text-gray-900">{groomData.fatherName}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Date of Birth</p>
                  <p className="font-medium text-gray-900">{safeFormatDate(groomData.dateOfBirth, 'MMMM d, yyyy')}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Aadhaar Number</p>
                  <p className="font-medium text-gray-900">{groomData.aadhaarNumber}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Mobile Number</p>
                  <p className="font-medium text-gray-900">{groomData.mobileNumber}</p>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Permanent Address</p>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>{groomData.permanentVillageStreet}</p>
                      <p>P.O: {groomData.permanentPostOffice}, P.S: {groomData.permanentPoliceStation}</p>
                      <p>Dist: {groomData.permanentDistrict}, {groomData.permanentState}</p>
                      <p>PIN: {groomData.permanentZipCode}, {groomData.permanentCountry}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Current Address</p>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>{groomData.currentVillageStreet}</p>
                      <p>P.O: {groomData.currentPostOffice}, P.S: {groomData.currentPoliceStation}</p>
                      <p>Dist: {groomData.currentDistrict}, {groomData.currentState}</p>
                      <p>PIN: {groomData.currentZipCode}, {groomData.currentCountry}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Bride Details */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">Bride Details</h4>
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
              <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                <div>
                  <p className="text-gray-500 mb-1">Full Name</p>
                  <p className="font-medium text-gray-900">{brideData.firstName} {brideData.lastName}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Father's Name</p>
                  <p className="font-medium text-gray-900">{brideData.fatherName}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Date of Birth</p>
                  <p className="font-medium text-gray-900">{safeFormatDate(brideData.dateOfBirth, 'MMMM d, yyyy')}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Aadhaar Number</p>
                  <p className="font-medium text-gray-900">{brideData.aadhaarNumber}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Mobile Number</p>
                  <p className="font-medium text-gray-900">{brideData.mobileNumber}</p>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Permanent Address</p>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>{brideData.permanentVillageStreet}</p>
                      <p>P.O: {brideData.permanentPostOffice}, P.S: {brideData.permanentPoliceStation}</p>
                      <p>Dist: {brideData.permanentDistrict}, {brideData.permanentState}</p>
                      <p>PIN: {brideData.permanentZipCode}, {brideData.permanentCountry}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Current Address</p>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>{brideData.currentVillageStreet}</p>
                      <p>P.O: {brideData.currentPostOffice}, P.S: {brideData.currentPoliceStation}</p>
                      <p>Dist: {brideData.currentDistrict}, {brideData.currentState}</p>
                      <p>PIN: {brideData.currentZipCode}, {brideData.currentCountry}</p>
                    </div>
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
                  <p className="text-sm font-medium text-gray-700 mb-2">Groom's Documents</p>
                  <div className="space-y-2">
                    {isLoadingDocuments ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gold-500"></div>
                        <span className="ml-2 text-sm text-gray-500">Loading documents...</span>
                      </div>
                    ) : (
                      <>
                        {/* Show saved documents from applicationDocuments */}
                        {applicationDocuments
                          .filter(d => d.belongsTo === 'user')
                          .map(doc => (
                        <div key={doc.id} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                          <FileText size={16} />
                          <span className="cursor-pointer hover:text-gray-900" onClick={() => handlePreviewDocument(doc)}>
                            {doc.type === 'aadhaar' && 'Aadhaar Card'}
                            {doc.type === 'tenth_certificate' && '10th Certificate'}
                            {doc.type === 'voter_id' && 'Voter ID'}
                            : {doc.name}
                          </span>
                          <button
                            onClick={() => handlePreviewDocument(doc)}
                            className="text-blue-600 hover:text-blue-700 p-1 ml-auto"
                            title="Preview"
                          >
                            <Eye size={16} />
                          </button>
                          <CheckCircle size={16} className="text-green-600" />
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
                          <span className="cursor-pointer hover:text-gray-900" onClick={() => handlePreviewDocument(doc)}>
                            {doc.type === 'aadhaar' && 'Aadhaar Card'}
                            {doc.type === 'tenth_certificate' && '10th Certificate'}
                            {doc.type === 'voter_id' && 'Voter ID'}
                            : {doc.file.name}
                          </span>
                          <button
                            onClick={() => handlePreviewDocument(doc)}
                            className="text-blue-600 hover:text-blue-700 p-1 ml-auto"
                            title="Preview"
                          >
                            <Eye size={16} />
                          </button>
                          <CheckCircle size={16} className="text-green-600" />
                        </div>
                      ))}
                        {applicationDocuments.filter(d => d.belongsTo === 'user').length === 0 && 
                         documents.filter(d => d.belongsTo === 'user').length === 0 && (
                          <p className="text-sm text-gray-400 italic">No documents uploaded yet</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Bride's Documents</p>
                  <div className="space-y-2">
                    {isLoadingDocuments ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gold-500"></div>
                        <span className="ml-2 text-sm text-gray-500">Loading documents...</span>
                      </div>
                    ) : (
                      <>
                        {/* Show saved documents from applicationDocuments */}
                        {applicationDocuments
                          .filter(d => d.belongsTo === 'partner')
                          .map(doc => (
                        <div key={doc.id} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                          <FileText size={16} />
                          <span className="cursor-pointer hover:text-gray-900" onClick={() => handlePreviewDocument(doc)}>
                            {doc.type === 'aadhaar' && 'Aadhaar Card'}
                            {doc.type === 'tenth_certificate' && '10th Certificate'}
                            {doc.type === 'voter_id' && 'Voter ID'}
                            : {doc.name}
                          </span>
                          <button
                            onClick={() => handlePreviewDocument(doc)}
                            className="text-blue-600 hover:text-blue-700 p-1 ml-auto"
                            title="Preview"
                          >
                            <Eye size={16} />
                          </button>
                          <CheckCircle size={16} className="text-green-600" />
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
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Joint Photograph</p>
                  <div className="space-y-2">
                    {isLoadingDocuments ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gold-500"></div>
                        <span className="ml-2 text-sm text-gray-500">Loading documents...</span>
                      </div>
                    ) : (
                      <>
                        {/* Show saved documents from applicationDocuments */}
                        {applicationDocuments
                          .filter(d => d.belongsTo === 'joint' && d.type === 'photo')
                          .map(doc => (
                        <div key={doc.id} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                          <FileText size={16} />
                          <span className="cursor-pointer hover:text-gray-900" onClick={() => handlePreviewDocument(doc)}>
                            Joint Photograph: {doc.name}
                          </span>
                          <button
                            onClick={() => handlePreviewDocument(doc)}
                            className="text-blue-600 hover:text-blue-700 p-1 ml-auto"
                            title="Preview"
                          >
                            <Eye size={16} />
                          </button>
                          <CheckCircle size={16} className="text-green-600" />
                        </div>
                      ))}
                    {/* Show unsaved documents from current session */}
                    {documents
                      .filter(d => {
                        if (d.belongsTo !== 'joint' || d.type !== 'photo') return false;
                        const isAlreadySaved = applicationDocuments.some(
                          ad => ad.belongsTo === d.belongsTo && ad.type === d.type
                        );
                        return !isAlreadySaved;
                      })
                      .map(doc => (
                        <div key={doc.id} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                          <FileText size={16} />
                          <span className="cursor-pointer hover:text-gray-900" onClick={() => handlePreviewDocument(doc)}>
                            Joint Photograph: {doc.file.name}
                          </span>
                          <button
                            onClick={() => handlePreviewDocument(doc)}
                            className="text-blue-600 hover:text-blue-700 p-1 ml-auto"
                            title="Preview"
                          >
                            <Eye size={16} />
                          </button>
                          <CheckCircle size={16} className="text-green-600" />
                        </div>
                      ))}
                        {applicationDocuments.filter(d => d.belongsTo === 'joint' && d.type === 'photo').length === 0 && 
                         documents.filter(d => d.belongsTo === 'joint' && d.type === 'photo').length === 0 && (
                          <p className="text-sm text-gray-400 italic">No joint photograph uploaded yet</p>
                        )}
                      </>
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

  // Save draft without validation (allow partial saves)
  const saveDraftWithoutValidation = async () => {
    if (isSubmitted) {
      showToast('Application has been submitted and cannot be edited', 'info');
      return;
    }
    try {
      setIsSaving(true);
      if (currentStep === 0) {
        const data = groomForm.getValues();
        await updateDraft({
          userDetails: {
            firstName: data.firstName || (application?.userDetails as any)?.firstName || '',
            lastName: data.lastName || (application?.userDetails as any)?.lastName || '',
            fatherName: data.fatherName || (application?.userDetails as any)?.fatherName || '',
            dateOfBirth: data.dateOfBirth || (application?.userDetails as any)?.dateOfBirth || '',
            aadhaarNumber: data.aadhaarNumber || (application?.userDetails as any)?.aadhaarNumber || '',
            mobileNumber: data.mobileNumber || (application?.userDetails as any)?.mobileNumber || '',
          },
          userAddress: {
            villageStreet: data.permanentVillageStreet || ((application?.userAddress as any)?.villageStreet || application?.userAddress?.street || ''),
            postOffice: data.permanentPostOffice || (application?.userAddress as any)?.postOffice || '',
            policeStation: data.permanentPoliceStation || (application?.userAddress as any)?.policeStation || '',
            district: data.permanentDistrict || ((application?.userAddress as any)?.district || application?.userAddress?.city || ''),
            state: data.permanentState || application?.userAddress?.state || '',
            zipCode: data.permanentZipCode || application?.userAddress?.zipCode || '',
            country: data.permanentCountry || application?.userAddress?.country || 'India',
          },
          userCurrentAddress: {
            villageStreet: data.currentVillageStreet || ((application?.userCurrentAddress as any)?.villageStreet || application?.userCurrentAddress?.street || ''),
            postOffice: data.currentPostOffice || (application?.userCurrentAddress as any)?.postOffice || '',
            policeStation: data.currentPoliceStation || (application?.userCurrentAddress as any)?.policeStation || '',
            district: data.currentDistrict || ((application?.userCurrentAddress as any)?.district || application?.userCurrentAddress?.city || ''),
            state: data.currentState || application?.userCurrentAddress?.state || '',
            zipCode: data.currentZipCode || application?.userCurrentAddress?.zipCode || '',
            country: data.currentCountry || application?.userCurrentAddress?.country || 'India',
          },
          declarations: {
            ...(application?.declarations || {}),
            marriageDate: data.marriageDate || (application?.declarations as any)?.marriageDate || '',
          },
        });
        // Refresh application to ensure form values are synced
        await refreshApplication();
        // Reset form with updated values including marriage date
        const updatedGroomData = {
          ...groomForm.getValues(),
          marriageDate: data.marriageDate || (application?.declarations as any)?.marriageDate || '',
        };
        groomForm.reset(updatedGroomData);
        showToast('Draft saved', 'success');
      } else if (currentStep === 1) {
        const data = brideForm.getValues();
        await updateDraft({
          partnerForm: {
            firstName: data.firstName || application?.partnerForm?.firstName || '',
            lastName: data.lastName || application?.partnerForm?.lastName || '',
            fatherName: data.fatherName || (application?.partnerForm as any)?.fatherName || '',
            dateOfBirth: data.dateOfBirth || application?.partnerForm?.dateOfBirth || '',
            idNumber: data.aadhaarNumber || ((application?.partnerForm as any)?.aadhaarNumber || (application?.partnerForm as any)?.idNumber || ''),
            aadhaarNumber: data.aadhaarNumber || ((application?.partnerForm as any)?.aadhaarNumber || (application?.partnerForm as any)?.idNumber || ''),
            mobileNumber: data.mobileNumber || (application?.partnerForm as any)?.mobileNumber || '',
            address: {
              villageStreet: data.permanentVillageStreet || ((application?.partnerAddress as any)?.villageStreet || application?.partnerAddress?.street || ''),
              postOffice: data.permanentPostOffice || (application?.partnerAddress as any)?.postOffice || '',
              policeStation: data.permanentPoliceStation || (application?.partnerAddress as any)?.policeStation || '',
              district: data.permanentDistrict || ((application?.partnerAddress as any)?.district || application?.partnerAddress?.city || ''),
              state: data.permanentState || application?.partnerAddress?.state || '',
              zipCode: data.permanentZipCode || application?.partnerAddress?.zipCode || '',
              country: data.permanentCountry || application?.partnerAddress?.country || 'India',
            },
          },
          partnerAddress: {
            villageStreet: data.permanentVillageStreet || ((application?.partnerAddress as any)?.villageStreet || application?.partnerAddress?.street || ''),
            postOffice: data.permanentPostOffice || (application?.partnerAddress as any)?.postOffice || '',
            policeStation: data.permanentPoliceStation || (application?.partnerAddress as any)?.policeStation || '',
            district: data.permanentDistrict || ((application?.partnerAddress as any)?.district || application?.partnerAddress?.city || ''),
            state: data.permanentState || application?.partnerAddress?.state || '',
            zipCode: data.permanentZipCode || application?.partnerAddress?.zipCode || '',
            country: data.permanentCountry || application?.partnerAddress?.country || 'India',
          },
          partnerCurrentAddress: {
            villageStreet: data.currentVillageStreet || ((application?.partnerCurrentAddress as any)?.villageStreet || application?.partnerCurrentAddress?.street || ''),
            postOffice: data.currentPostOffice || (application?.partnerCurrentAddress as any)?.postOffice || '',
            policeStation: data.currentPoliceStation || (application?.partnerCurrentAddress as any)?.policeStation || '',
            district: data.currentDistrict || ((application?.partnerCurrentAddress as any)?.district || application?.partnerCurrentAddress?.city || ''),
            state: data.currentState || application?.partnerCurrentAddress?.state || '',
            zipCode: data.currentZipCode || application?.partnerCurrentAddress?.zipCode || '',
            country: data.currentCountry || application?.partnerCurrentAddress?.country || 'India',
          },
        });
        showToast('Draft saved', 'success');
      } else if (currentStep === 2) {
        // Documents step - upload any documents that haven't been saved yet
        if (application && documents.length > 0) {
          try {
            // Upload all documents that are in the documents array (unsaved ones)
            for (const doc of documents) {
              await documentService.uploadDocument(application.id, doc.file, doc.type, doc.belongsTo);
            }
            // Clear the documents array after successful upload
            setDocuments([]);
            // Refresh application to get updated documents list
            await refreshApplication();
            showToast('Draft saved. Documents uploaded successfully.', 'success');
          } catch (error: any) {
            console.error('Failed to upload documents:', error);
            const errorMessage = error?.message || 'Failed to upload documents. Please try again.';
            showToast(errorMessage, 'error');
            throw error; // Re-throw to prevent showing success message
          }
        } else {
          showToast('Draft saved', 'success');
        }
      } else if (currentStep === 3) {
        const data = declarationsForm.getValues();
        await updateDraft({
          declarations: {
            ...(application?.declarations || {}), // Preserve existing fields like marriageDate
            consent: data.consent || false,
            accuracy: data.accuracy || false,
            legal: data.legal || false,
          },
        });
        showToast('Draft saved', 'success');
      }
    } catch (error: any) {
      console.error('Failed to save draft:', error);
      const errorMessage = error.message || 'Failed to save. Please try again.';
      showToast(errorMessage, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle exit
  const handleExit = () => {
    if (hasUnsavedChanges) {
      setShowExitConfirm(true);
    } else {
      navigate('/dashboard');
    }
  };

  // Handle exit after saving
  const handleExitAfterSave = async () => {
    await saveDraftWithoutValidation();
    setShowExitConfirm(false);
    navigate('/dashboard');
  };

  return (
    <>
      {/* Exit Confirmation Alert - Top Banner */}
      {showExitConfirm && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-rose-50 border-b-2 border-rose-300 shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                  <h3 className="font-semibold text-rose-900 text-lg">Unsaved Changes</h3>
                </div>
                <p className="text-rose-800 mb-3">
                  You have unsaved changes. If you exit now, your changes will not be saved.
                </p>
                <p className="text-sm text-rose-700 mb-3">
                  Would you like to save your progress as a draft before exiting?
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowExitConfirm(false);
                      navigate('/dashboard');
                    }}
                    className="border-rose-300 text-rose-700 hover:bg-rose-100"
                  >
                    Exit Without Saving
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleExitAfterSave}
                    isLoading={isSaving}
                    className="bg-rose-600 hover:bg-rose-700"
                  >
                    <Save size={18} className="mr-2" />
                    Save Draft & Exit
                  </Button>
                </div>
              </div>
              <button
                onClick={() => setShowExitConfirm(false)}
                className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-100 rounded-lg transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className={`max-w-4xl mx-auto px-6 py-8 ${showExitConfirm ? 'pt-40' : ''}`}>
        <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-4xl font-bold text-gray-900 mb-2">Marriage Registration Application</h1>
          <p className="text-gray-600">Complete all steps to submit your application</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExit}
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
        >
          <LogOut size={18} />
          <span>Exit</span>
        </Button>
      </div>

      <Stepper
        steps={applicationSteps}
        currentStep={currentStep}
        completedSteps={Array.from({ length: currentStep }, (_, i) => i)}
        className="mb-8"
      />

      <Card className="p-8">
        {renderStep()}

        {/* Document Preview Modal */}
        {previewDocument && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={closePreview}>
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
                <h3 className="font-semibold text-gray-900">
                  {getDocumentTypeLabel(previewDocument.type)}: {previewDocument.file?.name || (previewDocument as any).name || 'Document'}
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const urlToDownload = previewUrl || (previewDocument as any).url;
                      if (urlToDownload) {
                        window.open(urlToDownload, '_blank');
                      }
                    }}
                  >
                    <Download size={18} className="mr-2" />
                    Download
                  </Button>
                  <Button variant="ghost" size="sm" onClick={closePreview}>
                    <X size={18} />
                  </Button>
                </div>
              </div>
              <div className="p-6">
                {isLoadingPreview ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold-500"></div>
                  </div>
                ) : previewUrl ? (
                  <>
                    {isImage(previewDocument.file?.type || (previewDocument as any).mimeType) ? (
                      <img
                        src={previewUrl}
                        alt={previewDocument.file?.name || (previewDocument as any).name || 'Document'}
                        className="max-w-full h-auto rounded-lg shadow-lg mx-auto"
                        onError={(e) => {
                          console.error('Failed to load image:', e);
                          const fallbackUrl = (previewDocument as any).url;
                          if (fallbackUrl) {
                            (e.target as HTMLImageElement).src = fallbackUrl;
                          }
                        }}
                      />
                    ) : isPDF(previewDocument.file?.type || (previewDocument as any).mimeType) || 
                         (previewDocument.file?.name || (previewDocument as any).name || '').toLowerCase().endsWith('.pdf') ? (
                      <iframe
                        src={previewUrl}
                        className="w-full h-[70vh] rounded-lg border border-gray-200"
                        title={previewDocument.file?.name || (previewDocument as any).name || 'Document'}
                        onError={() => {
                          console.error('Failed to load PDF');
                        }}
                      />
                    ) : (
                      <div className="text-center py-12">
                        <FileText size={48} className="text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-4">Preview not available for this file type</p>
                        <Button variant="primary" onClick={() => window.open(previewUrl, '_blank')}>
                          <Download size={18} className="mr-2" />
                          Download to View
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <FileText size={48} className="text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">Failed to load document preview</p>
                    {(previewDocument as any).url && (
                      <Button variant="primary" onClick={() => window.open((previewDocument as any).url, '_blank')}>
                        <Download size={18} className="mr-2" />
                        Download to View
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
              onClick={saveDraftWithoutValidation}
              isLoading={isSaving}
            >
              <Save size={18} className="mr-2" />
              Save Draft
            </Button>
            <Button
              variant="primary"
              onClick={handleNextClick}
              isLoading={isSaving}
              disabled={
                (currentStep === applicationSteps.length - 1 && (application?.status === 'submitted' || application?.status === 'approved' || application?.status === 'under_review')) ||
                (!isCurrentStepValid && !isSubmitted)
              }
              className={!isCurrentStepValid && !isSubmitted ? 'opacity-40 cursor-not-allowed bg-gray-400 hover:bg-gray-400' : ''}
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
    </>
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
