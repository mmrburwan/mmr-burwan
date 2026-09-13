import React from 'react';
import { Application } from '../../types';
import { safeFormatDate } from '../../utils/dateUtils';
import { formatAadhaar } from '../../utils/formatUtils';

export interface FormattedAddressDisplayLines {
  line1: string;
  line2: string;
  line3: string;
}

// Format address into 3 distinct lines:
// Line 1: VILL & P.O
// Line 2: P.S & DIST
// Line 3: State name and PIN number
const formatAddressDisplayLines = (address: any): FormattedAddressDisplayLines => {
  if (!address) return { line1: 'N/A', line2: '', line3: '' };

  if (typeof address === 'string') {
    const raw = address.trim();
    if (!raw || raw === 'N/A') return { line1: 'N/A', line2: '', line3: '' };

    const villMatch = raw.match(/VILL-?\s*([^,]+)/i);
    const poMatch = raw.match(/P\.?O\.?-?\s*([^,]+)/i);
    const psMatch = raw.match(/P\.?S\.?-?\s*([^,]+)/i);
    const distMatch = raw.match(/DIST-?\s*([^,]+)/i);
    const pinMatch = raw.match(/PIN-?\s*(\d+)/i);

    let state = '';
    const stateMatch = raw.match(/(?:DIST-?[^,]+,\s*)([A-Za-z\s]+?)(?:,\s*PIN|$)/i);
    if (stateMatch) {
      state = stateMatch[1].trim().toUpperCase();
    } else if (/WEST BENGAL/i.test(raw)) {
      state = 'WEST BENGAL';
    }

    if (villMatch || poMatch || psMatch || distMatch || pinMatch) {
      const line1Parts: string[] = [];
      if (villMatch) line1Parts.push(`VILL- ${villMatch[1].trim().toUpperCase()}`);
      if (poMatch) line1Parts.push(`P.O- ${poMatch[1].trim().toUpperCase()}`);

      const line2Parts: string[] = [];
      if (psMatch) line2Parts.push(`P.S- ${psMatch[1].trim().toUpperCase()}`);
      if (distMatch) line2Parts.push(`DIST- ${distMatch[1].trim().toUpperCase()}`);

      const line3Parts: string[] = [];
      if (state) line3Parts.push(state);
      if (pinMatch) line3Parts.push(`PIN- ${pinMatch[1].trim()}`);

      return {
        line1: line1Parts.length > 0 ? line1Parts.join(', ') + (line2Parts.length > 0 || line3Parts.length > 0 ? ',' : '') : '',
        line2: line2Parts.length > 0 ? line2Parts.join(', ') + (line3Parts.length > 0 ? ',' : '') : '',
        line3: line3Parts.join(', '),
      };
    }

    return { line1: raw, line2: '', line3: '' };
  }

  const village = address.villageStreet || address.street || '';
  const postOffice = address.postOffice || address.city || '';
  const policeStation = address.policeStation || '';
  const district = address.district || address.city || '';
  const state = address.state || '';
  const zipCode = address.zipCode || '';

  const line1Parts: string[] = [];
  if (village) {
    const cleanVillage = village.toUpperCase().replace(/^VILL-?\s*/i, '').trim();
    line1Parts.push(`VILL- ${cleanVillage}`);
  }
  if (postOffice) {
    const cleanPostOffice = postOffice.toUpperCase().replace(/^P\.?O\.?-?\s*/i, '').trim();
    line1Parts.push(`P.O- ${cleanPostOffice}`);
  }

  const line2Parts: string[] = [];
  if (policeStation) {
    const cleanPoliceStation = policeStation.toUpperCase().replace(/^P\.?S\.?-?\s*/i, '').trim();
    line2Parts.push(`P.S- ${cleanPoliceStation}`);
  }
  if (district) {
    const cleanDistrict = district.toUpperCase().replace(/^DIST-?\s*/i, '').trim();
    line2Parts.push(`DIST- ${cleanDistrict}`);
  }

  const line3Parts: string[] = [];
  if (state) {
    line3Parts.push(state.toUpperCase().trim());
  }
  if (zipCode) {
    const cleanZip = String(zipCode).toUpperCase().replace(/^PIN-?\s*/i, '').trim();
    line3Parts.push(`PIN- ${cleanZip}`);
  }

  if (line1Parts.length === 0 && line2Parts.length === 0 && line3Parts.length === 0) {
    return { line1: 'N/A', line2: '', line3: '' };
  }

  return {
    line1: line1Parts.length > 0 ? line1Parts.join(', ') + (line2Parts.length > 0 || line3Parts.length > 0 ? ',' : '') : '',
    line2: line2Parts.length > 0 ? line2Parts.join(', ') + (line3Parts.length > 0 ? ',' : '') : '',
    line3: line3Parts.join(', '),
  };
};

// Calculate address font size for HTML template to gracefully prevent overflow
const getTemplateAddressFontSize = (addr: FormattedAddressDisplayLines): string => {
  const maxLen = Math.max(
    addr.line1 ? addr.line1.length : 0,
    addr.line2 ? addr.line2.length : 0,
    addr.line3 ? addr.line3.length : 0
  );
  if (maxLen > 48) return '8px';
  if (maxLen > 40) return '8.5px';
  if (maxLen > 34) return '9px';
  return '10px';
};

const formatAddressDisplay = (address: any): string => {
  const lines = formatAddressDisplayLines(address);
  if (lines.line1 === 'N/A') return 'N/A';
  return [lines.line1, lines.line2, lines.line3].filter(Boolean).join(' ');
};

interface CertificateTemplateProps {
  application: Application;
  verificationId: string;
  registrationDate: string;
  consecutiveNumber: string;
  book: string;
  volNo: string;
  serialNo: string;
  page: string;
  marriageDate: string;
  registrarName: string;
  registrarLicense: string;
  registrarOffice: string;
  registrarPhone: string;
  registrarEmail: string;
}

const CertificateTemplate: React.FC<CertificateTemplateProps> = ({
  application,
  verificationId,
  registrationDate,
  consecutiveNumber,
  book,
  volNo,
  serialNo,
  page,
  marriageDate,
  registrarName,
  registrarLicense,
  registrarOffice,
  registrarPhone,
  registrarEmail,
}) => {
  const userDetails = application.userDetails || {};
  const partnerDetails = application.partnerDetails || application.partnerForm || {};
  const userAddress = application.userAddress || application.address || {};
  const userCurrentAddress = application.userCurrentAddress || (application as any).currentAddress || {};
  const partnerAddress = application.partnerAddress || (partnerDetails as any).address || {};
  const partnerCurrentAddress = application.partnerCurrentAddress || {};

  const userPresentAddr = formatAddressDisplayLines((userCurrentAddress.villageStreet || userCurrentAddress.street) ? userCurrentAddress : userAddress);
  const userPermanentAddr = formatAddressDisplayLines(userAddress);
  const partnerPresentAddr = formatAddressDisplayLines((partnerCurrentAddress.villageStreet || partnerCurrentAddress.street) ? partnerCurrentAddress : partnerAddress);
  const partnerPermanentAddr = formatAddressDisplayLines(partnerAddress);

  // Try to load images, fallback to placeholders if not found
  const borderImage = '/assets/certificate/border.png';
  const emblemImage = '/assets/certificate/emblem-india.png';

  return (
    <div
      className="certificate-container"
      style={{
        width: '210mm',
        minHeight: '297mm',
        margin: '0 auto',
        padding: '20mm',
        backgroundColor: '#faf8f3',
        position: 'relative',
        fontFamily: 'serif',
      }}
    >
      {/* Border Image - Background */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url(${borderImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: 0.9,
          zIndex: 0,
        }}
      />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, paddingTop: '10px' }}>
        {/* Header Section */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          {/* Emblem */}
          <div style={{ margin: '0 auto 8px', width: '65px', height: '65px' }}>
            <img
              src={emblemImage}
              alt="Emblem of India"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>

          <h1 style={{
            fontSize: '17px',
            fontWeight: 'bold',
            marginBottom: '4px',
            letterSpacing: '1px',
            color: '#1a1a1a'
          }}>
            GOVERNMENT OF WEST BENGAL
          </h1>
          <h2 style={{
            fontSize: '15px',
            fontWeight: 'bold',
            marginBottom: '10px',
            color: '#1a1a1a'
          }}>
            LAW DEPARTMENT
          </h2>

          {/* Office Details */}
          <div style={{ marginTop: '10px', fontSize: '12px', lineHeight: '1.5' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>
              OFFICE OF THE MUHAMMADAN MARRIAGE REGISTRAR & QAAZI
            </p>
            <p style={{ marginBottom: '2px' }}>
              VILL. & P.O. GRAMSHALIKA, P.S. BURWAN, DIST. MURSHIDABAD, PIN- 742132
            </p>
            <p style={{ fontSize: '11px', fontStyle: 'italic', marginTop: '4px' }}>
              Under The Bengal Muhammadan Marriages and Divorces Registration Act- 1876.
            </p>
          </div>
        </div>

        {/* Certificate Title */}
        <div style={{ textAlign: 'center', marginTop: '25px', marginBottom: '20px' }}>
          <h2 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#8b6914',
            textDecoration: 'underline',
            marginBottom: '15px',
            fontFamily: 'serif'
          }}>
            Certificate Of Marriage
          </h2>
          <p style={{
            fontSize: '12px',
            fontStyle: 'italic',
            lineHeight: '1.6',
            marginBottom: '15px',
            padding: '0 20px'
          }}>
            This is to certify that the marriage has been Registered in between the following bridegroom and bride details under the Bengal Muhammadan Marriages and Divorces Registration Act- 1876 & Under the Indian Qaazi's Act-1880.
          </p>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            marginTop: '10px',
            padding: '0 30px'
          }}>
            <div>
              <strong>Consecutive Number:</strong> {consecutiveNumber}
            </div>
            <div>
              <strong>Registration Date:</strong> {safeFormatDate(registrationDate, 'dd-MM-yyyy')}
            </div>
          </div>
        </div>

        {/* Groom and Bride Details */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          marginTop: '25px',
          marginBottom: '20px'
        }}>
          {/* Groom Details */}
          <div style={{
            border: '1px solid #d4af37',
            padding: '15px',
            borderRadius: '5px',
            backgroundColor: 'rgba(255, 255, 255, 0.7)'
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: 'bold',
              marginBottom: '12px',
              textAlign: 'center',
              color: '#8b6914',
              borderBottom: '2px solid #d4af37',
              paddingBottom: '5px'
            }}>
              Details of Groom
            </h3>
            <div style={{ fontSize: '11px', lineHeight: '1.8' }}>
              <p><strong>Name:</strong> {userDetails.firstName || 'N/A'} {userDetails.lastName || ''}</p>
              <p><strong>S/O:</strong> {userDetails.fatherName || 'N/A'}</p>
              <p><strong>DOB:</strong> {userDetails.dateOfBirth ? safeFormatDate(userDetails.dateOfBirth, 'dd-MM-yyyy') : 'N/A'}</p>
              <p><strong>Aadhaar:</strong> {formatAadhaar(userDetails.aadhaarNumber)}</p>

              <p style={{ marginTop: '8px' }}><strong>Present Address:</strong></p>
              <div style={{
                fontSize: getTemplateAddressFontSize(userPresentAddr),
                marginLeft: '10px',
                lineHeight: '1.4'
              }}>
                {userPresentAddr.line1 ? <div>{userPresentAddr.line1}</div> : null}
                {userPresentAddr.line2 ? <div>{userPresentAddr.line2}</div> : null}
                {userPresentAddr.line3 ? <div>{userPresentAddr.line3}</div> : null}
              </div>
              <p style={{ marginTop: '8px' }}><strong>Permanent Address:</strong></p>
              <div style={{
                fontSize: getTemplateAddressFontSize(userPermanentAddr),
                marginLeft: '10px',
                lineHeight: '1.4'
              }}>
                {userPermanentAddr.line1 ? <div>{userPermanentAddr.line1}</div> : null}
                {userPermanentAddr.line2 ? <div>{userPermanentAddr.line2}</div> : null}
                {userPermanentAddr.line3 ? <div>{userPermanentAddr.line3}</div> : null}
              </div>
            </div>
          </div>

          {/* Bride Details */}
          <div style={{
            border: '1px solid #d4af37',
            padding: '15px',
            borderRadius: '5px',
            backgroundColor: 'rgba(255, 255, 255, 0.7)'
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: 'bold',
              marginBottom: '12px',
              textAlign: 'center',
              color: '#8b6914',
              borderBottom: '2px solid #d4af37',
              paddingBottom: '5px'
            }}>
              Details of Bride
            </h3>
            <div style={{ fontSize: '11px', lineHeight: '1.8' }}>
              <p><strong>Name:</strong> {partnerDetails.firstName || 'N/A'} {partnerDetails.lastName || ''}</p>
              <p><strong>D/O:</strong> {(partnerDetails as any).fatherName || 'N/A'}</p>
              <p><strong>DOB:</strong> {partnerDetails.dateOfBirth ? safeFormatDate(partnerDetails.dateOfBirth, 'dd-MM-yyyy') : 'N/A'}</p>
              <p><strong>Aadhaar:</strong> {formatAadhaar(partnerDetails.aadhaarNumber || (partnerDetails as any).idNumber)}</p>

              <p style={{ marginTop: '8px' }}><strong>Present Address:</strong></p>
              <div style={{
                fontSize: getTemplateAddressFontSize(partnerPresentAddr),
                marginLeft: '10px',
                lineHeight: '1.4'
              }}>
                {partnerPresentAddr.line1 ? <div>{partnerPresentAddr.line1}</div> : null}
                {partnerPresentAddr.line2 ? <div>{partnerPresentAddr.line2}</div> : null}
                {partnerPresentAddr.line3 ? <div>{partnerPresentAddr.line3}</div> : null}
              </div>
              <p style={{ marginTop: '8px' }}><strong>Permanent Address:</strong></p>
              <div style={{
                fontSize: getTemplateAddressFontSize(partnerPermanentAddr),
                marginLeft: '10px',
                lineHeight: '1.4'
              }}>
                {partnerPermanentAddr.line1 ? <div>{partnerPermanentAddr.line1}</div> : null}
                {partnerPermanentAddr.line2 ? <div>{partnerPermanentAddr.line2}</div> : null}
                {partnerPermanentAddr.line3 ? <div>{partnerPermanentAddr.line3}</div> : null}
              </div>
            </div>
          </div>
        </div>

        {/* Social Marriage Details */}
        <div style={{
          marginTop: '20px',
          padding: '12px',
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          borderRadius: '5px',
          border: '1px solid #d4af37'
        }}>
          <h3 style={{
            fontSize: '13px',
            fontWeight: 'bold',
            marginBottom: '8px',
            color: '#8b6914'
          }}>
            Social Marriage Details
          </h3>
          <p style={{ fontSize: '12px' }}>
            <strong>Date of Marriage:</strong> {safeFormatDate(marriageDate, 'dd-MM-yyyy')}
          </p>
        </div>

        {/* Registration Details */}
        <div style={{
          marginTop: '15px',
          padding: '12px',
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          borderRadius: '5px',
          border: '1px solid #d4af37'
        }}>
          <h3 style={{
            fontSize: '13px',
            fontWeight: 'bold',
            marginBottom: '8px',
            color: '#8b6914'
          }}>
            Registration Details
          </h3>
          <div style={{ fontSize: '11px', lineHeight: '1.8' }}>
            <p><strong>Date:</strong> {safeFormatDate(registrationDate, 'dd-MM-yyyy')}</p>
            <p><strong>Book:</strong> {book}</p>
            <p><strong>Vol No:</strong> {volNo}</p>
            <p><strong>Serial No:</strong> {serialNo}</p>
            <p><strong>Page:</strong> {page}</p>
          </div>
        </div>

        {/* Wish Statement */}
        <div style={{
          textAlign: 'center',
          marginTop: '25px',
          marginBottom: '20px'
        }}>
          <p style={{
            fontSize: '14px',
            fontStyle: 'italic',
            color: '#8b6914',
            fontWeight: '500'
          }}>
            I wish them All Successful Life.
          </p>
        </div>

        {/* Registrar Details */}
        <div style={{
          marginTop: '30px',
          padding: '15px',
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          borderRadius: '5px',
          border: '1px solid #d4af37'
        }}>
          <h3 style={{
            fontSize: '13px',
            fontWeight: 'bold',
            marginBottom: '12px',
            color: '#8b6914'
          }}>
            Muhammadan Marriage Registrar & Qaazi Details
          </h3>
          <div style={{ fontSize: '11px', lineHeight: '1.8' }}>
            <p><strong>Name:</strong> {registrarName}</p>
            <p><strong>Licence No:</strong> {registrarLicense}</p>
            <p><strong>Office Address:</strong> {registrarOffice}</p>
            <p style={{ marginTop: '8px' }}>
              <strong>Contact:</strong> {registrarPhone ? `📞 ${registrarPhone} | ` : ''}✉️ {registrarEmail} | 🌐 mmrburwan.com
            </p>
          </div>
        </div>

        {/* Photo and QR Code Section */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginTop: '25px',
          padding: '15px',
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          borderRadius: '5px'
        }}>
          <div style={{ flex: '1' }}>
            {/* Placeholder for couple photo */}
            <div style={{
              width: '120px',
              height: '150px',
              border: '2px solid #d4af37',
              borderRadius: '5px',
              backgroundColor: '#f5f5f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: '#999',
              textAlign: 'center',
              padding: '5px'
            }}>
              Couple Photo
            </div>
          </div>
          <div style={{ flex: '1', textAlign: 'right' }}>
            {/* QR Code Placeholder */}
            <div style={{
              width: '100px',
              height: '100px',
              border: '2px solid #d4af37',
              borderRadius: '5px',
              backgroundColor: '#f5f5f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: '#999',
              marginLeft: 'auto'
            }}>
              QR Code
            </div>
            <p style={{ fontSize: '9px', marginTop: '5px', color: '#666' }}>
              Verification ID: {verificationId}
            </p>
          </div>
        </div>

        {/* Signature Section */}
        <div style={{
          marginTop: '65px',
          textAlign: 'right',
          paddingRight: '30px'
        }}>
          <div style={{
            borderTop: '2px solid #000',
            width: '200px',
            marginLeft: 'auto',
            paddingTop: '5px',
            fontSize: '11px'
          }}>
            Signature of Registrar with Seal
          </div>
        </div>
      </div>
    </div>
  );
};

export default CertificateTemplate;

