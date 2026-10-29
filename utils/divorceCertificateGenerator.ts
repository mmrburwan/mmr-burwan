import './polyfills';
import { registerCertificateFonts } from './pdfFonts';
import { DivorceApplication } from '../types';
import { pdf } from '@react-pdf/renderer';
import React from 'react';
import { DivorceCertificatePDF } from '../components/certificate/DivorceCertificatePDF';
import QRCodeLib from 'qrcode';

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

  if (!certNumber) return defaults;

  if (certNumber.includes('-')) {
    const parts = certNumber.split('-');
    if (parts.length >= 7 && parts[0] === 'WB' && parts[1] === 'MSD' && parts[2] === 'BRW') {
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
  }

  if (certNumber.startsWith('WBMSDBRW')) {
    const remainder = certNumber.slice(8);
    const bookMatch = remainder.match(/^([IVXLCDM]+)/);
    const book = bookMatch ? bookMatch[1] : 'I';
    let rest = bookMatch ? remainder.slice(book.length) : remainder;

    const volNumMatch = rest.match(/^(\d+)/);
    const volumeNumber = volNumMatch ? volNumMatch[1] : '1';
    rest = volNumMatch ? rest.slice(volumeNumber.length) : rest;

    let volumeLetter = '';
    const volLetterMatch = rest.match(/^([A-Za-z]+)/);
    if (volLetterMatch) {
      volumeLetter = volLetterMatch[1];
      rest = rest.slice(volumeLetter.length);
    }

    let volumeYear = '';
    let serialNumber = '';
    let serialYear = '';
    let pageNumber = '';

    const digits = rest.replace(/\D/g, '');
    if (digits.length >= 4) {
      const yearMatch = digits.match(/^(20\d{2})/);
      if (yearMatch) {
        volumeYear = yearMatch[1];
        const afterYear = digits.slice(4);
        const yearMatch2 = afterYear.match(/(20\d{2})/);
        if (yearMatch2 && yearMatch2.index !== undefined) {
          serialNumber = afterYear.slice(0, yearMatch2.index);
          serialYear = yearMatch2[1];
          pageNumber = afterYear.slice(yearMatch2.index + 4);
        } else {
          const len = afterYear.length;
          const pageLen = Math.min(3, Math.floor(len / 2)) || 1;
          serialNumber = afterYear.slice(0, len - pageLen);
          pageNumber = afterYear.slice(-pageLen);
        }
      } else {
        const len = digits.length;
        const pageLen = Math.min(3, Math.floor(len / 2)) || 1;
        serialNumber = digits.slice(0, len - pageLen);
        pageNumber = digits.slice(-pageLen);
      }
    }

    return {
      book,
      volumeNumber,
      volumeLetter,
      volumeYear,
      serialNumber: serialNumber || '1',
      serialYear,
      pageNumber: pageNumber || '1',
    };
  }

  return defaults;
};

const imageUrlToDataUrl = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to convert image to data URL:', url, error);
    return null;
  }
};

export const generateDivorceCertificateData = (application: DivorceApplication) => {
  const userDetails = application.userDetails || {};
  const partnerDetails = (application.partnerForm as any) || {};

  const certDetails = application.certificateDetails;
  let parsedCert: any;

  if (certDetails && (certDetails.bookNumber || certDetails.volumeNumber)) {
    parsedCert = {
      book: certDetails.bookNumber || 'I',
      volumeNumber: certDetails.volumeNumber || '1',
      volumeLetter: certDetails.volumeLetter || '',
      volumeYear: certDetails.volumeYear || '',
      serialNumber: certDetails.serialNumber || '1',
      serialYear: certDetails.serialYear || '',
      pageNumber: certDetails.pageNumber || '1',
    };
  } else {
    parsedCert = parseCertificateNumber(application.certificateNumber);
  }

  const volNoParts = [parsedCert.volumeNumber, parsedCert.volumeLetter, parsedCert.volumeYear].filter(Boolean);
  const volNo = volNoParts.join('-');

  const serialNoParts = [parsedCert.serialNumber, parsedCert.serialYear].filter(Boolean);
  const serialNo = serialNoParts.join('-');

  const defaultCertNumber = application.certificateNumber || 'WBMSDBRWI12024120241';
  // Keep MMR standard verification ID format as requested
  const verificationId = `MMR-BW-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  const isMinhajul = application.registrarName !== 'md_ismail_khan';

  return {
    verificationId,
    registrationDate: application.registrationDate || new Date().toISOString(),
    consecutiveNumber: defaultCertNumber,
    book: parsedCert.book,
    volNo: volNo || '1',
    serialNo: serialNo || '1',
    page: parsedCert.pageNumber || '1',
    divorceDate: application.divorceDate,
    divorceType: application.divorceType || 'talaq',
    marriageCertificateNumber: application.marriageCertificateNumber,
    registrarName: isMinhajul ? 'Minhajul Islam Khan' : 'MD Ismail Khan',
    registrarLicense: isMinhajul ? '03 OF 2017' : '02 OF 2015',
    registrarOffice: 'Vill.& P.O. Gramshalika, P.S. Burwan, Dist. Murshidabad, PIN- 742132',
    registrarPhone: '+91 97335 14125',
    registrarEmail: 'mmrburwan@gmail.com',
    husbandFirstName: userDetails.firstName || 'Husband',
    husbandLastName: userDetails.lastName || '',
    husbandFatherName: (userDetails as any).fatherName || 'N/A',
    wifeFirstName: partnerDetails.firstName || 'Wife',
    wifeLastName: partnerDetails.lastName || '',
    wifeFatherName: partnerDetails.fatherName || 'N/A',
  };
};

export const generateDivorceCertificatePDFBlob = async (application: DivorceApplication) => {
  registerCertificateFonts();
  const certificateData = generateDivorceCertificateData(application);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://mmrburwan.netlify.app';

  let borderImageDataUrl: string | null = null;
  let emblemImageDataUrl: string | null = null;

  try {
    borderImageDataUrl = await imageUrlToDataUrl(`${baseUrl}/assets/certificate/border.png`);
  } catch (error) {
    console.error('Failed to load border image:', error);
  }

  try {
    emblemImageDataUrl = await imageUrlToDataUrl(`${baseUrl}/assets/certificate/emblem-india.png`);
  } catch (error) {
    console.error('Failed to load emblem image:', error);
  }

  const certificateNumber = application.certificateNumber || certificateData.consecutiveNumber;
  const verificationUrl = `${baseUrl}/verify/${certificateNumber}`;

  let qrCodeImage: string | null = null;
  try {
    qrCodeImage = await QRCodeLib.toDataURL(verificationUrl, {
      width: 68,
      margin: 1,
      color: {
        dark: '#874313',
        light: '#FFFFFF',
      },
    });
  } catch (error) {
    console.error('Failed to generate QR code:', error);
  }

  const doc = React.createElement(DivorceCertificatePDF, {
    application,
    certificateData,
    qrCodeImage,
    borderImageDataUrl,
    emblemImageDataUrl,
  });

  const blob = await pdf(doc).toBlob();
  return { blob, certificateData };
};

export const downloadDivorceCertificate = async (application: DivorceApplication) => {
  const { blob, certificateData } = await generateDivorceCertificatePDFBlob(application);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileIdentifier = certificateData.consecutiveNumber || certificateData.verificationId;
  link.download = `Divorce-Certificate-${fileIdentifier}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return certificateData;
};

export const viewDivorceCertificate = async (application: DivorceApplication): Promise<void> => {
  const { blob } = await generateDivorceCertificatePDFBlob(application);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
};

