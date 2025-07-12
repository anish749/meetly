import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth-service';
import { GoogleCalendarService } from '@/services/google-calendar-service';

export async function GET() {
  try {
    const user = await AuthService.getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const calendarService = new GoogleCalendarService(user.email);
    const calendars = await calendarService.listCalendars();

    // Filter and format calendar data
    const formattedCalendars = calendars.map((calendar) => ({
      id: calendar.id,
      summary: calendar.summary,
      description: calendar.description,
      primary: calendar.primary || false,
      accessRole: calendar.accessRole,
      backgroundColor: calendar.backgroundColor,
      foregroundColor: calendar.foregroundColor,
    }));

    return NextResponse.json({ calendars: formattedCalendars });
  } catch (error) {
    console.error('Error listing calendars:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendars' },
      { status: 500 }
    );
  }
}