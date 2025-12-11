import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../contexts/AuthContext';
import { ApplicationProvider, useApplication } from '../../contexts/ApplicationContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useTranslation } from '../../hooks/useTranslation';
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
import ApplicationSuccessModal from '../../components/ApplicationSuccessModal';
import StateDistrictSelector from '../../components/StateDistrictSelector';
import { ArrowRight, ArrowLeft, Save, Upload, X, FileText, Edit, CheckCircle, Eye, Download, LogOut } from 'lucide-react';
import ImageCropModal from '../../components/ui/ImageCropModal';

// Groom Details Schema (User personal + address)
const groomSchema = z.object({
  // Personal details
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().optional(),
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
  lastName: z.string().optional(),
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
  const location = useLocation();
  const { user } = useAuth();
  const { application, updateDraft, submitApplication, isLoading, refreshApplication } = useApplication();
  const { showToast } = useNotification();
  const { t } = useTranslation('application');
  
  // Detect if we're in admin context by checking the current route
  const isAdminContext = location.pathname.startsWith('/admin');
  
  const applicationSteps = [
    { id: 'groom', label: t('steps.groom') },
    { id: 'bride', label: t('steps.bride') },
    { id: 'documents', label: t('steps.documents') },
    { id: 'declarations', label: t('steps.declarations') },
    { id: 'review', label: t('steps.review') },
  ];
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [applicationDocuments, setApplicationDocuments] = useState<any[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<DocumentFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [pendingCropFile, setPendingCropFile] = useState<{ file: File; type: 'aadhaar' | 'tenth_certificate' | 'voter_id' | 'photo'; belongsTo: 'user' | 'partner' | 'joint' } | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
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
      // For proxy/offline applications (admin context), don't use admin's name - only use saved application data
      // For regular applications, use user's name as fallback
      // Use isAdminContext OR isProxyApplication to detect proxy apps (isAdminContext is more reliable on initial load)
      firstName: (application?.userDetails as any)?.firstName || (isAdminContext || application?.isProxyApplication ? '' : (user?.name?.split(' ')[0] || '')),
      lastName: (application?.userDetails as any)?.lastName || (isAdminContext || application?.isProxyApplication ? '' : (user?.name?.split(' ').slice(1).join(' ') || '')),
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
      // For proxy/offline applications (admin context), don't use admin's name - only use saved application data
      const groomData = {
        firstName: (application?.userDetails as any)?.firstName || (isAdminContext || application?.isProxyApplication ? '' : (user?.name?.split(' ')[0] || '')),
        lastName: (application?.userDetails as any)?.lastName || (isAdminContext || application?.isProxyApplication ? '' : (user?.name?.split(' ').slice(1).join(' ') || '')),
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
  // Only reload if we don't already have documents loaded to avoid clearing unsaved documents
  useEffect(() => {
    if (application && (currentStep === 2 || currentStep === 4)) {
      const loadDocuments = async () => {
        // Only show loading if we don't have any documents loaded yet
        if (applicationDocuments.length === 0) {
          setIsLoadingDocuments(true);
        }
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
      
      // Check if groom details are filled (lastName is optional)
      const groomDetailsFilled = application.userDetails?.firstName && application.userDetails?.fatherName &&
                                 application.userDetails?.dateOfBirth && application.userDetails?.aadhaarNumber && application.userDetails?.mobileNumber &&
                                 (application.userAddress?.villageStreet || application.userAddress?.street) && application.userAddress?.postOffice && application.userAddress?.policeStation &&
                                 (application.userAddress?.district || application.userAddress?.city) && application.userAddress?.state && application.userAddress?.zipCode && application.userAddress?.country &&
                                 (application.userCurrentAddress?.villageStreet || application.userCurrentAddress?.street) && application.userCurrentAddress?.postOffice && application.userCurrentAddress?.policeStation &&
                                 (application.userCurrentAddress?.district || application.userCurrentAddress?.city) && application.userCurrentAddress?.state && application.userCurrentAddress?.zipCode && application.userCurrentAddress?.country &&
                                 application.declarations?.marriageDate;
      
      if (!groomDetailsFilled) {
        calculatedStep = 0;
      } else {
        // Check if bride details are filled (lastName is optional)
        const brideDetailsFilled = application.partnerForm?.firstName && application.partnerForm?.fatherName &&
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
      // Check if all required groom form fields are filled (lastName is optional)
      const values = groomFormValues;
      return !!(
        values.firstName?.trim() && 
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
      // Check if all required bride form fields are filled (lastName is optional)
      const values = brideFormValues;
      return !!(
        values.firstName?.trim() && 
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
            const uploadedDocs: string[] = [];
            for (const doc of documents) {
              await documentService.uploadDocument(application.id, doc.file, doc.type, doc.belongsTo);
              uploadedDocs.push(doc.id);
            }
            showToast('Documents uploaded successfully!', 'success');
            
            // Only clear documents that were successfully uploaded
            setDocuments(prevDocs => prevDocs.filter(doc => !uploadedDocs.includes(doc.id)));
            
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
      setShowSuccessModal(true);
    } catch (error) {
      showToast('Failed to submit application. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper function to check if a document already exists (either unsaved or saved)
  const documentExists = (type: 'aadhaar' | 'tenth_certificate' | 'voter_id' | 'photo', belongsTo: 'user' | 'partner' | 'joint') => {
    // Check if document exists in unsaved documents
    const existsInUnsaved = documents.some(d => d.belongsTo === belongsTo && d.type === type);
    
    // Check if document exists in saved documents
    const existsInSaved = applicationDocuments.some(d => d.belongsTo === belongsTo && d.type === type);
    
    return existsInUnsaved || existsInSaved;
  };

  // Helper function to check if either tenth_certificate or voter_id exists (for second document)
  const secondDocumentExists = (belongsTo: 'user' | 'partner') => {
    const existsInUnsaved = documents.some(d => d.belongsTo === belongsTo && (d.type === 'tenth_certificate' || d.type === 'voter_id'));
    const existsInSaved = applicationDocuments.some(d => d.belongsTo === belongsTo && (d.type === 'tenth_certificate' || d.type === 'voter_id'));
    return existsInUnsaved || existsInSaved;
  };

  // Maximum file size: 500KB
  const MAX_FILE_SIZE = 500 * 1024; // 500KB in bytes

  const handleFileUpload = (file: File, type: 'aadhaar' | 'tenth_certificate' | 'voter_id' | 'photo', belongsTo: 'user' | 'partner' | 'joint') => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      showToast(`File size exceeds 500KB limit. Please compress or resize the image before uploading.`, 'error');
      return;
    }

    // Check if document already exists
    if (documentExists(type, belongsTo)) {
      showToast(`A ${getDocumentTypeLabel(type)} has already been uploaded. Please remove the existing document first.`, 'error');
      return;
    }

    // Show crop modal for joint photos
    if (type === 'photo' && belongsTo === 'joint') {
      setPendingCropFile({ file, type, belongsTo });
      setCropModalOpen(true);
      return;
    }

    const newDoc: DocumentFile = {
      id: `doc-${Date.now()}-${Math.random()}`,
      file,
      type,
      belongsTo,
    };
    setDocuments([...documents.filter(d => !(d.belongsTo === belongsTo && d.type === type)), newDoc]);
  };

  const handleCropComplete = (croppedFile: File) => {
    if (!pendingCropFile) return;

    // Check file size again after cropping
    if (croppedFile.size > MAX_FILE_SIZE) {
      showToast(`Cropped file size exceeds 500KB limit. Please try again with a smaller image.`, 'error');
      setPendingCropFile(null);
      setCropModalOpen(false);
      return;
    }

    // Create document with cropped file
    const newDoc: DocumentFile = {
      id: `doc-${Date.now()}-${Math.random()}`,
      file: croppedFile,
      type: pendingCropFile.type,
      belongsTo: pendingCropFile.belongsTo,
    };
    setDocuments([...documents.filter(d => !(d.belongsTo === pendingCropFile.belongsTo && d.type === pendingCropFile.type)), newDoc]);

    setPendingCropFile(null);
    setCropModalOpen(false);
  };

  const handleCropSkip = () => {
    if (!pendingCropFile) return;

    // Use original file
    const newDoc: DocumentFile = {
      id: `doc-${Date.now()}-${Math.random()}`,
      file: pendingCropFile.file,
      type: pendingCropFile.type,
      belongsTo: pendingCropFile.belongsTo,
    };
    setDocuments([...documents.filter(d => !(d.belongsTo === pendingCropFile.belongsTo && d.type === pendingCropFile.type)), newDoc]);

    setPendingCropFile(null);
    setCropModalOpen(false);
  };

  const handleRemoveDocument = (id: string) => {
    setDocuments(documents.filter(d => d.id !== id));
  };

  // Handle removing saved documents (from applicationDocuments)
  const handleRemoveSavedDocument = async (type: 'aadhaar' | 'tenth_certificate' | 'voter_id' | 'photo', belongsTo: 'user' | 'partner' | 'joint') => {
    if (!application) return;
    
    try {
      const docToRemove = applicationDocuments.find(d => d.belongsTo === belongsTo && d.type === type);
      if (docToRemove && docToRemove.id) {
        await documentService.deleteDocument(docToRemove.id);
        setApplicationDocuments(applicationDocuments.filter(d => !(d.belongsTo === belongsTo && d.type === type)));
        showToast('Document removed successfully', 'success');
      }
    } catch (error) {
      console.error('Failed to remove document:', error);
      showToast('Failed to remove document. Please try again.', 'error');
    }
  };

  const handlePreviewDocument = async (doc: DocumentFile | any) => {
    console.log('Preview clicked, document:', doc);
    setPreviewDocument(doc);
    setIsLoadingPreview(true);
    setPreviewUrl(null);
    
    try {
      if ('file' in doc && doc.file instanceof File) {
        // For local files (not yet uploaded)
        const url = URL.createObjectURL(doc.file);
        console.log('Created blob URL for file:', url);
        setPreviewUrl(url);
        setIsLoadingPreview(false);
      } else if ('url' in doc && doc.url) {
        // For already uploaded documents - try to get signed URL
        if (doc.id && application) {
          try {
            const signedUrl = await documentService.getSignedUrl(doc.id);
            console.log('Got signed URL:', signedUrl);
            setPreviewUrl(signedUrl);
          } catch (error) {
            console.error('Failed to get signed URL, using original:', error);
            // Fallback to original URL
            setPreviewUrl(doc.url);
          }
        } else {
          console.log('Using original URL:', doc.url);
          setPreviewUrl(doc.url);
        }
        setIsLoadingPreview(false);
      } else if (doc instanceof File) {
        // Direct file object
        const url = URL.createObjectURL(doc);
        console.log('Created blob URL for direct file:', url);
        setPreviewUrl(url);
        setIsLoadingPreview(false);
      } else {
        console.error('Unknown document type:', doc);
        setIsLoadingPreview(false);
      }
    } catch (error) {
      console.error('Failed to load preview:', error);
      if ('url' in doc && doc.url) {
        setPreviewUrl(doc.url);
      }
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
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            <div>
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-2 sm:mb-3 lg:mb-4">Groom Personal Details</h3>
              <div className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
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

            <div className="pt-4 sm:pt-5 lg:pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-2 sm:mb-3 lg:mb-4">Groom Permanent Address</h3>
              <div className="space-y-3 sm:space-y-4">
                <Input
                  label="Village/Street"
                  {...groomForm.register('permanentVillageStreet')}
                  disabled={isSubmitted}
                  error={groomForm.formState.errors.permanentVillageStreet?.message}
                  required
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
                  <StateDistrictSelector
                    stateValue={groomForm.watch('permanentState') || ''}
                    districtValue={groomForm.watch('permanentDistrict') || ''}
                    stateRegister={groomForm.register('permanentState')}
                    districtRegister={groomForm.register('permanentDistrict')}
                    setValue={groomForm.setValue}
                    stateError={groomForm.formState.errors.permanentState?.message}
                    districtError={groomForm.formState.errors.permanentDistrict?.message}
                    disabled={isSubmitted}
                    stateLabel="State"
                    districtLabel="District"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
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

              <div className="pt-4 sm:pt-5 lg:pt-6 border-t border-gray-200 mt-4 sm:mt-5 lg:mt-6">
                <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-2 sm:mb-3 lg:mb-4">Groom Current Address</h3>
                <div className="mb-3 sm:mb-4">
                  <Checkbox
                    label="Same as permanent address"
                    checked={groomSameAsPermanent || false}
                    onChange={(e) => groomForm.setValue('sameAsPermanent', e.target.checked)}
                  />
                </div>
                <div className="space-y-3 sm:space-y-4">
                  <Input
                    label="Village/Street"
                    {...groomForm.register('currentVillageStreet')}
                    disabled={isSubmitted || groomSameAsPermanent}
                    error={groomForm.formState.errors.currentVillageStreet?.message}
                    required
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
                    <StateDistrictSelector
                      stateValue={groomForm.watch('currentState') || ''}
                      districtValue={groomForm.watch('currentDistrict') || ''}
                      stateRegister={groomForm.register('currentState')}
                      districtRegister={groomForm.register('currentDistrict')}
                      setValue={groomForm.setValue}
                      stateError={groomForm.formState.errors.currentState?.message}
                      districtError={groomForm.formState.errors.currentDistrict?.message}
                      disabled={isSubmitted || groomSameAsPermanent}
                      stateLabel="State"
                      districtLabel="District"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
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

            <div className="pt-4 sm:pt-5 lg:pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-2 sm:mb-3 lg:mb-4">Marriage Date</h3>
              <div className="space-y-3 sm:space-y-4">
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
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            <div>
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-2 sm:mb-3 lg:mb-4">Bride Personal Details</h3>
              <div className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
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

            <div className="pt-4 sm:pt-5 lg:pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-2 sm:mb-3 lg:mb-4">Bride Permanent Address</h3>
              <div className="space-y-3 sm:space-y-4">
                <Input
                  label="Village/Street"
                  {...brideForm.register('permanentVillageStreet')}
                  disabled={isSubmitted}
                  error={brideForm.formState.errors.permanentVillageStreet?.message}
                  required
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
                  <StateDistrictSelector
                    stateValue={brideForm.watch('permanentState') || ''}
                    districtValue={brideForm.watch('permanentDistrict') || ''}
                    stateRegister={brideForm.register('permanentState')}
                    districtRegister={brideForm.register('permanentDistrict')}
                    setValue={brideForm.setValue}
                    stateError={brideForm.formState.errors.permanentState?.message}
                    districtError={brideForm.formState.errors.permanentDistrict?.message}
                    disabled={isSubmitted}
                    stateLabel="State"
                    districtLabel="District"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
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

              <div className="pt-4 sm:pt-5 lg:pt-6 border-t border-gray-200 mt-4 sm:mt-5 lg:mt-6">
                <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-2 sm:mb-3 lg:mb-4">Bride Current Address</h3>
                <div className="mb-3 sm:mb-4">
                  <Checkbox
                    label="Same as permanent address"
                    checked={brideSameAsPermanent || false}
                    onChange={(e) => brideForm.setValue('sameAsPermanent', e.target.checked)}
                  />
                </div>
                <div className="space-y-3 sm:space-y-4">
                  <Input
                    label="Village/Street"
                    {...brideForm.register('currentVillageStreet')}
                    disabled={isSubmitted || brideSameAsPermanent}
                    error={brideForm.formState.errors.currentVillageStreet?.message}
                    required
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
                    <StateDistrictSelector
                      stateValue={brideForm.watch('currentState') || ''}
                      districtValue={brideForm.watch('currentDistrict') || ''}
                      stateRegister={brideForm.register('currentState')}
                      districtRegister={brideForm.register('currentDistrict')}
                      setValue={brideForm.setValue}
                      stateError={brideForm.formState.errors.currentState?.message}
                      districtError={brideForm.formState.errors.currentDistrict?.message}
                      disabled={isSubmitted || brideSameAsPermanent}
                      stateLabel="State"
                      districtLabel="District"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
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
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            <div>
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1 sm:mb-2">Groom's Documents</h3>
              <p className="text-[10px] sm:text-xs text-gray-600 mb-1">Upload Aadhaar card + 10th certificate or Voter ID</p>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-3 sm:mb-4 lg:mb-6">
                <span className="text-gold-600 font-medium">Max file size: 500KB</span> per document
              </p>
              
              {isLoadingDocuments && (
                <div className="flex items-center justify-center py-3 sm:py-4 mb-3 sm:mb-4 bg-gray-50 rounded-lg">
                  <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-t-2 border-b-2 border-gold-500"></div>
                  <span className="ml-2 text-[10px] sm:text-xs text-gray-500">Loading...</span>
                </div>
              )}
              
              {/* Show saved documents from database */}
              {!isLoadingDocuments && applicationDocuments.filter(d => d.belongsTo === 'user').length > 0 && (
                <div className="mb-3 sm:mb-4 p-2.5 sm:p-4 bg-gray-50 rounded-lg">
                  <p className="text-[10px] sm:text-xs font-medium text-gray-700 mb-1.5 sm:mb-2">Previously Saved:</p>
                  <div className="space-y-1.5 sm:space-y-2">
                    {applicationDocuments
                      .filter(d => d.belongsTo === 'user')
                      .map(doc => (
                        <div key={doc.id} className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-gray-600">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="cursor-pointer hover:text-gray-900 truncate flex-1" onClick={(e) => { e.stopPropagation(); handlePreviewDocument(doc); }}>
                            {doc.type === 'aadhaar' && 'Aadhaar'}
                            {doc.type === 'tenth_certificate' && '10th Cert'}
                            {doc.type === 'voter_id' && 'Voter ID'}
                            : {doc.name}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handlePreviewDocument(doc);
                            }}
                            className="text-blue-600 hover:text-blue-700 p-0.5 sm:p-1 flex-shrink-0"
                            title="Preview"
                            type="button"
                          >
                            <Eye size={12} className="sm:w-4 sm:h-4" />
                          </button>
                          <CheckCircle size={12} className="sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
                        </div>
                      ))}
                  </div>
                </div>
              )}
              
              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    Aadhaar Card <span className="text-rose-600">*</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:gap-4">
                    {!documentExists('aadhaar', 'user') && (
                      <>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file, 'aadhaar', 'user');
                            // Reset input to allow selecting the same file again if needed
                            e.target.value = '';
                          }}
                          className="hidden"
                          id="user-aadhaar"
                        />
                        <label
                          htmlFor="user-aadhaar"
                          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 lg:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-xs sm:text-sm"
                        >
                          <Upload size={14} className="sm:w-[18px] sm:h-[18px]" />
                          <span>Choose</span>
                        </label>
                      </>
                    )}
                    {/* Show unsaved document */}
                    {documents.find(d => d.belongsTo === 'user' && d.type === 'aadhaar') && (() => {
                      const doc = documents.find(d => d.belongsTo === 'user' && d.type === 'aadhaar')!;
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="cursor-pointer hover:text-gray-900 truncate max-w-[120px] sm:max-w-[180px]" onClick={(e) => { e.stopPropagation(); handlePreviewDocument(doc); }}>
                            {doc.file.name}
                          </span>
                          <button
                            onClick={() => handlePreviewDocument(doc)}
                            className="text-blue-600 hover:text-blue-700 p-0.5 flex-shrink-0"
                            title="Preview"
                          >
                            <Eye size={12} className="sm:w-4 sm:h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveDocument(doc.id)}
                            className="text-rose-600 hover:text-rose-700 p-0.5 flex-shrink-0"
                            title="Remove"
                          >
                            <X size={12} className="sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      );
                    })()}
                    {/* Show saved document */}
                    {applicationDocuments.find(d => d.belongsTo === 'user' && d.type === 'aadhaar') && (() => {
                      const doc = applicationDocuments.find(d => d.belongsTo === 'user' && d.type === 'aadhaar')!;
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="cursor-pointer hover:text-gray-900 truncate max-w-[120px] sm:max-w-[180px]" onClick={(e) => { e.stopPropagation(); handlePreviewDocument(doc); }}>
                            {doc.name || 'Aadhaar Card'}
                          </span>
                          <button
                            onClick={() => handlePreviewDocument(doc)}
                            className="text-blue-600 hover:text-blue-700 p-0.5 flex-shrink-0"
                            title="Preview"
                          >
                            <Eye size={12} className="sm:w-4 sm:h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveSavedDocument('aadhaar', 'user')}
                            className="text-rose-600 hover:text-rose-700 p-0.5 flex-shrink-0"
                            title="Remove"
                          >
                            <X size={12} className="sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    10th Certificate / Voter ID <span className="text-rose-600">*</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:gap-4">
                    {!secondDocumentExists('user') && (
                      <>
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
                            // Reset input to allow selecting the same file again if needed
                            e.target.value = '';
                          }}
                          className="hidden"
                          id="user-second-doc"
                        />
                        <label
                          htmlFor="user-second-doc"
                          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 lg:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-xs sm:text-sm"
                        >
                          <Upload size={14} className="sm:w-[18px] sm:h-[18px]" />
                          <span>Choose</span>
                        </label>
                      </>
                    )}
                    {/* Show unsaved document */}
                    {documents.find(d => d.belongsTo === 'user' && (d.type === 'tenth_certificate' || d.type === 'voter_id')) && (() => {
                      const doc = documents.find(d => d.belongsTo === 'user' && (d.type === 'tenth_certificate' || d.type === 'voter_id'))!;
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="cursor-pointer hover:text-gray-900 truncate max-w-[120px] sm:max-w-[180px]" onClick={(e) => { e.stopPropagation(); handlePreviewDocument(doc); }}>
                            {doc.file.name}
                          </span>
                          <button
                            onClick={() => handlePreviewDocument(doc)}
                            className="text-blue-600 hover:text-blue-700 p-0.5 flex-shrink-0"
                            title="Preview"
                          >
                            <Eye size={12} className="sm:w-4 sm:h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveDocument(doc.id)}
                            className="text-rose-600 hover:text-rose-700 p-0.5 flex-shrink-0"
                            title="Remove"
                          >
                            <X size={12} className="sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      );
                    })()}
                    {/* Show saved document */}
                    {applicationDocuments.find(d => d.belongsTo === 'user' && (d.type === 'tenth_certificate' || d.type === 'voter_id')) && (() => {
                      const doc = applicationDocuments.find(d => d.belongsTo === 'user' && (d.type === 'tenth_certificate' || d.type === 'voter_id'))!;
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="cursor-pointer hover:text-gray-900 truncate max-w-[120px] sm:max-w-[180px]" onClick={(e) => { e.stopPropagation(); handlePreviewDocument(doc); }}>
                            {doc.name || (doc.type === 'tenth_certificate' ? '10th Certificate' : 'Voter ID')}
                          </span>
                          <button
                            onClick={() => handlePreviewDocument(doc)}
                            className="text-blue-600 hover:text-blue-700 p-0.5 flex-shrink-0"
                            title="Preview"
                          >
                            <Eye size={12} className="sm:w-4 sm:h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveSavedDocument(doc.type as 'tenth_certificate' | 'voter_id', 'user')}
                            className="text-rose-600 hover:text-rose-700 p-0.5 flex-shrink-0"
                            title="Remove"
                          >
                            <X size={12} className="sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 sm:pt-5 lg:pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1 sm:mb-2">Bride's Documents</h3>
              <p className="text-[10px] sm:text-xs text-gray-600 mb-1">Upload Aadhaar card + 10th certificate or Voter ID</p>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-3 sm:mb-4 lg:mb-6">
                <span className="text-gold-600 font-medium">Max file size: 500KB</span> per document
              </p>
              
              {isLoadingDocuments && (
                <div className="flex items-center justify-center py-3 sm:py-4 mb-3 sm:mb-4 bg-gray-50 rounded-lg">
                  <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-t-2 border-b-2 border-gold-500"></div>
                  <span className="ml-2 text-[10px] sm:text-xs text-gray-500">Loading...</span>
                </div>
              )}
              
              {/* Show saved documents from database */}
              {!isLoadingDocuments && applicationDocuments.filter(d => d.belongsTo === 'partner').length > 0 && (
                <div className="mb-3 sm:mb-4 p-2.5 sm:p-4 bg-gray-50 rounded-lg">
                  <p className="text-[10px] sm:text-xs font-medium text-gray-700 mb-1.5 sm:mb-2">Previously Saved:</p>
                  <div className="space-y-1.5 sm:space-y-2">
                    {applicationDocuments
                      .filter(d => d.belongsTo === 'partner')
                      .map(doc => (
                        <div key={doc.id} className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-gray-600">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="cursor-pointer hover:text-gray-900 truncate flex-1" onClick={(e) => { e.stopPropagation(); handlePreviewDocument(doc); }}>
                            {doc.type === 'aadhaar' && 'Aadhaar'}
                            {doc.type === 'tenth_certificate' && '10th Cert'}
                            {doc.type === 'voter_id' && 'Voter ID'}
                            : {doc.name}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handlePreviewDocument(doc);
                            }}
                            className="text-blue-600 hover:text-blue-700 p-0.5 sm:p-1 flex-shrink-0"
                            title="Preview"
                            type="button"
                          >
                            <Eye size={12} className="sm:w-4 sm:h-4" />
                          </button>
                          <CheckCircle size={12} className="sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
                        </div>
                      ))}
                  </div>
                </div>
              )}
              
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    Aadhaar Card <span className="text-rose-600">*</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:gap-4">
                    {!documentExists('aadhaar', 'partner') && (
                      <>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file, 'aadhaar', 'partner');
                            // Reset input to allow selecting the same file again if needed
                            e.target.value = '';
                          }}
                          className="hidden"
                          id="partner-aadhaar"
                        />
                        <label
                          htmlFor="partner-aadhaar"
                          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 lg:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-xs sm:text-sm"
                        >
                          <Upload size={14} className="sm:w-[18px] sm:h-[18px]" />
                          <span>Choose</span>
                        </label>
                      </>
                    )}
                    {/* Show unsaved document */}
                    {documents.find(d => d.belongsTo === 'partner' && d.type === 'aadhaar') && (() => {
                      const doc = documents.find(d => d.belongsTo === 'partner' && d.type === 'aadhaar')!;
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="cursor-pointer hover:text-gray-900 truncate max-w-[120px] sm:max-w-[180px]" onClick={(e) => { e.stopPropagation(); handlePreviewDocument(doc); }}>
                            {doc.file.name}
                          </span>
                          <button
                            onClick={() => handlePreviewDocument(doc)}
                            className="text-blue-600 hover:text-blue-700 p-0.5 flex-shrink-0"
                            title="Preview"
                          >
                            <Eye size={12} className="sm:w-4 sm:h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveDocument(doc.id)}
                            className="text-rose-600 hover:text-rose-700 p-0.5 flex-shrink-0"
                            title="Remove"
                          >
                            <X size={12} className="sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      );
                    })()}
                    {/* Show saved document */}
                    {applicationDocuments.find(d => d.belongsTo === 'partner' && d.type === 'aadhaar') && (() => {
                      const doc = applicationDocuments.find(d => d.belongsTo === 'partner' && d.type === 'aadhaar')!;
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="cursor-pointer hover:text-gray-900 truncate max-w-[120px] sm:max-w-[180px]" onClick={(e) => { e.stopPropagation(); handlePreviewDocument(doc); }}>
                            {doc.name || 'Aadhaar Card'}
                          </span>
                          <button
                            onClick={() => handlePreviewDocument(doc)}
                            className="text-blue-600 hover:text-blue-700 p-0.5 flex-shrink-0"
                            title="Preview"
                          >
                            <Eye size={12} className="sm:w-4 sm:h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveSavedDocument('aadhaar', 'partner')}
                            className="text-rose-600 hover:text-rose-700 p-0.5 flex-shrink-0"
                            title="Remove"
                          >
                            <X size={12} className="sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    10th Certificate / Voter ID <span className="text-rose-600">*</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:gap-4">
                    {!secondDocumentExists('partner') && (
                      <>
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
                            // Reset input to allow selecting the same file again if needed
                            e.target.value = '';
                          }}
                          className="hidden"
                          id="partner-second-doc"
                        />
                        <label
                          htmlFor="partner-second-doc"
                          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 lg:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-xs sm:text-sm"
                        >
                          <Upload size={14} className="sm:w-[18px] sm:h-[18px]" />
                          <span>Choose</span>
                        </label>
                      </>
                    )}
                    {/* Show unsaved document */}
                    {documents.find(d => d.belongsTo === 'partner' && (d.type === 'tenth_certificate' || d.type === 'voter_id')) && (() => {
                      const doc = documents.find(d => d.belongsTo === 'partner' && (d.type === 'tenth_certificate' || d.type === 'voter_id'))!;
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="cursor-pointer hover:text-gray-900 truncate max-w-[120px] sm:max-w-[180px]" onClick={(e) => { e.stopPropagation(); handlePreviewDocument(doc); }}>
                            {doc.file.name}
                          </span>
                          <button
                            onClick={() => handlePreviewDocument(doc)}
                            className="text-blue-600 hover:text-blue-700 p-0.5 flex-shrink-0"
                            title="Preview"
                          >
                            <Eye size={12} className="sm:w-4 sm:h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveDocument(doc.id)}
                            className="text-rose-600 hover:text-rose-700 p-0.5 flex-shrink-0"
                            title="Remove"
                          >
                            <X size={12} className="sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      );
                    })()}
                    {/* Show saved document */}
                    {applicationDocuments.find(d => d.belongsTo === 'partner' && (d.type === 'tenth_certificate' || d.type === 'voter_id')) && (() => {
                      const doc = applicationDocuments.find(d => d.belongsTo === 'partner' && (d.type === 'tenth_certificate' || d.type === 'voter_id'))!;
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="cursor-pointer hover:text-gray-900 truncate max-w-[120px] sm:max-w-[180px]" onClick={(e) => { e.stopPropagation(); handlePreviewDocument(doc); }}>
                            {doc.name || (doc.type === 'tenth_certificate' ? '10th Certificate' : 'Voter ID')}
                          </span>
                          <button
                            onClick={() => handlePreviewDocument(doc)}
                            className="text-blue-600 hover:text-blue-700 p-0.5 flex-shrink-0"
                            title="Preview"
                          >
                            <Eye size={12} className="sm:w-4 sm:h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveSavedDocument(doc.type as 'tenth_certificate' | 'voter_id', 'partner')}
                            className="text-rose-600 hover:text-rose-700 p-0.5 flex-shrink-0"
                            title="Remove"
                          >
                            <X size={12} className="sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 sm:pt-5 lg:pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1 sm:mb-2">Joint Photograph</h3>
              <p className="text-[10px] sm:text-xs text-gray-600 mb-1">Upload a joint photo of bride and groom</p>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-3 sm:mb-4 lg:mb-6">
                <span className="text-gold-600 font-medium">Max file size: 500KB</span>
              </p>
              
              {isLoadingDocuments && (
                <div className="flex items-center justify-center py-3 sm:py-4 mb-3 sm:mb-4 bg-gray-50 rounded-lg">
                  <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-t-2 border-b-2 border-gold-500"></div>
                  <span className="ml-2 text-[10px] sm:text-xs text-gray-500">Loading...</span>
                </div>
              )}
              
              {/* Show saved documents from database */}
              {!isLoadingDocuments && applicationDocuments.filter(d => d.belongsTo === 'joint' && d.type === 'photo').length > 0 && (
                <div className="mb-3 sm:mb-4 p-2.5 sm:p-4 bg-gray-50 rounded-lg">
                  <p className="text-[10px] sm:text-xs font-medium text-gray-700 mb-1.5 sm:mb-2">Previously Saved:</p>
                  <div className="space-y-1.5 sm:space-y-2">
                    {applicationDocuments
                      .filter(d => d.belongsTo === 'joint' && d.type === 'photo')
                      .map(doc => (
                        <div key={doc.id} className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-gray-600">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="cursor-pointer hover:text-gray-900 truncate flex-1" onClick={(e) => { e.stopPropagation(); handlePreviewDocument(doc); }}>
                            Joint Photo: {doc.name}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handlePreviewDocument(doc);
                            }}
                            className="text-blue-600 hover:text-blue-700 p-0.5 sm:p-1 flex-shrink-0"
                            title="Preview"
                            type="button"
                          >
                            <Eye size={12} className="sm:w-4 sm:h-4" />
                          </button>
                          <CheckCircle size={12} className="sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
                        </div>
                      ))}
                  </div>
                </div>
              )}
              
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    Joint Photo <span className="text-rose-600">*</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:gap-4">
                    {!documentExists('photo', 'joint') && (
                      <>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file, 'photo', 'joint');
                            // Reset input to allow selecting the same file again if needed
                            e.target.value = '';
                          }}
                          className="hidden"
                          id="joint-photograph"
                        />
                        <label
                          htmlFor="joint-photograph"
                          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 lg:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-xs sm:text-sm"
                        >
                          <Upload size={14} className="sm:w-[18px] sm:h-[18px]" />
                          <span>Choose</span>
                        </label>
                      </>
                    )}
                    {/* Show unsaved document */}
                    {documents.find(d => d.belongsTo === 'joint' && d.type === 'photo') && (() => {
                      const doc = documents.find(d => d.belongsTo === 'joint' && d.type === 'photo')!;
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="cursor-pointer hover:text-gray-900 truncate max-w-[120px] sm:max-w-[180px]" onClick={(e) => { e.stopPropagation(); handlePreviewDocument(doc); }}>
                            {doc.file.name}
                          </span>
                          <button
                            onClick={() => handlePreviewDocument(doc)}
                            className="text-blue-600 hover:text-blue-700 p-0.5 flex-shrink-0"
                            title="Preview"
                          >
                            <Eye size={12} className="sm:w-4 sm:h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveDocument(doc.id)}
                            className="text-rose-600 hover:text-rose-700 p-0.5 flex-shrink-0"
                            title="Remove"
                          >
                            <X size={12} className="sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      );
                    })()}
                    {/* Show saved document */}
                    {applicationDocuments.find(d => d.belongsTo === 'joint' && d.type === 'photo') && (() => {
                      const doc = applicationDocuments.find(d => d.belongsTo === 'joint' && d.type === 'photo')!;
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="cursor-pointer hover:text-gray-900 truncate max-w-[120px] sm:max-w-[180px]" onClick={(e) => { e.stopPropagation(); handlePreviewDocument(doc); }}>
                            {doc.name || 'Joint Photo'}
                          </span>
                          <button
                            onClick={() => handlePreviewDocument(doc)}
                            className="text-blue-600 hover:text-blue-700 p-0.5 flex-shrink-0"
                            title="Preview"
                          >
                            <Eye size={12} className="sm:w-4 sm:h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveSavedDocument('photo', 'joint')}
                            className="text-rose-600 hover:text-rose-700 p-0.5 flex-shrink-0"
                            title="Remove"
                          >
                            <X size={12} className="sm:w-4 sm:h-4" />
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
          <div className="space-y-4 sm:space-y-5 lg:space-y-6">
            <div>
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-2 sm:mb-3 lg:mb-4">Legal Declarations</h3>
              <p className="text-[10px] sm:text-xs text-gray-600 mb-4 sm:mb-5 lg:mb-6">
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
          <div className="space-y-3 sm:space-y-4 lg:space-y-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4 lg:mb-6 gap-2">
              <h3 className="font-semibold text-sm sm:text-base text-gray-900">Review Application</h3>
              {!isSubmitted && (
                <Badge variant="info" className="!text-[10px] sm:!text-xs">Draft</Badge>
              )}
            </div>

            {/* Marriage Information */}
            <Card className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between mb-2 sm:mb-3 lg:mb-4 gap-2">
                <h4 className="font-semibold text-xs sm:text-sm text-gray-900">Marriage Info</h4>
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
            <Card className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between mb-2 sm:mb-3 lg:mb-4 gap-2">
                <h4 className="font-semibold text-xs sm:text-sm text-gray-900">Groom Details</h4>
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
            <Card className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between mb-2 sm:mb-3 lg:mb-4 gap-2">
                <h4 className="font-semibold text-xs sm:text-sm text-gray-900">Bride Details</h4>
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
            <Card className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between mb-2 sm:mb-3 lg:mb-4 gap-2">
                <h4 className="font-semibold text-xs sm:text-sm text-gray-900">Documents</h4>
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
                        <div key={doc.id} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded min-w-0">
                          <FileText size={16} className="flex-shrink-0" />
                          <span className="cursor-pointer hover:text-gray-900 truncate flex-1 min-w-0" onClick={(e) => { e.stopPropagation(); handlePreviewDocument(doc); }} title={`${doc.type === 'aadhaar' ? 'Aadhaar Card' : doc.type === 'tenth_certificate' ? '10th Certificate' : 'Voter ID'}: ${doc.name}`}>
                            {doc.type === 'aadhaar' && 'Aadhaar Card'}
                            {doc.type === 'tenth_certificate' && '10th Certificate'}
                            {doc.type === 'voter_id' && 'Voter ID'}
                            : {doc.name}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handlePreviewDocument(doc);
                            }}
                            className="text-blue-600 hover:text-blue-700 p-1 flex-shrink-0"
                            title="Preview"
                            type="button"
                          >
                            <Eye size={16} />
                          </button>
                          <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
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
                        <div key={doc.id} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded min-w-0">
                          <FileText size={16} className="flex-shrink-0" />
                          <span className="cursor-pointer hover:text-gray-900 truncate flex-1 min-w-0" onClick={(e) => { e.stopPropagation(); handlePreviewDocument(doc); }} title={`${doc.type === 'aadhaar' ? 'Aadhaar Card' : doc.type === 'tenth_certificate' ? '10th Certificate' : 'Voter ID'}: ${doc.file.name}`}>
                            {doc.type === 'aadhaar' && 'Aadhaar Card'}
                            {doc.type === 'tenth_certificate' && '10th Certificate'}
                            {doc.type === 'voter_id' && 'Voter ID'}
                            : {doc.file.name}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handlePreviewDocument(doc);
                            }}
                            className="text-blue-600 hover:text-blue-700 p-1 flex-shrink-0"
                            title="Preview"
                            type="button"
                          >
                            <Eye size={16} />
                          </button>
                          <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
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
                        <div key={doc.id} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded min-w-0">
                          <FileText size={16} className="flex-shrink-0" />
                          <span className="cursor-pointer hover:text-gray-900 truncate flex-1 min-w-0" onClick={(e) => { e.stopPropagation(); handlePreviewDocument(doc); }} title={`${doc.type === 'aadhaar' ? 'Aadhaar Card' : doc.type === 'tenth_certificate' ? '10th Certificate' : 'Voter ID'}: ${doc.name}`}>
                            {doc.type === 'aadhaar' && 'Aadhaar Card'}
                            {doc.type === 'tenth_certificate' && '10th Certificate'}
                            {doc.type === 'voter_id' && 'Voter ID'}
                            : {doc.name}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handlePreviewDocument(doc);
                            }}
                            className="text-blue-600 hover:text-blue-700 p-1 flex-shrink-0"
                            title="Preview"
                            type="button"
                          >
                            <Eye size={16} />
                          </button>
                          <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
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
                        <div key={doc.id} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded min-w-0">
                          <FileText size={16} className="flex-shrink-0" />
                          <span className="cursor-pointer hover:text-gray-900 truncate flex-1 min-w-0" onClick={(e) => { e.stopPropagation(); handlePreviewDocument(doc); }} title={`${doc.type === 'aadhaar' ? 'Aadhaar Card' : doc.type === 'tenth_certificate' ? '10th Certificate' : 'Voter ID'}: ${doc.file.name}`}>
                            {doc.type === 'aadhaar' && 'Aadhaar Card'}
                            {doc.type === 'tenth_certificate' && '10th Certificate'}
                            {doc.type === 'voter_id' && 'Voter ID'}
                            : {doc.file.name}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handlePreviewDocument(doc);
                            }}
                            className="text-blue-600 hover:text-blue-700 p-1 flex-shrink-0"
                            title="Preview"
                            type="button"
                          >
                            <Eye size={16} />
                          </button>
                          <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
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
                        <div key={doc.id} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded min-w-0">
                          <FileText size={16} className="flex-shrink-0" />
                          <span className="cursor-pointer hover:text-gray-900 truncate flex-1 min-w-0" onClick={(e) => { e.stopPropagation(); handlePreviewDocument(doc); }} title={`Joint Photograph: ${doc.name}`}>
                            Joint Photograph: {doc.name}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handlePreviewDocument(doc);
                            }}
                            className="text-blue-600 hover:text-blue-700 p-1 flex-shrink-0"
                            title="Preview"
                            type="button"
                          >
                            <Eye size={16} />
                          </button>
                          <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
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
                        <div key={doc.id} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded min-w-0">
                          <FileText size={16} className="flex-shrink-0" />
                          <span className="cursor-pointer hover:text-gray-900 truncate flex-1 min-w-0" onClick={(e) => { e.stopPropagation(); handlePreviewDocument(doc); }} title={`Joint Photograph: ${doc.file.name}`}>
                            Joint Photograph: {doc.file.name}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handlePreviewDocument(doc);
                            }}
                            className="text-blue-600 hover:text-blue-700 p-1 flex-shrink-0"
                            title="Preview"
                            type="button"
                          >
                            <Eye size={16} />
                          </button>
                          <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
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
            <Card className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between mb-2 sm:mb-3 lg:mb-4 gap-2">
                <h4 className="font-semibold text-xs sm:text-sm text-gray-900">Declarations</h4>
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
            const uploadedDocs: string[] = [];
            // Upload all documents that are in the documents array (unsaved ones)
            for (const doc of documents) {
              await documentService.uploadDocument(application.id, doc.file, doc.type, doc.belongsTo);
              uploadedDocs.push(doc.id);
            }
            // Only clear documents that were successfully uploaded
            setDocuments(prevDocs => prevDocs.filter(doc => !uploadedDocs.includes(doc.id)));
            // Reload documents from database to update applicationDocuments state
            const updatedDocs = await documentService.getDocuments(application.id);
            setApplicationDocuments(updatedDocs);
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

  // Get the correct dashboard route based on context
  const getDashboardRoute = () => {
    return isAdminContext ? '/admin' : '/dashboard';
  };

  // Handle exit
  const handleExit = () => {
    if (hasUnsavedChanges) {
      setShowExitConfirm(true);
    } else {
      navigate(getDashboardRoute());
    }
  };

  // Handle exit after saving
  const handleExitAfterSave = async () => {
    await saveDraftWithoutValidation();
    setShowExitConfirm(false);
    navigate(getDashboardRoute());
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
                  <h3 className="font-semibold text-rose-900 text-lg">{t('messages.unsavedChanges')}</h3>
                </div>
                <p className="text-rose-800 mb-3">
                  {t('messages.unsavedChangesDesc')}
                </p>
                <p className="text-sm text-rose-700 mb-3">
                  {t('messages.saveBeforeExit')}
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowExitConfirm(false);
                      navigate(getDashboardRoute());
                    }}
                    className="border-rose-300 text-rose-700 hover:bg-rose-100"
                  >
                    {t('messages.exitWithoutSaving')}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleExitAfterSave}
                    isLoading={isSaving}
                    className="bg-rose-600 hover:bg-rose-700"
                  >
                    <Save size={18} className="mr-2" />
                    {t('messages.saveDraftExit')}
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
      
      <div className={`max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 ${showExitConfirm ? 'pt-40' : ''}`}>
        <div className="mb-4 sm:mb-6 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-0.5 sm:mb-1">Marriage Registration</h1>
          <p className="text-[10px] sm:text-xs text-gray-600">Complete all steps to submit</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExit}
          className="flex items-center gap-1.5 text-gray-700 hover:text-gray-900 !px-2 sm:!px-3"
        >
          <LogOut size={14} className="sm:w-4 sm:h-4" />
          <span className="text-xs sm:text-sm">Exit</span>
        </Button>
      </div>

      <Stepper
        steps={applicationSteps}
        currentStep={currentStep}
        completedSteps={Array.from({ length: currentStep }, (_, i) => i)}
        className="mb-4 sm:mb-6"
      />

      <Card className="p-3 sm:p-5 lg:p-6">
        {renderStep()}

        {/* Document Preview Modal */}
        {previewDocument && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-2 sm:p-4" 
            onClick={closePreview}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <div 
              className="bg-white rounded-lg sm:rounded-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-auto" 
              onClick={(e) => e.stopPropagation()}
              style={{ zIndex: 101 }}
            >
              <div className="sticky top-0 bg-white border-b border-gray-200 p-2.5 sm:p-4 flex items-center justify-between z-10 gap-2">
                <h3 className="font-semibold text-xs sm:text-sm text-gray-900 truncate flex-1">
                  {getDocumentTypeLabel(previewDocument.type)}: {previewDocument.file?.name || (previewDocument as any).name || 'Document'}
                </h3>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="!px-2 sm:!px-3 !text-xs"
                    onClick={() => {
                      const urlToDownload = previewUrl || (previewDocument as any).url;
                      if (urlToDownload) {
                        window.open(urlToDownload, '_blank');
                      }
                    }}
                  >
                    <Download size={14} className="sm:w-4 sm:h-4 mr-1" />
                    <span className="hidden sm:inline">Download</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={closePreview} className="!p-1.5 sm:!p-2">
                    <X size={16} className="sm:w-[18px] sm:h-[18px]" />
                  </Button>
                </div>
              </div>
              <div className="p-2 sm:p-3 lg:p-6 overflow-y-auto max-h-[calc(95vh-80px)] sm:max-h-[calc(90vh-100px)]">
                {isLoadingPreview ? (
                  <div className="flex flex-col items-center justify-center py-8 sm:py-12">
                    <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 border-t-2 border-b-2 border-gold-500"></div>
                    <p className="text-xs sm:text-sm text-gray-500 mt-3">Loading preview...</p>
                  </div>
                ) : previewUrl ? (
                  <>
                    {isImage(previewDocument.file?.type || (previewDocument as any).mimeType) ? (
                      <div className="flex items-center justify-center min-h-[200px] sm:min-h-[300px] w-full">
                        <img
                          src={previewUrl}
                          alt={previewDocument.file?.name || (previewDocument as any).name || 'Document'}
                          className="max-w-full max-h-[calc(95vh-120px)] sm:max-h-[calc(90vh-140px)] w-auto h-auto rounded-lg shadow-lg mx-auto object-contain"
                          onLoad={() => console.log('Image loaded successfully')}
                          onError={(e) => {
                            console.error('Failed to load image:', e);
                            const fallbackUrl = (previewDocument as any).url;
                            if (fallbackUrl) {
                              console.log('Trying fallback URL:', fallbackUrl);
                              (e.target as HTMLImageElement).src = fallbackUrl;
                            } else {
                              console.error('No fallback URL available');
                            }
                          }}
                        />
                      </div>
                    ) : isPDF(previewDocument.file?.type || (previewDocument as any).mimeType) || 
                         (previewDocument.file?.name || (previewDocument as any).name || '').toLowerCase().endsWith('.pdf') ? (
                      <div className="w-full">
                        <iframe
                          src={previewUrl}
                          className="w-full h-[calc(95vh-120px)] sm:h-[calc(90vh-140px)] lg:h-[70vh] rounded-lg border border-gray-200"
                          title={previewDocument.file?.name || (previewDocument as any).name || 'Document'}
                          onLoad={() => console.log('PDF iframe loaded')}
                          onError={() => {
                            console.error('Failed to load PDF');
                          }}
                        />
                      </div>
                    ) : (
                      <div className="text-center py-8 sm:py-12">
                        <FileText size={36} className="sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
                        <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">Preview not available</p>
                        <Button variant="primary" size="sm" className="!text-xs sm:!text-sm" onClick={() => window.open(previewUrl, '_blank')}>
                          <Download size={14} className="sm:w-4 sm:h-4 mr-1.5" />
                          Download to View
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 sm:py-12">
                    <FileText size={36} className="sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
                    <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">Failed to load preview</p>
                    <div className="space-y-2">
                      {(previewDocument as any).url && (
                        <Button variant="primary" size="sm" className="!text-xs sm:!text-sm w-full sm:w-auto" onClick={() => window.open((previewDocument as any).url, '_blank')}>
                          <Download size={14} className="sm:w-4 sm:h-4 mr-1.5" />
                          Open in New Tab
                        </Button>
                      )}
                      {previewDocument.file && (
                        <Button variant="outline" size="sm" className="!text-xs sm:!text-sm w-full sm:w-auto" onClick={() => {
                          const url = URL.createObjectURL(previewDocument.file);
                          window.open(url, '_blank');
                        }}>
                          <Download size={14} className="sm:w-4 sm:h-4 mr-1.5" />
                          Open File
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-gray-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            disabled={currentStep === 0 || (currentStep === applicationSteps.length - 1 && (application?.status === 'submitted' || application?.status === 'approved' || application?.status === 'under_review'))}
            className="!text-xs sm:!text-sm order-2 sm:order-1"
          >
            <ArrowLeft size={14} className="sm:w-4 sm:h-4 mr-1.5" />
            {t('buttons.previous')}
          </Button>
          <div className="flex gap-2 sm:gap-3 order-1 sm:order-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={isSubmitted}
              onClick={saveDraftWithoutValidation}
              isLoading={isSaving}
              className="!text-xs sm:!text-sm flex-1 sm:flex-initial"
            >
              <Save size={14} className="sm:w-4 sm:h-4 mr-1.5" />
              {t('buttons.save')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleNextClick}
              isLoading={isSaving}
              disabled={
                (currentStep === applicationSteps.length - 1 && (application?.status === 'submitted' || application?.status === 'approved' || application?.status === 'under_review')) ||
                (!isCurrentStepValid && !isSubmitted)
              }
              className={`!text-xs sm:!text-sm flex-1 sm:flex-initial ${!isCurrentStepValid && !isSubmitted ? 'opacity-40 cursor-not-allowed bg-gray-400 hover:bg-gray-400' : ''}`}
            >
              {currentStep === applicationSteps.length - 1 
                ? (application?.status === 'submitted' || application?.status === 'approved' || application?.status === 'under_review')
                  ? t('review.submitted')
                  : t('buttons.submit')
                : t('buttons.next')}
              {currentStep < applicationSteps.length - 1 && <ArrowRight size={14} className="sm:w-4 sm:h-4 ml-1.5" />}
            </Button>
          </div>
        </div>
      </Card>
      </div>

      {/* Image Crop Modal */}
      <ImageCropModal
        isOpen={cropModalOpen}
        onClose={() => {
          setCropModalOpen(false);
          setPendingCropFile(null);
        }}
        imageFile={pendingCropFile?.file || null}
        onCropComplete={handleCropComplete}
        onSkip={handleCropSkip}
      />

      {/* Application Success Modal */}
      <ApplicationSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
      />
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

// Export ApplicationFormContent for use in admin pages
export { ApplicationFormContent };

export default ApplicationPage;
