import { Application } from '../types';
import { pdf } from '@react-pdf/renderer';
import React from 'react';
import { CertificatePDF } from '../components/certificate/CertificatePDF';
import { documentService } from '../services/documents';
import QRCodeLib from 'qrcode';

// Generate random names for testing
const generateRandomName = () => {
  const firstNames = ['Ahmed', 'Mohammed', 'Hassan', 'Ali', 'Ibrahim', 'Omar', 'Yusuf', 'Khalid', 'Fatima', 'Aisha', 'Zainab', 'Mariam', 'Khadija', 'Aminah'];
  const lastNames = ['Khan', 'Ahmed', 'Hassan', 'Ali', 'Rahman', 'Hussain', 'Malik', 'Sheikh', 'Begum', 'Bibi'];
  return {
    firstName: firstNames[Math.floor(Math.random() * firstNames.length)],
    lastName: lastNames[Math.floor(Math.random() * lastNames.length)],
  };
};

// Format Aadhaar number with spaces
const formatAadhaar = (aadhaar: string | undefined): string => {
  if (!aadhaar || aadhaar === 'N/A') return 'N/A';
  const cleaned = aadhaar.replace(/\s/g, '');
  if (cleaned.length === 12) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 8)} ${cleaned.slice(8, 12)}`;
  }
  return aadhaar;
};

// Format address in the exact format: "VILL- UPARIDHA, P.O- MUKUNDAPUR, P.S- BERHAMPORE, DIST- MURSHIDABAD, WEST BENGAL, PIN- 742187"
// Uses the exact address fields from the application form
const formatAddress = (address: any): string => {
  if (!address) return 'N/A';

  const parts = [];

  // Village/Street - use villageStreet field first, fallback to street
  const village = address.villageStreet || address.street || '';
  if (village) {
    // Remove any existing VILL- prefix and add it properly
    const cleanVillage = village.toUpperCase().replace(/^VILL-?\s*/i, '').trim();
    parts.push(`VILL- ${cleanVillage}`);
  }

  // Post Office - use postOffice field first, fallback to city
  const postOffice = address.postOffice || address.city || '';
  if (postOffice) parts.push(`P.O- ${postOffice.toUpperCase()}`);

  // Police Station - use policeStation field
  const policeStation = address.policeStation || '';
  if (policeStation) parts.push(`P.S- ${policeStation.toUpperCase()}`);

  // District - use district field first, fallback to city
  const district = address.district || address.city || '';
  if (district) parts.push(`DIST- ${district.toUpperCase()}`);

  // State - use actual state from address
  const state = address.state || '';
  if (state) parts.push(state.toUpperCase());

  // PIN code
  if (address.zipCode) parts.push(`PIN- ${address.zipCode}`);

  // Only show if we have at least village/street info
  return parts.length > 0 ? parts.join(', ') : 'N/A';
};

// Parse certificate number: 
// "WB-MSD-BRW-I-1-C-2024-16-2025-21" (with both optional fields)
// "WB-MSD-BRW-I-1-C-2024-16-21" (with only volumeYear)
// "WB-MSD-BRW-I-1-C-16-2025-21" (with only serialYear)
// "WB-MSD-BRW-I-1-C-16-21" (without optional fields)
// Also handles old format with consecutive dashes for backward compatibility
const parseCertificateNumber = (certNumber: string | undefined) => {
  if (!certNumber) {
    return {
      book: 'I',
      volumeNumber: '1',
      volumeLetter: 'C',
      volumeYear: '', // Optional, default to empty
      serialNumber: '1',
      serialYear: '', // Optional, default to empty
      pageNumber: '1',
    };
  }

  // Format: WB-MSD-BRW-{book}-{volumeNumber}-{volumeLetter}-{volumeYear?}-{serialNumber}-{serialYear?}-{pageNumber}
  // volumeYear and serialYear are optional
  const parts = certNumber.split('-');

  // Must start with WB-MSD-BRW
  if (parts.length < 8 || parts[0] !== 'WB' || parts[1] !== 'MSD' || parts[2] !== 'BRW') {
    return {
      book: 'I',
      volumeNumber: '1',
      volumeLetter: 'C',
      volumeYear: '',
      serialNumber: '1',
      serialYear: '',
      pageNumber: '1',
    };
  }

  // Base structure: WB-MSD-BRW-book-volNum-volLet-[volYear?]-serialNum-[serialYear?]-pageNum
  // 8 parts = no optional fields: WB-MSD-BRW-book-volNum-volLet-serialNum-pageNum
  // 9 parts = one optional field
  // 10 parts = both optional fields
  if (parts.length === 8) {
    // No optional fields: WB-MSD-BRW-book-volNum-volLet-serialNum-pageNum
    return {
      book: parts[3] || 'I',
      volumeNumber: parts[4] || '1',
      volumeLetter: parts[5] || 'C',
      volumeYear: '',
      serialNumber: parts[6] || '1',
      serialYear: '',
      pageNumber: parts[7] || '1',
    };
  } else if (parts.length === 9) {
    // One optional field - need to determine which one
    // Check if part[6] looks like a year (4 digits) or serial number
    const part6 = parts[6] || '';
    const isYear = /^\d{4}$/.test(part6);

    if (isYear) {
      // volumeYear present: WB-MSD-BRW-book-volNum-volLet-volYear-serialNum-pageNum
      return {
        book: parts[3] || 'I',
        volumeNumber: parts[4] || '1',
        volumeLetter: parts[5] || 'C',
        volumeYear: part6,
        serialNumber: parts[7] || '1',
        serialYear: '',
        pageNumber: parts[8] || '1',
      };
    } else {
      // serialYear present: WB-MSD-BRW-book-volNum-volLet-serialNum-serialYear-pageNum
      return {
        book: parts[3] || 'I',
        volumeNumber: parts[4] || '1',
        volumeLetter: parts[5] || 'C',
        volumeYear: '',
        serialNumber: part6,
        serialYear: parts[7] || '',
        pageNumber: parts[8] || '1',
      };
    }
  } else if (parts.length === 10) {
    // Both optional fields: WB-MSD-BRW-book-volNum-volLet-volYear-serialNum-serialYear-pageNum
    return {
      book: parts[3] || 'I',
      volumeNumber: parts[4] || '1',
      volumeLetter: parts[5] || 'C',
      volumeYear: parts[6] || '',
      serialNumber: parts[7] || '1',
      serialYear: parts[8] || '',
      pageNumber: parts[9] || '1',
    };
  } else if (parts.length >= 11) {
    // Old format with consecutive dashes (backward compatibility)
    return {
      book: parts[3] || 'I',
      volumeNumber: parts[4] || '1',
      volumeLetter: parts[5] || 'C',
      volumeYear: parts[6] || '',
      serialNumber: parts[7] || '1',
      serialYear: parts[8] || '',
      pageNumber: parts[9] || '1',
    };
  }

  // Fallback to defaults
  return {
    book: 'I',
    volumeNumber: '1',
    volumeLetter: 'C',
    volumeYear: '',
    serialNumber: '1',
    serialYear: '',
    pageNumber: '1',
  };
};

export const generateCertificateData = (application: Application) => {
  const userDetails = application.userDetails || {};
  const partnerDetails = (application as any).partnerDetails || (application as any).partnerForm || {};

  const userRandomName = generateRandomName();
  const partnerRandomName = generateRandomName();

  const currentYear = new Date().getFullYear();

  // Use stored registration date and certificate number if available, otherwise generate defaults
  const registrationDate = application.registrationDate || application.verifiedAt || application.submittedAt || new Date().toISOString();
  const marriageDate = (application.declarations as any)?.marriageDate || application.submittedAt || new Date().toISOString();

  // Use stored certificate number if available, otherwise generate a default
  const consecutiveNumber = application.certificateNumber || `WB-MSD-BRW-I-1-C-${currentYear}-${Math.floor(Math.random() * 50) + 1}-${currentYear + 1}-${Math.floor(Math.random() * 30) + 1}`;
  const verificationId = `MMR-BW-${currentYear}-${String(Date.now()).slice(-6)}`;

  // Parse certificate number to extract components
  const certParts = parseCertificateNumber(application.certificateNumber || consecutiveNumber);

  // Format volume number: "1-C/2024" or "1-C" if volumeYear is empty
  const volNo = certParts.volumeYear
    ? `${certParts.volumeNumber}-${certParts.volumeLetter}/${certParts.volumeYear}`
    : `${certParts.volumeNumber}-${certParts.volumeLetter}`;

  // Format serial number: "3/2026" or "3" if serialYear is empty
  const serialNo = certParts.serialYear
    ? `${certParts.serialNumber}/${certParts.serialYear}`
    : certParts.serialNumber;

  return {
    verificationId,
    registrationDate,
    consecutiveNumber,
    book: certParts.book,
    volNo: volNo,
    serialNo: serialNo,
    page: certParts.pageNumber,
    marriageDate,
    registrarName: 'MINHAJUL ISLAM KHAN',
    registrarLicense: '04L(St.)/LW/O/St./4M-123/2019',
    registrarOffice: 'VILL. & P.O- GRAMSALIKA, P.S- BURWAN, DIST- MURSHIDABAD, WEST BENGAL, PIN-742132',
    registrarPhone: '9732688698',
    registrarEmail: 'mmrburwan@gmail.com',
    userFirstName: (userDetails as any).firstName || userRandomName.firstName,
    userLastName: (userDetails as any).lastName || '',
    userFatherName: (userDetails as any).fatherName || `MD ${userRandomName.firstName.toUpperCase()} SK`,
    partnerFirstName: (partnerDetails as any).firstName || partnerRandomName.firstName,
    partnerLastName: (partnerDetails as any).lastName || '',
    partnerFatherName: (partnerDetails as any).fatherName || `MD ${partnerRandomName.firstName.toUpperCase()} SK`,
  };
};


// Helper function to convert image URL to base64 data URL
const imageUrlToDataUrl = async (imageUrl: string): Promise<string | null> => {
  try {
    // If it's already a data URL, return it
    if (imageUrl.startsWith('data:')) {
      return imageUrl;
    }

    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error('Failed to fetch image:', response.statusText);
      return null;
    }

    // Convert to blob
    const blob = await response.blob();

    // Convert blob to base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to data URL:', error);
    return null;
  }
};

// Generate certificate PDF blob (used for both download and upload)
const generateCertificatePDFBlob = async (application: Application): Promise<{ blob: Blob; certificateData: any }> => {
  const certificateData = generateCertificateData(application);

  // Find joint photograph and convert to data URL if it exists
  const jointPhotograph = application.documents?.find(
    (doc) => doc.type === 'photo' && doc.belongsTo === 'joint'
  );

  let jointPhotoDataUrl: string | null = null;
  if (jointPhotograph) {
    try {
      // Get signed URL for the document to ensure it's accessible
      const signedUrl = await documentService.getSignedUrl(jointPhotograph.id);
      // Convert to data URL for PDF rendering
      jointPhotoDataUrl = await imageUrlToDataUrl(signedUrl);
    } catch (error) {
      console.error('Failed to load joint photograph:', error);
      // Continue without photo if it fails
    }
  }

  // Generate QR code with verification URL
  const certificateNumber = application.certificateNumber || certificateData.consecutiveNumber;
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'http://localhost:3000'; // Fallback for server-side
  const verificationUrl = `${baseUrl}/verify/${certificateNumber}`;

  let qrCodeImage: string | null = null;
  try {
    qrCodeImage = await QRCodeLib.toDataURL(verificationUrl, {
      width: 68,
      margin: 1,
      color: {
        dark: '#874313', // Golden color matching the intro text
        light: '#FFFFFF',
      },
    });
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    // Continue without QR code if it fails
  }

  // Generate PDF using React PDF with the data URL
  const doc = React.createElement(CertificatePDF, {
    application,
    certificateData,
    jointPhotoDataUrl, // Pass the data URL instead of URL
    qrCodeImage // Pass QR code image
  });
  const blob = await pdf(doc).toBlob();

  return { blob, certificateData };
};

export const downloadCertificate = async (application: Application) => {
  const { blob, certificateData } = await generateCertificatePDFBlob(application);

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Marriage-Certificate-${certificateData.verificationId}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);

  return certificateData;
};

// Generate and upload certificate PDF to storage (for server-side use)
export const generateAndUploadCertificate = async (
  application: Application,
  supabaseClient: any
): Promise<{ pdfUrl: string; certificateData: any }> => {
  const { blob, certificateData } = await generateCertificatePDFBlob(application);

  // Convert blob to File for upload
  const fileName = `Marriage-Certificate-${certificateData.verificationId}.pdf`;
  const file = new File([blob], fileName, { type: 'application/pdf' });

  // Upload to Supabase storage
  const filePath = `${application.id || 'certificates'}/${Date.now()}-${fileName}`;

  const { error: uploadError } = await supabaseClient.storage
    .from('certificates')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload certificate PDF: ${uploadError.message}`);
  }

  // Get public URL
  const { data: urlData } = supabaseClient.storage
    .from('certificates')
    .getPublicUrl(filePath);

  return {
    pdfUrl: urlData.publicUrl,
    certificateData,
  };
};
