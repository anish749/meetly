import { EmailAnalystResult } from './email-analyst';

export type MeetingRequestStatus =
  | 'analysing_email'
  | 'processing_with_stina'
  | 'context_collection'
  | 'scheduled'
  | 'rescheduled'
  | 'completed'
  | 'cancelled'
  | 'pending_reply';

export type CommunicationType = 'email' | 'text' | 'whatsapp';

export type CreatorSource = 'email' | 'text' | 'whatsapp' | 'manual';

export type UrgencyLevel = 'low' | 'medium' | 'high';

export interface MeetingRequestParticipant {
  email: string;
  name?: string;
  isRegisteredUser: boolean;
  preferences?: string;
}

export interface MeetingRequestCreator {
  email: string;
  source: CreatorSource;
}

export interface MeetingRequestContext {
  summary: string;
}

export interface ProposedTimeLocation {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export interface ProposedTime {
  start: string;
  end: string;
  timezone: string;
  location?: ProposedTimeLocation;
  note?: string;
}

export interface ScheduledEvent {
  googleEventId: string;
  calendarId: string;
  start: string;
  end: string;
}

export interface Communication {
  id: string;
  type: CommunicationType;
  content: string;
  sender: string;
  timestamp: string;
  processed: boolean;
}

export interface MeetingRequestMetadata {
  location?: string;
  agenda?: string;
  duration?: number;
  urgency?: UrgencyLevel;
}

export interface MeetingRequest {
  id: string;
  status: MeetingRequestStatus;
  participants: MeetingRequestParticipant[];
  creator: MeetingRequestCreator;
  context: MeetingRequestContext;
  proposedTimes: ProposedTime[];
  scheduledEvent?: ScheduledEvent;
  communications: Communication[];
  metadata: MeetingRequestMetadata;
  emailAnalystResponse?: EmailAnalystResult;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMeetingRequestPayload {
  participants: Omit<MeetingRequestParticipant, 'isRegisteredUser'>[];
  creator: MeetingRequestCreator;
  context: MeetingRequestContext;
  proposedTimes?: ProposedTime[];
  metadata?: MeetingRequestMetadata;
  communications?: Omit<Communication, 'id'>[];
}

export interface UpdateMeetingRequestPayload {
  status?: MeetingRequestStatus;
  context?: Partial<MeetingRequestContext>;
  proposedTimes?: ProposedTime[];
  scheduledEvent?: ScheduledEvent;
  metadata?: Partial<MeetingRequestMetadata>;
}

export interface MeetingRequestFilters {
  status?: MeetingRequestStatus | MeetingRequestStatus[];
  participant?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  urgency?: UrgencyLevel;
}

export interface MeetingRequestListResponse {
  meetingRequests: MeetingRequest[];
  total: number;
  page: number;
  limit: number;
}

export const VALID_STATUS_TRANSITIONS: Record<
  MeetingRequestStatus,
  MeetingRequestStatus[]
> = {
  analysing_email: ['processing_with_stina', 'cancelled'],
  processing_with_stina: ['context_collection', 'cancelled'],
  context_collection: ['scheduled', 'cancelled', 'pending_reply'],
  pending_reply: ['context_collection', 'scheduled', 'cancelled'],
  scheduled: ['rescheduled', 'completed', 'cancelled'],
  rescheduled: ['scheduled', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};
