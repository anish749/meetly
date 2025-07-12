import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth-service';
import { MeetingRequestService } from '@/services/meeting-request-service';
import { z } from 'zod';

const processRequestSchema = z.object({
  meetingRequestId: z.string(),
});

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

    const validationResult = processRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { meetingRequestId } = validationResult.data;

    const canAccess = await MeetingRequestService.canUserAccess(
      meetingRequestId,
      user.email
    );
    if (!canAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const meetingRequest =
      await MeetingRequestService.getById(meetingRequestId);
    if (!meetingRequest) {
      return NextResponse.json(
        { error: 'Meeting request not found' },
        { status: 404 }
      );
    }

    await MeetingRequestService.processWithAI(meetingRequestId);

    return NextResponse.json({
      success: true,
      message: 'Meeting request processed successfully',
    });
  } catch (error) {
    console.error('Error processing meeting request:', error);

    if (error instanceof Error && error.message.includes('ANTHROPIC_API_KEY')) {
      return NextResponse.json(
        { error: 'AI processing service not configured' },
        { status: 503 }
      );
    }

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Meeting request not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process meeting request' },
      { status: 500 }
    );
  }
}
