import { generateText, generateObject, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { adminDb } from '@/config/firebase-admin';
import {
  StinaTools,
  calendarCheckScheduleSchema,
  venuesFindSchema,
  commsSendEmailSchema,
  backendUpdateSessionSchema,
  peopleGetPersonDetailsSchema,
} from './stina-tools';
import { EmailAnalysisResult } from './email-analyst';
import { z } from 'zod';

// System prompt for Stina AI Agent
const STINA_SYSTEM_PROMPT = `You are "Stina", an Executive-Assistant AI.

Mission
-------
• Turn free-form user requests ("Grab coffee with David next week") into confirmed meetings.  
• Communicate on the user's behalf—always polite, concise and proactive.

Super-powers (tool calls)
-------------------------
• calendar_check_schedule  – retrieve the user's free blocks in a date range  
• venues_find              – suggest 3-5 suitable meeting spots near a coordinate  
• comms_send_email         – start or reply to an email thread as the user's alias  
• backend_update_session   – persist the current session status, progress % and a note
• people_get_person_details - Gets the person's details

*(These are the **only** side-effect tools available.)*

Workflow
--------
1. **Understand the ask.** Extract invitee name(s), date range, duration, modality (in-person / virtual) and purpose from the latest email or chat message.  
2. **Check availability.** Call **calendar_check_schedule** to pick 2-3 candidate slots that respect the user's preferences (passed in the context).  
3. **Suggest venues** when the meeting is in-person and no location is fixed. Call **venues_find** around the midpoint of participants' postcodes, filtered by tags such as *coffee* or *lunch*.  
4. **Propose the meeting.**  
   • Call **backend_update_session** → \`TIME_PROPOSED\`, progress ≈ 30 %.  
   • Call **comms_send_email** to the invitee(s) listing the proposed slots (and venues if any).  
   • Call **backend_update_session** again → note "Waiting for reply".  
5. **Loop.** When a reply arrives, repeat steps 1-4 until both time and (if needed) venue are agreed.  
6. **Book it.** Once confirmed, call **backend_update_session** → \`CALENDAR_BOOKED\`, progress ≈ 90 %, and send a confirmation email.  
7. **Finish.** Call **backend_update_session** → \`COMPLETED\`, progress = 100 %.

Etiquette
---------
• Address people by name and keep emails short and friendly.  
• Use the user's local timezone (Europe/London) and show times with explicit TZ (e.g. "Tue 16 July 14:00–15:00 BST").  
• Propose **no more than three** slots in any single email.  
• If key details are missing (e.g. no date range), ask the user a clarifying question in chat *before* emailing anyone.

Safety Rails
------------
• Never invent tool names or parameters beyond the four above.  
• Never expose raw JSON or internal reasoning to human recipients.  
• If an external tool call fails, describe the failure in a follow-up **backend_update_session** note and wait for the next instruction.`;

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
  private stinaTools: StinaTools;

  constructor(userEmail: string) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    this.userEmail = userEmail;
    this.stinaTools = new StinaTools(userEmail);
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
        await this.processEmailWithAI(email);
      } catch (error) {
        console.error(`Error processing email ${email.id}:`, error);
      }
    }
  }

  async processEmailWithAI(email: EmailContext): Promise<void> {
    console.log('Processing email with AI - ', email.subject);

    // Generate a unique session ID for this interaction
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create context string for the AI
    const contextString = this.buildContextString();

    try {
      const result = await generateText({
        model: anthropic('claude-3-5-sonnet-20241022'),
        system: STINA_SYSTEM_PROMPT,
        prompt: `
Context about the user:
${contextString}

Process this email and handle the meeting request if present:

Subject: ${email.subject}
From: ${email.from}
Body: ${email.body}
Received: ${email.createdAt}

Session ID for tracking: ${sessionId}

Please analyze this email and take appropriate actions according to your workflow.`,
        maxSteps: 20,
        tools: {
          calendar_check_schedule: tool({
            description: "Check the user's schedule",
            parameters: calendarCheckScheduleSchema,
            execute: async (params) => {
              const result = await this.stinaTools.executeToolCall(
                'calendar_check_schedule',
                params
              );
              return result.data || { error: result.error };
            },
          }),
          venues_find: tool({
            description:
              'Return up to limit venues that match the given tags near the supplied place-name',
            parameters: venuesFindSchema,
            execute: async (params) => {
              const result = await this.stinaTools.executeToolCall(
                'venues_find',
                params
              );
              return result.data || { error: result.error };
            },
          }),
          comms_send_email: tool({
            description:
              "Send a new e-mail or reply in an existing thread on the user's behalf",
            parameters: commsSendEmailSchema,
            execute: async (params) => {
              const result = await this.stinaTools.executeToolCall(
                'comms_send_email',
                params
              );
              return result.data || { error: result.error };
            },
          }),
          backend_update_session: tool({
            description: "Updates the session's status",
            parameters: backendUpdateSessionSchema,
            execute: async (params) => {
              const result = await this.stinaTools.executeToolCall(
                'backend_update_session',
                params
              );
              return result.data || { error: result.error };
            },
          }),
          people_get_person_details: tool({
            description:
              'Retrieve enriched contact information for the person the user wants to meet',
            parameters: peopleGetPersonDetailsSchema,
            execute: async (params) => {
              const result = await this.stinaTools.executeToolCall(
                'people_get_person_details',
                params
              );
              return result.data || { error: result.error };
            },
          }),
        },
      });

      console.log('AI processing result:', result.text);
      console.log('Tools used:', result.steps.length, 'steps');

      // Store the processing result
      await this.storeProcessingResult(email, sessionId, result);
    } catch (error) {
      console.error('Error in AI processing:', error);

      // Update session with error status
      await this.stinaTools.executeToolCall('backend_update_session', {
        session_id: sessionId,
        status: 'INITIATING',
        progress: 0,
        note: `Error processing email: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  private buildContextString(): string {
    return `
• Working hours: ${this.context.preferences.workingHours.start} - ${this.context.preferences.workingHours.end}
• Time zone: ${this.context.preferences.timeZone}
• Default meeting type: ${this.context.preferences.defaultMeetingType}
• Meeting buffer: ${this.context.preferences.meetingBuffer} minutes
• Working days: ${this.context.preferences.workingHours.days.join(', ')}
• Preferred locations: ${this.context.preferences.preferredLocations?.join(', ') || 'None specified'}
• Food preferences: ${this.context.preferences.foodPreferences?.join(', ') || 'None specified'}
• Known contacts: ${this.context.contacts.length} contacts in database
• Current location: ${this.context.environmental.location?.city || 'Unknown'}, ${this.context.environmental.location?.country || 'Unknown'}`;
  }

  private async storeProcessingResult(
    email: EmailContext,
    sessionId: string,
    result: {
      text: string;
      steps: Array<{
        toolCalls?: Array<{ toolName: string }>;
      }>;
    }
  ): Promise<void> {
    try {
      await adminDb
        .collection('users')
        .doc(this.userEmail)
        .collection('email_processing_results')
        .doc(email.id)
        .set({
          email_id: email.id,
          session_id: sessionId,
          subject: email.subject,
          from: email.from,
          processed_at: new Date().toISOString(),
          ai_response: result.text,
          steps_taken: result.steps.length,
          tools_used: result.steps
            .map((step) => step.toolCalls?.map((call) => call.toolName) || [])
            .flat(),
          processing_status: 'completed',
        });
    } catch (error) {
      console.error('Error storing processing result:', error);
    }
  }

  /**
   * Process email with pre-analyzed data from Email Analyst
   */
  async processEmailWithAnalysis(
    email: EmailContext,
    analysisResult: EmailAnalysisResult
  ): Promise<void> {
    console.log('Processing email with analysis - ', email.subject);

    // Generate a unique session ID for this interaction
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create context string for the AI
    const contextString = this.buildContextString();

    // Format the analysis result for the AI
    const analysisString = `
Email Analysis Results:
- Initiator: ${analysisResult.initiator.name} (${analysisResult.initiator.email})
- Invitees: ${analysisResult.invitees.map((inv) => `${inv.name || 'Unknown'} (${inv.email})`).join(', ')}
- Meeting Intent: ${analysisResult.meeting_intent}
- Requested Timeframe: ${analysisResult.requested_timeframe || 'Not specified'}
- Duration: ${analysisResult.duration_minutes ? `${analysisResult.duration_minutes} minutes` : 'Not specified'}
- Location Hint: ${analysisResult.location_hint || 'Not specified'}
- Other Notes: ${analysisResult.other_notes || 'None'}`;

    try {
      const result = await generateText({
        model: anthropic('claude-3-5-sonnet-20241022'),
        system: STINA_SYSTEM_PROMPT,
        prompt: `
Context about the user:
${contextString}

Email Analysis (pre-processed):
${analysisString}

Original Email:
Subject: ${email.subject}
From: ${email.from}
Body: ${email.body}
Received: ${email.createdAt}

Session ID for tracking: ${sessionId}

The email has been pre-analyzed to extract meeting scheduling information. Use this structured analysis to efficiently process the meeting request according to your workflow. Focus on the extracted details rather than re-analyzing the email content.`,
        maxSteps: 20,
        tools: {
          calendar_check_schedule: tool({
            description: "Check the user's schedule",
            parameters: calendarCheckScheduleSchema,
            execute: async (params) => {
              const result = await this.stinaTools.executeToolCall(
                'calendar_check_schedule',
                params
              );
              return result.data || { error: result.error };
            },
          }),
          venues_find: tool({
            description: 'Find nearby venues',
            parameters: venuesFindSchema,
            execute: async (params) => {
              const result = await this.stinaTools.executeToolCall(
                'venues_find',
                params
              );
              return result.data || { error: result.error };
            },
          }),
          comms_send_email: tool({
            description: 'Send an email response',
            parameters: commsSendEmailSchema,
            execute: async (params) => {
              const result = await this.stinaTools.executeToolCall(
                'comms_send_email',
                params
              );
              return result.data || { error: result.error };
            },
          }),
          backend_update_session: tool({
            description: "Updates the session's status",
            parameters: backendUpdateSessionSchema,
            execute: async (params) => {
              const result = await this.stinaTools.executeToolCall(
                'backend_update_session',
                params
              );
              return result.data || { error: result.error };
            },
          }),
          people_get_person_details: tool({
            description:
              'Retrieve enriched contact information for the person the user wants to meet',
            parameters: peopleGetPersonDetailsSchema,
            execute: async (params) => {
              const result = await this.stinaTools.executeToolCall(
                'people_get_person_details',
                params
              );
              return result.data || { error: result.error };
            },
          }),
        },
      });

      console.log('AI processing result:', result.text);
      console.log('Tools used:', result.steps.length, 'steps');

      // Store the processing result with analysis data
      await this.storeProcessingResultWithAnalysis(
        email,
        sessionId,
        result,
        analysisResult
      );
    } catch (error) {
      console.error('Error in AI processing with analysis:', error);

      // Update session with error status
      await this.stinaTools.executeToolCall('backend_update_session', {
        session_id: sessionId,
        status: 'INITIATING',
        progress: 0,
        note: `Error processing email with analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  private async storeProcessingResultWithAnalysis(
    email: EmailContext,
    sessionId: string,
    result: {
      text: string;
      steps: Array<{
        toolCalls?: Array<{ toolName: string }>;
      }>;
    },
    analysisResult: EmailAnalysisResult
  ): Promise<void> {
    try {
      await adminDb
        .collection('users')
        .doc(this.userEmail)
        .collection('email_processing_results')
        .doc(email.id)
        .set({
          email_id: email.id,
          session_id: sessionId,
          subject: email.subject,
          from: email.from,
          processed_at: new Date().toISOString(),
          ai_response: result.text,
          steps_taken: result.steps.length,
          tools_used: result.steps
            .map((step) => step.toolCalls?.map((call) => call.toolName) || [])
            .flat(),
          processing_status: 'completed',
          analysis_data: analysisResult,
          user_email: this.userEmail,
        });
    } catch (error) {
      console.error('Error storing processing result with analysis:', error);
    }
  }

  async extractMeetingDetails(
    email: EmailContext
  ): Promise<MeetingIntent | null> {
    try {
      const meetingSchema = z.object({
        is_meeting_request: z.boolean(),
        participants: z.array(z.string().email()).optional(),
        duration: z.number().optional(),
        type: z.enum(['in-person', 'virtual', 'hybrid']).optional(),
        preferredTimes: z.array(z.string()).optional(),
        location: z.string().optional(),
        agenda: z.string().optional(),
        urgency: z.enum(['low', 'medium', 'high']).optional(),
      });

      const result = await generateObject({
        model: anthropic('claude-3-5-sonnet-20241022'),
        system:
          'You are an expert at extracting meeting details from emails. Extract structured information about meeting requests.',
        prompt: `
Analyze this email and extract meeting details if this is a meeting request:

Subject: ${email.subject}
From: ${email.from}
Body: ${email.body}

If this is a meeting request, extract the details. If not, set is_meeting_request to false.`,
        schema: meetingSchema,
      });

      const extractedData = result.object as z.infer<typeof meetingSchema>;

      if (!extractedData.is_meeting_request) {
        return null;
      }

      return {
        participants: extractedData.participants || [],
        duration: extractedData.duration || 60,
        type: extractedData.type || this.context.preferences.defaultMeetingType,
        preferredTimes: extractedData.preferredTimes || [],
        location: extractedData.location,
        agenda: extractedData.agenda,
        urgency: extractedData.urgency || 'medium',
      };
    } catch (error) {
      console.error('Error extracting meeting details:', error);
      return null;
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
}
