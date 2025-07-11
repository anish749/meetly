import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth-service';
import { GoogleCalendarService } from '@/services/google-calendar-service';

export async function GET(request: NextRequest) {
  try {
    const user = await AuthService.getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const calendarId = searchParams.get('calendarId') || 'primary';
    const timeMin = searchParams.get('timeMin');
    const timeMax = searchParams.get('timeMax');
    const maxResults = searchParams.get('maxResults');

    const calendarService = new GoogleCalendarService(user.email);
    const events = await calendarService.listEvents(calendarId, {
      timeMin: timeMin || undefined,
      timeMax: timeMax || undefined,
      maxResults: maxResults ? parseInt(maxResults) : undefined,
    });

    return NextResponse.json({ events });
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
