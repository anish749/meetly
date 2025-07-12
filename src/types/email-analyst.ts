export interface EmailAnalystInitiator {
  name: string;
  email: string;
}

export interface EmailAnalystInvitee {
  name?: string;
  email: string;
  relationship?: string;
  work_context?: string;
}

export interface EmailAnalystResponse {
  initiator: EmailAnalystInitiator;
  invitees: EmailAnalystInvitee[];
  meeting_intent: string;
  requested_timeframe?: string;
  duration_minutes?: number | null;
  location_hint?: string | null;
  other_notes?: string | null;
}

export interface EmailAnalystError {
  error: string;
  details?: string;
}

export type EmailAnalystResult = EmailAnalystResponse | EmailAnalystError;
