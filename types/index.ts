/**
 * TypeScript type definitions for MMR Burwan
 */

export type UserRole = 'client' | 'admin';

export interface User {
  id: string;
  email: string;
  phone?: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface Profile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  idNumber: string;
  address: Address;
  partnerDetails?: PartnerDetails;
  completionPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerDetails {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  idNumber: string;
  aadhaarNumber?: string;
  mobileNumber?: string;
  email?: string; // Bride's email address
  voterOrRollNo: string;
  address: Address;
}

export interface Address {
  villageStreet: string;
  postOffice: string;
  policeStation: string;
  district: string;
  state: string;
  zipCode: string;
  country: string;
  // Legacy fields for backward compatibility
  street?: string;
  city?: string;
}

export interface UserDetails {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  aadhaarNumber: string;
  mobileNumber: string;
  voterOrRollNo: string;
}

export interface Application {
  id: string;
  userId: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  progress: number;
  userDetails?: UserDetails;
  partnerForm?: PartnerDetails;
  userAddress?: Address;
  userCurrentAddress?: Address;
  partnerAddress?: Address;
  partnerCurrentAddress?: Address;
  address?: Address; // Keep for backward compatibility
  currentAddress?: Address; // Keep for backward compatibility
  declarations?: Record<string, boolean | string>; // Allow both boolean (consent, accuracy, legal) and string (marriageDate)
  documents: Document[];
  verified?: boolean; // Admin verification status
  verifiedAt?: string;
  verifiedBy?: string;
  certificateNumber?: string; // Certificate number set by admin during verification
  registrationDate?: string; // Registration date set by admin during verification
  submittedAt?: string;
  lastUpdated: string;
  // Proxy application fields
  createdByAdminId?: string;
  isProxyApplication?: boolean;
  offlineApplicantContact?: {
    phone?: string;
    address?: string;
    notes?: string;
    contactPerson?: string;
  };
  proxyUserEmail?: string;
}

export interface Document {
  id: string;
  applicationId: string;
  type: 'aadhaar' | 'tenth_certificate' | 'voter_id' | 'id' | 'photo' | 'certificate' | 'other';
  name: string;
  url: string;
  status: 'pending' | 'approved' | 'rejected';
  uploadedAt: string;
  size: number;
  mimeType: string;
  belongsTo?: 'user' | 'partner' | 'joint'; // To identify if document belongs to user, partner, or joint
  isReuploaded?: boolean; // Indicates if this document was re-uploaded after being rejected
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  attachments?: Array<{ name: string; url: string; type: string }>;
  status: 'sent' | 'failed';
  timestamp: string;
}

export interface Conversation {
  id: string;
  userId: string;
  adminId?: string;
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: string;
}

export interface AppointmentSlot {
  id: string;
  date: string;
  time: string;
  capacity: number;
  booked: number;
  isHoliday?: boolean;
}

export interface Appointment {
  id: string;
  userId: string;
  slotId: string;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  qrCodeData: string;
  createdAt: string;
}

export interface Certificate {
  id: string;
  userId: string;
  applicationId?: string; // Made optional since certificates can exist without applications
  verificationId: string;
  name: string;
  issuedOn: string;
  pdfUrl: string;
  verified: boolean;
  expiresAt?: string;
  certificateNumber?: string;
  registrationDate?: string;
  groomName?: string;
  brideName?: string;
  canDownload?: boolean; // Admin-controlled permission for user to download certificate
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface Notification {
  id: string;
  userId: string;
  applicationId?: string;
  documentId?: string;
  type: 'document_rejected' | 'document_approved' | 'application_approved' | 'application_rejected' | 'application_verified' | 'certificate_ready' | 'other';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}


export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  limit: number;
}

export interface FilterOptions {
  search?: string;
  verified?: 'all' | 'verified' | 'unverified' | 'submitted' | 'draft';
}
