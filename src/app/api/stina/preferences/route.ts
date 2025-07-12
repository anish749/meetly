import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth-service';
import { StinaAgent, UserPreferences } from '@/services/stina-agent';
import { adminDb } from '@/config/firebase-admin';

export async function GET() {
  try {
    // Verify user authentication
    const user = await AuthService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user's Stina preferences
    const userDoc = await adminDb.collection('users').doc(user.email).get();
    
    let preferences = {};
    if (userDoc.exists) {
      const userData = userDoc.data();
      preferences = userData?.stinaPreferences || {};
    }

    return NextResponse.json({
      success: true,
      preferences,
    });

  } catch (error) {
    console.error('Error fetching Stina preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify user authentication
    const user = await AuthService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { preferences } = body;

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json(
        { error: 'Valid preferences object required' },
        { status: 400 }
      );
    }

    // Initialize Stina agent and save preferences
    const stinaAgent = new StinaAgent(user.email);
    await stinaAgent.saveUserPreferences(preferences as Partial<UserPreferences>);

    return NextResponse.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences,
    });

  } catch (error) {
    console.error('Error updating Stina preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Verify user authentication
    const user = await AuthService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, data } = body;

    const stinaAgent = new StinaAgent(user.email);
    await stinaAgent.initializeContext();

    switch (action) {
      case 'reset_preferences':
        // Reset to default preferences
        const defaultPrefs = {
          defaultMeetingType: 'virtual' as const,
          workingHours: {
            start: '09:00',
            end: '17:00',
            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          },
          timeZone: 'UTC',
          meetingBuffer: 15,
        };
        
        await stinaAgent.saveUserPreferences(defaultPrefs);
        
        return NextResponse.json({
          success: true,
          message: 'Preferences reset to defaults',
          preferences: defaultPrefs,
        });

      case 'update_contact':
        if (!data.email || !data.preferences) {
          return NextResponse.json(
            { error: 'Email and preferences required for contact update' },
            { status: 400 }
          );
        }

        await adminDb
          .collection('users')
          .doc(user.email)
          .collection('contacts')
          .doc(data.email)
          .set(
            {
              email: data.email,
              preferences: data.preferences,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );

        return NextResponse.json({
          success: true,
          message: 'Contact preferences updated',
          contact: data.email,
        });

      case 'get_context':
        // Get current Stina context for debugging/display
        return NextResponse.json({
          success: true,
          context: {
            userEmail: user.email,
            // Don't expose full context for security, just summary
            hasPreferences: true,
            contactCount: 0, // Would need to count contacts
          },
        });

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error handling Stina preferences action:', error);
    return NextResponse.json(
      { error: 'Failed to handle action' },
      { status: 500 }
    );
  }
}