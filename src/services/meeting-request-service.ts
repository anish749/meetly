import { adminDb } from '@/config/firebase-admin';
import {
  MeetingRequest,
  MeetingRequestStatus,
  CreateMeetingRequestPayload,
  UpdateMeetingRequestPayload,
  MeetingRequestFilters,
  Communication,
  VALID_STATUS_TRANSITIONS,
  MeetingRequestParticipant,
} from '@/types/meeting-request';
import { EmailContext } from './stina-agent';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

interface TextMessage {
  id: string;
  from: string;
  content: string;
  timestamp: string;
}

export class MeetingRequestService {
  static async createFromEmail(
    emailContext: EmailContext,
    userEmail: string
  ): Promise<MeetingRequest> {
    try {
      const meetingRequestId = this.generateMeetingRequestId();

      const participants: MeetingRequestParticipant[] = [
        {
          email: emailContext.from,
          isRegisteredUser: await this.isUserRegistered(emailContext.from),
          preferences: await this.getUserPreferences(emailContext.from),
        },
      ];

      const communication: Communication = {
        id: `email_${emailContext.id}`,
        type: 'email',
        content: emailContext.body,
        sender: emailContext.from,
        timestamp: emailContext.createdAt,
        processed: false,
      };

      const meetingRequest: MeetingRequest = {
        id: meetingRequestId,
        status: 'context_collection',
        participants,
        creator: {
          email: userEmail,
          source: 'email',
        },
        context: {
          summary: `Email from ${emailContext.from}: ${emailContext.subject}`,
        },
        proposedTimes: [],
        communications: [communication],
        metadata: {
          urgency: 'medium',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Filter out undefined values to prevent Firestore errors
      const cleanMeetingRequest = this.removeUndefinedValues(meetingRequest);

      await adminDb
        .collection('meetingRequests')
        .doc(meetingRequestId)
        .set(cleanMeetingRequest);

      return meetingRequest;
    } catch (error) {
      console.error('Error creating meeting request from email:', error);
      throw error;
    }
  }

  static async createFromText(
    textMessage: TextMessage,
    userEmail: string
  ): Promise<MeetingRequest> {
    try {
      const meetingRequestId = this.generateMeetingRequestId();

      const participants: MeetingRequestParticipant[] = [
        {
          email: textMessage.from,
          name: undefined,
          isRegisteredUser: await this.isUserRegistered(textMessage.from),
          preferences: await this.getUserPreferences(textMessage.from),
        },
      ];

      const communication: Communication = {
        id: `text_${textMessage.id}`,
        type: 'text',
        content: textMessage.content,
        sender: textMessage.from,
        timestamp: textMessage.timestamp,
        processed: false,
      };

      const meetingRequest: MeetingRequest = {
        id: meetingRequestId,
        status: 'context_collection',
        participants,
        creator: {
          email: userEmail,
          source: 'text',
        },
        context: {
          summary: `Text message from ${textMessage.from}`,
        },
        proposedTimes: [],
        communications: [communication],
        metadata: {
          urgency: 'medium',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await adminDb
        .collection('meetingRequests')
        .doc(meetingRequestId)
        .set(meetingRequest);

      return meetingRequest;
    } catch (error) {
      console.error('Error creating meeting request from text:', error);
      throw error;
    }
  }

  static async create(
    payload: CreateMeetingRequestPayload,
    initialStatus: MeetingRequestStatus = 'context_collection'
  ): Promise<MeetingRequest> {
    try {
      const meetingRequestId = this.generateMeetingRequestId();

      const participants: MeetingRequestParticipant[] = await Promise.all(
        payload.participants.map(async (p) => ({
          ...p,
          isRegisteredUser: await this.isUserRegistered(p.email),
          preferences:
            p.preferences || (await this.getUserPreferences(p.email)),
        }))
      );

      const communications: Communication[] = payload.communications
        ? payload.communications.map((comm, index) => ({
            ...comm,
            id: `${comm.type}_${Date.now()}_${index}`,
          }))
        : [];

      const meetingRequest: MeetingRequest = {
        id: meetingRequestId,
        status: initialStatus,
        participants,
        creator: payload.creator,
        context: payload.context,
        proposedTimes: payload.proposedTimes || [],
        communications,
        metadata: payload.metadata || { urgency: 'medium' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await adminDb
        .collection('meetingRequests')
        .doc(meetingRequestId)
        .set(meetingRequest);

      return meetingRequest;
    } catch (error) {
      console.error('Error creating meeting request:', error);
      throw error;
    }
  }

  static async updateStatus(
    requestId: string,
    newStatus: MeetingRequestStatus,
    context?: Record<string, unknown>
  ): Promise<void> {
    try {
      const meetingRequest = await this.getById(requestId);
      if (!meetingRequest) {
        throw new Error(`Meeting request ${requestId} not found`);
      }

      if (!this.isValidStatusTransition(meetingRequest.status, newStatus)) {
        throw new Error(
          `Invalid status transition from ${meetingRequest.status} to ${newStatus}`
        );
      }

      const updateData: Partial<MeetingRequest> = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };

      if (context) {
        updateData.metadata = {
          ...meetingRequest.metadata,
          ...context,
        };
      }

      await adminDb
        .collection('meetingRequests')
        .doc(requestId)
        .update(updateData);
    } catch (error) {
      console.error('Error updating meeting request status:', error);
      throw error;
    }
  }

  static async addCommunication(
    requestId: string,
    communication: Omit<Communication, 'id'>
  ): Promise<void> {
    try {
      const meetingRequest = await this.getById(requestId);
      if (!meetingRequest) {
        throw new Error(`Meeting request ${requestId} not found`);
      }

      const newCommunication: Communication = {
        ...communication,
        id: `${communication.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      const updatedCommunications = [
        ...meetingRequest.communications,
        newCommunication,
      ];

      await adminDb.collection('meetingRequests').doc(requestId).update({
        communications: updatedCommunications,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error adding communication to meeting request:', error);
      throw error;
    }
  }

  static async updateContext(
    requestId: string,
    contextUpdate: Partial<MeetingRequest['context']>
  ): Promise<void> {
    try {
      const meetingRequest = await this.getById(requestId);
      if (!meetingRequest) {
        throw new Error(`Meeting request ${requestId} not found`);
      }

      const updatedContext = {
        ...meetingRequest.context,
        ...contextUpdate,
      };

      await adminDb.collection('meetingRequests').doc(requestId).update({
        context: updatedContext,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating meeting request context:', error);
      throw error;
    }
  }

  static async getByUser(
    userEmail: string,
    filters?: MeetingRequestFilters
  ): Promise<MeetingRequest[]> {
    try {
      let query = adminDb
        .collection('meetingRequests')
        .where('creator.email', '==', userEmail);

      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.where('status', 'in', filters.status);
        } else {
          query = query.where('status', '==', filters.status);
        }
      }

      const snapshot = await query.orderBy('createdAt', 'desc').get();
      return snapshot.docs.map((doc) => doc.data() as MeetingRequest);
    } catch (error) {
      console.error('Error getting meeting requests by user:', error);
      throw error;
    }
  }

  static async getByParticipant(
    email: string,
    filters?: MeetingRequestFilters
  ): Promise<MeetingRequest[]> {
    try {
      let query = adminDb
        .collection('meetingRequests')
        .where('participants', 'array-contains-any', [{ email }]);

      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.where('status', 'in', filters.status);
        } else {
          query = query.where('status', '==', filters.status);
        }
      }

      const snapshot = await query.orderBy('createdAt', 'desc').get();
      return snapshot.docs.map((doc) => doc.data() as MeetingRequest);
    } catch (error) {
      console.error('Error getting meeting requests by participant:', error);
      throw error;
    }
  }

  static async getById(requestId: string): Promise<MeetingRequest | null> {
    try {
      const doc = await adminDb
        .collection('meetingRequests')
        .doc(requestId)
        .get();

      if (!doc.exists) {
        return null;
      }

      return doc.data() as MeetingRequest;
    } catch (error) {
      console.error('Error getting meeting request by ID:', error);
      throw error;
    }
  }

  static async processWithAI(requestId: string): Promise<void> {
    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required');
      }

      const meetingRequest = await this.getById(requestId);
      if (!meetingRequest) {
        throw new Error(`Meeting request ${requestId} not found`);
      }

      const unprocessedCommunications = meetingRequest.communications.filter(
        (c) => !c.processed
      );
      if (unprocessedCommunications.length === 0) {
        return;
      }

      const result = await generateText({
        model: anthropic('claude-3-5-sonnet-20241022'),
        system:
          'You are an expert at analyzing meeting request communications and extracting relevant context. Update the meeting request summary with new insights.',
        prompt: `
Analyze these new communications and update the meeting context:

Current context: ${meetingRequest.context.summary}

New communications:
${unprocessedCommunications.map((c) => `${c.type} from ${c.sender}: ${c.content}`).join('\n')}

Meeting participants: ${meetingRequest.participants.map((p) => p.email).join(', ')}
Current status: ${meetingRequest.status}

Provide an updated context summary that captures all relevant meeting details.`,
      });

      await this.updateContext(requestId, { summary: result.text });

      const communicationIds = unprocessedCommunications.map((c) => c.id);
      const updatedCommunications = meetingRequest.communications.map((c) =>
        communicationIds.includes(c.id) ? { ...c, processed: true } : c
      );

      await adminDb.collection('meetingRequests').doc(requestId).update({
        communications: updatedCommunications,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error processing meeting request with AI:', error);
      throw error;
    }
  }

  static async linkToCalendarEvent(
    requestId: string,
    eventId: string,
    calendarId: string
  ): Promise<void> {
    try {
      const meetingRequest = await this.getById(requestId);
      if (!meetingRequest) {
        throw new Error(`Meeting request ${requestId} not found`);
      }

      if (meetingRequest.proposedTimes.length === 0) {
        throw new Error(
          'No proposed times available to link to calendar event'
        );
      }

      const firstProposedTime = meetingRequest.proposedTimes[0];

      await adminDb
        .collection('meetingRequests')
        .doc(requestId)
        .update({
          scheduledEvent: {
            googleEventId: eventId,
            calendarId,
            start: firstProposedTime.start,
            end: firstProposedTime.end,
          },
          status: 'scheduled',
          updatedAt: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error linking meeting request to calendar event:', error);
      throw error;
    }
  }

  static async update(
    requestId: string,
    updates: UpdateMeetingRequestPayload
  ): Promise<MeetingRequest> {
    try {
      const meetingRequest = await this.getById(requestId);
      if (!meetingRequest) {
        throw new Error(`Meeting request ${requestId} not found`);
      }

      if (
        updates.status &&
        !this.isValidStatusTransition(meetingRequest.status, updates.status)
      ) {
        throw new Error(
          `Invalid status transition from ${meetingRequest.status} to ${updates.status}`
        );
      }

      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };

      if (updates.status) {
        updateData.status = updates.status;
      }

      if (updates.context) {
        updateData.context = {
          ...meetingRequest.context,
          ...updates.context,
        };
      }

      if (updates.proposedTimes) {
        updateData.proposedTimes = updates.proposedTimes;
      }

      if (updates.scheduledEvent) {
        updateData.scheduledEvent = updates.scheduledEvent;
      }

      if (updates.metadata) {
        updateData.metadata = {
          ...meetingRequest.metadata,
          ...updates.metadata,
        };
      }

      // Filter out undefined values to prevent Firestore errors
      const cleanUpdateData = this.removeUndefinedValues(updateData);

      await adminDb
        .collection('meetingRequests')
        .doc(requestId)
        .update(cleanUpdateData);

      return (await this.getById(requestId)) as MeetingRequest;
    } catch (error) {
      console.error('Error updating meeting request:', error);
      throw error;
    }
  }

  static async delete(requestId: string): Promise<void> {
    try {
      await this.updateStatus(requestId, 'cancelled');
    } catch (error) {
      console.error('Error deleting meeting request:', error);
      throw error;
    }
  }

  static async canUserAccess(
    requestId: string,
    userEmail: string
  ): Promise<boolean> {
    try {
      const meetingRequest = await this.getById(requestId);
      if (!meetingRequest) {
        return false;
      }

      return (
        meetingRequest.creator.email === userEmail ||
        meetingRequest.participants.some((p) => p.email === userEmail)
      );
    } catch (error) {
      console.error('Error checking user access:', error);
      return false;
    }
  }

  private static generateMeetingRequestId(): string {
    return `meeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static isValidStatusTransition(
    currentStatus: MeetingRequestStatus,
    newStatus: MeetingRequestStatus
  ): boolean {
    return VALID_STATUS_TRANSITIONS[currentStatus].includes(newStatus);
  }

  private static async isUserRegistered(email: string): Promise<boolean> {
    try {
      const userDoc = await adminDb.collection('users').doc(email).get();
      return userDoc.exists;
    } catch (error) {
      console.error('Error checking if user is registered:', error);
      return false;
    }
  }

  private static async getUserPreferences(
    email: string
  ): Promise<string | undefined> {
    try {
      const userDoc = await adminDb.collection('users').doc(email).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        return userData?.stinaPreferences
          ? JSON.stringify(userData.stinaPreferences)
          : undefined;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return undefined;
    }
  }

  private static buildAIContextString(meetingRequest: MeetingRequest): string {
    return `
Meeting Request: ${meetingRequest.id}
Status: ${meetingRequest.status}
Participants: ${meetingRequest.participants.map((p) => `${p.email}${p.name ? ` (${p.name})` : ''}`).join(', ')}
Creator: ${meetingRequest.creator.email} via ${meetingRequest.creator.source}
Proposed Times: ${meetingRequest.proposedTimes.length} time slots
Communications: ${meetingRequest.communications.length} messages
Metadata: ${JSON.stringify(meetingRequest.metadata, null, 2)}
`;
  }

  private static removeUndefinedValues<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.removeUndefinedValues(item)) as T;
    }

    const result = {} as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) {
        result[key] = this.removeUndefinedValues(value);
      }
    }
    return result as T;
  }
}
