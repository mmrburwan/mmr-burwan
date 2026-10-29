if (typeof window === 'undefined' || !globalThis.localStorage || typeof (globalThis.localStorage as any).getItem !== 'function') {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] || null,
    length: 0,
  } as any;
}

import { describe, it, expect } from 'vitest';
import { divorceApplicationService } from '../services/divorceApplication';
import { divorceCertificateService } from '../services/divorceCertificates';
import { generateDivorceCertificateData } from '../utils/divorceCertificateGenerator';
import { DivorceApplication } from '../types';

describe('Divorce Feature Tests', () => {
  it('should map database row to DivorceApplication correctly', () => {
    const mockDbRow = {
      id: 'd9b936eb-f63b-47e3-b31c-3b320d7718e0',
      user_id: '81ff92bc-07e8-46cb-8b5e-2d93e2a77a94',
      status: 'submitted',
      progress: 100,
      marriage_certificate_number: 'WBMSDBRWI1C2024123202445',
      user_details: {
        firstName: 'Tariq',
        lastName: 'Ahmed',
        fatherName: 'Kabir Ahmed',
        dateOfBirth: '1995-04-12',
        aadhaarNumber: '123456789012',
        mobileNumber: '9876543210',
      },
      partner_form: {
        firstName: 'Fatima',
        lastName: 'Khatun',
        fatherName: 'Rahim Khan',
        dateOfBirth: '1998-08-20',
        aadhaarNumber: '987654321098',
        mobileNumber: '9123456780',
      },
      user_address: {
        villageStreet: 'Gramshalika',
        postOffice: 'Gramshalika',
        policeStation: 'Burwan',
        district: 'Murshidabad',
        state: 'WEST BENGAL',
        zipCode: '742132',
      },
      partner_address: {
        villageStreet: 'Kandi',
        postOffice: 'Kandi',
        policeStation: 'Kandi',
        district: 'Murshidabad',
        state: 'WEST BENGAL',
        zipCode: '742137',
      },
      divorce_date: '2026-10-29',
      divorce_type: 'talaq',
      divorce_reason: 'Irreconcilable differences',
      verified: true,
      certificate_number: 'WBMSDBRWI12026120261',
      registration_date: '2026-10-29',
      registrar_name: 'minhajul_islam_khan',
      certificate_details: {
        bookNumber: 'I',
        volumeNumber: '1',
        volumeLetter: '',
        volumeYear: '2026',
        serialNumber: '1',
        serialYear: '2026',
        pageNumber: '1',
      },
      created_at: '2026-10-29T10:00:00Z',
      documents: [],
    };

    const mapped = divorceApplicationService.mapDivorceApplication(mockDbRow);

    expect(mapped.id).toBe(mockDbRow.id);
    expect(mapped.userId).toBe(mockDbRow.user_id);
    expect(mapped.verified).toBe(true);
    expect(mapped.certificateNumber).toBe('WBMSDBRWI12026120261');
    expect(mapped.divorceType).toBe('talaq');
    expect(mapped.divorceDate).toBe('2026-10-29');
    expect(mapped.userDetails?.firstName).toBe('Tariq');
    expect(mapped.partnerForm?.firstName).toBe('Fatima');
  });

  it('should map database row to DivorceCertificate correctly', () => {
    const mockCertRow = {
      id: 'cert-12345',
      user_id: 'user-12345',
      divorce_application_id: 'app-12345',
      verification_id: 'MMR-BW-2026-999888',
      name: 'Divorce Registration Certificate',
      issued_on: '2026-10-29T10:00:00Z',
      verified: true,
      certificate_number: 'WBMSDBRWI12026120261',
      registration_date: '2026-10-29',
      husband_name: 'Tariq Ahmed',
      wife_name: 'Fatima Khatun',
      can_download: true,
    };

    const cert = divorceCertificateService.mapCertificate(mockCertRow);

    expect(cert.id).toBe('cert-12345');
    expect(cert.verificationId).toBe('MMR-BW-2026-999888');
    expect(cert.certificateNumber).toBe('WBMSDBRWI12026120261');
    expect(cert.husbandName).toBe('Tariq Ahmed');
    expect(cert.wifeName).toBe('Fatima Khatun');
    expect(cert.canDownload).toBe(true);
  });

  it('should generate divorce certificate data maintaining standard WBMSDBRW and MMR-BW formats without DVR', () => {
    const mockApp: DivorceApplication = {
      id: 'app-999',
      userId: 'user-999',
      status: 'approved',
      progress: 100,
      certificateNumber: 'WBMSDBRWI2A20265202612',
      registrationDate: '2026-10-29',
      registrarName: 'minhajul_islam_khan',
      divorceDate: '2026-10-25',
      divorceType: 'khula',
      marriageCertificateNumber: 'WBMSDBRWI1C202410',
      userDetails: {
        firstName: 'Imran',
        lastName: 'Hossain',
        fatherName: 'Altaf Hossain',
        dateOfBirth: '1992-05-15',
        aadhaarNumber: '111122223333',
        mobileNumber: '9988776655',
        voterOrRollNo: '',
      },
      partnerForm: {
        firstName: 'Salma',
        lastName: 'Parveen',
        fatherName: 'Latif Mondal',
        dateOfBirth: '1996-03-10',
        aadhaarNumber: '444455556666',
        idNumber: '444455556666',
        mobileNumber: '9988776644',
        voterOrRollNo: '',
        address: {
          villageStreet: 'Burwan',
          postOffice: 'Burwan',
          policeStation: 'Burwan',
          district: 'Murshidabad',
          state: 'WEST BENGAL',
          zipCode: '742132',
          country: 'India',
        },
      },
      documents: [],
      verified: true,
      lastUpdated: new Date().toISOString(),
    };

    const certData = generateDivorceCertificateData(mockApp);

    // Verify format adheres to user requirements: KEEP MMR NO NEED DVR, NO NEED TO ADD DVR
    expect(certData.consecutiveNumber).toBe('WBMSDBRWI2A20265202612');
    expect(certData.consecutiveNumber.startsWith('WBMSDBRW')).toBe(true);
    expect(certData.consecutiveNumber.includes('DVR')).toBe(false);

    expect(certData.verificationId.startsWith('MMR-BW-')).toBe(true);
    expect(certData.verificationId.includes('DVR')).toBe(false);

    // Check husband and wife
    expect(certData.husbandFirstName).toBe('Imran');
    expect(certData.wifeFirstName).toBe('Salma');
    expect(certData.divorceType).toBe('khula');
    expect(certData.divorceDate).toBe('2026-10-25');
    expect(certData.marriageCertificateNumber).toBe('WBMSDBRWI1C202410');
  });
});
