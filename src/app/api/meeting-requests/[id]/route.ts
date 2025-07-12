import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth-service';
import { MeetingRequestService } from '@/services/meeting-request-service';
import { UpdateMeetingRequestPayload } from '@/types/meeting-request';
import { z } from 'zod';

const updateMeetingRequestSchema = z.object({
  status: z
    .enum([
      'context_collection',
      'scheduled',
      'rescheduled',
      'completed',
      'cancelled',
      'pending_reply',
    ])
    .optional(),
  context: z
    .object({
      summary: z.string(),
    })
    .partial()
    .optional(),
  proposedTimes: z
    .array(
      z.object({
        start: z.string(),
        end: z.string(),
        timezone: z.string(),
        location: z
          .object({
            name: z.string(),
            address: z.string().optional(),
            lat: z.number().optional(),
            lng: z.number().optional(),
          })
          .optional(),
        note: z.string().optional(),
      })
    )
    .optional(),
  scheduledEvent: z
    .object({
      googleEventId: z.string(),
      calendarId: z.string(),
      start: z.string(),
      end: z.string(),
    })
    .optional(),
  metadata: z
    .object({
      location: z.string().optional(),
      agenda: z.string().optional(),
      duration: z.number().optional(),
      urgency: z.enum(['low', 'medium', 'high']).optional(),
    })
    .partial()
    .optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await AuthService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const canAccess = await MeetingRequestService.canUserAccess(id, user.email);
    if (!canAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const meetingRequest = await MeetingRequestService.getById(id);
    if (!meetingRequest) {
      return NextResponse.json(
        { error: 'Meeting request not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      meetingRequest,
    });
  } catch (error) {
    console.error('Error fetching meeting request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch meeting request' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await AuthService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const canAccess = await MeetingRequestService.canUserAccess(id, user.email);
    if (!canAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();

    const validationResult = updateMeetingRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const updates = validationResult.data as UpdateMeetingRequestPayload;
    const meetingRequest = await MeetingRequestService.update(id, updates);

    return NextResponse.json({
      success: true,
      meetingRequest,
    });
  } catch (error) {
    console.error('Error updating meeting request:', error);

    if (
      error instanceof Error &&
      error.message.includes('Invalid status transition')
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Meeting request not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update meeting request' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await AuthService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const canAccess = await MeetingRequestService.canUserAccess(id, user.email);
    if (!canAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await MeetingRequestService.delete(id);

    return NextResponse.json({
      success: true,
      message: 'Meeting request cancelled successfully',
    });
  } catch (error) {
    console.error('Error deleting meeting request:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Meeting request not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to cancel meeting request' },
      { status: 500 }
    );
  }
}
