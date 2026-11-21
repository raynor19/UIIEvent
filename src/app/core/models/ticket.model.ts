export type RegistrationStatus = 'REGISTERED' | 'WAITING_LIST' | 'ATTENDED' | 'CANCELLED';

export interface RegistrationItem {
  id: string;
  userId: string;
  userNim: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  userFaculty: string;
  userStudyProgram: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  status: RegistrationStatus;
  createdAt: string;
  attendedAt?: string;
  
  // Fields for OPREC Panitia
  category?: string;
  divisionChoice1?: string;
  divisionChoice2?: string;
  motivation?: string;
  cvFileName?: string;
  krsFileName?: string;
  selectionStatus?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

export interface TicketItem {
  id: string;
  registrationId: string;
  ticketCode: string; // e.g. UII-TIK-2026-XXXX
  eventId: string;
  eventTitle: string;
  eventCategory: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  eventRoom: string;
  userId: string;
  userName: string;
  userNim: string;
  userStudyProgram: string;
  qrPayload: string; // Encrypted string or HMAC hash JSON
  hashSignature: string; // SHA-256 / HMAC hash
  timestampIssued: string;
  isCheckedIn: boolean;
  checkedInAt?: string;
  checkedInBy?: string;
}

export interface CertificateItem {
  id: string;
  registrationId: string;
  ticketId: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  organizer?: string;
  eventRoom?: string;
  publishedAtFormatted?: string;
  userId: string;
  userName: string;
  userNim: string;
  userFaculty: string;
  userStudyProgram: string;
  certificateNumber: string; // e.g. UII/DPK/CERT/2026/0491
  skpiPoints: number;
  issueDate: string;
  verificationHash: string; // SHA-256 for public verify URL
  issuerName: string;
  issuerRole: string;
  isUnlocked: boolean; // Only true when isCheckedIn = true (ATTENDED)
}
