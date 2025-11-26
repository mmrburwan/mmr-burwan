import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { Appointment } from '../../types';
import { safeFormatDate } from '../../utils/dateUtils';

interface AppointmentPassPDFProps {
  appointment: Appointment;
  userName: string;
  userEmail?: string;
  qrCodeImage: string; // Base64 data URL of QR code
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 8,
    borderBottom: '1.5 solid #D4AF37',
    paddingBottom: 6,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 2,
    fontFamily: 'Helvetica-Bold',
  },
  headerSubtitle: {
    fontSize: 7,
    color: '#6B7280',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  officeInfo: {
    marginTop: 4,
    paddingTop: 4,
    borderTop: '0.5 solid #E5E7EB',
  },
  officeName: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 1,
  },
  officeAddress: {
    fontSize: 6,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 1.1,
  },
  statusBadge: {
    backgroundColor: '#10B981',
    color: '#FFFFFF',
    padding: '2 8',
    borderRadius: 2,
    fontSize: 7,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 6,
    alignSelf: 'center',
  },
  userSection: {
    marginBottom: 8,
    textAlign: 'center',
  },
  userName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 1,
    fontFamily: 'Helvetica-Bold',
  },
  passType: {
    fontSize: 7,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  contentRow: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 6,
  },
  leftColumn: {
    flex: 1.2,
  },
  rightColumn: {
    flex: 0.8,
  },
  detailsSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 3,
    padding: 8,
    marginBottom: 6,
    border: '0.5 solid #E5E7EB',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    paddingBottom: 4,
    borderBottom: '0.5 solid #E5E7EB',
  },
  detailRowLast: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottom: 'none',
  },
  detailLabel: {
    fontSize: 7,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    flex: 1,
  },
  detailValue: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#111827',
    flex: 2,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
  },
  qrSection: {
    alignItems: 'center',
    padding: 6,
    backgroundColor: '#FFFFFF',
    border: '1 solid #E5E7EB',
    borderRadius: 3,
    justifyContent: 'center',
  },
  qrCode: {
    width: 100,
    height: 100,
    marginBottom: 4,
  },
  qrLabel: {
    fontSize: 7,
    color: '#374151',
    fontWeight: 'bold',
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  verificationId: {
    fontSize: 6,
    color: '#9CA3AF',
    textAlign: 'center',
    fontFamily: 'Helvetica-Oblique',
    marginTop: 2,
    lineHeight: 1.1,
  },
  instructionsSection: {
    marginTop: 6,
    padding: 6,
    backgroundColor: '#EFF6FF',
    border: '0.5 solid #BFDBFE',
    borderRadius: 3,
  },
  instructionsTitle: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  instructionItem: {
    fontSize: 6,
    color: '#1E3A8A',
    marginBottom: 1.5,
    lineHeight: 1.2,
  },
  footer: {
    marginTop: 6,
    paddingTop: 5,
    borderTop: '0.5 solid #E5E7EB',
    textAlign: 'center',
  },
  footerText: {
    fontSize: 6,
    color: '#9CA3AF',
    lineHeight: 1.1,
  },
  contactInfo: {
    marginTop: 6,
    paddingTop: 5,
    borderTop: '0.5 solid #E5E7EB',
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 1,
  },
  contactLabel: {
    fontSize: 6,
    color: '#6B7280',
    marginRight: 4,
  },
  contactValue: {
    fontSize: 6,
    color: '#374151',
    fontWeight: 'bold',
  },
});

export const AppointmentPassPDF: React.FC<AppointmentPassPDFProps> = ({
  appointment,
  userName,
  userEmail,
  qrCodeImage,
}) => {
  const formattedDate = safeFormatDate(appointment.date, 'EEEE, MMMM d, yyyy');
  const formattedTime = appointment.time;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>MMR Burwan</Text>
          <Text style={styles.headerSubtitle}>Official Appointment Pass</Text>
          <View style={styles.officeInfo}>
            <Text style={styles.officeName}>
              Office of the Muhammadan Marriage Registrar & Qaazi
            </Text>
            <Text style={styles.officeAddress}>
              Vill. & P.O. Gramshalika, P.S. Burwan, Dist. Murshidabad, PIN - 742132, West Bengal, India
            </Text>
          </View>
        </View>

        {/* Status Badge and User Section */}
        <View style={styles.userSection}>
          <View style={styles.statusBadge}>
            <Text>{appointment.status.toUpperCase()}</Text>
          </View>
          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.passType}>Appointment Pass</Text>
        </View>

        {/* Main Content Row: Details and QR Code */}
        <View style={styles.contentRow}>
          {/* Left Column: Details */}
          <View style={styles.leftColumn}>
            <View style={styles.detailsSection}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{formattedDate}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Time</Text>
                <Text style={styles.detailValue}>{formattedTime}</Text>
              </View>
              {userEmail && (
                <View style={[styles.detailRow, styles.detailRowLast]}>
                  <Text style={styles.detailLabel}>Email</Text>
                  <Text style={styles.detailValue}>{userEmail}</Text>
                </View>
              )}
            </View>

            {/* Instructions Section */}
            <View style={styles.instructionsSection}>
              <Text style={styles.instructionsTitle}>Instructions</Text>
              <Text style={styles.instructionItem}>
                • Arrive 15 min before appointment
              </Text>
              <Text style={styles.instructionItem}>
                • Bring pass, valid ID & documents
              </Text>
              <Text style={styles.instructionItem}>
                • Present QR code at reception
              </Text>
              <Text style={styles.instructionItem}>
                • Late arrivals may be rescheduled
              </Text>
              <Text style={styles.instructionItem}>
                • Contact office for queries
              </Text>
            </View>

            {/* Contact Information */}
            <View style={styles.contactInfo}>
              <View style={styles.contactRow}>
                <Text style={styles.contactLabel}>Hours:</Text>
                <Text style={styles.contactValue}>Mon-Sat, 10 AM - 5 PM</Text>
              </View>
            </View>
          </View>

          {/* Right Column: QR Code */}
          <View style={styles.rightColumn}>
            <View style={styles.qrSection}>
              <Text style={styles.qrLabel}>Scan QR Code</Text>
              <Image src={qrCodeImage} style={styles.qrCode} />
              <Text style={styles.verificationId}>
                ID: {appointment.id}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Official document. Keep safe and bring to appointment.
          </Text>
          <Text style={styles.footerText}>
            Generated: {safeFormatDate(new Date().toISOString(), 'MMM d, yyyy')} {safeFormatDate(new Date().toISOString(), 'h:mm a')}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

