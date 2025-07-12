import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth-service';
import { adminDb } from '@/config/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface SelectedCalendar {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  enabled: boolean;
  label?: string; // User-defined label like "Work" or "Personal"
}

export async function GET() {
  try {
    const user = await AuthService.getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const selectedCalendarsDoc = await adminDb
      .collection('users')
      .doc(user.email)
      .collection('calendars')
      .doc('selected')
      .get();

    if (!selectedCalendarsDoc.exists) {
      // Return default configuration with primary calendar
      return NextResponse.json({
        calendars: [],
        hasConfiguration: false,
      });
    }

    const data = selectedCalendarsDoc.data();
    return NextResponse.json({
      calendars: data?.calendars || [],
      hasConfiguration: true,
      updatedAt: data?.updatedAt || null,
    });
  } catch (error) {
    console.error('Error fetching selected calendars:', error);
    return NextResponse.json(
      { error: 'Failed to fetch selected calendars' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await AuthService.getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { calendars } = body;

    if (!Array.isArray(calendars)) {
      return NextResponse.json(
        { error: 'Invalid calendars data' },
        { status: 400 }
      );
    }

    // Validate calendar objects
    for (const calendar of calendars) {
      if (!calendar.id || typeof calendar.enabled !== 'boolean') {
        return NextResponse.json(
          { error: 'Invalid calendar object' },
          { status: 400 }
        );
      }
    }

    // Ensure at least one calendar is enabled
    const enabledCalendars = calendars.filter((cal) => cal.enabled);
    if (enabledCalendars.length === 0) {
      return NextResponse.json(
        { error: 'At least one calendar must be enabled' },
        { status: 400 }
      );
    }

    const selectedCalendarsRef = adminDb
      .collection('users')
      .doc(user.email)
      .collection('calendars')
      .doc('selected');

    const selectedCalendarsDoc = await selectedCalendarsRef.get();
    const now = FieldValue.serverTimestamp();

    const calendarData = {
      calendars,
      updatedAt: now,
    };

    if (!selectedCalendarsDoc.exists) {
      await selectedCalendarsRef.set({
        ...calendarData,
        createdAt: now,
        version: 1,
      });
    } else {
      await selectedCalendarsRef.update({
        ...calendarData,
        version: FieldValue.increment(1),
      });
    }

    return NextResponse.json({
      success: true,
      enabledCount: enabledCalendars.length,
    });
  } catch (error) {
    console.error('Error updating selected calendars:', error);
    return NextResponse.json(
      { error: 'Failed to update selected calendars' },
      { status: 500 }
    );
  }
}