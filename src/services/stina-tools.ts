import { GoogleCalendarService } from './google-calendar-service';
import { adminDb } from '@/config/firebase-admin';
import { ContactInfo } from './stina-agent';

export interface ToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

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
        case 'check_calendar_availability':
          return await this.checkCalendarAvailability(
            parameters as {
              startDate: string;
              endDate: string;
              participants?: string[];
            }
          );
        case 'get_weather_info':
          return await this.getWeatherInfo(
            parameters as {
              location: string;
            }
          );
        case 'find_nearby_venues':
          return await this.findNearbyVenues(
            parameters as {
              location: string;
              type: 'cafe' | 'restaurant' | 'meeting_room' | 'coworking';
              radius?: number;
            }
          );
        case 'get_contact_preferences':
          return await this.getContactPreferences(
            parameters as {
              email: string;
            }
          );
        case 'update_contact_preferences':
          return await this.updateContactPreferences(
            parameters as {
              email: string;
              preferences: Record<string, unknown>;
            }
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

  private async checkCalendarAvailability(parameters: {
    startDate: string;
    endDate: string;
    participants?: string[];
  }): Promise<ToolCallResult> {
    try {
      const calendarService = new GoogleCalendarService(this.userEmail);

      // Get user's free/busy information
      const freeBusy = await calendarService.getFreeBusy(
        parameters.startDate,
        parameters.endDate
      );

      // Get user's events for context
      const events = await calendarService.listEvents('primary', {
        timeMin: parameters.startDate,
        timeMax: parameters.endDate,
      });

      return {
        success: true,
        data: {
          freeBusy,
          events: events.map((event) => ({
            id: event.id,
            summary: event.summary,
            start: event.start,
            end: event.end,
            attendees: event.attendees?.map((a) => a.email) || [],
          })),
          analysis: this.analyzeAvailability(freeBusy, events),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Calendar check failed',
      };
    }
  }

  private analyzeAvailability(
    freeBusy: unknown,
    events: unknown[]
  ): {
    totalBusyTime: number;
    recommendedTimes: string[];
    schedulingTips: string[];
  } {
    // Analyze patterns in the user's schedule
    const workingHours = { start: 9, end: 17 }; // Default 9-5
    const freeBusyData = freeBusy as { primary?: { busy?: unknown[] } };
    const busySlots = freeBusyData.primary?.busy || [];

    return {
      totalBusyTime: busySlots.length,
      recommendedTimes: this.suggestMeetingTimes(busySlots, workingHours),
      schedulingTips: this.generateSchedulingTips(events),
    };
  }

  private suggestMeetingTimes(
    busySlots: unknown[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _workingHours: { start: number; end: number }
  ): string[] {
    // Simple algorithm to suggest meeting times
    const suggestions = [];

    // Morning slots
    if (busySlots.length === 0 || !this.hasConflict(busySlots, 10, 11)) {
      suggestions.push('10:00 AM - Good for focused meetings');
    }

    // Afternoon slots
    if (!this.hasConflict(busySlots, 14, 15)) {
      suggestions.push('2:00 PM - Post-lunch energy');
    }

    // Late afternoon
    if (!this.hasConflict(busySlots, 16, 17)) {
      suggestions.push('4:00 PM - End of day wrap-up');
    }

    return suggestions;
  }

  private hasConflict(
    busySlots: unknown[],
    startHour: number,
    endHour: number
  ): boolean {
    // Simplified conflict detection
    return busySlots.some((slot: unknown) => {
      const slotData = slot as { start?: string; end?: string };
      if (!slotData.start || !slotData.end) return false;
      const slotStart = new Date(slotData.start).getHours();
      const slotEnd = new Date(slotData.end).getHours();
      return slotStart < endHour && slotEnd > startHour;
    });
  }

  private generateSchedulingTips(events: unknown[]): string[] {
    const tips = [];

    if (events.length > 5) {
      tips.push(
        'Your schedule is quite busy. Consider shorter meetings or combining related topics.'
      );
    }

    const hasEarlyMeetings = events.some((event) => {
      const eventObj = event as {
        start?: { dateTime?: string; date?: string };
      };
      const hour = new Date(
        eventObj.start?.dateTime || eventObj.start?.date || ''
      ).getHours();
      return hour < 9;
    });

    if (hasEarlyMeetings) {
      tips.push(
        'You have early meetings scheduled. Consider maintaining consistent wake times.'
      );
    }

    return tips;
  }

  private async getWeatherInfo(parameters: {
    location: string;
  }): Promise<ToolCallResult> {
    try {
      // In a real implementation, this would call a weather API
      // For demo purposes, we'll return mock data
      const weatherData = {
        location: parameters.location,
        current: {
          temperature: '22°C',
          condition: 'Partly cloudy',
          humidity: '65%',
          wind: '10 km/h',
        },
        forecast: {
          today: 'Partly cloudy, high of 24°C',
          tomorrow: 'Sunny, high of 26°C',
        },
        recommendation: this.getWeatherRecommendation('Partly cloudy'),
      };

      return {
        success: true,
        data: weatherData,
      };
    } catch {
      return {
        success: false,
        error: 'Weather service unavailable',
      };
    }
  }

  private getWeatherRecommendation(condition: string): string {
    const recommendations: Record<string, string> = {
      'Partly cloudy': 'Good weather for outdoor meetings or walking meetings.',
      Sunny: 'Perfect for outdoor venues or meetings with outdoor seating.',
      Rainy:
        'Recommend indoor venues. Consider virtual meetings if travel is involved.',
      Stormy: 'Strong recommendation for virtual meetings or postponement.',
    };

    return (
      recommendations[condition] ||
      'Check weather conditions for meeting planning.'
    );
  }

  private async findNearbyVenues(parameters: {
    location: string;
    type: 'cafe' | 'restaurant' | 'meeting_room' | 'coworking';
    radius?: number;
  }): Promise<ToolCallResult> {
    try {
      // In a real implementation, this would integrate with Google Places API or similar
      // For demo purposes, we'll return mock data
      const venues = this.getMockVenues(parameters.type, parameters.location);

      return {
        success: true,
        data: {
          location: parameters.location,
          type: parameters.type,
          venues,
          recommendations: this.generateVenueRecommendations(
            venues,
            parameters.type
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

  private getMockVenues(
    type: string,
    location: string
  ): Array<{
    name: string;
    address: string;
    rating: number;
    distance: string;
    features: string[];
  }> {
    const venueMap: Record<
      string,
      Array<{
        name: string;
        address: string;
        rating: number;
        distance: string;
        features: string[];
      }>
    > = {
      cafe: [
        {
          name: 'The Coffee Corner',
          address: '123 Main St, ' + location,
          rating: 4.5,
          distance: '0.2 km',
          features: ['WiFi', 'Quiet area', 'Power outlets', 'Good coffee'],
        },
        {
          name: 'Brew & Meet',
          address: '456 Business Ave, ' + location,
          rating: 4.2,
          distance: '0.5 km',
          features: ['Meeting tables', 'WiFi', 'Noise level: Low', 'Parking'],
        },
      ],
      restaurant: [
        {
          name: 'Business Lunch Bistro',
          address: '789 Corporate Blvd, ' + location,
          rating: 4.3,
          distance: '0.3 km',
          features: [
            'Private dining',
            'Business-friendly',
            'Parking',
            'Quick service',
          ],
        },
      ],
      meeting_room: [
        {
          name: 'Downtown Conference Center',
          address: '101 Meeting St, ' + location,
          rating: 4.7,
          distance: '0.4 km',
          features: ['AV equipment', 'Catering', 'Parking', 'Flexible setup'],
        },
      ],
      coworking: [
        {
          name: 'Shared Workspace Hub',
          address: '202 Innovation Dr, ' + location,
          rating: 4.6,
          distance: '0.6 km',
          features: ['Day passes', 'Meeting rooms', 'WiFi', 'Coffee bar'],
        },
      ],
    };

    return venueMap[type] || [];
  }

  private generateVenueRecommendations(
    venues: Array<{
      name: string;
      address: string;
      rating: number;
      distance: string;
      features: string[];
    }>,
    type: string
  ): string[] {
    const recommendations = [];

    if (venues.length === 0) {
      recommendations.push(
        `No ${type} venues found. Consider virtual meeting or different location.`
      );
      return recommendations;
    }

    const topVenue = venues.sort((a, b) => b.rating - a.rating)[0];
    recommendations.push(
      `Top recommended: ${topVenue.name} (${topVenue.rating}★)`
    );

    if (type === 'cafe') {
      recommendations.push(
        'For coffee meetings, arrive early to secure a quiet table.'
      );
      recommendations.push('Consider noise levels for important discussions.');
    } else if (type === 'restaurant') {
      recommendations.push('Make reservations in advance for business meals.');
      recommendations.push('Choose venues with separate billing options.');
    }

    return recommendations;
  }

  private async getContactPreferences(parameters: {
    email: string;
  }): Promise<ToolCallResult> {
    try {
      const contactDoc = await adminDb
        .collection('users')
        .doc(this.userEmail)
        .collection('contacts')
        .doc(parameters.email)
        .get();

      if (!contactDoc.exists) {
        return {
          success: true,
          data: {
            email: parameters.email,
            preferences: {},
            history: [],
            recommendations: ['No previous interaction history found.'],
          },
        };
      }

      const contactData = contactDoc.data() as ContactInfo;

      return {
        success: true,
        data: {
          ...contactData,
          recommendations: this.generateContactRecommendations(contactData),
        },
      };
    } catch {
      return {
        success: false,
        error: 'Failed to retrieve contact preferences',
      };
    }
  }

  private generateContactRecommendations(contact: ContactInfo): string[] {
    const recommendations = [];

    if (contact.preferences?.meetingType) {
      recommendations.push(
        `Preferred meeting type: ${contact.preferences.meetingType}`
      );
    }

    if (contact.preferences?.workingHours) {
      const { start, end } = contact.preferences.workingHours;
      recommendations.push(`Working hours: ${start} - ${end}`);
    }

    if (contact.pastMeetings && contact.pastMeetings.length > 0) {
      const recentMeeting = contact.pastMeetings[0];
      recommendations.push(
        `Last meeting: ${recentMeeting.type} on ${recentMeeting.date}`
      );

      if (recentMeeting.location) {
        recommendations.push(`Previous location: ${recentMeeting.location}`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push(
        'No specific preferences recorded. Consider asking for preferences.'
      );
    }

    return recommendations;
  }

  private async updateContactPreferences(parameters: {
    email: string;
    preferences: Record<string, unknown>;
  }): Promise<ToolCallResult> {
    try {
      await adminDb
        .collection('users')
        .doc(this.userEmail)
        .collection('contacts')
        .doc(parameters.email)
        .set(
          {
            email: parameters.email,
            preferences: parameters.preferences,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

      return {
        success: true,
        data: {
          message: 'Contact preferences updated successfully',
          email: parameters.email,
          preferences: parameters.preferences,
        },
      };
    } catch {
      return {
        success: false,
        error: 'Failed to update contact preferences',
      };
    }
  }
}
