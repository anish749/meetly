// Firebase Collection Names
export const FIREBASE_COLLECTIONS = {
  USERS: 'users',
  MEETING_REQUESTS: 'meetingRequests',
  // Sub-collections under users
  CONTACTS: 'contacts',
  PREFERENCES: 'preferences',
  EMAIL_PROCESSING_RESULTS: 'email_processing_results',
} as const;

export type FirebaseCollectionName =
  (typeof FIREBASE_COLLECTIONS)[keyof typeof FIREBASE_COLLECTIONS];

// Helper functions for constructing collection paths
export const getCollectionPath = {
  users: () => FIREBASE_COLLECTIONS.USERS,
  user: (email: string) => `${FIREBASE_COLLECTIONS.USERS}/${email}`,
  contacts: (userEmail: string) =>
    `${FIREBASE_COLLECTIONS.USERS}/${userEmail}/${FIREBASE_COLLECTIONS.CONTACTS}`,
  contact: (userEmail: string, contactEmail: string) =>
    `${FIREBASE_COLLECTIONS.USERS}/${userEmail}/${FIREBASE_COLLECTIONS.CONTACTS}/${contactEmail}`,
  preferences: (userEmail: string) =>
    `${FIREBASE_COLLECTIONS.USERS}/${userEmail}/${FIREBASE_COLLECTIONS.PREFERENCES}`,
  emailProcessingResults: (userEmail: string) =>
    `${FIREBASE_COLLECTIONS.USERS}/${userEmail}/${FIREBASE_COLLECTIONS.EMAIL_PROCESSING_RESULTS}`,
  meetingRequests: () => FIREBASE_COLLECTIONS.MEETING_REQUESTS,
  meetingRequest: (requestId: string) =>
    `${FIREBASE_COLLECTIONS.MEETING_REQUESTS}/${requestId}`,
};

// Document Type Definitions
// Note: MeetingRequest types are defined in @/types/meeting-request.ts

// User Document (stored in 'users' collection)
export interface UserDocument {
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  oauthToken: {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expiry_date: number; // Unix timestamp
  };
  sessions: Array<{
    token: string;
    expiresAt: number; // Unix timestamp
  }>;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  stinaPreferences?: string; // Free-form text preferences
}

// Contact Document (stored in 'users/{email}/contacts' sub-collection)
export interface ContactDocument {
  email: string;
  name?: string;
  company?: string;
  lastInteraction?: string; // ISO string
  timezone?: string;
  preferences?: {
    preferredMeetingTimes?: string;
    workingHours?: {
      start: string;
      end: string;
    };
    notes?: string;
  };
  meetingHistory?: Array<{
    date: string; // ISO string
    duration: number;
    title: string;
  }>;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

// Preferences Document (stored in 'users/{email}/preferences' sub-collection)
export interface PreferencesDocument {
  id: string; // Usually 'primary'
  preferences: string; // Free-form text
  version: number;
  updatedAt: string; // ISO string
}

// Email Processing Result Document (stored in 'users/{email}/email_processing_results' sub-collection)
export interface EmailProcessingResultDocument {
  emailId: string;
  processedAt: string; // ISO string
  success: boolean;
  error?: string;
  result?: {
    toolCalls?: Array<{
      toolName: string;
      input: Record<string, unknown>;
      output: Record<string, unknown>;
    }>;
    summary?: string;
  };
}

// Type guard functions
export const isUserDocument = (doc: unknown): doc is UserDocument => {
  const d = doc as Record<string, unknown>;
  return (
    d &&
    typeof d.email === 'string' &&
    typeof d.name === 'string' &&
    d.oauthToken !== undefined
  );
};

export const isContactDocument = (doc: unknown): doc is ContactDocument => {
  const d = doc as Record<string, unknown>;
  return d && typeof d.email === 'string';
};

// Firestore converter helpers for type safety
import {
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';

export const firestoreConverters = {
  user: {
    toFirestore(user: UserDocument): DocumentData {
      return user;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): UserDocument {
      return snapshot.data() as UserDocument;
    },
  },
  contact: {
    toFirestore(contact: ContactDocument): DocumentData {
      return contact;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): ContactDocument {
      return snapshot.data() as ContactDocument;
    },
  },
  preferences: {
    toFirestore(prefs: PreferencesDocument): DocumentData {
      return prefs;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): PreferencesDocument {
      return snapshot.data() as PreferencesDocument;
    },
  },
  emailProcessingResult: {
    toFirestore(result: EmailProcessingResultDocument): DocumentData {
      return result;
    },
    fromFirestore(
      snapshot: QueryDocumentSnapshot
    ): EmailProcessingResultDocument {
      return snapshot.data() as EmailProcessingResultDocument;
    },
  },
};

// Re-export meeting request types from the correct source
export type {
  MeetingRequest,
  MeetingRequestStatus,
  CommunicationType,
} from '@/types/meeting-request';
