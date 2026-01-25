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

// Normalize certificate number - convert hyphenated format to compact format
const normalizeCertificateNumber = (certNumber: string): string => {
  // If already compact (starts with WBMSDBRW without hyphen), return as is
  if (certNumber.startsWith('WBMSDBRW') && !certNumber.includes('-')) {
    return certNumber;
  }
  // If hyphenated, remove all hyphens
  if (certNumber.includes('-')) {
    // Convert WB-MSD-BRW-... to WBMSDBRW...
    return certNumber.replace(/-/g, '').replace('WBMSDBRW', 'WBMSDBRW');
  }
  return certNumber;
};

// Parse certificate number with support for both compact (no hyphens) and legacy (hyphenated) formats
const parseCertificateNumber = (certNumber: string | undefined) => {
  const defaults = {
    book: 'I',
    volumeNumber: '1',
    volumeLetter: '',
    volumeYear: '',
    serialNumber: '1',
    serialYear: '',
    pageNumber: '1',
  };

  if (!certNumber) {
    return defaults;
  }

  // Check if it's legacy hyphenated format
  if (certNumber.includes('-')) {
    const parts = certNumber.split('-');
    if (parts.length >= 7 && parts[0] === 'WB' && parts[1] === 'MSD' && parts[2] === 'BRW') {
      // Handle legacy format - simplified extraction
      const afterPrefix = parts.slice(3);
      return {
        book: afterPrefix[0] || 'I',
        volumeNumber: afterPrefix[1] || '1',
        volumeLetter: afterPrefix[2] && /^[A-Za-z]+$/.test(afterPrefix[2]) ? afterPrefix[2] : '',
        volumeYear: afterPrefix[3] && /^\d+$/.test(afterPrefix[3]) ? afterPrefix[3] : '',
        serialNumber: afterPrefix[4] || afterPrefix[2] || '1',
        serialYear: afterPrefix[5] || '',
        pageNumber: afterPrefix[afterPrefix.length - 1] || '1',
      };
    }
    return defaults;
  }

  // New compact format: WBMSDBRW followed by components
  if (!certNumber.startsWith('WBMSDBRW')) {
    return defaults;
  }

  // Remove the prefix
  const remainder = certNumber.slice(8); // "WBMSDBRW".length = 8

  // Extract book number (Roman numerals at the start)
  const bookMatch = remainder.match(/^([IVXLCDM]+)/);
  if (!bookMatch) {
    return defaults;
  }
  const book = bookMatch[1];
  let rest = remainder.slice(book.length);

  // Match volumeNumber (1+ digits at the start of rest)
  const volNumMatch = rest.match(/^(\d+)/);
  if (!volNumMatch) {
    return { ...defaults, book };
  }
  const volumeNumber = volNumMatch[1];
  rest = rest.slice(volumeNumber.length);

  // Check if next characters are letters (volumeLetter)
  let volumeLetter = '';
  const volLetterMatch = rest.match(/^([A-Za-z]+)/);
  if (volLetterMatch) {
    volumeLetter = volLetterMatch[1];
    rest = rest.slice(volumeLetter.length);
  }

  // Parse remaining digits
  let volumeYear = '';
  let serialNumber = '1';
  let serialYear = '';
  let pageNumber = '1';

  if (/^\d+$/.test(rest)) {
    const digits = rest;
    const len = digits.length;

    if (len >= 2) {
      if (len >= 8 && /^\d{4}/.test(digits)) {
        // volumeYear(4) + serialNumber + serialYear(4) + pageNumber
        volumeYear = digits.slice(0, 4);
        const afterVolYear = digits.slice(4);
        const serialYearMatch = afterVolYear.match(/^(\d{1,3})(\d{4})(\d+)$/);
        if (serialYearMatch) {
          serialNumber = serialYearMatch[1];
          serialYear = serialYearMatch[2];
          pageNumber = serialYearMatch[3];
        } else {
          const mid = Math.floor(afterVolYear.length / 2);
          serialNumber = afterVolYear.slice(0, mid || 1);
          pageNumber = afterVolYear.slice(mid || 1) || '1';
        }
      } else if (len >= 6 && /^\d{4}/.test(digits)) {
        volumeYear = digits.slice(0, 4);
        const afterVolYear = digits.slice(4);
        const mid = Math.floor(afterVolYear.length / 2);
        serialNumber = afterVolYear.slice(0, mid || 1);
        pageNumber = afterVolYear.slice(mid || 1) || '1';
      } else {
        // No 4-digit year, just serialNumber + pageNumber
        const pageLen = Math.min(3, Math.floor(len / 2)) || 1;
        serialNumber = digits.slice(0, len - pageLen) || '1';
        pageNumber = digits.slice(-pageLen) || '1';
      }
    }
  }

  return {
    book,
    volumeNumber: volumeNumber || '1',
    volumeLetter,
    volumeYear,
    serialNumber: serialNumber || '1',
    serialYear,
    pageNumber: pageNumber || '1',
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

  // Use stored certificate number if available, otherwise generate a default (compact format)
  // Normalize to convert any legacy hyphenated format
  const rawCertNumber = application.certificateNumber || `WBMSDBRWI1C${currentYear}${Math.floor(Math.random() * 50) + 1}${currentYear + 1}${Math.floor(Math.random() * 30) + 1}`;
  const consecutiveNumber = normalizeCertificateNumber(rawCertNumber);
  const verificationId = `MMR-BW-${currentYear}-${String(Date.now()).slice(-6)}`;

  // Parse certificate number to extract components (parse the normalized version)
  const certParts = parseCertificateNumber(consecutiveNumber);

  // Format volume number: "1-C/2024", "1-C", "1/2024", or "1"
  // Handle empty volumeLetter to avoid trailing dashes
  const volNo = (() => {
    const parts = [certParts.volumeNumber, certParts.volumeLetter].filter(Boolean);
    const basePart = parts.join('-');
    return certParts.volumeYear ? `${basePart}/${certParts.volumeYear}` : basePart;
  })();

  // Format serial number: "3/2026" or "3" if serialYear is empty
  const serialNo = certParts.serialYear
    ? `${certParts.serialNumber}/${certParts.serialYear}`
    : certParts.serialNumber;

  // Determine registrar information based on application.registrarName
  // Default to minhajul_islam_khan for backward compatibility
  const registrarNameValue = application.registrarName || 'minhajul_islam_khan';

  const registrarInfo = {
    minhajul_islam_khan: {
      name: 'MINHAJUL ISLAM KHAN',
      license: '04L(St.)/LW/O/St./4M-123/2019',
      qualifications: undefined,
      office: 'VILL. & P.O- GRAMSHALIKA, P.S- BURWAN, DIST- MURSHIDABAD, WEST BENGAL, PIN-742132',
      phone: '9647724532',
      email: 'mmrburwan@gmail.com',
    },
    md_ismail_khan: {
      name: 'SENIOR MUFTI MAULANA AL-HAJJ MD ISMAIL KHAN',
      qualifications: 'M.M.M.F. (CAL), M.A. ALIGARH MUSLIM UNIVERSITY',
      license: '2203, 2204',
      office: 'VILL & PO- GRAMSHALIKA, PS- BURWAN, DIST- MURSHIDABAD, WEST BENGAL, PIN- 742132',
      phone: '9732688698',
      email: 'mmrburwan@gmail.com',
    },
  };

  const selectedRegistrar = registrarInfo[registrarNameValue as keyof typeof registrarInfo] || registrarInfo.minhajul_islam_khan;

  return {
    verificationId,
    registrationDate,
    consecutiveNumber,
    book: certParts.book,
    volNo: volNo,
    serialNo: serialNo,
    page: certParts.pageNumber,
    marriageDate,
    registrarName: selectedRegistrar.name,
    registrarLicense: selectedRegistrar.license,
    registrarQualifications: selectedRegistrar.qualifications,
    registrarOffice: selectedRegistrar.office,
    registrarPhone: selectedRegistrar.phone,
    registrarEmail: selectedRegistrar.email,
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

  // Convert static certificate images to data URLs
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://mmrburwan.netlify.app';

  let borderImageDataUrl: string | null = null;
  let emblemImageDataUrl: string | null = null;
  let westBengalLogoDataUrl: string | null = null;

  try {
    // Convert border image
    borderImageDataUrl = await imageUrlToDataUrl(`${baseUrl}/assets/certificate/border.png`);
  } catch (error) {
    console.error('Failed to load border image:', error);
  }

  try {
    // Convert emblem image
    emblemImageDataUrl = await imageUrlToDataUrl(`${baseUrl}/assets/certificate/emblem-india.png`);
  } catch (error) {
    console.error('Failed to load emblem image:', error);
  }

  try {
    // Convert West Bengal logo
    westBengalLogoDataUrl = await imageUrlToDataUrl(`${baseUrl}/assets/certificate/west-bengal-logo.png`);
  } catch (error) {
    console.error('Failed to load West Bengal logo:', error);
  }

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

  // Generate PDF using React PDF with the data URLs
  const doc = React.createElement(CertificatePDF, {
    application,
    certificateData,
    jointPhotoDataUrl,
    qrCodeImage,
    borderImageDataUrl,
    emblemImageDataUrl,
    westBengalLogoDataUrl,
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
