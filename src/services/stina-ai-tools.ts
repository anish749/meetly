import { z } from 'zod';
import { tool } from 'ai';

// Type definitions for tool parameters
export const PeopleGetPersonDetailsSchema = z.object({
  identifier: z.string().describe('Either an email address or a full name to look up.'),
  strict: z.boolean().default(false).describe('If true, fail when no exact match is found; if false, return the closest match.')
});

export const CommsSendEmailSchema = z.object({
  to: z.array(z.string().email()).describe('Recipient e-mail address(es).'),
  subject: z.string().describe('E-mail subject line.'),
  body: z.string().describe('Plain-text or simple HTML body.'),
  thread_id: z.string().nullable().optional().describe('Existing thread ID if replying.'),
  watch: z.boolean().default(false).describe('If true, backend will watch this thread for replies.')
});

export const VenuesFindSchema = z.object({
  location: z.string().describe('Free-form place name such as \'Elephant & Castle, London\' or \'EC2V 7HH\'.'),
  tags: z.array(z.string()).describe('Purpose keywords, e.g. [\'coffee\'], [\'lunch\'], [\'meeting_room\'].'),
  radius_m: z.number().default(2000).describe('Search radius in metres (max 5000).'),
  limit: z.number().min(1).max(10).default(5).describe('Maximum number of venues to return.')
});

export const CalendarCheckScheduleSchema = z.object({
  start: z.string().describe('ISO-8601 start of the window (user TZ).'),
  end: z.string().describe('ISO-8601 end of the window.'),
  duration_minutes: z.number().min(15).max(240).describe('Desired meeting length in minutes.')
});

export const BackendUpdateSessionSchema = z.object({
  session_id: z.string().describe('Unique UUID for this scheduling session.'),
  status: z.enum(['INITIATING', 'TIME_PROPOSED', 'TIME_CONFIRMED', 'VENUE_PROPOSED', 'CALENDAR_BOOKED', 'COMPLETED']).describe('One of the workflow states.'),
  progress: z.number().min(0).max(100).describe('Progress bar value (0-100).'),
  note: z.string().optional().describe('Optional free-text note for dashboards.')
});

// Tool implementations using Vercel AI SDK
export const peopleGetPersonDetails = tool({
  description: 'Retrieve enriched contact information for the person the user wants to meet. Falls back to public data (e.g. Clearbit) if not already cached',
  parameters: PeopleGetPersonDetailsSchema,
  execute: async ({ identifier, strict }) => {
    // Mock implementation for testing
    console.log(`Looking up person: ${identifier}, strict: ${strict}`);
    
    return {
      success: true,
      data: {
        identifier,
        name: 'John Doe',
        email: identifier.includes('@') ? identifier : 'john.doe@company.com',
        company: 'Acme Corporation',
        role: 'Senior Product Manager',
        bio: 'Experienced product manager with 8+ years in tech industry',
        linkedin: 'https://linkedin.com/in/johndoe',
        timezone: 'America/New_York',
        preferences: {
          meeting_type: 'hybrid',
          preferred_times: ['10:00-12:00', '14:00-16:00'],
          communication_style: 'direct'
        },
        enrichment_source: strict ? 'exact_match' : 'best_guess'
      }
    };
  }
});

export const commsSendEmail = tool({
  description: 'Send a new e-mail or reply in an existing thread on the user\'s behalf',
  parameters: CommsSendEmailSchema,
  execute: async ({ to, subject, body, thread_id, watch }) => {
    // Mock implementation for testing
    console.log(`Sending email to: ${to.join(', ')}, subject: ${subject}`);
    console.log(`Thread ID: ${thread_id}, Watch: ${watch}`);
    
    return {
      success: true,
      data: {
        message_id: `msg_${Date.now()}`,
        thread_id: thread_id || `thread_${Date.now()}`,
        sent_to: to,
        subject,
        body_preview: body.substring(0, 100) + (body.length > 100 ? '...' : ''),
        sent_at: new Date().toISOString(),
        status: 'sent',
        watch_enabled: watch
      }
    };
  }
});

export const venuesFind = tool({
  description: 'Return up to limit venues that match the given tags near the supplied place-name (postcode, neighbourhood, landmark, or city). The backend geocodes the string',
  parameters: VenuesFindSchema,
  execute: async ({ location, tags, radius_m, limit }) => {
    // Mock implementation for testing
    console.log(`Finding venues near: ${location}, tags: ${tags.join(', ')}, radius: ${radius_m}m, limit: ${limit}`);
    
    const mockVenues = [
      {
        id: 'venue_1',
        name: 'The Coffee Hub',
        address: '123 Main Street, ' + location,
        coordinates: { lat: 51.5074, lng: -0.1278 },
        rating: 4.5,
        price_level: 2,
        distance_meters: 150,
        tags: ['coffee', 'wifi', 'quiet'],
        features: ['Free WiFi', 'Power outlets', 'Quiet atmosphere', 'Meeting tables'],
        opening_hours: '07:00-19:00',
        phone: '+44 20 1234 5678',
        website: 'https://coffeehub.example.com'
      },
      {
        id: 'venue_2', 
        name: 'Business Bistro',
        address: '456 Business Ave, ' + location,
        coordinates: { lat: 51.5075, lng: -0.1279 },
        rating: 4.2,
        price_level: 3,
        distance_meters: 280,
        tags: ['lunch', 'meeting_room', 'business'],
        features: ['Private dining rooms', 'Business lunch menu', 'Parking available'],
        opening_hours: '11:00-22:00',
        phone: '+44 20 1234 5679',
        website: 'https://businessbistro.example.com'
      }
    ].filter(venue => 
      tags.some(tag => venue.tags.includes(tag))
    ).slice(0, limit);
    
    return {
      success: true,
      data: {
        location,
        geocoded_location: {
          lat: 51.5074,
          lng: -0.1278,
          formatted_address: location
        },
        search_params: {
          tags,
          radius_meters: radius_m,
          limit
        },
        venues: mockVenues,
        total_found: mockVenues.length,
        recommendations: mockVenues.length > 0 ? [
          `Found ${mockVenues.length} venues matching your criteria`,
          `Top recommendation: ${mockVenues[0].name} (${mockVenues[0].rating}★)`,
          'Consider making reservations in advance for popular venues'
        ] : [
          'No venues found matching your criteria',
          'Try expanding the search radius or adjusting the tags'
        ]
      }
    };
  }
});

export const calendarCheckSchedule = tool({
  description: 'Check the user\'s schedule',
  parameters: CalendarCheckScheduleSchema,
  execute: async ({ start, end, duration_minutes }) => {
    // Mock implementation for testing
    console.log(`Checking schedule from ${start} to ${end} for ${duration_minutes} minute slots`);
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    const durationMs = duration_minutes * 60 * 1000;
    
    // Generate mock available slots
    const availableSlots = [];
    const hourMs = 60 * 60 * 1000;
    
    for (let currentTime = startDate.getTime(); currentTime + durationMs <= endDate.getTime(); currentTime += hourMs) {
      const currentSlot = new Date(currentTime);
      
      // Mock logic: assume 9-5 working hours with some random busy slots
      const hour = currentSlot.getHours();
      const dayOfWeek = currentSlot.getDay();
      
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 9 && hour <= 17) {
        // Randomly skip some slots to simulate busy times
        if (Math.random() > 0.3) {
          availableSlots.push({
            start: currentSlot.toISOString(),
            end: new Date(currentTime + durationMs).toISOString(),
            confidence: Math.random() > 0.5 ? 'high' : 'medium',
            notes: Math.random() > 0.7 ? 'Buffer time available' : null
          });
        }
      }
    }
    
    return {
      success: true,
      data: {
        query: {
          start,
          end,
          duration_minutes
        },
        available_slots: availableSlots.slice(0, 10), // Limit to 10 slots
        busy_periods: [
          {
            start: new Date(startDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
            end: new Date(startDate.getTime() + 3 * 60 * 60 * 1000).toISOString(),
            title: 'Team Standup',
            type: 'meeting'
          }
        ],
        recommendations: [
          availableSlots.length > 0 ? `Found ${availableSlots.length} available slots` : 'No available slots found',
          'Consider scheduling during mid-morning or early afternoon for best availability',
          'Add buffer time between meetings for preparation'
        ],
        timezone: 'UTC'
      }
    };
  }
});

export const backendUpdateSession = tool({
  description: 'Updates the session\'s status',
  parameters: BackendUpdateSessionSchema,
  execute: async ({ session_id, status, progress, note }) => {
    // Mock implementation for testing
    console.log(`Updating session ${session_id}: ${status} (${progress}%)`);
    if (note) console.log(`Note: ${note}`);
    
    return {
      success: true,
      data: {
        session_id,
        previous_status: 'INITIATING',
        new_status: status,
        progress,
        note,
        updated_at: new Date().toISOString(),
        next_steps: status === 'COMPLETED' ? [] : [
          'Continue with next phase of scheduling workflow',
          'Monitor for user responses and confirmations'
        ]
      }
    };
  }
});

// Export all tools as a collection
export const stinaAiTools = {
  people_get_person_details: peopleGetPersonDetails,
  comms_send_email: commsSendEmail,
  venues_find: venuesFind,
  calendar_check_schedule: calendarCheckSchedule,
  backend_update_session: backendUpdateSession
};

// Export type definitions for use in other files
export type PeopleGetPersonDetailsParams = z.infer<typeof PeopleGetPersonDetailsSchema>;
export type CommsSendEmailParams = z.infer<typeof CommsSendEmailSchema>;
export type VenuesFindParams = z.infer<typeof VenuesFindSchema>;
export type CalendarCheckScheduleParams = z.infer<typeof CalendarCheckScheduleSchema>;
export type BackendUpdateSessionParams = z.infer<typeof BackendUpdateSessionSchema>;