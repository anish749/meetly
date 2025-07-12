import Anthropic from '@anthropic-ai/sdk';
import { GoogleCalendarService } from './google-calendar-service';
import { AuthService } from './auth-service';
import { adminDb } from '@/config/firebase-admin';
import { StinaTools } from './stina-tools';

export interface StinaTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
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
  private anthropic: Anthropic;
  private userEmail: string;
  private context: StinaContext;

  constructor(userEmail: string) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
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
    for (const email of emails) {
      try {
        await this.processEmail(email);
      } catch (error) {
        console.error(`Error processing email ${email.id}:`, error);
      }
    }
  }

  private async processEmail(email: EmailContext): Promise<void> {
    const meetingIntent = await this.analyzeMeetingIntent(email);

    if (meetingIntent) {
      await this.handleMeetingRequest(email, meetingIntent);
    }
  }

  private async analyzeMeetingIntent(
    email: EmailContext
  ): Promise<MeetingIntent | null> {
    const tools = this.getTools();
    const stinaTools = new StinaTools(this.userEmail);

    let messages: Anthropic.Messages.MessageParam[] = [
      {
        role: 'user',
        content: `
          Analyze this email to determine if it's a meeting request and extract meeting details:
          
          Subject: ${email.subject}
          From: ${email.from}
          Body: ${email.body}
          
          Context about the user:
          - Working hours: ${this.context.preferences.workingHours.start} - ${this.context.preferences.workingHours.end}
          - Time zone: ${this.context.preferences.timeZone}
          - Default meeting type: ${this.context.preferences.defaultMeetingType}
          
          If this is a meeting request:
          1. Use tools to check calendar availability and get contact preferences
          2. Extract meeting details (type, participants, duration, preferred times, location, agenda, urgency)
          3. Return structured meeting intent
          
          If this is not a meeting request, simply respond with "NOT_MEETING_REQUEST".
        `,
      },
    ];

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        tools,
        messages,
      });

      // Handle tool use in the response
      for (const content of response.content) {
        if (content.type === 'tool_use') {
          const toolResult = await stinaTools.executeToolCall(
            content.name,
            content.input as Record<string, unknown>
          );

          messages.push({
            role: 'assistant',
            content: [content],
          });

          messages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: content.id,
                content: JSON.stringify(toolResult),
              },
            ],
          });
        }
      }

      // If tools were used, get the final response
      if (messages.length > 1) {
        const finalResponse = await this.anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: messages.concat([
            {
              role: 'user',
              content:
                'Based on the tool results, provide the final meeting intent as JSON or "NOT_MEETING_REQUEST".',
            },
          ]),
        });

        const finalContent = finalResponse.content[0];
        if (finalContent.type === 'text') {
          return this.parseMeetingIntent(finalContent.text);
        }
      } else {
        // No tools were used, parse the direct response
        const directContent = response.content[0];
        if (directContent.type === 'text') {
          return this.parseMeetingIntent(directContent.text);
        }
      }
    } catch (error) {
      console.error('Error analyzing meeting intent:', error);
    }

    return null;
  }

  private parseMeetingIntent(responseText: string): MeetingIntent | null {
    if (responseText.includes('NOT_MEETING_REQUEST')) {
      return null;
    }

    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const intent = JSON.parse(jsonMatch[0]);

        // Validate required fields
        if (intent.participants && intent.duration && intent.type) {
          return intent as MeetingIntent;
        }
      }
    } catch (error) {
      console.error('Error parsing meeting intent JSON:', error);
    }

    return null;
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
    participants: string[],
    preferredTimes: string[],
    duration: number
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
    // AI-powered slot finding based on availability and preferences
    const tools = this.getTools();

    const message = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      tools,
      messages: [
        {
          role: 'user',
          content: `
            Find the best meeting slot based on:
            
            Meeting Requirements:
            - Duration: ${intent.duration} minutes
            - Type: ${intent.type}
            - Participants: ${intent.participants.join(', ')}
            - Preferred times: ${intent.preferredTimes.join(', ')}
            
            User Preferences:
            - Working hours: ${this.context.preferences.workingHours.start} - ${this.context.preferences.workingHours.end}
            - Meeting buffer: ${this.context.preferences.meetingBuffer} minutes
            
            Availability: ${JSON.stringify(availability)}
            
            Return the best meeting slot with date, time, and justification.
          `,
        },
      ],
    });

    // Parse response and return best slot
    return null; // Simplified for now
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
              emailHistory: adminDb.FieldValue.arrayUnion({
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

  private getTools(): StinaTool[] {
    return [
      {
        name: 'check_calendar_availability',
        description: 'Check calendar availability for scheduling meetings',
        input_schema: {
          type: 'object',
          properties: {
            startDate: {
              type: 'string',
              description: 'Start date in ISO format',
            },
            endDate: { type: 'string', description: 'End date in ISO format' },
            participants: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of participant email addresses',
            },
          },
          required: ['startDate', 'endDate'],
        },
      },
      {
        name: 'get_weather_info',
        description:
          'Get current weather information for location-based meeting planning',
        input_schema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'Location to get weather for',
            },
          },
          required: ['location'],
        },
      },
      {
        name: 'find_nearby_venues',
        description:
          'Find cafes, restaurants, or meeting venues near a location',
        input_schema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'Location to search near',
            },
            type: {
              type: 'string',
              enum: ['cafe', 'restaurant', 'meeting_room', 'coworking'],
              description: 'Type of venue to find',
            },
            radius: {
              type: 'number',
              description: 'Search radius in kilometers',
            },
          },
          required: ['location', 'type'],
        },
      },
      {
        name: 'get_contact_preferences',
        description: 'Get stored preferences and context for a contact',
        input_schema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: 'Contact email address' },
          },
          required: ['email'],
        },
      },
      {
        name: 'update_contact_preferences',
        description: 'Update stored preferences for a contact',
        input_schema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: 'Contact email address' },
            preferences: {
              type: 'object',
              description: 'Preferences to update',
            },
          },
          required: ['email', 'preferences'],
        },
      },
    ];
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
