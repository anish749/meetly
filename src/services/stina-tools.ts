import { GoogleCalendarService } from './google-calendar-service';
import { adminDb } from '@/config/firebase-admin';
import { ContactInfo } from './stina-agent';
import { z } from 'zod';

export interface ToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Vercel AI SDK compatible tool definitions with Zod schemas
export const calendarCheckScheduleSchema = z.object({
  start: z.string().describe('ISO-8601 start of the window (user TZ).'),
  end: z.string().describe('ISO-8601 end of the window.'),
  duration_minutes: z.number().min(15).max(240).describe('Desired meeting length in minutes.')
});

export const venuesFindSchema = z.object({
  location: z.string().describe('Free-form place name such as \'Elephant & Castle, London\' or \'EC2V 7HH\'.'),
  tags: z.array(z.string()).describe('Purpose keywords, e.g. [\'coffee\'], [\'lunch\'], [\'meeting_room\'].'),
  radius_m: z.number().default(2000).describe('Search radius in metres (max 5000).'),
  limit: z.number().min(1).max(10).default(5).describe('Maximum number of venues to return.')
});

export const commsSendEmailSchema = z.object({
  to: z.array(z.string().email()).describe('Recipient e-mail address(es).'),
  subject: z.string().describe('E-mail subject line.'),
  body: z.string().describe('Plain-text or simple HTML body.'),
  thread_id: z.string().nullable().optional().describe('Existing thread ID if replying.'),
  watch: z.boolean().default(false).describe('If true, backend will watch this thread for replies.')
});

export const backendUpdateSessionSchema = z.object({
  session_id: z.string().describe('Unique UUID for this scheduling session.'),
  status: z.enum(['INITIATING', 'TIME_PROPOSED', 'TIME_CONFIRMED', 'VENUE_PROPOSED', 'CALENDAR_BOOKED', 'COMPLETED']).describe('One of the workflow states.'),
  progress: z.number().min(0).max(100).describe('Progress bar value (0-100).'),
  note: z.string().optional().describe('Optional free-text note for dashboards.')
});

export const peopleGetPersonDetailsSchema = z.object({
  identifier: z.string().describe('Either an email address or a full name to look up.'),
  strict: z.boolean().default(false).describe('If true, fail when no exact match is found; if false, return the closest match.')
});

export class StinaTools {
  private userEmail: string;

  constructor(userEmail: string) {
    this.userEmail = userEmail;
  }

  async executeToolCall(
    toolName: string,
    parameters: Record<string, unknown>
  ): Promise<ToolCallResult> {
    try {
      switch (toolName) {
        case 'calendar_check_schedule':
          return await this.calendarCheckSchedule(
            parameters as z.infer<typeof calendarCheckScheduleSchema>
          );
        case 'venues_find':
          return await this.venuesFind(
            parameters as z.infer<typeof venuesFindSchema>
          );
        case 'comms_send_email':
          return await this.commsSendEmail(
            parameters as z.infer<typeof commsSendEmailSchema>
          );
        case 'backend_update_session':
          return await this.backendUpdateSession(
            parameters as z.infer<typeof backendUpdateSessionSchema>
          );
        case 'people_get_person_details':
          return await this.peopleGetPersonDetails(
            parameters as z.infer<typeof peopleGetPersonDetailsSchema>
          );
        default:
          return {
            success: false,
            error: `Unknown tool: ${toolName}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async calendarCheckSchedule(parameters: z.infer<typeof calendarCheckScheduleSchema>): Promise<ToolCallResult> {
    try {
      const calendarService = new GoogleCalendarService(this.userEmail);

      // Get user's free/busy information
      const freeBusy = await calendarService.getFreeBusy(
        parameters.start,
        parameters.end
      );

      // Get user's events for context
      const events = await calendarService.listEvents('primary', {
        timeMin: parameters.start,
        timeMax: parameters.end,
      });

      // Find available slots for the requested duration
      const availableSlots = this.findAvailableSlots(freeBusy, events, parameters.duration_minutes, parameters.start, parameters.end);

      return {
        success: true,
        data: {
          available_slots: availableSlots,
          busy_periods: freeBusy,
          existing_events: events.map((event) => ({
            id: event.id,
            summary: event.summary,
            start: event.start,
            end: event.end,
            attendees: event.attendees?.map((a) => a.email) || [],
          })),
          recommendations: this.generateSchedulingRecommendations(availableSlots, parameters.duration_minutes),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Calendar check failed',
      };
    }
  }


  private async venuesFind(parameters: z.infer<typeof venuesFindSchema>): Promise<ToolCallResult> {
    try {
      // In a real implementation, this would integrate with Google Places API or similar
      // For demo purposes, we'll return mock data
      const venues = this.getMockVenues(parameters.tags, parameters.location, parameters.limit);

      return {
        success: true,
        data: {
          location: parameters.location,
          tags: parameters.tags,
          radius_m: parameters.radius_m,
          venues: venues.slice(0, parameters.limit),
          recommendations: this.generateVenueRecommendations(
            venues,
            parameters.tags
          ),
        },
      };
    } catch {
      return {
        success: false,
        error: 'Venue search service unavailable',
      };
    }
  }

  private async commsSendEmail(parameters: z.infer<typeof commsSendEmailSchema>): Promise<ToolCallResult> {
    try {
      // Mock implementation - in real app would integrate with email service
      const emailData = {
        id: `email_${Date.now()}`,
        to: parameters.to,
        subject: parameters.subject,
        body: parameters.body,
        thread_id: parameters.thread_id,
        timestamp: new Date().toISOString(),
        status: 'sent',
        watch: parameters.watch
      };

      // Store in database for tracking
      if (parameters.watch) {
        await adminDb
          .collection('users')
          .doc(this.userEmail)
          .collection('email_threads')
          .doc(emailData.id)
          .set({
            ...emailData,
            watching: true,
            user_email: this.userEmail
          });
      }

      return {
        success: true,
        data: {
          email_id: emailData.id,
          status: 'sent',
          recipients: parameters.to,
          subject: parameters.subject,
          watching: parameters.watch,
          message: 'Email sent successfully. Recipient will receive scheduling proposal.'
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Email send failed',
      };
    }
  }

  private async backendUpdateSession(parameters: z.infer<typeof backendUpdateSessionSchema>): Promise<ToolCallResult> {
    try {
      const sessionData = {
        session_id: parameters.session_id,
        status: parameters.status,
        progress: parameters.progress,
        note: parameters.note,
        updated_at: new Date().toISOString(),
        user_email: this.userEmail
      };

      // Store session state in database
      await adminDb
        .collection('users')
        .doc(this.userEmail)
        .collection('stina_sessions')
        .doc(parameters.session_id)
        .set(sessionData, { merge: true });

      return {
        success: true,
        data: {
          session_id: parameters.session_id,
          status: parameters.status,
          progress: parameters.progress,
          note: parameters.note,
          message: `Session updated to ${parameters.status} (${parameters.progress}%)`
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Session update failed',
      };
    }
  }

  private findAvailableSlots(
    freeBusy: unknown,
    events: unknown[],
    durationMinutes: number,
    start: string,
    end: string
  ): Array<{ start: string; end: string; confidence: string }> {
    // Mock implementation - simplified slot finding
    const startDate = new Date(start);
    const endDate = new Date(end);
    const slots = [];
    
    // Generate some mock available slots
    const currentDate = new Date(startDate);
    while (currentDate < endDate && slots.length < 5) {
      // Skip weekends for business meetings
      if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        // Morning slot (10:00 AM)
        const morningSlot = new Date(currentDate);
        morningSlot.setHours(10, 0, 0, 0);
        const morningEnd = new Date(morningSlot);
        morningEnd.setMinutes(morningEnd.getMinutes() + durationMinutes);
        
        slots.push({
          start: morningSlot.toISOString(),
          end: morningEnd.toISOString(),
          confidence: 'high'
        });
        
        // Afternoon slot (2:00 PM)
        const afternoonSlot = new Date(currentDate);
        afternoonSlot.setHours(14, 0, 0, 0);
        const afternoonEnd = new Date(afternoonSlot);
        afternoonEnd.setMinutes(afternoonEnd.getMinutes() + durationMinutes);
        
        slots.push({
          start: afternoonSlot.toISOString(),
          end: afternoonEnd.toISOString(),
          confidence: 'medium'
        });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return slots.slice(0, 3); // Return top 3 slots
  }

  private generateSchedulingRecommendations(
    availableSlots: Array<{ start: string; end: string; confidence: string }>,
    durationMinutes: number
  ): string[] {
    const recommendations = [];
    
    if (availableSlots.length === 0) {
      recommendations.push('No available slots found in the requested timeframe.');
      recommendations.push('Consider expanding the date range or reducing meeting duration.');
      return recommendations;
    }
    
    recommendations.push(`Found ${availableSlots.length} potential meeting slots for ${durationMinutes} minute duration.`);
    
    const highConfidenceSlots = availableSlots.filter(slot => slot.confidence === 'high');
    if (highConfidenceSlots.length > 0) {
      recommendations.push(`${highConfidenceSlots.length} high-confidence slots available with no conflicts.`);
    }
    
    recommendations.push('Morning slots (10:00 AM) typically have higher focus and energy.');
    recommendations.push('Allow 15-minute buffer between meetings for transitions.');
    
    return recommendations;
  }

  private getMockVenues(
    tags: string[],
    location: string,
    limit: number
  ): Array<{
    name: string;
    address: string;
    rating: number;
    distance_m: number;
    tags: string[];
    features: string[];
  }> {
    // Mock venue data based on tags
    const allVenues = [
      {
        name: 'The Coffee Corner',
        address: '123 Main St, ' + location,
        rating: 4.5,
        distance_m: 200,
        tags: ['coffee', 'casual'],
        features: ['WiFi', 'Quiet area', 'Power outlets', 'Good coffee'],
      },
      {
        name: 'Business Lunch Bistro',
        address: '789 Corporate Blvd, ' + location,
        rating: 4.3,
        distance_m: 300,
        tags: ['lunch', 'restaurant', 'business'],
        features: ['Private dining', 'Business-friendly', 'Parking', 'Quick service'],
      },
      {
        name: 'Downtown Conference Center',
        address: '101 Meeting St, ' + location,
        rating: 4.7,
        distance_m: 400,
        tags: ['meeting_room', 'conference', 'formal'],
        features: ['AV equipment', 'Catering', 'Parking', 'Flexible setup'],
      },
      {
        name: 'Shared Workspace Hub',
        address: '202 Innovation Dr, ' + location,
        rating: 4.6,
        distance_m: 600,
        tags: ['coworking', 'meeting_room', 'casual'],
        features: ['Day passes', 'Meeting rooms', 'WiFi', 'Coffee bar'],
      },
      {
        name: 'Brew & Meet Cafe',
        address: '456 Business Ave, ' + location,
        rating: 4.2,
        distance_m: 500,
        tags: ['coffee', 'meeting_room'],
        features: ['Meeting tables', 'WiFi', 'Noise level: Low', 'Parking'],
      },
    ];

    // Filter venues based on tags
    const filteredVenues = allVenues.filter(venue => 
      tags.some(tag => venue.tags.includes(tag))
    );

    // Sort by rating and distance, return up to limit
    return filteredVenues
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
  }

  private generateVenueRecommendations(
    venues: Array<{
      name: string;
      address: string;
      rating: number;
      distance_m: number;
      tags: string[];
      features: string[];
    }>,
    tags: string[]
  ): string[] {
    const recommendations = [];

    if (venues.length === 0) {
      recommendations.push(
        `No venues found matching tags: ${tags.join(', ')}. Consider virtual meeting or different location.`
      );
      return recommendations;
    }

    const topVenue = venues.sort((a, b) => b.rating - a.rating)[0];
    recommendations.push(
      `Top recommended: ${topVenue.name} (${topVenue.rating}★)`
    );

    if (tags.includes('coffee')) {
      recommendations.push(
        'For coffee meetings, arrive early to secure a quiet table.'
      );
      recommendations.push('Consider noise levels for important discussions.');
    }
    
    if (tags.includes('lunch') || tags.includes('restaurant')) {
      recommendations.push('Make reservations in advance for business meals.');
      recommendations.push('Choose venues with separate billing options.');
    }
    
    if (tags.includes('meeting_room')) {
      recommendations.push('Book meeting rooms in advance for guaranteed availability.');
      recommendations.push('Confirm AV equipment and setup requirements.');
    }

    return recommendations;
  }

  private async peopleGetPersonDetails(parameters: z.infer<typeof peopleGetPersonDetailsSchema>): Promise<ToolCallResult> {
    try {
      // Try to parse as email first, then search by name
      const isEmail = parameters.identifier.includes('@');
      let contactDoc;
      
      if (isEmail) {
        contactDoc = await adminDb
          .collection('users')
          .doc(this.userEmail)
          .collection('contacts')
          .doc(parameters.identifier)
          .get();
      } else {
        // Search by name in contacts collection
        const contactsSnapshot = await adminDb
          .collection('users')
          .doc(this.userEmail)
          .collection('contacts')
          .where('name', '==', parameters.identifier)
          .limit(1)
          .get();
        
        contactDoc = contactsSnapshot.docs[0];
      }

      if (!contactDoc || !contactDoc.exists) {
        if (parameters.strict) {
          return {
            success: false,
            error: `No exact match found for: ${parameters.identifier}`,
          };
        }
        
        // Return mock enriched data for demonstration
        return {
          success: true,
          data: {
            identifier: parameters.identifier,
            email: isEmail ? parameters.identifier : 'unknown@example.com',
            name: isEmail ? 'Unknown Contact' : parameters.identifier,
            title: 'Professional',
            company: 'External Organization',
            timezone: 'Europe/London',
            working_hours: { start: '09:00', end: '17:00' },
            meeting_preferences: ['virtual', 'in-person'],
            last_interaction: null,
            enrichment_source: 'mock_data'
          },
        };
      }

      const contactData = contactDoc.data() as ContactInfo;

      return {
        success: true,
        data: {
          identifier: parameters.identifier,
          email: contactData.email,
          name: contactData.name || 'Unknown',
          title: contactData.role || 'Professional',
          company: contactData.company || 'Unknown Company',
          timezone: contactData.preferences?.timeZone || 'Europe/London',
          working_hours: contactData.preferences?.workingHours || { start: '09:00', end: '17:00' },
          meeting_preferences: [contactData.preferences?.meetingType || 'virtual'],
          last_interaction: contactData.pastMeetings?.[0]?.date || null,
          enrichment_source: 'stored_contact'
        },
      };
    } catch {
      return {
        success: false,
        error: 'Failed to retrieve contact preferences',
      };
    }
  }


}
