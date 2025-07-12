import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth-service';
import { GoogleCalendarService } from '@/services/google-calendar-service';
import { adminDb } from '@/config/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const user = await AuthService.getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const specificCalendarId = searchParams.get('calendarId');
    const timeMin = searchParams.get('timeMin');
    const timeMax = searchParams.get('timeMax');
    const maxResults = searchParams.get('maxResults');

    const calendarService = new GoogleCalendarService(user.email);

    // If a specific calendar is requested, use the original behavior
    if (specificCalendarId) {
      const events = await calendarService.listEvents(specificCalendarId, {
        timeMin: timeMin || undefined,
        timeMax: timeMax || undefined,
        maxResults: maxResults ? parseInt(maxResults) : undefined,
      });

      return NextResponse.json({ events });
    }

    // Otherwise, fetch from all selected calendars
    let calendarIds = ['primary']; // Default fallback

    try {
      const selectedCalendarsDoc = await adminDb
        .collection('users')
        .doc(user.email)
        .collection('calendars')
        .doc('selected')
        .get();

      if (selectedCalendarsDoc.exists) {
        const data = selectedCalendarsDoc.data();
        const selectedCalendars = data?.calendars || [];
        const enabledCalendars = selectedCalendars.filter((cal: any) => cal.enabled);
        
        if (enabledCalendars.length > 0) {
          calendarIds = enabledCalendars.map((cal: any) => cal.id);
        }
      }
    } catch (error) {
      console.warn('Error fetching selected calendars, using primary:', error);
    }

    // Fetch events from all selected calendars
    const allEvents = [];
    const maxPerCalendar = maxResults ? Math.ceil(parseInt(maxResults) / calendarIds.length) : 50;

    for (const calendarId of calendarIds) {
      try {
        const events = await calendarService.listEvents(calendarId, {
          timeMin: timeMin || undefined,
          timeMax: timeMax || undefined,
          maxResults: maxPerCalendar,
        });

        // Add calendar info to each event
        const eventsWithCalendar = events.map((event: any) => ({
          ...event,
          calendarId,
        }));

        allEvents.push(...eventsWithCalendar);
      } catch (error) {
        console.warn(`Error fetching events from calendar ${calendarId}:`, error);
        // Continue with other calendars
      }
    }

    // Sort events by start time
    allEvents.sort((a, b) => {
      const aStart = a.start?.dateTime || a.start?.date || '';
      const bStart = b.start?.dateTime || b.start?.date || '';
      return new Date(aStart).getTime() - new Date(bStart).getTime();
    });

    // Apply global maxResults limit
    const limitedEvents = maxResults ? allEvents.slice(0, parseInt(maxResults)) : allEvents;

    return NextResponse.json({ 
      events: limitedEvents,
      calendarsUsed: calendarIds.length,
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await AuthService.getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { event, calendarId = 'primary' } = body;

    const calendarService = new GoogleCalendarService(user.email);
    const createdEvent = await calendarService.createEvent(event, calendarId);

    return NextResponse.json({ event: createdEvent });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}
