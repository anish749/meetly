import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth-service';
import { MeetingRequestService } from '@/services/meeting-request-service';
import {
  CreateMeetingRequestPayload,
  MeetingRequestFilters,
} from '@/types/meeting-request';
import { z } from 'zod';

const createMeetingRequestSchema = z.object({
  participants: z.array(
    z.object({
      email: z.string().email(),
      name: z.string().optional(),
      preferences: z.string().optional(),
    })
  ),
  creator: z.object({
    email: z.string().email(),
    source: z.enum(['email', 'text', 'whatsapp', 'manual']),
  }),
  context: z.object({
    summary: z.string(),
  }),
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
  metadata: z
    .object({
      location: z.string().optional(),
      agenda: z.string().optional(),
      duration: z.number().optional(),
      urgency: z.enum(['low', 'medium', 'high']).optional(),
    })
    .optional(),
  communications: z
    .array(
      z.object({
        type: z.enum(['email', 'text', 'whatsapp']),
        content: z.string(),
        sender: z.string(),
        timestamp: z.string(),
        processed: z.boolean(),
      })
    )
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await AuthService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    const filters: MeetingRequestFilters = {};

    const status = searchParams.get('status');
    if (status) {
      const validStatuses = [
        'context_collection',
        'scheduled',
        'rescheduled',
        'completed',
        'cancelled',
        'pending_reply',
      ] as const;
      type ValidStatus = (typeof validStatuses)[number];

      if (status.includes(',')) {
        const statusArray = status
          .split(',')
          .filter((s): s is ValidStatus =>
            validStatuses.includes(s as ValidStatus)
          );
        if (statusArray.length > 0) {
          filters.status = statusArray;
        }
      } else if (validStatuses.includes(status as ValidStatus)) {
        filters.status = status as ValidStatus;
      }
    }

    const participant = searchParams.get('participant');
    if (participant) {
      filters.participant = participant;
    }

    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    if (startDate && endDate) {
      filters.dateRange = {
        start: startDate,
        end: endDate,
      };
    }

    const urgency = searchParams.get('urgency');
    if (urgency && ['low', 'medium', 'high'].includes(urgency)) {
      filters.urgency = urgency as 'low' | 'medium' | 'high';
    }

    let meetingRequests;
    if (filters.participant) {
      meetingRequests = await MeetingRequestService.getByParticipant(
        filters.participant,
        filters
      );
    } else {
      meetingRequests = await MeetingRequestService.getByUser(
        user.email,
        filters
      );
    }

    return NextResponse.json({
      success: true,
      meetingRequests,
      total: meetingRequests.length,
    });
  } catch (error) {
    console.error('Error fetching meeting requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch meeting requests' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await AuthService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();

    const validationResult = createMeetingRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const payload = validationResult.data as CreateMeetingRequestPayload;

    if (payload.creator.email !== user.email) {
      return NextResponse.json(
        { error: 'Creator email must match authenticated user' },
        { status: 403 }
      );
    }

    const meetingRequest = await MeetingRequestService.create(payload);

    return NextResponse.json(
      {
        success: true,
        meetingRequest,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating meeting request:', error);
    return NextResponse.json(
      { error: 'Failed to create meeting request' },
      { status: 500 }
    );
  }
}
