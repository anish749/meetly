export interface EmailAnalystInitiator {
  name: string;
  email: string;
}

export interface EmailAnalystInvitee {
  name?: string;
  email: string;
  role: 'attendee' | 'coordinator';
  relationship?: string;
  work_context?: string;
  coordinates_for?: string;
}

export interface EmailAnalystResponse {
  initiator: EmailAnalystInitiator;
  invitees: EmailAnalystInvitee[];
  meeting_intent: string;
  requested_timeframe?: string;
  duration_minutes?: number | null;
  location_hint?: string | null;
  other_notes?: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface EmailAnalystError {
  error: string;
  details?: string;
}

export type EmailAnalystResult = EmailAnalystResponse | EmailAnalystError;
