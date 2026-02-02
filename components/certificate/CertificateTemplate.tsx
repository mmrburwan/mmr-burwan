import React from 'react';
import { Application } from '../../types';
import { safeFormatDate } from '../../utils/dateUtils';
import { formatAadhaar } from '../../utils/formatUtils';

// Format address using exact fields from the application form
const formatAddressDisplay = (address: any): string => {
  if (!address) return 'N/A';

  const parts = [];

  // Village/Street - use villageStreet field first, fallback to street
  const village = address.villageStreet || address.street || '';
  if (village) {
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

  return parts.length > 0 ? parts.join(', ') : 'N/A';
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

  // Try to load images, fallback to placeholders if not found
  const borderImage = '/assets/certificate/border.png';
  const emblemImage = '/assets/certificate/emblem-india.png';
  const wbLogoImage = '/assets/certificate/west-bengal-logo.png';

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
      <div style={{ position: 'relative', zIndex: 1, paddingTop: '15px' }}>
        {/* Header Section */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 style={{
            fontSize: '18px',
            fontWeight: 'bold',
            marginBottom: '8px',
            letterSpacing: '1px',
            color: '#1a1a1a'
          }}>
            GOVERNMENT OF WEST BENGAL
          </h1>
          <h2 style={{
            fontSize: '16px',
            fontWeight: 'bold',
            marginBottom: '15px',
            color: '#1a1a1a'
          }}>
            LAW DEPARTMENT
          </h2>

          {/* Emblem */}
          <div style={{ margin: '15px auto', width: '80px', height: '80px' }}>
            <img
              src={emblemImage}
              alt="Emblem of India"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>

          {/* Office Details */}
          <div style={{ marginTop: '15px', fontSize: '12px', lineHeight: '1.6' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>
              OFFICE OF THE MUHAMMADAN MARRIAGE REGISTRAR & QAAZI
            </p>
            <p style={{ marginBottom: '3px' }}>
              VILL. & P.O. GRAMSHALIKA, P.S. BURWAN, DIST. MURSHIDABAD, PIN- 742132
            </p>
            <p style={{ fontSize: '11px', fontStyle: 'italic', marginTop: '5px' }}>
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
              <p><strong>Phone No:</strong> {userDetails.mobileNumber || 'N/A'}</p>
              <p style={{ marginTop: '8px' }}><strong>Present Address:</strong></p>
              <p style={{ fontSize: '10px', marginLeft: '10px' }}>
                {formatAddressDisplay((userCurrentAddress.villageStreet || userCurrentAddress.street) ? userCurrentAddress : userAddress)}
              </p>
              <p style={{ marginTop: '8px' }}><strong>Permanent Address:</strong></p>
              <p style={{ fontSize: '10px', marginLeft: '10px' }}>
                {formatAddressDisplay(userAddress)}
              </p>
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
              <p><strong>Phone No:</strong> {partnerDetails.mobileNumber || 'N/A'}</p>
              <p style={{ marginTop: '8px' }}><strong>Present Address:</strong></p>
              <p style={{ fontSize: '10px', marginLeft: '10px' }}>
                {formatAddressDisplay((partnerCurrentAddress.villageStreet || partnerCurrentAddress.street) ? partnerCurrentAddress : partnerAddress)}
              </p>
              <p style={{ marginTop: '8px' }}><strong>Permanent Address:</strong></p>
              <p style={{ fontSize: '10px', marginLeft: '10px' }}>
                {formatAddressDisplay(partnerAddress)}
              </p>
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
              <strong>Contact:</strong> 📞 {registrarPhone} | ✉️ {registrarEmail}
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
          marginTop: '40px',
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

