import { generateObject, generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { GoogleCalendarService } from './google-calendar-service';
import { adminDb } from '@/config/firebase-admin';
import { stinaAiTools } from './stina-ai-tools';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

// Session tracking for multi-step workflows
export interface StinaSession {
  id: string;
  userEmail: string;
  status: 'INITIATING' | 'TIME_PROPOSED' | 'TIME_CONFIRMED' | 'VENUE_PROPOSED' | 'CALENDAR_BOOKED' | 'COMPLETED';
  progress: number;
  context: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface StinaContext {
  userEmail: string;
  contacts: ContactInfo[];
  preferences: UserPreferences;
  environmental: EnvironmentalContext;
}

export interface ContactInfo {
  email: string;
  name?: string;
  company?: string;
  role?: string;
  preferences?: {
    meetingType?: 'in-person' | 'virtual' | 'hybrid';
    timeZone?: string;
    workingHours?: {
      start: string;
      end: string;
      days: string[];
    };
  };
  pastMeetings?: MeetingHistory[];
}

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

export interface EnvironmentalContext {
  weather?: {
    location: string;
    current: string;
    forecast: string;
  };
  location?: {
    city: string;
    country: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  nearbyVenues?: {
    cafes: Array<{
      name: string;
      address: string;
      rating: number;
      cuisine?: string;
    }>;
    offices: Array<{
      name: string;
      address: string;
    }>;
  };
}

export interface MeetingHistory {
  date: string;
  type: 'in-person' | 'virtual';
  location?: string;
  duration: number;
  notes?: string;
}

export interface EmailContext {
  id: string;
  subject: string;
  from: string;
  body: string;
  createdAt: string;
}

export interface MeetingIntent {
  type: 'in-person' | 'virtual' | 'hybrid';
  participants: string[];
  duration: number;
  preferredTimes: string[];
  location?: string;
  agenda?: string;
  urgency: 'low' | 'medium' | 'high';
}

export class StinaAgent {
  private userEmail: string;
  private context: StinaContext;
  private model: ReturnType<typeof anthropic>;

  constructor(userEmail: string) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    this.model = anthropic('claude-3-5-sonnet-20241022');
    this.userEmail = userEmail;
    this.context = {
      userEmail,
      contacts: [],
      preferences: this.getDefaultPreferences(),
      environmental: {},
    };
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      defaultMeetingType: 'virtual',
      workingHours: {
        start: '09:00',
        end: '17:00',
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      },
      timeZone: 'UTC',
      meetingBuffer: 15,
    };
  }

  async initializeContext(): Promise<void> {
    // Load user preferences from database
    await this.loadUserPreferences();

    // Load contact information
    await this.loadContacts();

    // Get current environmental context
    await this.updateEnvironmentalContext();
  }

  private async loadUserPreferences(): Promise<void> {
    try {
      const userDoc = await adminDb
        .collection('users')
        .doc(this.userEmail)
        .get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData?.stinaPreferences) {
          this.context.preferences = {
            ...this.context.preferences,
            ...userData.stinaPreferences,
          };
        }
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  }

  private async loadContacts(): Promise<void> {
    try {
      const contactsSnapshot = await adminDb
        .collection('users')
        .doc(this.userEmail)
        .collection('contacts')
        .get();

      this.context.contacts = contactsSnapshot.docs.map((doc) => ({
        ...doc.data(),
        email: doc.id,
      })) as ContactInfo[];
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  }

  private async updateEnvironmentalContext(): Promise<void> {
    // This would integrate with weather and location APIs
    // For now, we'll set basic defaults
    this.context.environmental = {
      location: {
        city: 'Unknown',
        country: 'Unknown',
      },
    };
  }

  async processEmails(emails: EmailContext[]): Promise<void> {
    console.log('Processing emails - ', emails.length);
    for (const email of emails) {
      try {
        await this.processEmail(email);
      } catch (error) {
        console.error(`Error processing email ${email.id}:`, error);
      }
    }
  }

  private async processEmail(email: EmailContext): Promise<void> {
    console.log('Processing email - ', email.subject);
    const meetingIntent = await this.analyzeMeetingIntent(email);

    if (meetingIntent) {
      await this.handleMeetingRequest(email, meetingIntent);
    }
  }

  private async analyzeMeetingIntent(
    email: EmailContext
  ): Promise<MeetingIntent | null> {
    try {
      // Create a unique session for this email processing
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // First, use generateText with tools to analyze the email and perform multi-step reasoning
      const result = await generateText({
        model: this.model,
        maxSteps: 20,
        tools: stinaAiTools,
        prompt: `
          You are Stina, an AI executive assistant. Analyze this email to determine if it's a meeting request and help schedule it.
          
          Email Details:
          Subject: ${email.subject}
          From: ${email.from}
          Body: ${email.body}
          
          User Context:
          - Working hours: ${this.context.preferences.workingHours.start} - ${this.context.preferences.workingHours.end}
          - Time zone: ${this.context.preferences.timeZone}
          - Default meeting type: ${this.context.preferences.defaultMeetingType}
          
          Instructions:
          1. First, update the session status to INITIATING
          2. Analyze if this is a meeting request
          3. If it is a meeting request:
             - Extract participant emails from the message
             - Look up person details for each participant
             - Check calendar availability for suggested times
             - If location is mentioned or in-person meeting, find suitable venues
             - Update session progress as you work
          4. If it's not a meeting request, respond with "NOT_MEETING_REQUEST"
          
          Session ID: ${sessionId}
          
          Think step by step and use the available tools to gather all necessary information.
        `,
      });

      console.log('AI Analysis Steps:', result.steps?.length || 0);
      console.log('Final Response:', result.text);

      // Parse the final response for meeting intent
      if (result.text.includes('NOT_MEETING_REQUEST')) {
        return null;
      }

      // Extract meeting intent from the response or tool calls
      return await this.extractMeetingIntentFromResponse(result.text, email);
    } catch (error) {
      console.error('Error analyzing meeting intent:', error);
      return null;
    }
  }

  private async extractMeetingIntentFromResponse(
    responseText: string, 
    email: EmailContext
  ): Promise<MeetingIntent | null> {
    try {
      // Use generateObject to extract structured meeting intent
      const meetingIntentSchema = z.object({
        type: z.enum(['in-person', 'virtual', 'hybrid']),
        participants: z.array(z.string().email()),
        duration: z.number().min(15).max(480), // 15 minutes to 8 hours
        preferredTimes: z.array(z.string()),
        location: z.string().optional(),
        agenda: z.string().optional(),
        urgency: z.enum(['low', 'medium', 'high'])
      });

      const { object: meetingIntent } = await generateObject({
        model: this.model,
        schema: meetingIntentSchema,
        prompt: `
          Extract meeting details from this analysis and email:
          
          Analysis: ${responseText}
          
          Original Email:
          Subject: ${email.subject}
          From: ${email.from}
          Body: ${email.body}
          
          Extract the meeting intent with:
          - type: meeting format preference
          - participants: array of email addresses
          - duration: meeting length in minutes
          - preferredTimes: array of suggested time strings
          - location: meeting location if specified
          - agenda: meeting purpose/agenda if mentioned
          - urgency: how urgent this meeting seems
        `,
      });

      return meetingIntent as MeetingIntent;
    } catch (error) {
      console.error('Error extracting meeting intent:', error);
      
      // Fallback to simple parsing if structured extraction fails
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const intent = JSON.parse(jsonMatch[0]);
          if (intent.participants && intent.duration && intent.type) {
            return intent as MeetingIntent;
          }
        } catch (parseError) {
          console.error('Fallback parsing failed:', parseError);
        }
      }
      
      return null;
    }
  }

  private async handleMeetingRequest(
    email: EmailContext,
    intent: MeetingIntent
  ): Promise<void> {
    // Check availability for all participants
    const availability = await this.checkAvailability(
      intent.participants,
      intent.preferredTimes,
      intent.duration
    );

    // Find best meeting slot
    const bestSlot = await this.findBestMeetingSlot(availability, intent);

    if (bestSlot) {
      // Create calendar event
      await this.createMeetingEvent(email, intent, bestSlot);

      // Update contact context
      await this.updateContactContext(intent.participants, email);
    }
  }

  private async checkAvailability(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _participants: string[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _preferredTimes: string[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _duration: number
  ): Promise<{
    user: unknown;
    participants: Record<string, unknown>;
  }> {
    const calendarService = new GoogleCalendarService(this.userEmail);

    // Check user's availability
    const userAvailability = await calendarService.getFreeBusy(
      new Date().toISOString(),
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    );

    // For other participants, we'd need their calendar access or external scheduling
    return {
      user: userAvailability,
      participants: {}, // Would be populated with other participants' availability
    };
  }

  private async findBestMeetingSlot(
    availability: {
      user: unknown;
      participants: Record<string, unknown>;
    },
    intent: MeetingIntent
  ): Promise<{
    startTime: string;
    endTime: string;
  } | null> {
    try {
      // Use AI to find the best meeting slot with multi-step reasoning
      const result = await generateText({
        model: this.model,
        maxSteps: 10,
        tools: stinaAiTools,
        prompt: `
          Find the best meeting slot based on the following requirements:
          
          Meeting Requirements:
          - Duration: ${intent.duration} minutes
          - Type: ${intent.type}
          - Participants: ${intent.participants.join(', ')}
          - Preferred times: ${intent.preferredTimes.join(', ')}
          
          User Preferences:
          - Working hours: ${this.context.preferences.workingHours.start} - ${this.context.preferences.workingHours.end}
          - Meeting buffer: ${this.context.preferences.meetingBuffer} minutes
          
          Steps:
          1. Check calendar availability for the next 7 days
          2. Consider the preferred times mentioned
          3. Factor in working hours and meeting buffer
          4. Recommend the best slot with justification
          
          Return your final recommendation as a JSON object with startTime and endTime in ISO format.
        `,
      });

      // Extract time slot from the response
      const timeSlotMatch = result.text.match(/"startTime":\s*"([^"]+)",\s*"endTime":\s*"([^"]+)"/);
      if (timeSlotMatch) {
        return {
          startTime: timeSlotMatch[1],
          endTime: timeSlotMatch[2]
        };
      }

      // Fallback: generate a simple slot based on preferences
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      tomorrow.setHours(14, 0, 0, 0); // 2 PM tomorrow
      
      const endTime = new Date(tomorrow.getTime() + intent.duration * 60 * 1000);
      
      return {
        startTime: tomorrow.toISOString(),
        endTime: endTime.toISOString()
      };
    } catch (error) {
      console.error('Error finding meeting slot:', error);
      return null;
    }
  }

  private async createMeetingEvent(
    email: EmailContext,
    intent: MeetingIntent,
    slot: {
      startTime: string;
      endTime: string;
    }
  ): Promise<void> {
    const calendarService = new GoogleCalendarService(this.userEmail);

    // Create event based on intent and slot
    const event = {
      summary: email.subject,
      description: `${email.body}\n\nScheduled by Stina AI Agent`,
      start: {
        dateTime: slot.startTime,
        timeZone: this.context.preferences.timeZone,
      },
      end: {
        dateTime: slot.endTime,
        timeZone: this.context.preferences.timeZone,
      },
      attendees: intent.participants.map((email) => ({ email })),
      location: intent.location,
    };

    await calendarService.createEvent(event);
  }

  private async updateContactContext(
    participants: string[],
    email: EmailContext
  ): Promise<void> {
    for (const participantEmail of participants) {
      try {
        await adminDb
          .collection('users')
          .doc(this.userEmail)
          .collection('contacts')
          .doc(participantEmail)
          .set(
            {
              lastContact: new Date().toISOString(),
              emailHistory: FieldValue.arrayUnion({
                id: email.id,
                subject: email.subject,
                date: email.createdAt,
              }),
            },
            { merge: true }
          );
      } catch (error) {
        console.error(`Error updating contact ${participantEmail}:`, error);
      }
    }
  }


  async saveUserPreferences(
    preferences: Partial<UserPreferences>
  ): Promise<void> {
    try {
      await adminDb
        .collection('users')
        .doc(this.userEmail)
        .update({
          stinaPreferences: {
            ...this.context.preferences,
            ...preferences,
          },
          updatedAt: new Date().toISOString(),
        });

      this.context.preferences = {
        ...this.context.preferences,
        ...preferences,
      };
    } catch (error) {
      console.error('Error saving user preferences:', error);
      throw error;
    }
  }

  // Session management methods
  private async createSession(emailId: string): Promise<StinaSession> {
    const session: StinaSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userEmail: this.userEmail,
      status: 'INITIATING',
      progress: 0,
      context: {
        emailId,
        createdFrom: 'email_processing'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await adminDb
        .collection('users')
        .doc(this.userEmail)
        .collection('stina_sessions')
        .doc(session.id)
        .set(session);
    } catch (error) {
      console.error('Error creating session:', error);
    }

    return session;
  }

  private async updateSession(
    sessionId: string, 
    updates: Partial<Pick<StinaSession, 'status' | 'progress' | 'context'>>
  ): Promise<void> {
    try {
      await adminDb
        .collection('users')
        .doc(this.userEmail)
        .collection('stina_sessions')
        .doc(sessionId)
        .update({
          ...updates,
          updatedAt: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error updating session:', error);
    }
  }

  // Enhanced email processing with AI-powered multi-step workflow
  async processEmailWithAI(email: EmailContext): Promise<void> {
    console.log(`Processing email with AI: ${email.subject}`);
    
    try {
      // Create a session to track this processing workflow
      const session = await this.createSession(email.id);

      // Use AI with tools to process the email end-to-end
      const result = await generateText({
        model: this.model,
        maxSteps: 20,
        tools: stinaAiTools,
        prompt: `
          You are Stina, an AI executive assistant. Process this email comprehensively:
          
          Email Details:
          Subject: ${email.subject}
          From: ${email.from}
          Body: ${email.body}
          
          User Context:
          - Email: ${this.userEmail}
          - Working hours: ${this.context.preferences.workingHours.start} - ${this.context.preferences.workingHours.end}
          - Time zone: ${this.context.preferences.timeZone}
          - Default meeting type: ${this.context.preferences.defaultMeetingType}
          
          Session ID: ${session.id}
          
          Instructions:
          1. Update session status to INITIATING with 10% progress
          2. Analyze if this requires meeting scheduling
          3. If it's a meeting request:
             - Extract participant details and look them up
             - Check calendar availability for next 2 weeks
             - If location needed, find suitable venues
             - Update session progress to TIME_PROPOSED (40%)
             - Send appropriate response email
             - Update session to COMPLETED (100%)
          4. If it's not a meeting request:
             - Determine appropriate response action
             - Update session status accordingly
          
          Be thorough and use all available tools to provide comprehensive assistance.
        `,
      });

      console.log(`Processed email in ${result.steps?.length || 0} AI steps`);
      console.log('Final result:', result.text);
      
    } catch (error) {
      console.error('Error in AI email processing:', error);
    }
  }
}
