import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../contexts/AuthContext';
import { useDivorceApplication } from '../../contexts/DivorceApplicationContext';
import { useNotification } from '../../contexts/NotificationContext';
import { documentService } from '../../services/documents';
import { supabase } from '../../lib/supabase';
import { safeFormatDate, calculateDetailedAge } from '../../utils/dateUtils';
import { formatAadhaar, handleAadhaarInput } from '../../utils/formatUtils';
import Stepper from '../../components/ui/Stepper';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import PhoneInput from '../../components/ui/PhoneInput';
import Checkbox from '../../components/ui/Checkbox';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import StateDistrictSelector from '../../components/StateDistrictSelector';
import ImageCropModal from '../../components/ui/ImageCropModal';
import {
  ArrowRight,
  ArrowLeft,
  Save,
  Upload,
  X,
  FileText,
  Edit,
  CheckCircle,
  Eye,
  Download,
  Trash2,
  Camera,
  Search,
  FileX,
  Loader2,
  AlertCircle,
  Link as LinkIcon,
  User,
  Users,
} from 'lucide-react';
import { Document as AppDocument } from '../../types';

interface DivorceFormContentProps {
  onComplete?: (applicationId: string) => void;
  isAdminContext?: boolean;
}

export interface DocumentFile {
  file: File;
  type: 'aadhaar' | 'tenth_certificate' | 'voter_id' | 'photo' | 'certificate' | 'id' | 'other';
  belongsTo: 'user' | 'partner' | 'joint';
  id: string;
}

// Schemas
const createHusbandSchema = (isAdmin: boolean) =>
  z.object({
    firstName: z.string().min(2, 'Husband first name is required'),
    lastName: z.string().optional(),
    fatherName: z.string().min(2, "Husband father's name is required"),
    dateOfBirth: z.string().min(1, 'Husband date of birth is required'),
    aadhaarNumber: z
      .string()
      .refine((val) => (val || '').replace(/\s/g, '').length === 12, 'Aadhaar number must be exactly 12 digits'),
    mobileNumber: z.string().regex(/^\d{10}$/, 'Mobile number must be exactly 10 digits'),
    voterOrRollNo: isAdmin ? z.string().optional() : z.string().min(1, 'Voter EPIC No or Roll No is required'),

    // Address
    permanentVillageStreet: z.string().min(2, 'Village/Street is required'),
    permanentPostOffice: z.string().min(2, 'Post Office is required'),
    permanentPoliceStation: z.string().min(2, 'Police Station is required'),
    permanentDistrict: z.string().min(2, 'District is required'),
    permanentState: z.string().min(2, 'State is required'),
    permanentZipCode: z.string().regex(/^\d{6}$/, 'PIN code must be exactly 6 digits'),
    permanentCountry: z.string().min(2, 'Country is required'),

    sameAsPermanent: z.boolean().optional(),
    currentVillageStreet: z.string().optional(),
    currentPostOffice: z.string().optional(),
    currentPoliceStation: z.string().optional(),
    currentDistrict: z.string().optional(),
    currentState: z.string().optional(),
    currentZipCode: z.string().optional(),
    currentCountry: z.string().optional(),

    // Divorce Particulars
    divorceDate: z.string().min(1, 'Date of divorce is required').refine((val) => {
      const today = new Date().toISOString().split('T')[0];
      return val <= today;
    }, 'Divorce date cannot be in the future'),
    divorceType: z.enum(['talaq', 'khula', 'mutual', 'mubarat', 'other']),
    divorceReason: z.string().optional(),
    marriageCertificateNumber: z.string().optional(),
  });

const createWifeSchema = (isAdmin: boolean) =>
  z.object({
    firstName: z.string().min(2, 'Wife first name is required'),
    lastName: z.string().optional(),
    fatherName: z.string().min(2, "Wife father's name is required"),
    dateOfBirth: z.string().min(1, 'Wife date of birth is required'),
    aadhaarNumber: z
      .string()
      .refine((val) => (val || '').replace(/\s/g, '').length === 12, 'Aadhaar number must be exactly 12 digits'),
    mobileNumber: z.string().regex(/^\d{10}$/, 'Mobile number must be exactly 10 digits'),
    voterOrRollNo: isAdmin ? z.string().optional() : z.string().min(1, 'Voter EPIC No or Roll No is required'),

    // Address
    permanentVillageStreet: z.string().min(2, 'Village/Street is required'),
    permanentPostOffice: z.string().min(2, 'Post Office is required'),
    permanentPoliceStation: z.string().min(2, 'Police Station is required'),
    permanentDistrict: z.string().min(2, 'District is required'),
    permanentState: z.string().min(2, 'State is required'),
    permanentZipCode: z.string().regex(/^\d{6}$/, 'PIN code must be exactly 6 digits'),
    permanentCountry: z.string().min(2, 'Country is required'),

    sameAsPermanent: z.boolean().optional(),
    currentVillageStreet: z.string().optional(),
    currentPostOffice: z.string().optional(),
    currentPoliceStation: z.string().optional(),
    currentDistrict: z.string().optional(),
    currentState: z.string().optional(),
    currentZipCode: z.string().optional(),
    currentCountry: z.string().optional(),
  });

const declarationsSchema = z.object({
  accuracy: z.boolean().refine((val) => val === true, 'You must confirm that all details are accurate'),
  legal: z.boolean().refine((val) => val === true, 'You must declare legal validity of divorce'),
  consent: z.boolean().refine((val) => val === true, 'You must acknowledge Bengal Act 1876 provisions'),
});

type HusbandFormData = z.infer<ReturnType<typeof createHusbandSchema>>;
type WifeFormData = z.infer<ReturnType<typeof createWifeSchema>>;
type DeclarationsFormData = z.infer<typeof declarationsSchema>;

const formatAadhaarForInput = (val?: string | null): string => {
  if (!val || typeof val !== 'string' || val.trim() === '' || val.trim().toUpperCase() === 'N/A') return '';
  return handleAadhaarInput(val);
};

export const DivorceFormContent: React.FC<DivorceFormContentProps> = ({
  onComplete,
  isAdminContext = false,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useNotification();
  const { application, updateDraft, submitApplication, isLoading, refreshApplication } = useDivorceApplication();

  const steps = [
    { id: 'husband', label: 'Husband Details' },
    { id: 'wife', label: 'Wife Details' },
    { id: 'documents', label: 'Documents' },
    { id: 'declarations', label: 'Declarations & Particulars' },
    { id: 'review', label: 'Review & Submit' },
  ];

  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Marriage Certificate Search
  const [searchCertNumber, setSearchCertNumber] = useState('');
  const [isSearchingMarriage, setIsSearchingMarriage] = useState(false);
  const [linkedMarriageData, setLinkedMarriageData] = useState<any | null>(null);

  // Document Upload States
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [applicationDocuments, setApplicationDocuments] = useState<any[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<DocumentFile | any | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [pendingCropFile, setPendingCropFile] = useState<{
    file: File;
    type: 'aadhaar' | 'tenth_certificate' | 'voter_id' | 'photo' | 'certificate';
    belongsTo: 'user' | 'partner' | 'joint';
  } | null>(null);

  // Husband Form
  const husbandSchema = useMemo(() => createHusbandSchema(isAdminContext), [isAdminContext]);
  const husbandForm = useForm<HusbandFormData>({
    resolver: zodResolver(husbandSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      fatherName: '',
      dateOfBirth: '',
      aadhaarNumber: '',
      mobileNumber: '',
      voterOrRollNo: '',
      permanentVillageStreet: '',
      permanentPostOffice: '',
      permanentPoliceStation: '',
      permanentDistrict: 'MURSHIDABAD',
      permanentState: 'WEST BENGAL',
      permanentZipCode: '',
      permanentCountry: 'India',
      sameAsPermanent: true,
      currentVillageStreet: '',
      currentPostOffice: '',
      currentPoliceStation: '',
      currentDistrict: 'MURSHIDABAD',
      currentState: 'WEST BENGAL',
      currentZipCode: '',
      currentCountry: 'India',
      divorceDate: new Date().toISOString().split('T')[0],
      divorceType: 'talaq',
      divorceReason: '',
      marriageCertificateNumber: '',
    },
  });

  // Wife Form
  const wifeSchema = useMemo(() => createWifeSchema(isAdminContext), [isAdminContext]);
  const wifeForm = useForm<WifeFormData>({
    resolver: zodResolver(wifeSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      fatherName: '',
      dateOfBirth: '',
      aadhaarNumber: '',
      mobileNumber: '',
      voterOrRollNo: '',
      permanentVillageStreet: '',
      permanentPostOffice: '',
      permanentPoliceStation: '',
      permanentDistrict: 'MURSHIDABAD',
      permanentState: 'WEST BENGAL',
      permanentZipCode: '',
      permanentCountry: 'India',
      sameAsPermanent: true,
      currentVillageStreet: '',
      currentPostOffice: '',
      currentPoliceStation: '',
      currentDistrict: 'MURSHIDABAD',
      currentState: 'WEST BENGAL',
      currentZipCode: '',
      currentCountry: 'India',
    },
  });

  // Declarations Form
  const declarationsForm = useForm<DeclarationsFormData>({
    resolver: zodResolver(declarationsSchema),
    defaultValues: {
      accuracy: false,
      legal: false,
      consent: false,
    },
  });

  // Watched DOBs for detailed age calculation
  const watchedHusbandDob = husbandForm.watch('dateOfBirth');
  const watchedWifeDob = wifeForm.watch('dateOfBirth');
  const watchedDivorceDate = husbandForm.watch('divorceDate');

  const husbandDetailedAge = useMemo(() => {
    if (!watchedHusbandDob) return null;
    return calculateDetailedAge(watchedHusbandDob, watchedDivorceDate || new Date());
  }, [watchedHusbandDob, watchedDivorceDate]);

  const wifeDetailedAge = useMemo(() => {
    if (!watchedWifeDob) return null;
    return calculateDetailedAge(watchedWifeDob, watchedDivorceDate || new Date());
  }, [watchedWifeDob, watchedDivorceDate]);

  // Load draft data into forms
  useEffect(() => {
    if (application) {
      if (application.userDetails) {
        husbandForm.reset({
          firstName: application.userDetails.firstName || '',
          lastName: application.userDetails.lastName || '',
          fatherName: application.userDetails.fatherName || '',
          dateOfBirth: application.userDetails.dateOfBirth || '',
          aadhaarNumber: formatAadhaarForInput(application.userDetails.aadhaarNumber),
          mobileNumber: application.userDetails.mobileNumber || '',
          voterOrRollNo: application.userDetails.voterOrRollNo || '',
          permanentVillageStreet: application.userAddress?.villageStreet || '',
          permanentPostOffice: application.userAddress?.postOffice || '',
          permanentPoliceStation: application.userAddress?.policeStation || '',
          permanentDistrict: application.userAddress?.district || 'MURSHIDABAD',
          permanentState: application.userAddress?.state || 'WEST BENGAL',
          permanentZipCode: application.userAddress?.zipCode || '',
          permanentCountry: application.userAddress?.country || 'India',
          sameAsPermanent: !application.userCurrentAddress || application.userCurrentAddress.villageStreet === application.userAddress?.villageStreet,
          currentVillageStreet: application.userCurrentAddress?.villageStreet || '',
          currentPostOffice: application.userCurrentAddress?.postOffice || '',
          currentPoliceStation: application.userCurrentAddress?.policeStation || '',
          currentDistrict: application.userCurrentAddress?.district || 'MURSHIDABAD',
          currentState: application.userCurrentAddress?.state || 'WEST BENGAL',
          currentZipCode: application.userCurrentAddress?.zipCode || '',
          currentCountry: application.userCurrentAddress?.country || 'India',
          divorceDate: application.divorceDate ? new Date(application.divorceDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          divorceType: (application.divorceType as any) || 'talaq',
          divorceReason: application.divorceReason || '',
          marriageCertificateNumber: application.marriageCertificateNumber || '',
        });
      }

      if (application.partnerForm) {
        wifeForm.reset({
          firstName: application.partnerForm.firstName || '',
          lastName: application.partnerForm.lastName || '',
          fatherName: application.partnerForm.fatherName || '',
          dateOfBirth: application.partnerForm.dateOfBirth || '',
          aadhaarNumber: formatAadhaarForInput(application.partnerForm.aadhaarNumber || application.partnerForm.idNumber),
          mobileNumber: application.partnerForm.mobileNumber || '',
          voterOrRollNo: application.partnerForm.voterOrRollNo || '',
          permanentVillageStreet: application.partnerAddress?.villageStreet || '',
          permanentPostOffice: application.partnerAddress?.postOffice || '',
          permanentPoliceStation: application.partnerAddress?.policeStation || '',
          permanentDistrict: application.partnerAddress?.district || 'MURSHIDABAD',
          permanentState: application.partnerAddress?.state || 'WEST BENGAL',
          permanentZipCode: application.partnerAddress?.zipCode || '',
          permanentCountry: application.partnerAddress?.country || 'India',
          sameAsPermanent: !application.partnerCurrentAddress || application.partnerCurrentAddress.villageStreet === application.partnerAddress?.villageStreet,
          currentVillageStreet: application.partnerCurrentAddress?.villageStreet || '',
          currentPostOffice: application.partnerCurrentAddress?.postOffice || '',
          currentPoliceStation: application.partnerCurrentAddress?.policeStation || '',
          currentDistrict: application.partnerCurrentAddress?.district || 'MURSHIDABAD',
          currentState: application.partnerCurrentAddress?.state || 'WEST BENGAL',
          currentZipCode: application.partnerCurrentAddress?.zipCode || '',
          currentCountry: application.partnerCurrentAddress?.country || 'India',
        });
      }

      if (application.declarations) {
        declarationsForm.reset({
          accuracy: !!application.declarations.accuracy,
          legal: !!application.declarations.legal,
          consent: !!application.declarations.consent,
        });
      }
    }
  }, [application?.id]);

  // Load saved divorce documents from database
  useEffect(() => {
    if (application?.id && (currentStep === 2 || currentStep === 4)) {
      const loadDocuments = async () => {
        if (applicationDocuments.length === 0) {
          setIsLoadingDocuments(true);
        }
        try {
          const docs = await documentService.getDivorceDocuments(application.id);
          setApplicationDocuments(docs);
        } catch (error) {
          console.error('Failed to load documents:', error);
        } finally {
          setIsLoadingDocuments(false);
        }
      };
      loadDocuments();
    }
  }, [application?.id, currentStep]);

  // Marriage Certificate Search Handler
  const handleSearchMarriageCertificate = async () => {
    if (!searchCertNumber.trim()) {
      showToast('Please enter a Marriage Certificate Number', 'error');
      return;
    }
    setIsSearchingMarriage(true);
    try {
      const { data, error } = await supabase
        .from('certificates')
        .select(`
          *,
          applications:application_id (
            *,
            documents (*)
          )
        `)
        .eq('certificate_number', searchCertNumber.trim())
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        showToast('No marriage record found with this Certificate Number', 'error');
        setLinkedMarriageData(null);
        return;
      }

      setLinkedMarriageData(data);
      const app = (data as any).applications;

      if (app) {
        if (app.user_details) {
          husbandForm.setValue('firstName', app.user_details.firstName || '');
          husbandForm.setValue('lastName', app.user_details.lastName || '');
          husbandForm.setValue('fatherName', app.user_details.fatherName || '');
          husbandForm.setValue('dateOfBirth', app.user_details.dateOfBirth || '');
          husbandForm.setValue('aadhaarNumber', formatAadhaarForInput(app.user_details.aadhaarNumber), { shouldValidate: true });
          husbandForm.setValue('mobileNumber', app.user_details.mobileNumber || '');
          husbandForm.setValue('voterOrRollNo', app.user_details.voterOrRollNo || '');
        }

        if (app.user_address) {
          husbandForm.setValue('permanentVillageStreet', app.user_address.villageStreet || '');
          husbandForm.setValue('permanentPostOffice', app.user_address.postOffice || '');
          husbandForm.setValue('permanentPoliceStation', app.user_address.policeStation || '');
          husbandForm.setValue('permanentDistrict', app.user_address.district || 'MURSHIDABAD');
          husbandForm.setValue('permanentState', app.user_address.state || 'WEST BENGAL');
          husbandForm.setValue('permanentZipCode', app.user_address.zipCode || '');
        }

        if (app.partner_form) {
          wifeForm.setValue('firstName', app.partner_form.firstName || '');
          wifeForm.setValue('lastName', app.partner_form.lastName || '');
          wifeForm.setValue('fatherName', app.partner_form.fatherName || '');
          wifeForm.setValue('dateOfBirth', app.partner_form.dateOfBirth || '');
          wifeForm.setValue('aadhaarNumber', formatAadhaarForInput(app.partner_form.aadhaarNumber || app.partner_form.idNumber), { shouldValidate: true });
          wifeForm.setValue('mobileNumber', app.partner_form.mobileNumber || '');
          wifeForm.setValue('voterOrRollNo', app.partner_form.voterOrRollNo || '');
        }

        if (app.partner_address) {
          wifeForm.setValue('permanentVillageStreet', app.partner_address.villageStreet || '');
          wifeForm.setValue('permanentPostOffice', app.partner_address.postOffice || '');
          wifeForm.setValue('permanentPoliceStation', app.partner_address.policeStation || '');
          wifeForm.setValue('permanentDistrict', app.partner_address.district || 'MURSHIDABAD');
          wifeForm.setValue('permanentState', app.partner_address.state || 'WEST BENGAL');
          wifeForm.setValue('permanentZipCode', app.partner_address.zipCode || '');
        }

        husbandForm.setValue('marriageCertificateNumber', data.certificate_number);
        showToast('Marriage record found! Husband & Wife details pre-filled.', 'success');
      }
    } catch (err: any) {
      console.error('Error searching marriage certificate:', err);
      showToast(err.message || 'Error searching marriage certificate', 'error');
    } finally {
      setIsSearchingMarriage(false);
    }
  };

  // Helper function to check if a document exists (either unsaved or saved)
  const documentExists = (
    type: 'aadhaar' | 'tenth_certificate' | 'voter_id' | 'photo' | 'certificate',
    belongsTo: 'user' | 'partner' | 'joint'
  ) => {
    const existsInUnsaved = documents.some((d) => d.belongsTo === belongsTo && d.type === type);
    const existsInSaved = applicationDocuments.some((d) => d.belongsTo === belongsTo && d.type === type);
    return existsInUnsaved || existsInSaved;
  };

  // Helper function to check if either tenth_certificate or voter_id exists
  const secondDocumentExists = (belongsTo: 'user' | 'partner') => {
    const existsInUnsaved = documents.some(
      (d) => d.belongsTo === belongsTo && (d.type === 'tenth_certificate' || d.type === 'voter_id')
    );
    const existsInSaved = applicationDocuments.some(
      (d) => d.belongsTo === belongsTo && (d.type === 'tenth_certificate' || d.type === 'voter_id')
    );
    return existsInUnsaved || existsInSaved;
  };

  const MAX_FILE_SIZE = 250 * 1024; // 250KB

  const handleFileUpload = (
    file: File,
    type: 'aadhaar' | 'tenth_certificate' | 'voter_id' | 'photo' | 'certificate',
    belongsTo: 'user' | 'partner' | 'joint'
  ) => {
    if (file.size > MAX_FILE_SIZE) {
      showToast('File size exceeds 250KB limit. Please compress or resize the file before uploading.', 'error');
      return;
    }

    if (documentExists(type, belongsTo)) {
      showToast('This document has already been uploaded. Please remove the existing document first.', 'error');
      return;
    }

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
    setDocuments((prev) => [...prev.filter((d) => !(d.belongsTo === belongsTo && d.type === type)), newDoc]);
  };

  const handleCropComplete = (croppedFile: File) => {
    if (!pendingCropFile) return;
    if (croppedFile.size > MAX_FILE_SIZE) {
      showToast('Cropped file size exceeds 250KB. Please try again.', 'error');
      setPendingCropFile(null);
      setCropModalOpen(false);
      return;
    }

    const newDoc: DocumentFile = {
      id: `doc-${Date.now()}-${Math.random()}`,
      file: croppedFile,
      type: pendingCropFile.type,
      belongsTo: pendingCropFile.belongsTo,
    };
    setDocuments((prev) => [
      ...prev.filter((d) => !(d.belongsTo === pendingCropFile.belongsTo && d.type === pendingCropFile.type)),
      newDoc,
    ]);
    setPendingCropFile(null);
    setCropModalOpen(false);
  };

  const handleCropSkip = () => {
    if (!pendingCropFile) return;
    const newDoc: DocumentFile = {
      id: `doc-${Date.now()}-${Math.random()}`,
      file: pendingCropFile.file,
      type: pendingCropFile.type,
      belongsTo: pendingCropFile.belongsTo,
    };
    setDocuments((prev) => [
      ...prev.filter((d) => !(d.belongsTo === pendingCropFile.belongsTo && d.type === pendingCropFile.type)),
      newDoc,
    ]);
    setPendingCropFile(null);
    setCropModalOpen(false);
  };

  const handleRemoveDocument = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const handleRemoveSavedDocument = async (
    type: 'aadhaar' | 'tenth_certificate' | 'voter_id' | 'photo' | 'certificate',
    belongsTo: 'user' | 'partner' | 'joint'
  ) => {
    if (!application) return;
    try {
      const docToRemove = applicationDocuments.find((d) => d.belongsTo === belongsTo && d.type === type);
      if (docToRemove && docToRemove.id) {
        await documentService.deleteDivorceDocument(docToRemove.id);
        setApplicationDocuments((prev) => prev.filter((d) => !(d.belongsTo === belongsTo && d.type === type)));
        await refreshApplication();
        showToast('Document removed successfully', 'success');
      }
    } catch (error) {
      console.error('Failed to remove document:', error);
      showToast('Failed to remove document. Please try again.', 'error');
    }
  };

  const handlePreviewDocument = async (doc: DocumentFile | any) => {
    setPreviewDocument(doc);
    setIsLoadingPreview(true);
    setPreviewUrl(null);

    try {
      if ('file' in doc && doc.file instanceof File) {
        const url = URL.createObjectURL(doc.file);
        setPreviewUrl(url);
        setIsLoadingPreview(false);
      } else if ('url' in doc && doc.url) {
        if (doc.id) {
          try {
            const signedUrl = await documentService.getDivorceSignedUrl(doc.id);
            setPreviewUrl(signedUrl);
          } catch {
            setPreviewUrl(doc.url);
          }
        } else {
          setPreviewUrl(doc.url);
        }
        setIsLoadingPreview(false);
      } else if (doc instanceof File) {
        const url = URL.createObjectURL(doc);
        setPreviewUrl(url);
        setIsLoadingPreview(false);
      }
    } catch (err) {
      console.error('Preview error:', err);
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

  // Upload unsaved files from local state to storage
  const uploadUnsavedDocuments = async () => {
    if (!application || documents.length === 0) return;
    const uploadedIds: string[] = [];
    for (const doc of documents) {
      await documentService.uploadDivorceDocument(application.id, doc.file, doc.type, doc.belongsTo);
      uploadedIds.push(doc.id);
    }
    setDocuments((prev) => prev.filter((d) => !uploadedIds.includes(d.id)));
    const updated = await documentService.getDivorceDocuments(application.id);
    setApplicationDocuments(updated);
    await refreshApplication();
  };

  // Draft Save Handler
  const saveCurrentStepDraft = async (silent = false) => {
    setIsSaving(true);
    try {
      const hValues = husbandForm.getValues();
      const wValues = wifeForm.getValues();
      const dValues = declarationsForm.getValues();

      const userAddress = {
        villageStreet: hValues.permanentVillageStreet || '',
        postOffice: hValues.permanentPostOffice || '',
        policeStation: hValues.permanentPoliceStation || '',
        district: hValues.permanentDistrict || 'MURSHIDABAD',
        state: hValues.permanentState || 'WEST BENGAL',
        zipCode: hValues.permanentZipCode || '',
        country: hValues.permanentCountry || 'India',
      };

      const userCurrentAddress = hValues.sameAsPermanent
        ? userAddress
        : {
          villageStreet: hValues.currentVillageStreet || '',
          postOffice: hValues.currentPostOffice || '',
          policeStation: hValues.currentPoliceStation || '',
          district: hValues.currentDistrict || 'MURSHIDABAD',
          state: hValues.currentState || 'WEST BENGAL',
          zipCode: hValues.currentZipCode || '',
          country: hValues.currentCountry || 'India',
        };

      const partnerAddress = {
        villageStreet: wValues.permanentVillageStreet || '',
        postOffice: wValues.permanentPostOffice || '',
        policeStation: wValues.permanentPoliceStation || '',
        district: wValues.permanentDistrict || 'MURSHIDABAD',
        state: wValues.permanentState || 'WEST BENGAL',
        zipCode: wValues.permanentZipCode || '',
        country: wValues.permanentCountry || 'India',
      };

      const partnerCurrentAddress = wValues.sameAsPermanent
        ? partnerAddress
        : {
          villageStreet: wValues.currentVillageStreet || '',
          postOffice: wValues.currentPostOffice || '',
          policeStation: wValues.currentPoliceStation || '',
          district: wValues.currentDistrict || 'MURSHIDABAD',
          state: wValues.currentState || 'WEST BENGAL',
          zipCode: wValues.currentZipCode || '',
          country: wValues.currentCountry || 'India',
        };

      await updateDraft({
        userDetails: {
          firstName: hValues.firstName,
          lastName: hValues.lastName,
          fatherName: hValues.fatherName,
          dateOfBirth: hValues.dateOfBirth,
          aadhaarNumber: (hValues.aadhaarNumber || '').replace(/\s/g, ''),
          mobileNumber: hValues.mobileNumber,
          voterOrRollNo: hValues.voterOrRollNo,
        },
        partnerForm: {
          firstName: wValues.firstName,
          lastName: wValues.lastName,
          fatherName: wValues.fatherName,
          dateOfBirth: wValues.dateOfBirth,
          aadhaarNumber: (wValues.aadhaarNumber || '').replace(/\s/g, ''),
          idNumber: (wValues.aadhaarNumber || '').replace(/\s/g, ''),
          mobileNumber: wValues.mobileNumber,
          voterOrRollNo: wValues.voterOrRollNo,
        },
        userAddress,
        userCurrentAddress,
        partnerAddress,
        partnerCurrentAddress,
        divorceDate: hValues.divorceDate,
        divorceType: hValues.divorceType,
        divorceReason: hValues.divorceReason,
        marriageCertificateNumber: hValues.marriageCertificateNumber || linkedMarriageData?.certificate_number,
        marriageApplicationId: linkedMarriageData?.id,
        declarations: dValues,
      });

      // Upload any unsaved documents if on documents step
      if (currentStep === 2 && documents.length > 0) {
        await uploadUnsavedDocuments();
      }

      if (!silent) {
        showToast('Application draft saved successfully', 'success');
      }
    } catch (err: any) {
      console.error('Failed to save draft:', err);
      if (!silent) {
        showToast(err.message || 'Failed to save draft', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Step Navigation
  const handleNext = async () => {
    let isValid = false;
    if (currentStep === 0) {
      isValid = await husbandForm.trigger();
    } else if (currentStep === 1) {
      isValid = await wifeForm.trigger();
    } else if (currentStep === 2) {
      // All documents are optional for divorce
      // Upload any unsaved documents before advancing if user uploaded any
      if (application && documents.length > 0) {
        setIsSaving(true);
        try {
          await uploadUnsavedDocuments();
          showToast('Documents uploaded successfully', 'success');
        } catch (error: any) {
          console.error('Document upload error:', error);
          showToast(error?.message || 'Failed to upload documents. Please try again.', 'error');
          setIsSaving(false);
          return;
        } finally {
          setIsSaving(false);
        }
      }

      isValid = true;
    } else if (currentStep === 3) {
      isValid = await declarationsForm.trigger();
    }

    if (isValid) {
      await saveCurrentStepDraft(true);
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      showToast('Please fill all required fields correctly', 'error');
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Final Submit
  const handleFinalSubmit = async () => {
    const hValid = await husbandForm.trigger();
    const wValid = await wifeForm.trigger();
    const dValid = await declarationsForm.trigger();

    if (!hValid || !wValid || !dValid) {
      showToast('Please complete all required sections before submitting', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await saveCurrentStepDraft(true);
      await submitApplication();
      showToast('Divorce application submitted successfully!', 'success');
      if (onComplete && application) {
        onComplete(application.id);
      } else {
        navigate(`/admin/divorce/applications/${application?.id || ''}`);
      }
    } catch (err: any) {
      console.error('Failed to submit application:', err);
      showToast(err.message || 'Failed to submit application', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={32} className="animate-spin text-gold-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Stepper Header */}
      <Stepper
        steps={steps}
        currentStep={currentStep}
        onStepClick={(step) => {
          if (step <= currentStep) setCurrentStep(step);
        }}
      />

      {/* STEP 0: HUSBAND DETAILS */}
      {currentStep === 0 && (
        <form className="space-y-6">
          {/* Marriage Certificate Search Box */}
          <Card className="p-4 sm:p-6 bg-gradient-to-r from-amber-50/50 to-gold-50/30 border border-gold-200">
            <div className="flex items-center gap-2 mb-2">
              <LinkIcon size={18} className="text-gold-600" />
              <h3 className="font-semibold text-sm sm:text-base text-gray-900">
                Link Existing Marriage Certificate (Optional)
              </h3>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              If the marriage was registered through this portal, enter the Certificate Number to auto-fill details.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="e.g. WBMSDBRWI1B202663202663"
                value={searchCertNumber}
                onChange={(e) => setSearchCertNumber(e.target.value.toUpperCase())}
                className="flex-1 font-mono uppercase text-xs sm:text-sm"
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSearchMarriageCertificate}
                isLoading={isSearchingMarriage}
                disabled={isSearchingMarriage}
              >
                <Search size={14} className="mr-1.5" />
                Find & Auto-fill
              </Button>
              {linkedMarriageData && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLinkedMarriageData(null);
                    setSearchCertNumber('');
                  }}
                >
                  Clear Link
                </Button>
              )}
            </div>
          </Card>

          {/* Husband Personal Details */}
          <Card className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <h2 className="font-serif text-base sm:text-lg font-bold text-gray-900">
                Husband Personal Details
              </h2>
              {husbandDetailedAge && (
                <Badge variant="outline" className="text-gold-700 bg-gold-50 border-gold-200 text-xs">
                  Age: {husbandDetailedAge.text}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  First Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  {...husbandForm.register('firstName')}
                  placeholder="e.g. NOOR MAHAMMAD"
                  error={husbandForm.formState.errors.firstName?.message}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label>
                <Input
                  {...husbandForm.register('lastName')}
                  placeholder="e.g. SK"
                  error={husbandForm.formState.errors.lastName?.message}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Father's Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  {...husbandForm.register('fatherName')}
                  placeholder="e.g. SAHABAT SK"
                  error={husbandForm.formState.errors.fatherName?.message}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Date of Birth <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="date"
                  {...husbandForm.register('dateOfBirth')}
                  error={husbandForm.formState.errors.dateOfBirth?.message}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Aadhaar Number <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="0000 0000 0000"
                  maxLength={14}
                  {...husbandForm.register('aadhaarNumber', {
                    onChange: (e) => {
                      e.target.value = handleAadhaarInput(e.target.value);
                    },
                  })}
                  error={husbandForm.formState.errors.aadhaarNumber?.message}
                />
              </div>

              <div>
                <PhoneInput
                  label="Mobile Number"
                  value={husbandForm.watch('mobileNumber') || ''}
                  onChange={(val) => {
                    husbandForm.setValue('mobileNumber', val, { shouldValidate: true });
                  }}
                  error={husbandForm.formState.errors.mobileNumber?.message}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Voter EPIC No / Admit Card No {isAdminContext && <span className="text-gray-400 font-normal">(Optional)</span>}
                </label>
                <Input
                  placeholder="e.g. WBG1234567"
                  {...husbandForm.register('voterOrRollNo')}
                  error={husbandForm.formState.errors.voterOrRollNo?.message}
                />
              </div>
            </div>
          </Card>

          {/* Divorce Particulars */}
          <Card className="p-4 sm:p-6 space-y-4">
            <h2 className="font-serif text-base sm:text-lg font-bold text-gray-900 pb-2 border-b border-gray-200">
              Divorce Particulars
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Date of Divorce / Pronouncement <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="date"
                  {...husbandForm.register('divorceDate')}
                  error={husbandForm.formState.errors.divorceDate?.message}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Type of Divorce <span className="text-rose-500">*</span>
                </label>
                <select
                  {...husbandForm.register('divorceType')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gold-500"
                >
                  <option value="talaq">Talaq (By Husband)</option>
                  <option value="khula">Khula (At Instance of Wife)</option>
                  <option value="mutual">Mubarat / Mutual Consent</option>
                  <option value="other">Other / Judicial Dissolution</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Marriage Certificate Number (If Any)
                </label>
                <Input
                  placeholder="e.g. WBMSDBRWI1B2026..."
                  {...husbandForm.register('marriageCertificateNumber')}
                  className="uppercase font-mono text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Reason / Mutual Notes (Optional)
                </label>
                <Input
                  placeholder="e.g. Irreconcilable differences, mutual consent"
                  {...husbandForm.register('divorceReason')}
                />
              </div>
            </div>
          </Card>

          {/* Husband Permanent Address */}
          <Card className="p-4 sm:p-6 space-y-4">
            <h2 className="font-serif text-base sm:text-lg font-bold text-gray-900 pb-2 border-b border-gray-200">
              Husband Permanent Address
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Village / Town / Street <span className="text-rose-500">*</span>
                </label>
                <Input
                  {...husbandForm.register('permanentVillageStreet')}
                  placeholder="Vill- Hatpara"
                  error={husbandForm.formState.errors.permanentVillageStreet?.message}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Post Office <span className="text-rose-500">*</span>
                </label>
                <Input
                  {...husbandForm.register('permanentPostOffice')}
                  placeholder="P.O. Hazarpur Nabagram"
                  error={husbandForm.formState.errors.permanentPostOffice?.message}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Police Station <span className="text-rose-500">*</span>
                </label>
                <Input
                  {...husbandForm.register('permanentPoliceStation')}
                  placeholder="P.S. Kandi"
                  error={husbandForm.formState.errors.permanentPoliceStation?.message}
                />
              </div>

              <StateDistrictSelector
                stateValue={husbandForm.watch('permanentState') || ''}
                districtValue={husbandForm.watch('permanentDistrict') || ''}
                stateRegister={husbandForm.register('permanentState')}
                districtRegister={husbandForm.register('permanentDistrict')}
                setValue={husbandForm.setValue}
                stateError={husbandForm.formState.errors.permanentState?.message}
                districtError={husbandForm.formState.errors.permanentDistrict?.message}
                required
              />

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  PIN Code <span className="text-rose-500">*</span>
                </label>
                <Input
                  maxLength={6}
                  {...husbandForm.register('permanentZipCode')}
                  placeholder="742136"
                  error={husbandForm.formState.errors.permanentZipCode?.message}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Country</label>
                <Input {...husbandForm.register('permanentCountry')} disabled value="India" />
              </div>
            </div>

            {/* Checkbox for same address */}
            <div className="pt-2">
              <Checkbox
                label="Present Address is same as Permanent Address"
                checked={husbandForm.watch('sameAsPermanent') || false}
                onChange={(e) => husbandForm.setValue('sameAsPermanent', e.target.checked)}
              />
            </div>

            {!husbandForm.watch('sameAsPermanent') && (
              <div className="pt-4 border-t border-gray-200 space-y-4">
                <h3 className="font-semibold text-sm text-gray-900">Husband Present Address</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Village / Street</label>
                    <Input {...husbandForm.register('currentVillageStreet')} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Post Office</label>
                    <Input {...husbandForm.register('currentPostOffice')} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Police Station</label>
                    <Input {...husbandForm.register('currentPoliceStation')} />
                  </div>
                  <StateDistrictSelector
                    stateValue={husbandForm.watch('currentState') || ''}
                    districtValue={husbandForm.watch('currentDistrict') || ''}
                    stateRegister={husbandForm.register('currentState')}
                    districtRegister={husbandForm.register('currentDistrict')}
                    setValue={husbandForm.setValue}
                    stateError={husbandForm.formState.errors.currentState?.message}
                    districtError={husbandForm.formState.errors.currentDistrict?.message}
                  />
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">PIN Code</label>
                    <Input maxLength={6} {...husbandForm.register('currentZipCode')} />
                  </div>
                </div>
              </div>
            )}
          </Card>
        </form>
      )}

      {/* STEP 1: WIFE DETAILS */}
      {currentStep === 1 && (
        <form className="space-y-6">
          <Card className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <h2 className="font-serif text-base sm:text-lg font-bold text-gray-900">
                Wife Personal Details
              </h2>
              {wifeDetailedAge && (
                <Badge variant="outline" className="text-rose-700 bg-rose-50 border-rose-200 text-xs">
                  Age: {wifeDetailedAge.text}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  First Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  {...wifeForm.register('firstName')}
                  placeholder="e.g. NASRIN"
                  error={wifeForm.formState.errors.firstName?.message}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label>
                <Input
                  {...wifeForm.register('lastName')}
                  placeholder="e.g. KHATUN"
                  error={wifeForm.formState.errors.lastName?.message}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Father's Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  {...wifeForm.register('fatherName')}
                  placeholder="e.g. SOHIDUL SK"
                  error={wifeForm.formState.errors.fatherName?.message}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Date of Birth <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="date"
                  {...wifeForm.register('dateOfBirth')}
                  error={wifeForm.formState.errors.dateOfBirth?.message}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Aadhaar Number <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="0000 0000 0000"
                  maxLength={14}
                  {...wifeForm.register('aadhaarNumber', {
                    onChange: (e) => {
                      e.target.value = handleAadhaarInput(e.target.value);
                    },
                  })}
                  error={wifeForm.formState.errors.aadhaarNumber?.message}
                />
              </div>

              <div>
                <PhoneInput
                  label="Mobile Number"
                  value={wifeForm.watch('mobileNumber') || ''}
                  onChange={(val) => {
                    wifeForm.setValue('mobileNumber', val, { shouldValidate: true });
                  }}
                  error={wifeForm.formState.errors.mobileNumber?.message}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Voter EPIC No / Admit Card No {isAdminContext && <span className="text-gray-400 font-normal">(Optional)</span>}
                </label>
                <Input
                  placeholder="e.g. WBG9876543"
                  {...wifeForm.register('voterOrRollNo')}
                  error={wifeForm.formState.errors.voterOrRollNo?.message}
                />
              </div>
            </div>
          </Card>

          {/* Wife Permanent Address */}
          <Card className="p-4 sm:p-6 space-y-4">
            <h2 className="font-serif text-base sm:text-lg font-bold text-gray-900 pb-2 border-b border-gray-200">
              Wife Permanent Address
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Village / Town / Street <span className="text-rose-500">*</span>
                </label>
                <Input
                  {...wifeForm.register('permanentVillageStreet')}
                  placeholder="Vill- Motra"
                  error={wifeForm.formState.errors.permanentVillageStreet?.message}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Post Office <span className="text-rose-500">*</span>
                </label>
                <Input
                  {...wifeForm.register('permanentPostOffice')}
                  placeholder="P.O. Hazarpur Nabagram"
                  error={wifeForm.formState.errors.permanentPostOffice?.message}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Police Station <span className="text-rose-500">*</span>
                </label>
                <Input
                  {...wifeForm.register('permanentPoliceStation')}
                  placeholder="P.S. Kandi"
                  error={wifeForm.formState.errors.permanentPoliceStation?.message}
                />
              </div>

              <StateDistrictSelector
                stateValue={wifeForm.watch('permanentState') || ''}
                districtValue={wifeForm.watch('permanentDistrict') || ''}
                stateRegister={wifeForm.register('permanentState')}
                districtRegister={wifeForm.register('permanentDistrict')}
                setValue={wifeForm.setValue}
                stateError={wifeForm.formState.errors.permanentState?.message}
                districtError={wifeForm.formState.errors.permanentDistrict?.message}
                required
              />

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  PIN Code <span className="text-rose-500">*</span>
                </label>
                <Input
                  maxLength={6}
                  {...wifeForm.register('permanentZipCode')}
                  placeholder="742136"
                  error={wifeForm.formState.errors.permanentZipCode?.message}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Country</label>
                <Input {...wifeForm.register('permanentCountry')} disabled value="India" />
              </div>
            </div>

            {/* Checkbox for same address */}
            <div className="pt-2">
              <Checkbox
                label="Present Address is same as Permanent Address"
                checked={wifeForm.watch('sameAsPermanent') || false}
                onChange={(e) => wifeForm.setValue('sameAsPermanent', e.target.checked)}
              />
            </div>

            {!wifeForm.watch('sameAsPermanent') && (
              <div className="pt-4 border-t border-gray-200 space-y-4">
                <h3 className="font-semibold text-sm text-gray-900">Wife Present Address</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Village / Street</label>
                    <Input {...wifeForm.register('currentVillageStreet')} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Post Office</label>
                    <Input {...wifeForm.register('currentPostOffice')} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Police Station</label>
                    <Input {...wifeForm.register('currentPoliceStation')} />
                  </div>
                  <StateDistrictSelector
                    stateValue={wifeForm.watch('currentState') || ''}
                    districtValue={wifeForm.watch('currentDistrict') || ''}
                    stateRegister={wifeForm.register('currentState')}
                    districtRegister={wifeForm.register('currentDistrict')}
                    setValue={wifeForm.setValue}
                    stateError={wifeForm.formState.errors.currentState?.message}
                    districtError={wifeForm.formState.errors.currentDistrict?.message}
                  />
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">PIN Code</label>
                    <Input maxLength={6} {...wifeForm.register('currentZipCode')} />
                  </div>
                </div>
              </div>
            )}
          </Card>
        </form>
      )}

      {/* STEP 2: DOCUMENTS UPLOAD (MATCHES MARRIAGE APPLICATION STYLE + KABIN/MARRIAGE CERTIFICATE) */}
      {currentStep === 2 && (
        <Card className="p-4 sm:p-6 space-y-6">
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            {/* Section 1: Husband's Documents */}
            <div>
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1 sm:mb-2">Husband's Documents</h3>
              <p className="text-[10px] sm:text-xs text-gray-600 mb-1">Optional: Upload Aadhaar card + Madhyamik Admit Card or Voter ID</p>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-3 sm:mb-4 lg:mb-6">
                <span className="text-gold-600 font-medium">Max file size: 250KB</span> per document
              </p>

              {isLoadingDocuments && (
                <div className="flex items-center justify-center py-3 sm:py-4 mb-3 sm:mb-4 bg-gray-50 rounded-lg">
                  <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-t-2 border-b-2 border-gold-500"></div>
                  <span className="ml-2 text-[10px] sm:text-xs text-gray-500">Loading documents...</span>
                </div>
              )}

              {/* Show saved documents from database */}
              {!isLoadingDocuments && applicationDocuments.filter((d) => d.belongsTo === 'user').length > 0 && (
                <div className="mb-3 sm:mb-4 p-2.5 sm:p-4 bg-gray-50 rounded-lg">
                  <p className="text-[10px] sm:text-xs font-medium text-gray-700 mb-1.5 sm:mb-2">Previously Saved:</p>
                  <div className="space-y-1.5 sm:space-y-2">
                    {applicationDocuments
                      .filter((d) => d.belongsTo === 'user')
                      .sort((a, b) => {
                        const order: Record<string, number> = { aadhaar: 1, tenth_certificate: 2, voter_id: 3, photo: 4 };
                        return (order[a.type] || 99) - (order[b.type] || 99);
                      })
                      .map((doc) => (
                        <div key={doc.id} className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-gray-600">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span
                            className="cursor-pointer hover:text-gray-900 truncate flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewDocument(doc);
                            }}
                          >
                            {doc.type === 'aadhaar' && 'Aadhaar'}
                            {doc.type === 'tenth_certificate' && 'Madhyamik Admit Card'}
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
                    Aadhaar Card <span className="text-gray-400 font-normal text-xs">(Optional)</span>
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
                            e.target.value = '';
                          }}
                          className="hidden"
                          id="husband-aadhaar"
                        />
                        <label
                          htmlFor="husband-aadhaar"
                          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 lg:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-xs sm:text-sm"
                        >
                          <Upload size={14} className="sm:w-[18px] sm:h-[18px]" />
                          <span>Choose</span>
                        </label>
                      </>
                    )}
                    {/* Show unsaved document */}
                    {documents.find((d) => d.belongsTo === 'user' && d.type === 'aadhaar') && (() => {
                      const doc = documents.find((d) => d.belongsTo === 'user' && d.type === 'aadhaar')!;
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span
                            className="cursor-pointer hover:text-gray-900 truncate max-w-[120px] sm:max-w-[180px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewDocument(doc);
                            }}
                          >
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
                    {applicationDocuments.find((d) => d.belongsTo === 'user' && d.type === 'aadhaar') && (() => {
                      const doc = applicationDocuments.find((d) => d.belongsTo === 'user' && d.type === 'aadhaar')!;
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span
                            className="cursor-pointer hover:text-gray-900 truncate max-w-[120px] sm:max-w-[180px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewDocument(doc);
                            }}
                          >
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
                    Madhyamik Admit Card / Voter ID <span className="text-gray-400 font-normal text-xs">(Optional)</span>
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
                              const type =
                                fileName.includes('voter') || fileName.includes('voterid')
                                  ? 'voter_id'
                                  : 'tenth_certificate';
                              handleFileUpload(file, type, 'user');
                            }
                            e.target.value = '';
                          }}
                          className="hidden"
                          id="husband-second-doc"
                        />
                        <label
                          htmlFor="husband-second-doc"
                          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 lg:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-xs sm:text-sm"
                        >
                          <Upload size={14} className="sm:w-[18px] sm:h-[18px]" />
                          <span>Choose</span>
                        </label>
                      </>
                    )}
                    {/* Show unsaved document */}
                    {documents.find((d) => d.belongsTo === 'user' && (d.type === 'tenth_certificate' || d.type === 'voter_id')) && (() => {
                      const doc = documents.find(
                        (d) => d.belongsTo === 'user' && (d.type === 'tenth_certificate' || d.type === 'voter_id')
                      )!;
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span
                            className="cursor-pointer hover:text-gray-900 truncate max-w-[120px] sm:max-w-[180px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewDocument(doc);
                            }}
                          >
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
                    {applicationDocuments.find((d) => d.belongsTo === 'user' && (d.type === 'tenth_certificate' || d.type === 'voter_id')) && (() => {
                      const doc = applicationDocuments.find(
                        (d) => d.belongsTo === 'user' && (d.type === 'tenth_certificate' || d.type === 'voter_id')
                      )!;
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span
                            className="cursor-pointer hover:text-gray-900 truncate max-w-[120px] sm:max-w-[180px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewDocument(doc);
                            }}
                          >
                            {doc.name || (doc.type === 'tenth_certificate' ? 'Madhyamik Admit Card' : 'Voter ID')}
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

            {/* Section 2: Wife's Documents */}
            <div className="pt-4 sm:pt-5 lg:pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1 sm:mb-2">Wife's Documents</h3>
              <p className="text-[10px] sm:text-xs text-gray-600 mb-1">Optional: Upload Aadhaar card + Madhyamik Admit Card or Voter ID</p>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-3 sm:mb-4 lg:mb-6">
                <span className="text-gold-600 font-medium">Max file size: 250KB</span> per document
              </p>

              {/* Show saved documents from database */}
              {!isLoadingDocuments && applicationDocuments.filter((d) => d.belongsTo === 'partner').length > 0 && (
                <div className="mb-3 sm:mb-4 p-2.5 sm:p-4 bg-gray-50 rounded-lg">
                  <p className="text-[10px] sm:text-xs font-medium text-gray-700 mb-1.5 sm:mb-2">Previously Saved:</p>
                  <div className="space-y-1.5 sm:space-y-2">
                    {applicationDocuments
                      .filter((d) => d.belongsTo === 'partner')
                      .sort((a, b) => {
                        const order: Record<string, number> = { aadhaar: 1, tenth_certificate: 2, voter_id: 3, photo: 4 };
                        return (order[a.type] || 99) - (order[b.type] || 99);
                      })
                      .map((doc) => (
                        <div key={doc.id} className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-gray-600">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span
                            className="cursor-pointer hover:text-gray-900 truncate flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewDocument(doc);
                            }}
                          >
                            {doc.type === 'aadhaar' && 'Aadhaar'}
                            {doc.type === 'tenth_certificate' && 'Madhyamik Admit Card'}
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
                    Aadhaar Card <span className="text-gray-400 font-normal text-xs">(Optional)</span>
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
                            e.target.value = '';
                          }}
                          className="hidden"
                          id="wife-aadhaar"
                        />
                        <label
                          htmlFor="wife-aadhaar"
                          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 lg:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-xs sm:text-sm"
                        >
                          <Upload size={14} className="sm:w-[18px] sm:h-[18px]" />
                          <span>Choose</span>
                        </label>
                      </>
                    )}
                    {/* Show unsaved document */}
                    {documents.find((d) => d.belongsTo === 'partner' && d.type === 'aadhaar') && (() => {
                      const doc = documents.find((d) => d.belongsTo === 'partner' && d.type === 'aadhaar')!;
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span
                            className="cursor-pointer hover:text-gray-900 truncate max-w-[120px] sm:max-w-[180px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewDocument(doc);
                            }}
                          >
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
                    {applicationDocuments.find((d) => d.belongsTo === 'partner' && d.type === 'aadhaar') && (() => {
                      const doc = applicationDocuments.find((d) => d.belongsTo === 'partner' && d.type === 'aadhaar')!;
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span
                            className="cursor-pointer hover:text-gray-900 truncate max-w-[120px] sm:max-w-[180px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewDocument(doc);
                            }}
                          >
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
                    Madhyamik Admit Card / Voter ID <span className="text-gray-400 font-normal text-xs">(Optional)</span>
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
                              const type =
                                fileName.includes('voter') || fileName.includes('voterid')
                                  ? 'voter_id'
                                  : 'tenth_certificate';
                              handleFileUpload(file, type, 'partner');
                            }
                            e.target.value = '';
                          }}
                          className="hidden"
                          id="wife-second-doc"
                        />
                        <label
                          htmlFor="wife-second-doc"
                          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 lg:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-xs sm:text-sm"
                        >
                          <Upload size={14} className="sm:w-[18px] sm:h-[18px]" />
                          <span>Choose</span>
                        </label>
                      </>
                    )}
                    {/* Show unsaved document */}
                    {documents.find((d) => d.belongsTo === 'partner' && (d.type === 'tenth_certificate' || d.type === 'voter_id')) && (() => {
                      const doc = documents.find(
                        (d) => d.belongsTo === 'partner' && (d.type === 'tenth_certificate' || d.type === 'voter_id')
                      )!;
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span
                            className="cursor-pointer hover:text-gray-900 truncate max-w-[120px] sm:max-w-[180px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewDocument(doc);
                            }}
                          >
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
                    {applicationDocuments.find((d) => d.belongsTo === 'partner' && (d.type === 'tenth_certificate' || d.type === 'voter_id')) && (() => {
                      const doc = applicationDocuments.find(
                        (d) => d.belongsTo === 'partner' && (d.type === 'tenth_certificate' || d.type === 'voter_id')
                      )!;
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span
                            className="cursor-pointer hover:text-gray-900 truncate max-w-[120px] sm:max-w-[180px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewDocument(doc);
                            }}
                          >
                            {doc.name || (doc.type === 'tenth_certificate' ? 'Madhyamik Admit Card' : 'Voter ID')}
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

            {/* Section 3: Joint Photograph */}
            <div className="pt-4 sm:pt-5 lg:pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1 sm:mb-2">Joint Photograph</h3>
              <p className="text-[10px] sm:text-xs text-gray-600 mb-1">Optional: Upload a joint photo of husband and wife</p>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-3 sm:mb-4 lg:mb-6">
                <span className="text-gold-600 font-medium">Max file size: 250KB</span>
              </p>

              {/* Show saved documents from database */}
              {!isLoadingDocuments && applicationDocuments.filter((d) => d.belongsTo === 'joint' && d.type === 'photo').length > 0 && (
                <div className="mb-3 sm:mb-4 p-2.5 sm:p-4 bg-gray-50 rounded-lg">
                  <p className="text-[10px] sm:text-xs font-medium text-gray-700 mb-1.5 sm:mb-2">Previously Saved:</p>
                  <div className="space-y-1.5 sm:space-y-2">
                    {applicationDocuments
                      .filter((d) => d.belongsTo === 'joint' && d.type === 'photo')
                      .map((doc) => (
                        <div key={doc.id} className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-gray-600">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span
                            className="cursor-pointer hover:text-gray-900 truncate flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewDocument(doc);
                            }}
                          >
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

              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    Joint Photo <span className="text-gray-400 font-normal text-xs">(Optional)</span>
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
                    {documents.find((d) => d.belongsTo === 'joint' && d.type === 'photo') && (() => {
                      const doc = documents.find((d) => d.belongsTo === 'joint' && d.type === 'photo')!;
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span
                            className="cursor-pointer hover:text-gray-900 truncate max-w-[120px] sm:max-w-[180px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewDocument(doc);
                            }}
                          >
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
                    {applicationDocuments.find((d) => d.belongsTo === 'joint' && d.type === 'photo') && (() => {
                      const doc = applicationDocuments.find((d) => d.belongsTo === 'joint' && d.type === 'photo')!;
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span
                            className="cursor-pointer hover:text-gray-900 truncate max-w-[120px] sm:max-w-[180px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewDocument(doc);
                            }}
                          >
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

            {/* Section 4: Kabin / Marriage Certificate */}
            <div className="pt-4 sm:pt-5 lg:pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1 sm:mb-2">Kabin / Marriage Certificate</h3>
              <p className="text-[10px] sm:text-xs text-gray-600 mb-1">Optional: Upload Nikahnama, Kabinnama or Marriage Certificate</p>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-3 sm:mb-4 lg:mb-6">
                <span className="text-gold-600 font-medium">Max file size: 250KB</span> per document
              </p>

              {/* Show saved documents from database */}
              {!isLoadingDocuments && applicationDocuments.filter((d) => d.belongsTo === 'joint' && d.type === 'certificate').length > 0 && (
                <div className="mb-3 sm:mb-4 p-2.5 sm:p-4 bg-gray-50 rounded-lg">
                  <p className="text-[10px] sm:text-xs font-medium text-gray-700 mb-1.5 sm:mb-2">Previously Saved:</p>
                  <div className="space-y-1.5 sm:space-y-2">
                    {applicationDocuments
                      .filter((d) => d.belongsTo === 'joint' && d.type === 'certificate')
                      .map((doc) => (
                        <div key={doc.id} className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-gray-600">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span
                            className="cursor-pointer hover:text-gray-900 truncate flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewDocument(doc);
                            }}
                          >
                            Marriage Certificate / Kabin: {doc.name}
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
                    Kabin / Marriage Certificate <span className="text-gray-400 font-normal text-xs">(Optional)</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:gap-4">
                    {!documentExists('certificate', 'joint') && (
                      <>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file, 'certificate', 'joint');
                            e.target.value = '';
                          }}
                          className="hidden"
                          id="marriage-kabin-doc"
                        />
                        <label
                          htmlFor="marriage-kabin-doc"
                          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 lg:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-xs sm:text-sm"
                        >
                          <Upload size={14} className="sm:w-[18px] sm:h-[18px]" />
                          <span>Choose</span>
                        </label>
                      </>
                    )}
                    {/* Show unsaved document */}
                    {documents.find((d) => d.belongsTo === 'joint' && d.type === 'certificate') && (() => {
                      const doc = documents.find((d) => d.belongsTo === 'joint' && d.type === 'certificate')!;
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span
                            className="cursor-pointer hover:text-gray-900 truncate max-w-[120px] sm:max-w-[180px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewDocument(doc);
                            }}
                          >
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
                    {applicationDocuments.find((d) => d.belongsTo === 'joint' && d.type === 'certificate') && (() => {
                      const doc = applicationDocuments.find((d) => d.belongsTo === 'joint' && d.type === 'certificate')!;
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 min-w-0">
                          <FileText size={12} className="sm:w-4 sm:h-4 flex-shrink-0" />
                          <span
                            className="cursor-pointer hover:text-gray-900 truncate max-w-[120px] sm:max-w-[180px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewDocument(doc);
                            }}
                          >
                            {doc.name || 'Marriage Certificate / Kabin'}
                          </span>
                          <button
                            onClick={() => handlePreviewDocument(doc)}
                            className="text-blue-600 hover:text-blue-700 p-0.5 flex-shrink-0"
                            title="Preview"
                          >
                            <Eye size={12} className="sm:w-4 sm:h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveSavedDocument('certificate', 'joint')}
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
        </Card>
      )}

      {/* STEP 3: DECLARATIONS */}
      {currentStep === 3 && (
        <form className="space-y-6">
          <Card className="p-4 sm:p-6 space-y-4">
            <div className="pb-3 border-b border-gray-200">
              <h2 className="font-serif text-base sm:text-lg font-bold text-gray-900">
                Statutory Declarations
              </h2>
              <p className="text-xs text-gray-500">
                Please verify and confirm the following statutory declarations under The Bengal Muhammadan Marriages and Divorces Registration Act 1876.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200/60">
                <Checkbox
                  label="I solemnly affirm that all particulars, personal details, dates, and addresses furnished in this divorce registration application are true, genuine and accurate to the best of our knowledge and belief."
                  checked={declarationsForm.watch('accuracy') || false}
                  onChange={(e) => declarationsForm.setValue('accuracy', e.target.checked, { shouldValidate: true })}
                />
                {declarationsForm.formState.errors.accuracy && (
                  <p className="text-xs text-rose-600 mt-1 pl-6">
                    {declarationsForm.formState.errors.accuracy.message}
                  </p>
                )}
              </div>

              <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200/60">
                <Checkbox
                  label="I declare that the divorce between the parties has been pronounced or agreed legally in accordance with Muhammadan Law and there exists no legal impediment or prohibition to the registration thereof."
                  checked={declarationsForm.watch('legal') || false}
                  onChange={(e) => declarationsForm.setValue('legal', e.target.checked, { shouldValidate: true })}
                />
                {declarationsForm.formState.errors.legal && (
                  <p className="text-xs text-rose-600 mt-1 pl-6">
                    {declarationsForm.formState.errors.legal.message}
                  </p>
                )}
              </div>

              <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200/60">
                <Checkbox
                  label="I understand that registration is effected under The Bengal Muhammadan Marriages and Divorces Registration Act-1876 & Under the Indian Qaazi's Act-1880, and false statements are punishable by law."
                  checked={declarationsForm.watch('consent') || false}
                  onChange={(e) => declarationsForm.setValue('consent', e.target.checked, { shouldValidate: true })}
                />
                {declarationsForm.formState.errors.consent && (
                  <p className="text-xs text-rose-600 mt-1 pl-6">
                    {declarationsForm.formState.errors.consent.message}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </form>
      )}

      {/* STEP 4: REVIEW & SUBMIT */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <Card className="p-4 sm:p-6 space-y-5">
            <div className="pb-3 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-base sm:text-lg font-bold text-gray-900">
                  Review Application
                </h2>
                <p className="text-xs text-gray-500">
                  Please review all entered details thoroughly before final submission.
                </p>
              </div>
              <Badge variant="outline" className="text-xs text-gold-700 bg-gold-50 border-gold-300">
                Ready for submission
              </Badge>
            </div>

            {/* Husband Summary */}
            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/40 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-1.5">
                  <User size={16} className="text-gold-600" />
                  Husband: {husbandForm.watch('firstName')} {husbandForm.watch('lastName')}
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentStep(0)}
                  className="text-xs text-gold-700 hover:text-gold-800"
                >
                  <Edit size={14} className="mr-1" /> Edit
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Father:</span>{' '}
                  <span className="font-medium text-gray-900">{husbandForm.watch('fatherName')}</span>
                </div>
                <div>
                  <span className="text-gray-500">DOB:</span>{' '}
                  <span className="font-medium text-gray-900">{husbandForm.watch('dateOfBirth')}</span>
                  {husbandDetailedAge && (
                    <span className="ml-1 text-[10px] text-gold-700 font-semibold">
                      ({husbandDetailedAge.text})
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-gray-500">Aadhaar:</span>{' '}
                  <span className="font-medium text-gray-900">
                    {formatAadhaar(husbandForm.watch('aadhaarNumber'))}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Mobile:</span>{' '}
                  <span className="font-medium text-gray-900">{husbandForm.watch('mobileNumber')}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Permanent Address:</span>{' '}
                  <span className="font-medium text-gray-900">
                    {husbandForm.watch('permanentVillageStreet')}, P.O. {husbandForm.watch('permanentPostOffice')}, P.S. {husbandForm.watch('permanentPoliceStation')}, {husbandForm.watch('permanentDistrict')} - {husbandForm.watch('permanentZipCode')}
                  </span>
                </div>
              </div>
            </div>

            {/* Wife Summary */}
            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/40 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-1.5">
                  <Users size={16} className="text-rose-600" />
                  Wife: {wifeForm.watch('firstName')} {wifeForm.watch('lastName')}
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentStep(1)}
                  className="text-xs text-gold-700 hover:text-gold-800"
                >
                  <Edit size={14} className="mr-1" /> Edit
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Father:</span>{' '}
                  <span className="font-medium text-gray-900">{wifeForm.watch('fatherName')}</span>
                </div>
                <div>
                  <span className="text-gray-500">DOB:</span>{' '}
                  <span className="font-medium text-gray-900">{wifeForm.watch('dateOfBirth')}</span>
                  {wifeDetailedAge && (
                    <span className="ml-1 text-[10px] text-rose-700 font-semibold">
                      ({wifeDetailedAge.text})
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-gray-500">Aadhaar:</span>{' '}
                  <span className="font-medium text-gray-900">
                    {formatAadhaar(wifeForm.watch('aadhaarNumber'))}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Mobile:</span>{' '}
                  <span className="font-medium text-gray-900">{wifeForm.watch('mobileNumber')}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Permanent Address:</span>{' '}
                  <span className="font-medium text-gray-900">
                    {wifeForm.watch('permanentVillageStreet')}, P.O. {wifeForm.watch('permanentPostOffice')}, P.S. {wifeForm.watch('permanentPoliceStation')}, {wifeForm.watch('permanentDistrict')} - {wifeForm.watch('permanentZipCode')}
                  </span>
                </div>
              </div>
            </div>

            {/* Divorce Particulars Summary */}
            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/40 space-y-2">
              <h3 className="font-semibold text-sm text-gray-900">Divorce Details</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Date of Divorce:</span>{' '}
                  <span className="font-medium text-gray-900">{husbandForm.watch('divorceDate')}</span>
                </div>
                <div>
                  <span className="text-gray-500">Divorce Type:</span>{' '}
                  <span className="font-semibold uppercase text-rose-700">
                    {husbandForm.watch('divorceType')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Marriage Certificate:</span>{' '}
                  <span className="font-medium text-gray-900">
                    {husbandForm.watch('marriageCertificateNumber') || 'None'}
                  </span>
                </div>
                {husbandForm.watch('divorceReason') && (
                  <div className="col-span-2 sm:col-span-3">
                    <span className="text-gray-500">Reason / Notes:</span>{' '}
                    <span className="font-medium text-gray-900">{husbandForm.watch('divorceReason')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Uploaded Documents Summary (All 4 Sections matching Marriage Application) */}
            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/40 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-1.5">
                  <FileText size={16} className="text-gold-600" />
                  Uploaded Documents
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentStep(2)}
                  className="text-xs text-gold-700 hover:text-gold-800"
                >
                  <Edit size={14} className="mr-1" /> Edit
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Husband's Documents */}
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Husband's Documents</p>
                  <div className="space-y-1.5">
                    {applicationDocuments.filter((d) => d.belongsTo === 'user').map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-200 text-xs">
                        <span className="truncate font-medium text-gray-800">
                          📄 {doc.type === 'aadhaar' ? 'Aadhaar Card' : doc.type === 'tenth_certificate' ? 'Madhyamik Admit Card' : 'Voter ID'}: {doc.name}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreviewDocument(doc)}
                          className="!p-1 text-gold-600 flex-shrink-0"
                          title="Preview"
                        >
                          <Eye size={14} />
                        </Button>
                      </div>
                    ))}
                    {documents.filter((d) => d.belongsTo === 'user').map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-200 text-xs">
                        <span className="truncate font-medium text-gray-800">
                          📄 {doc.type === 'aadhaar' ? 'Aadhaar Card' : doc.type === 'tenth_certificate' ? 'Madhyamik Admit Card' : 'Voter ID'}: {doc.file.name}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreviewDocument(doc)}
                          className="!p-1 text-gold-600 flex-shrink-0"
                          title="Preview"
                        >
                          <Eye size={14} />
                        </Button>
                      </div>
                    ))}
                    {applicationDocuments.filter((d) => d.belongsTo === 'user').length === 0 &&
                      documents.filter((d) => d.belongsTo === 'user').length === 0 && (
                        <p className="text-xs text-gray-400 italic">No husband documents uploaded yet</p>
                      )}
                  </div>
                </div>

                {/* Wife's Documents */}
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Wife's Documents</p>
                  <div className="space-y-1.5">
                    {applicationDocuments.filter((d) => d.belongsTo === 'partner').map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-200 text-xs">
                        <span className="truncate font-medium text-gray-800">
                          📄 {doc.type === 'aadhaar' ? 'Aadhaar Card' : doc.type === 'tenth_certificate' ? 'Madhyamik Admit Card' : 'Voter ID'}: {doc.name}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreviewDocument(doc)}
                          className="!p-1 text-gold-600 flex-shrink-0"
                          title="Preview"
                        >
                          <Eye size={14} />
                        </Button>
                      </div>
                    ))}
                    {documents.filter((d) => d.belongsTo === 'partner').map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-200 text-xs">
                        <span className="truncate font-medium text-gray-800">
                          📄 {doc.type === 'aadhaar' ? 'Aadhaar Card' : doc.type === 'tenth_certificate' ? 'Madhyamik Admit Card' : 'Voter ID'}: {doc.file.name}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreviewDocument(doc)}
                          className="!p-1 text-gold-600 flex-shrink-0"
                          title="Preview"
                        >
                          <Eye size={14} />
                        </Button>
                      </div>
                    ))}
                    {applicationDocuments.filter((d) => d.belongsTo === 'partner').length === 0 &&
                      documents.filter((d) => d.belongsTo === 'partner').length === 0 && (
                        <p className="text-xs text-gray-400 italic">No wife documents uploaded yet</p>
                      )}
                  </div>
                </div>

                {/* Joint Photograph */}
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Joint Photograph</p>
                  <div className="space-y-1.5">
                    {applicationDocuments.filter((d) => d.belongsTo === 'joint' && d.type === 'photo').map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-200 text-xs">
                        <span className="truncate font-medium text-gray-800">
                          🖼️ Joint Photo: {doc.name}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreviewDocument(doc)}
                          className="!p-1 text-gold-600 flex-shrink-0"
                          title="Preview"
                        >
                          <Eye size={14} />
                        </Button>
                      </div>
                    ))}
                    {documents.filter((d) => d.belongsTo === 'joint' && d.type === 'photo').map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-200 text-xs">
                        <span className="truncate font-medium text-gray-800">
                          🖼️ Joint Photo: {doc.file.name}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreviewDocument(doc)}
                          className="!p-1 text-gold-600 flex-shrink-0"
                          title="Preview"
                        >
                          <Eye size={14} />
                        </Button>
                      </div>
                    ))}
                    {applicationDocuments.filter((d) => d.belongsTo === 'joint' && d.type === 'photo').length === 0 &&
                      documents.filter((d) => d.belongsTo === 'joint' && d.type === 'photo').length === 0 && (
                        <p className="text-xs text-gray-400 italic">No joint photograph uploaded yet</p>
                      )}
                  </div>
                </div>

                {/* Kabin / Marriage Certificate */}
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Kabin / Marriage Certificate</p>
                  <div className="space-y-1.5">
                    {applicationDocuments.filter((d) => d.belongsTo === 'joint' && d.type === 'certificate').map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-200 text-xs">
                        <span className="truncate font-medium text-gray-800">
                          📜 Marriage Certificate / Kabin: {doc.name}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreviewDocument(doc)}
                          className="!p-1 text-gold-600 flex-shrink-0"
                          title="Preview"
                        >
                          <Eye size={14} />
                        </Button>
                      </div>
                    ))}
                    {documents.filter((d) => d.belongsTo === 'joint' && d.type === 'certificate').map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-200 text-xs">
                        <span className="truncate font-medium text-gray-800">
                          📜 Marriage Certificate / Kabin: {doc.file.name}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreviewDocument(doc)}
                          className="!p-1 text-gold-600 flex-shrink-0"
                          title="Preview"
                        >
                          <Eye size={14} />
                        </Button>
                      </div>
                    ))}
                    {applicationDocuments.filter((d) => d.belongsTo === 'joint' && d.type === 'certificate').length === 0 &&
                      documents.filter((d) => d.belongsTo === 'joint' && d.type === 'certificate').length === 0 && (
                        <p className="text-xs text-gray-400 italic">No Kabin / Marriage certificate uploaded yet</p>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* BOTTOM ACTION BAR */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleBack}
          disabled={currentStep === 0 || isSaving || isSubmitting}
        >
          <ArrowLeft size={16} className="mr-1.5" />
          Previous
        </Button>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => saveCurrentStepDraft(false)}
            isLoading={isSaving}
            disabled={isSaving || isSubmitting}
          >
            <Save size={16} className="mr-1.5" />
            Save Draft
          </Button>

          {currentStep < steps.length - 1 ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleNext}
              isLoading={isSaving}
              disabled={isSaving}
            >
              Save & Continue
              <ArrowRight size={16} className="ml-1.5" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleFinalSubmit}
              isLoading={isSubmitting}
              disabled={isSubmitting || isSaving}
              className="bg-gold-600 hover:bg-gold-700 text-white"
            >
              <CheckCircle size={16} className="mr-1.5" />
              Submit Application
            </Button>
          )}
        </div>
      </div>

      {/* Document Preview Modal */}
      {previewDocument && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
          onClick={closePreview}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate">
                {previewDocument.file?.name || previewDocument.name || 'Document Preview'}
              </h3>
              <button
                type="button"
                onClick={closePreview}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-auto flex items-center justify-center">
              {isLoadingPreview ? (
                <div className="flex items-center gap-2 text-gray-500 py-12">
                  <Loader2 className="animate-spin text-gold-600" size={24} />
                  <span>Loading preview...</span>
                </div>
              ) : previewUrl ? (
                (previewDocument.file?.type || previewDocument.mimeType || '').startsWith('image/') ||
                  (previewDocument.file?.name || previewDocument.name || '').match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-sm"
                  />
                ) : (previewDocument.file?.type || previewDocument.mimeType) === 'application/pdf' ||
                  (previewDocument.file?.name || previewDocument.name || '').toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[70vh] rounded-lg border border-gray-200"
                    title="PDF Preview"
                  />
                ) : (
                  <div className="text-center py-8">
                    <FileText size={48} className="text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-3">Preview not available for this file type</p>
                    <a
                      href={previewUrl}
                      download={previewDocument.file?.name || previewDocument.name || 'document'}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold-600 text-white rounded-lg text-xs font-medium hover:bg-gold-700"
                    >
                      <Download size={14} /> Download File
                    </a>
                  </div>
                )
              ) : (
                <p className="text-sm text-gray-500 py-8">Failed to load preview</p>
              )}
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
};

export default DivorceFormContent;
