import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';
import { Application } from '../../types';
import { safeFormatDate } from '../../utils/dateUtils';

// Helper function to get image URL for local assets
const getImageUrl = (path: string): string => {
  // If it's already a full URL (http/https), return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // For relative paths (local assets), prepend origin
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }
  return path;
};

// Register Times font family
Font.register({
  family: 'Times',
  fonts: [
    { src: '/fonts/times.ttf', fontWeight: 'normal', fontStyle: 'normal' },
    { src: '/fonts/timesbd.ttf', fontWeight: 'bold', fontStyle: 'normal' },
    { src: '/fonts/timesi.ttf', fontWeight: 'normal', fontStyle: 'italic' },
    { src: '/fonts/timesbi.ttf', fontWeight: 'bold', fontStyle: 'italic' },
  ],
});

// Register Arial font family
Font.register({
  family: 'Arial',
  fonts: [
    { src: '/fonts/arial.ttf', fontWeight: 'normal' },
    { src: '/fonts/arialbd.ttf', fontWeight: 'bold' },
  ],
});

// Register Calibri font family
Font.register({
  family: 'Calibri',
  fonts: [
    { src: '/fonts/calibri.ttf', fontWeight: 'normal' },
    { src: '/fonts/calibrib.ttf', fontWeight: 'bold' },
  ],
});

// Register Old English font
Font.register({
  family: 'OldEnglish',
  src: '/fonts/OLDENGL.TTF',
});

// Register Script MT Bold font
Font.register({
  family: 'ScriptMTBold',
  src: '/fonts/SCRIPTBL.TTF',
});

// Format Aadhaar number with spaces
const formatAadhaar = (aadhaar: string | undefined): string => {
  if (!aadhaar || aadhaar === 'N/A') return 'N/A';
  const cleaned = aadhaar.replace(/\s/g, '');
  if (cleaned.length === 12) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 8)} ${cleaned.slice(8, 12)}`;
  }
  return aadhaar;
};

// Format address matching original format
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

interface CertificatePDFProps {
  application: Application;
  certificateData: {
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
    userFirstName: string;
    userLastName: string;
    userFatherName: string;
    partnerFirstName: string;
    partnerLastName: string;
    partnerFatherName: string;
  };
  jointPhotoDataUrl?: string | null;
  qrCodeImage?: string | null;
}

// Exact colors from the original
const GOLD = '#8B6914';
const GREEN = '#006400';
const RED = '#8B0000';
const BLACK = '#000000';
const WHITE = '#FFFFFF';

const styles = StyleSheet.create({
  page: {
    position: 'relative',
    backgroundColor: WHITE,
  },
  borderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  borderImage: {
    width: '100%',
    height: '100%',
    objectFit: 'fill',
  },
  content: {
    position: 'relative',
    zIndex: 1,
    padding: '55 45 35 45', // Increased top padding to shift content down
  },
  
  // ===== HEADER =====
  header: {
    textAlign: 'center',
    marginBottom: 4,
  },
  logosContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    margin: '-8 auto 2',
  },
  emblemContainer: {
    width: 40,
    height: 40,
  },
  emblem: {
    width: 40,
    height: 40,
    objectFit: 'contain',
  },
  westBengalLogo: {
    width: 40,
    height: 40,
    objectFit: 'contain',
  },
  govTitle: {
    fontFamily: 'Times',
    fontSize: 16,
    fontWeight: 'bold',
    color: BLACK,
    marginBottom: 1,
  },
  lawDeptBox: {
    backgroundColor: WHITE,
    padding: '2 15',
    marginBottom: 2,
    alignSelf: 'center',
  },
  lawDeptText: {
    fontFamily: 'Times',
    fontSize: 16,
    fontWeight: 'bold',
    color: BLACK,
    textDecoration: 'underline',
  },
  officeTitle: {
    fontFamily: 'Times',
    fontSize: 11,
    fontWeight: 'bold',
    color: BLACK,
    marginBottom: 1,
  },
  officeAddress: {
    fontFamily: 'Arial',
    fontSize: 9,
    fontWeight: 'bold',
    color: BLACK,
    marginBottom: 1,
  },
  actText: {
    fontFamily: 'Arial',
    fontSize: 9,
    fontWeight: 'bold',
    color: BLACK,
  },
  
  // ===== CERTIFICATE TITLE =====
  titleSection: {
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  certificateTitle: {
    fontFamily: 'OldEnglish',
    fontSize: 30,
    color: '#3A1F03',
    marginBottom: 4,
    textDecoration: 'underline',
  },
  introText: {
    fontFamily: 'Times',
    fontSize: 10,
    fontStyle: 'italic',
    color: '#874313',
    lineHeight: 1.3,
    paddingHorizontal: 10,
    textAlign: 'center',
    marginBottom: 4,
  },
  
  // ===== CONSECUTIVE ROW =====
  consecutiveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
    marginBottom: 4,
  },
  consecutiveText: {
    fontFamily: 'Times',
    fontSize: 10,
    color: BLACK,
  },
  boldText: {
    fontWeight: 'bold',
  },
  
  // ===== DETAILS BOXES =====
  detailsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  detailBox: {
    flex: 1,
    border: `1.5 solid ${GOLD}`,
  },
  detailBoxHeader: {
    padding: '2 8',
  },
  detailBoxTitle: {
    fontFamily: 'Times',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#833C0B',
    textDecoration: 'underline',
  },
  detailBoxBody: {
    padding: '2 8',
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 0.2,
  },
  fieldLabel: {
    fontFamily: 'Times',
    fontSize: 12,
    fontWeight: 'bold',
    color: BLACK,
    width: 55,
  },
  fieldValue: {
    fontFamily: 'Times',
    fontSize: 12,
    color: BLACK,
    flex: 1,
  },
  addressBlock: {
    marginTop: 0.5,
  },
  addressTitle: {
    fontFamily: 'Times',
    fontSize: 12,
    fontWeight: 'bold',
    color: BLACK,
    textDecoration: 'underline',
    marginBottom: 0.2,
  },
  addressValue: {
    fontFamily: 'Times',
    fontSize: 12,
    color: BLACK,
    lineHeight: 1.0,
  },
  
  // ===== SECTION BOXES =====
  sectionBox: {
    marginBottom: 2,
  },
  sectionTitle: {
    fontFamily: 'Times',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#833C0B',
    textDecoration: 'underline',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0.5,
  },
  sectionLabel: {
    fontFamily: 'Times',
    fontSize: 10,
    fontWeight: 'bold',
    color: BLACK,
  },
  sectionValue: {
    fontFamily: 'Times',
    fontSize: 10,
    color: BLACK,
  },
  
  // ===== REGISTRATION DETAILS =====
  regDetailsContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 1,
  },
  regItem: {
    flexDirection: 'row',
  },
  
  // ===== WISH STATEMENT =====
  wishSection: {
    textAlign: 'center',
    marginVertical: 3,
  },
  wishText: {
    fontFamily: 'Times',
    fontSize: 14,
    fontWeight: 'bold',
    fontStyle: 'italic',
    color: BLACK,
  },
  
  // ===== REGISTRAR BOX =====
  registrarBox: {
    marginBottom: 4,
  },
  registrarTitle: {
    fontFamily: 'Times',
    fontSize: 11,
    fontWeight: 'bold',
    fontStyle: 'italic',
    color: '#833C0B',
    textDecoration: 'underline',
    marginBottom: 1,
  },
  registrarRow: {
    flexDirection: 'row',
    marginBottom: 0.5,
  },
  registrarLabel: {
    fontFamily: 'Times',
    fontSize: 10,
    fontWeight: 'bold',
    color: BLACK,
  },
  registrarValue: {
    fontFamily: 'Times',
    fontSize: 10,
    color: BLACK,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0.5,
    gap: 20,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 14,
    height: 14,
    marginRight: 6,
    objectFit: 'contain',
  },
  iconContainer: {
    width: 14,
    height: 14,
    marginRight: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // ===== BOTTOM SECTION =====
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 3,
  },
  couplePhotoBox: {
    width: 127.5, // 4.5 cm (matches 4.5:3 crop aspect ratio)
    height: 85, // 3 cm (matches 4.5:3 crop aspect ratio)
    border: `1.5 solid ${GOLD}`,
    backgroundColor: '#f5f5f5',
  },
  qrSection: {
    alignItems: 'flex-end',
  },
  qrBox: {
    width: 68,
    height: 68,
    border: `1.5 solid ${GOLD}`,
    backgroundColor: '#f5f5f5',
  },
  
  // ===== SIGNATURE =====
  signatureSection: {
    marginTop: 30,
    alignItems: 'center',
  },
  signatureLine: {
    width: 200,
    borderTop: `1 solid ${BLACK}`,
    marginBottom: 4,
  },
  signatureText: {
    fontFamily: 'ScriptMTBold',
    fontSize: 11,
    color: BLACK,
  },
});

export const CertificatePDF: React.FC<CertificatePDFProps> = ({ application, certificateData, jointPhotoDataUrl, qrCodeImage }) => {
  const userDetails = application.userDetails || {};
  const partnerDetails = (application as any).partnerDetails || (application as any).partnerForm || {};
  const userAddress = application.userAddress || (application as any).address || {};
  const userCurrentAddress = application.userCurrentAddress || (application as any).currentAddress || {};
  const partnerAddress = ((application as any).partnerAddress || (partnerDetails as any).address || {}) as any;
  const partnerCurrentAddress = ((application as any).partnerCurrentAddress || {}) as any;
  
  // Check for villageStreet (new format) OR street (legacy format) to determine if current address exists
  const hasUserCurrentAddress = userCurrentAddress.villageStreet || userCurrentAddress.street;
  const hasPartnerCurrentAddress = partnerCurrentAddress.villageStreet || partnerCurrentAddress.street;
  
  const userPresentAddr = formatAddress(hasUserCurrentAddress ? userCurrentAddress : userAddress);
  const userPermanentAddr = formatAddress(userAddress);
  const partnerPresentAddr = formatAddress(hasPartnerCurrentAddress ? partnerCurrentAddress : partnerAddress);
  const partnerPermanentAddr = formatAddress(partnerAddress);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Border */}
        <View style={styles.borderContainer}>
          <Image 
            src={getImageUrl("/assets/certificate/border.png")} 
            style={styles.borderImage}
            cache={false}
          />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logosContainer}>
              <View style={styles.emblemContainer}>
                <Image 
                  src={getImageUrl("/assets/certificate/emblem-india.png")} 
                  style={styles.emblem}
                  cache={false}
                />
              </View>
              <Image 
                src={getImageUrl("/assets/certificate/west-bengal-logo.png")} 
                style={styles.westBengalLogo}
                cache={false}
              />
            </View>
            <Text style={styles.govTitle}>GOVERNMENT OF WEST BENGAL</Text>
            <View style={styles.lawDeptBox}>
              <Text style={styles.lawDeptText}>LAW DEPARTMENT</Text>
            </View>
            <Text style={styles.officeTitle}>OFFICE OF THE MUHAMMADAN MARRIAGE REGISTRAR & QAAZI</Text>
            <Text style={styles.officeAddress}>VILL.& P.O. GRAMSHALIKA, P.S. BURWAN, DIST. MURSHIDABAD, PIN- 742132</Text>
            <Text style={styles.actText}>Under The Bengal Muhammadan Marriages and Divorces Registration Act- 1876.</Text>
          </View>

          {/* Certificate Title */}
          <View style={styles.titleSection}>
            <Text style={styles.certificateTitle}>Certificate Of Marriage</Text>
            <Text style={styles.introText}>
              This is to certify that the marriage has been Registered in between the following bridegroom and bride details under the Bengal Muhammadan Marriages and Divorces Registration Act- 1876 & Under the Indian Qaazi's Act-1880.
            </Text>
          </View>

          {/* Certificate Number Row */}
          <View style={styles.consecutiveRow}>
            <Text style={styles.consecutiveText}>
              <Text style={styles.boldText}>Certificate Number: </Text>{certificateData.consecutiveNumber}
            </Text>
            <Text style={styles.consecutiveText}>
              <Text style={styles.boldText}>Registration Date: {safeFormatDate(certificateData.registrationDate, 'dd-MM-yyyy')}</Text>
            </Text>
          </View>

          {/* Details - Groom and Bride */}
          <View style={styles.detailsRow}>
            {/* Groom */}
            <View style={styles.detailBox}>
              <View style={styles.detailBoxHeader}>
                <Text style={styles.detailBoxTitle}>Details of Groom</Text>
              </View>
              <View style={styles.detailBoxBody}>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Name:</Text>
                  <Text style={styles.fieldValue}>{(certificateData.userFirstName + ' ' + certificateData.userLastName).toUpperCase()}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>S/O:</Text>
                  <Text style={styles.fieldValue}>{certificateData.userFatherName.toUpperCase()}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>DOB:</Text>
                  <Text style={styles.fieldValue}>{(userDetails as any).dateOfBirth ? safeFormatDate((userDetails as any).dateOfBirth, 'dd-MM-yyyy') : 'N/A'}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Aadhaar:</Text>
                  <Text style={styles.fieldValue}>{formatAadhaar((userDetails as any).aadhaarNumber)}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Phone No:</Text>
                  <Text style={styles.fieldValue}>{(userDetails as any).mobileNumber || ''}</Text>
                </View>
                <View style={styles.addressBlock}>
                  <Text style={styles.addressTitle}>Present Address:</Text>
                  <Text style={styles.addressValue}>{userPresentAddr}</Text>
                </View>
                <View style={styles.addressBlock}>
                  <Text style={styles.addressTitle}>Permanent Address:</Text>
                  <Text style={styles.addressValue}>{userPermanentAddr}</Text>
                </View>
              </View>
            </View>

            {/* Bride */}
            <View style={styles.detailBox}>
              <View style={styles.detailBoxHeader}>
                <Text style={styles.detailBoxTitle}>Details of Bride</Text>
              </View>
              <View style={styles.detailBoxBody}>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Name:</Text>
                  <Text style={styles.fieldValue}>{(certificateData.partnerFirstName + ' ' + certificateData.partnerLastName).toUpperCase()}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>D/O:</Text>
                  <Text style={styles.fieldValue}>{certificateData.partnerFatherName.toUpperCase()}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>DOB:</Text>
                  <Text style={styles.fieldValue}>{(partnerDetails as any).dateOfBirth ? safeFormatDate((partnerDetails as any).dateOfBirth, 'dd-MM-yyyy') : 'N/A'}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Aadhaar:</Text>
                  <Text style={styles.fieldValue}>{formatAadhaar((partnerDetails as any).aadhaarNumber || (partnerDetails as any).idNumber)}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Phone No:</Text>
                  <Text style={styles.fieldValue}>{(partnerDetails as any).mobileNumber || ''}</Text>
                </View>
                <View style={styles.addressBlock}>
                  <Text style={styles.addressTitle}>Present Address:</Text>
                  <Text style={styles.addressValue}>{partnerPresentAddr}</Text>
                </View>
                <View style={styles.addressBlock}>
                  <Text style={styles.addressTitle}>Permanent Address:</Text>
                  <Text style={styles.addressValue}>{partnerPermanentAddr}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Social Marriage Details */}
          <View style={styles.sectionBox}>
            <Text style={styles.sectionTitle}>Social Marriage Details:</Text>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>Date of Marriage:    </Text>
              <Text style={styles.sectionValue}>{safeFormatDate(certificateData.marriageDate, 'dd-MM-yyyy')}</Text>
            </View>
          </View>

          {/* Registration Details */}
          <View style={styles.sectionBox}>
            <Text style={styles.sectionTitle}>Registration Details:</Text>
            <View style={styles.regDetailsContent}>
              <View style={styles.regItem}>
                <Text style={styles.sectionLabel}>Date: </Text>
                <Text style={styles.sectionValue}>{safeFormatDate(certificateData.registrationDate, 'dd-MM-yyyy')}</Text>
              </View>
              <View style={styles.regItem}>
                <Text style={styles.sectionLabel}>Book: </Text>
                <Text style={styles.sectionValue}>{certificateData.book}</Text>
              </View>
              <View style={styles.regItem}>
                <Text style={styles.sectionLabel}>Vol No: </Text>
                <Text style={styles.sectionValue}>{certificateData.volNo}</Text>
              </View>
              <View style={styles.regItem}>
                <Text style={styles.sectionLabel}>Serial No: </Text>
                <Text style={styles.sectionValue}>{certificateData.serialNo}</Text>
              </View>
              <View style={styles.regItem}>
                <Text style={styles.sectionLabel}>Page: </Text>
                <Text style={styles.sectionValue}>{certificateData.page}.</Text>
              </View>
            </View>
          </View>

          {/* Wish */}
          <View style={styles.wishSection}>
            <Text style={styles.wishText}>I wish them All Successful Life.</Text>
          </View>

          {/* Registrar Details */}
          <View style={styles.registrarBox}>
            <Text style={styles.registrarTitle}>Muhammadan Marriage Registrar & Qaazi Details:</Text>
            <View style={styles.registrarRow}>
              <Text style={styles.registrarLabel}>Name: </Text>
              <Text style={styles.registrarValue}>{certificateData.registrarName}</Text>
            </View>
            <View style={styles.registrarRow}>
              <Text style={styles.registrarLabel}>Licence No: </Text>
              <Text style={styles.registrarValue}>{certificateData.registrarLicense}</Text>
            </View>
            <View style={styles.registrarRow}>
              <Text style={styles.registrarLabel}>Office Address: </Text>
              <Text style={styles.registrarValue}>{certificateData.registrarOffice}</Text>
            </View>
            <View style={styles.contactRow}>
              <Text style={styles.registrarLabel}>Contact: </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
                <Image 
                  src={getImageUrl("/icons/phone.png")} 
                  style={styles.icon}
                  cache={false}
                />
                <Text style={styles.registrarValue}> {certificateData.registrarPhone}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
                <Image 
                  src={getImageUrl("/icons/mail.png")} 
                  style={styles.icon}
                  cache={false}
                />
                <Text style={styles.registrarValue}> {certificateData.registrarEmail}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Image 
                  src={getImageUrl("/icons/world.png")} 
                  style={styles.icon}
                  cache={false}
                />
                <Text style={styles.registrarValue}> mmrburwan.com</Text>
              </View>
            </View>
          </View>

          {/* Bottom - Couple Photo and QR */}
          <View style={styles.bottomSection}>
            <View style={styles.couplePhotoBox}>
              {jointPhotoDataUrl ? (
                <Image 
                  src={jointPhotoDataUrl} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  cache={false}
                />
              ) : null}
            </View>
            <View style={styles.qrSection}>
              {qrCodeImage ? (
                <Image 
                  src={qrCodeImage} 
                  style={{ width: 68, height: 68 }}
                  cache={false}
                />
              ) : (
                <View style={styles.qrBox} />
              )}
            </View>
          </View>

          {/* Signature */}
          <View style={styles.signatureSection}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureText}>Signature of Registrar with Seal</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
