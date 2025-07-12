// Database type definitions for Meetly application

import { EmailAnalysisResult } from '@/services/email-analyst';

/**
 * Email processing status tracking
 */
export type EmailProcessingStatus =
  | 'pending' // Email received but not processed
  | 'analysing_email' // Email Analyst AI is analyzing the email
  | 'processing_with_stina' // Stina AI is processing based on analysis results
  | 'completed' // Processing completed
  | 'failed'; // Processing failed

/**
 * Email summary for UI display
 */
export interface EmailSummary {
  id: string;
  subject: string;
  from: string;
  createdAt: string;
  status?: EmailProcessingStatus;
}

/**
 * Extended email context for processing
 */
export interface EmailContext {
  id: string;
  subject: string;
  from: string;
  body: string;
  createdAt: string;
  status?: EmailProcessingStatus;
}

/**
 * Email analysis results stored in database
 */
export interface EmailAnalysisRecord {
  email_id: string;
  subject: string;
  from: string;
  analysed_at: string;
  analysis_result: EmailAnalysisResult;
  status: 'completed' | 'failed';
  error_message?: string;
  user_email: string;
}

/**
 * Email processing results (existing structure, extended)
 */
export interface EmailProcessingResult {
  email_id: string;
  session_id: string;
  subject: string;
  from: string;
  processed_at: string;
  ai_response: string;
  steps_taken: number;
  tools_used: string[];
  processing_status: 'completed' | 'failed';
  analysis_data?: EmailAnalysisResult; // Added to link with analysis results
  user_email: string;
}

/**
 * Stina session status tracking (existing structure)
 */
export type StinaSessionStatus =
  | 'INITIATING'
  | 'TIME_PROPOSED'
  | 'TIME_CONFIRMED'
  | 'VENUE_PROPOSED'
  | 'CALENDAR_BOOKED'
  | 'COMPLETED'
  | 'FAILED';

export interface StinaSession {
  session_id: string;
  status: StinaSessionStatus;
  progress: number; // 0-100
  note?: string;
  updated_at: string;
  user_email: string;
  email_id?: string; // Added to link with specific email
}

/**
 * Email threads (existing structure)
 */
export interface EmailThread {
  id: string;
  to: string[];
  subject: string;
  body: string;
  thread_id?: string;
  timestamp: string;
  status: 'sent' | 'failed';
  watch: boolean;
  watching: boolean;
  user_email: string;
}

/**
 * User preferences for Stina AI (existing structure)
 */
export interface UserPreferences {
  defaultMeetingType: 'in-person' | 'virtual' | 'hybrid';
  workingHours: {
    start: string;
    end: string;
    days: string[];
  };
  timeZone: string;
  preferredLocations?: string[];
  foodPreferences?: string[];
  meetingBuffer: number; // minutes between meetings
}

/**
 * Contact information (existing structure)
 */
export interface ContactInfo {
  email: string;
  name?: string;
  relationship?: string;
  work_context?: string;
  preferences?: {
    meetingType?: 'in-person' | 'virtual' | 'hybrid';
    preferredTimes?: string[];
    location?: string;
  };
}

/**
 * User document structure in Firestore
 */
export interface UserDocument {
  email: string;
  name?: string;
  created_at: string;
  stinaPreferences?: UserPreferences;
  oauth_tokens?: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}
