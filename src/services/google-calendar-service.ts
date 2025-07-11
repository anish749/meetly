import { google, calendar_v3 } from 'googleapis';
import { createOAuth2Client } from '@/config/google-oauth';
import { AuthService } from './auth-service';

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  location?: string;
  conferenceData?: calendar_v3.Schema$ConferenceData;
}

export class GoogleCalendarService {
  private calendar: calendar_v3.Calendar;
  private userEmail: string;

  constructor(userEmail: string) {
    this.userEmail = userEmail;
    this.calendar = google.calendar({ version: 'v3' });
  }

  private async getAuthenticatedClient() {
    const accessToken = await AuthService.getValidAccessToken(this.userEmail);

    if (!accessToken) {
      throw new Error('Unable to get valid access token');
    }

    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: accessToken,
    });

    return oauth2Client;
  }

  async listCalendars() {
    try {
      const auth = await this.getAuthenticatedClient();
      const response = await this.calendar.calendarList.list({
        auth,
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Error listing calendars:', error);
      throw error;
    }
  }

  async listEvents(
    calendarId: string = 'primary',
    options?: {
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
      orderBy?: 'startTime' | 'updated';
    }
  ) {
    try {
      const auth = await this.getAuthenticatedClient();
      const response = await this.calendar.events.list({
        auth,
        calendarId,
        timeMin: options?.timeMin || new Date().toISOString(),
        timeMax: options?.timeMax,
        maxResults: options?.maxResults || 50,
        singleEvents: true,
        orderBy: options?.orderBy || 'startTime',
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Error listing events:', error);
      throw error;
    }
  }

  async getEvent(eventId: string, calendarId: string = 'primary') {
    try {
      const auth = await this.getAuthenticatedClient();
      const response = await this.calendar.events.get({
        auth,
        calendarId,
        eventId,
      });

      return response.data;
    } catch (error) {
      console.error('Error getting event:', error);
      throw error;
    }
  }

  async createEvent(event: CalendarEvent, calendarId: string = 'primary') {
    try {
      const auth = await this.getAuthenticatedClient();
      const response = await this.calendar.events.insert({
        auth,
        calendarId,
        requestBody: event,
      });

      return response.data;
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  }

  async updateEvent(
    eventId: string,
    event: Partial<CalendarEvent>,
    calendarId: string = 'primary'
  ) {
    try {
      const auth = await this.getAuthenticatedClient();
      const response = await this.calendar.events.update({
        auth,
        calendarId,
        eventId,
        requestBody: event as calendar_v3.Schema$Event,
      });

      return response.data;
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  }

  async deleteEvent(eventId: string, calendarId: string = 'primary') {
    try {
      const auth = await this.getAuthenticatedClient();
      await this.calendar.events.delete({
        auth,
        calendarId,
        eventId,
      });

      return true;
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  }

  async getFreeBusy(
    timeMin: string,
    timeMax: string,
    calendars: string[] = ['primary']
  ) {
    try {
      const auth = await this.getAuthenticatedClient();
      const response = await this.calendar.freebusy.query({
        auth,
        requestBody: {
          timeMin,
          timeMax,
          items: calendars.map((id) => ({ id })),
        },
      });

      return response.data.calendars || {};
    } catch (error) {
      console.error('Error getting free/busy info:', error);
      throw error;
    }
  }
}
