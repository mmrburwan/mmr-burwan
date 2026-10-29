import '../../utils/polyfills';
import '../../utils/pdfFonts';
import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';
import { DivorceApplication } from '../../types';
import { safeFormatDate } from '../../utils/dateUtils';
import { formatAadhaar } from '../../utils/formatUtils';

export interface FormattedAddressLines {
  line1: string;
  line2: string;
  line3: string;
}

const formatAddressLines = (address: any): FormattedAddressLines => {
  if (!address) {
    return { line1: 'N/A', line2: '', line3: '' };
  }

  if (typeof address === 'string') {
    const raw = address.trim();
    if (!raw || raw === 'N/A') {
      return { line1: 'N/A', line2: '', line3: '' };
    }

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

const getAddressFontSize = (addr: FormattedAddressLines): number => {
  const maxLen = Math.max(
    addr.line1 ? addr.line1.length : 0,
    addr.line2 ? addr.line2.length : 0,
    addr.line3 ? addr.line3.length : 0
  );
  if (maxLen > 48) return 8;
  if (maxLen > 42) return 8.5;
  if (maxLen > 36) return 9.5;
  if (maxLen > 30) return 10.5;
  return 11;
};

interface DivorceCertificatePDFProps {
  application: DivorceApplication;
  certificateData: {
    verificationId: string;
    registrationDate: string;
    consecutiveNumber: string;
    book: string;
    volNo: string;
    serialNo: string;
    page: string;
    divorceDate?: string;
    divorceType?: string;
    marriageCertificateNumber?: string;
    registrarName: string;
    registrarLicense: string;
    registrarOffice: string;
    registrarPhone: string;
    registrarEmail: string;
    husbandFirstName: string;
    husbandLastName: string;
    husbandFatherName: string;
    wifeFirstName: string;
    wifeLastName: string;
    wifeFatherName: string;
  };
  qrCodeImage?: string | null;
  borderImageDataUrl?: string | null;
  emblemImageDataUrl?: string | null;
}

const GOLD = '#8B6914';
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
    padding: '48 45 30 45',
  },
  header: {
    textAlign: 'center',
    marginBottom: 4,
  },
  emblemContainer: {
    width: 46,
    height: 46,
    alignSelf: 'center',
    marginBottom: 2,
  },
  emblem: {
    width: 46,
    height: 46,
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
  consecutiveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
    marginBottom: 4,
  },
  consecutiveText: {
    fontFamily: 'Times',
    fontSize: 11,
    color: BLACK,
  },
  boldText: {
    fontWeight: 'bold',
  },
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
    lineHeight: 1.1,
  },
  sectionBox: {
    marginBottom: 4,
    border: `1 solid ${GOLD}`,
    padding: '4 8',
  },
  sectionTitle: {
    fontFamily: 'Times',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#833C0B',
    textDecoration: 'underline',
    marginBottom: 2,
  },
  sectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  sectionItem: {
    flexDirection: 'row',
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
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    marginTop: 10,
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
  signatureSection: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
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

export const DivorceCertificatePDF: React.FC<DivorceCertificatePDFProps> = ({
  application,
  certificateData,
  qrCodeImage,
  borderImageDataUrl,
  emblemImageDataUrl,
}) => {
  const userDetails = application.userDetails || {};
  const partnerDetails = (application.partnerForm as any) || {};
  const userAddress = application.userAddress || {};
  const userCurrentAddress = application.userCurrentAddress || {};
  const partnerAddress = application.partnerAddress || {};
  const partnerCurrentAddress = application.partnerCurrentAddress || {};

  const hasUserCurrentAddress = userCurrentAddress.villageStreet || userCurrentAddress.street;
  const hasPartnerCurrentAddress = partnerCurrentAddress.villageStreet || partnerCurrentAddress.street;

  const userPresentAddr = formatAddressLines(hasUserCurrentAddress ? userCurrentAddress : userAddress);
  const userPermanentAddr = formatAddressLines(userAddress);
  const partnerPresentAddr = formatAddressLines(hasPartnerCurrentAddress ? partnerCurrentAddress : partnerAddress);
  const partnerPermanentAddr = formatAddressLines(partnerAddress);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Border Background */}
        <View style={styles.borderContainer}>
          {borderImageDataUrl && (
            <Image
              src={borderImageDataUrl}
              style={styles.borderImage}
              cache={false}
            />
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.emblemContainer}>
              {emblemImageDataUrl && (
                <Image
                  src={emblemImageDataUrl}
                  style={styles.emblem}
                  cache={false}
                />
              )}
            </View>
            <Text style={styles.govTitle}>GOVERNMENT OF WEST BENGAL</Text>
            <View style={styles.lawDeptBox}>
              <Text style={styles.lawDeptText}>LAW DEPARTMENT</Text>
            </View>
            <Text style={styles.officeTitle}>OFFICE OF THE MUHAMMADAN MARRIAGE REGISTRAR & QAAZI</Text>
            <Text style={styles.officeAddress}>VILL.& P.O. GRAMSHALIKA, P.S. BURWAN, DIST. MURSHIDABAD, PIN- 742132</Text>
            <Text style={styles.actText}>Under The Bengal Muhammadan Marriages and Divorces Registration Act- 1876.</Text>
          </View>

          {/* Title */}
          <View style={styles.titleSection}>
            <Text style={styles.certificateTitle}>Certificate Of Divorce</Text>
            <Text style={styles.introText}>
              This is to certify that the divorce has been Registered between the following husband and wife details under the Bengal Muhammadan Marriages and Divorces Registration Act- 1876 & Under the Indian Qaazi's Act-1880.
            </Text>
          </View>

          {/* Certificate Number Row */}
          <View style={styles.consecutiveRow}>
            <Text style={styles.consecutiveText}>
              <Text style={styles.boldText}>Certificate Number: {certificateData.consecutiveNumber}</Text>
            </Text>
            <Text style={styles.consecutiveText}>
              <Text style={styles.boldText}>Registration Date: {safeFormatDate(certificateData.registrationDate, 'dd-MM-yyyy')}</Text>
            </Text>
          </View>

          {/* Details - Husband & Wife */}
          <View style={styles.detailsRow}>
            {/* Husband */}
            <View style={styles.detailBox}>
              <View style={styles.detailBoxHeader}>
                <Text style={styles.detailBoxTitle}>Details of Husband</Text>
              </View>
              <View style={styles.detailBoxBody}>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Name:</Text>
                  <Text style={styles.fieldValue}>{(certificateData.husbandFirstName + ' ' + certificateData.husbandLastName).toUpperCase()}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>S/O:</Text>
                  <Text style={styles.fieldValue}>{certificateData.husbandFatherName.toUpperCase()}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>DOB:</Text>
                  <Text style={styles.fieldValue}>{(userDetails as any).dateOfBirth ? safeFormatDate((userDetails as any).dateOfBirth, 'dd-MM-yyyy') : 'N/A'}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Aadhaar:</Text>
                  <Text style={styles.fieldValue}>{formatAadhaar((userDetails as any).aadhaarNumber)}</Text>
                </View>

                <View style={styles.addressBlock}>
                  <Text style={styles.addressTitle}>Present Address:</Text>
                  {userPresentAddr.line1 ? (
                    <Text style={{ ...styles.addressValue, fontSize: getAddressFontSize(userPresentAddr) }}>
                      {userPresentAddr.line1}
                    </Text>
                  ) : null}
                  {userPresentAddr.line2 ? (
                    <Text style={{ ...styles.addressValue, fontSize: getAddressFontSize(userPresentAddr) }}>
                      {userPresentAddr.line2}
                    </Text>
                  ) : null}
                  {userPresentAddr.line3 ? (
                    <Text style={{ ...styles.addressValue, fontSize: getAddressFontSize(userPresentAddr) }}>
                      {userPresentAddr.line3}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.addressBlock}>
                  <Text style={styles.addressTitle}>Permanent Address:</Text>
                  {userPermanentAddr.line1 ? (
                    <Text style={{ ...styles.addressValue, fontSize: getAddressFontSize(userPermanentAddr) }}>
                      {userPermanentAddr.line1}
                    </Text>
                  ) : null}
                  {userPermanentAddr.line2 ? (
                    <Text style={{ ...styles.addressValue, fontSize: getAddressFontSize(userPermanentAddr) }}>
                      {userPermanentAddr.line2}
                    </Text>
                  ) : null}
                  {userPermanentAddr.line3 ? (
                    <Text style={{ ...styles.addressValue, fontSize: getAddressFontSize(userPermanentAddr) }}>
                      {userPermanentAddr.line3}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Wife */}
            <View style={styles.detailBox}>
              <View style={styles.detailBoxHeader}>
                <Text style={styles.detailBoxTitle}>Details of Wife</Text>
              </View>
              <View style={styles.detailBoxBody}>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Name:</Text>
                  <Text style={styles.fieldValue}>{(certificateData.wifeFirstName + ' ' + certificateData.wifeLastName).toUpperCase()}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>D/O:</Text>
                  <Text style={styles.fieldValue}>{certificateData.wifeFatherName.toUpperCase()}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>DOB:</Text>
                  <Text style={styles.fieldValue}>{(partnerDetails as any).dateOfBirth ? safeFormatDate((partnerDetails as any).dateOfBirth, 'dd-MM-yyyy') : 'N/A'}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Aadhaar:</Text>
                  <Text style={styles.fieldValue}>{formatAadhaar((partnerDetails as any).aadhaarNumber || (partnerDetails as any).idNumber)}</Text>
                </View>

                <View style={styles.addressBlock}>
                  <Text style={styles.addressTitle}>Present Address:</Text>
                  {partnerPresentAddr.line1 ? (
                    <Text style={{ ...styles.addressValue, fontSize: getAddressFontSize(partnerPresentAddr) }}>
                      {partnerPresentAddr.line1}
                    </Text>
                  ) : null}
                  {partnerPresentAddr.line2 ? (
                    <Text style={{ ...styles.addressValue, fontSize: getAddressFontSize(partnerPresentAddr) }}>
                      {partnerPresentAddr.line2}
                    </Text>
                  ) : null}
                  {partnerPresentAddr.line3 ? (
                    <Text style={{ ...styles.addressValue, fontSize: getAddressFontSize(partnerPresentAddr) }}>
                      {partnerPresentAddr.line3}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.addressBlock}>
                  <Text style={styles.addressTitle}>Permanent Address:</Text>
                  {partnerPermanentAddr.line1 ? (
                    <Text style={{ ...styles.addressValue, fontSize: getAddressFontSize(partnerPermanentAddr) }}>
                      {partnerPermanentAddr.line1}
                    </Text>
                  ) : null}
                  {partnerPermanentAddr.line2 ? (
                    <Text style={{ ...styles.addressValue, fontSize: getAddressFontSize(partnerPermanentAddr) }}>
                      {partnerPermanentAddr.line2}
                    </Text>
                  ) : null}
                  {partnerPermanentAddr.line3 ? (
                    <Text style={{ ...styles.addressValue, fontSize: getAddressFontSize(partnerPermanentAddr) }}>
                      {partnerPermanentAddr.line3}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          </View>

          {/* Divorce Particulars */}
          <View style={styles.sectionBox}>
            <Text style={styles.sectionTitle}>Divorce Particulars</Text>
            <View style={styles.sectionRow}>
              <View style={styles.sectionItem}>
                <Text style={styles.sectionLabel}>Date of Divorce: </Text>
                <Text style={styles.sectionValue}>
                  {certificateData.divorceDate ? safeFormatDate(certificateData.divorceDate, 'dd-MM-yyyy') : 'N/A'}
                </Text>
              </View>
              <View style={styles.sectionItem}>
                <Text style={styles.sectionLabel}>Type of Divorce: </Text>
                <Text style={styles.sectionValue}>
                  {certificateData.divorceType ? certificateData.divorceType.toUpperCase() : 'TALAQ'}
                </Text>
              </View>
              {certificateData.marriageCertificateNumber && (
                <View style={styles.sectionItem}>
                  <Text style={styles.sectionLabel}>Marriage Certificate: </Text>
                  <Text style={styles.sectionValue}>{certificateData.marriageCertificateNumber}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Registration Details */}
          <View style={styles.sectionBox}>
            <Text style={styles.sectionTitle}>Registration Details</Text>
            <View style={styles.sectionRow}>
              <View style={styles.sectionItem}>
                <Text style={styles.sectionLabel}>Date: </Text>
                <Text style={styles.sectionValue}>{safeFormatDate(certificateData.registrationDate, 'dd-MM-yyyy')}</Text>
              </View>
              <View style={styles.sectionItem}>
                <Text style={styles.sectionLabel}>Book: </Text>
                <Text style={styles.sectionValue}>{certificateData.book}</Text>
              </View>
              <View style={styles.sectionItem}>
                <Text style={styles.sectionLabel}>Vol No: </Text>
                <Text style={styles.sectionValue}>{certificateData.volNo}</Text>
              </View>
              <View style={styles.sectionItem}>
                <Text style={styles.sectionLabel}>Serial No: </Text>
                <Text style={styles.sectionValue}>{certificateData.serialNo}</Text>
              </View>
              <View style={styles.sectionItem}>
                <Text style={styles.sectionLabel}>Page: </Text>
                <Text style={styles.sectionValue}>{certificateData.page}</Text>
              </View>
            </View>
          </View>

          {/* Registrar Details */}
          <View style={styles.registrarBox}>
            <Text style={styles.registrarTitle}>Muhammadan Marriage Registrar & Qaazi Details</Text>
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
            <View style={styles.registrarRow}>
              <Text style={styles.registrarLabel}>Contact: </Text>
              <Text style={styles.registrarValue}>{certificateData.registrarEmail}  |  mmrburwan.com</Text>
            </View>
          </View>

          {/* QR Code Section */}
          <View style={styles.bottomSection}>
            <View style={styles.qrSection}>
              {qrCodeImage && (
                <Image
                  src={qrCodeImage}
                  style={styles.qrBox}
                  cache={false}
                />
              )}
              <Text style={{ fontSize: 8, marginTop: 3, color: '#666' }}>
                Verification ID: {certificateData.verificationId}
              </Text>
            </View>
          </View>
        </View>

        {/* Signature */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureText}>Signature of Registrar with Seal</Text>
        </View>
      </Page>
    </Document>
  );
};

export default DivorceCertificatePDF;

