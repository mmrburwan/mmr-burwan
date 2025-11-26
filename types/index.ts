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
  address: Address;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface UserDetails {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  aadhaarNumber: string;
  mobileNumber: string;
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
  declarations?: Record<string, boolean>;
  documents: Document[];
  verified?: boolean; // Admin verification status
  verifiedAt?: string;
  verifiedBy?: string;
  submittedAt?: string;
  lastUpdated: string;
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
  belongsTo?: 'user' | 'partner'; // To identify if document belongs to user or partner
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
  applicationId: string;
  verificationId: string;
  name: string;
  issuedOn: string;
  pdfUrl: string;
  verified: boolean;
  expiresAt?: string;
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

