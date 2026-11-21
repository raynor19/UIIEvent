export type EventCategory = 'SEMINAR' | 'WORKSHOP' | 'LOMBA' | 'KONSER' | 'COMMITTEE_RECRUITMENT';

export type EventStatus = 'DRAFT' | 'PENDING' | 'REVISION' | 'REJECTED' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED';

export interface EventSpeaker {
  name: string;
  role: string;
  company: string;
  avatarUrl?: string;
}

export interface EventItem {
  id: string;
  title: string;
  slug: string;
  category: EventCategory;
  categoryLabel: string;
  organizer: string;
  faculty: string;
  description: string;
  date: string;
  time: string;
  location: string;
  room: string;
  bannerUrl: string;
  quotaTotal: number;
  quotaRemaining: number;
  status: EventStatus;
  skpiPoints: number;
  isFree: boolean;
  price?: number;
  speaker?: EventSpeaker;
  oprecDivisions?: string[];
  instagramPostStatus?: {
    isPosted: boolean;
    postId?: string;
    postedAt?: string;
    mediaUrl?: string;
  };
  whatsappHelpdesk: string;

  // Fields for DPK Proposal Curation & Verification
  proposalFileName?: string;
  dpkReviewNotes?: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}
