import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth-service';
import { StinaAgent, EmailContext } from '@/services/stina-agent';
import { MeetingRequestService } from '@/services/meeting-request-service';
import { z } from 'zod';

const processWithStinaSchema = z.object({
  meetingRequestId: z.string(),
});

export async function POST(request: Request) {
  try {
    // Verify user authentication
    const user = await AuthService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = processWithStinaSchema.parse(body);
    const { meetingRequestId } = validatedData;

    // Get the meeting request
    const meetingRequest =
      await MeetingRequestService.getById(meetingRequestId);
    if (!meetingRequest) {
      return NextResponse.json(
        { error: 'Meeting request not found' },
        { status: 404 }
      );
    }

    // Check if the meeting request is in the correct status
    if (meetingRequest.status !== 'processing_with_stina') {
      return NextResponse.json(
        {
          error: 'Meeting request must be in processing_with_stina status',
          currentStatus: meetingRequest.status,
        },
        { status: 400 }
      );
    }

    // Check if email analyst response exists
    if (
      !meetingRequest.emailAnalystResponse ||
      'error' in meetingRequest.emailAnalystResponse
    ) {
      return NextResponse.json(
        { error: 'No valid email analysis found for this meeting request' },
        { status: 400 }
      );
    }

    // Initialize Stina agent
    const stinaAgent = new StinaAgent(user.email);
    await stinaAgent.initializeContext();

    // Convert meeting request communications to EmailContext format
    const emailContexts: EmailContext[] = meetingRequest.communications
      .filter((comm) => comm.type === 'email')
      .map((comm) => ({
        id: comm.id,
        subject: meetingRequest.context.summary,
        from: comm.sender,
        body: comm.content,
        createdAt: comm.timestamp,
      }));

    // Create a comprehensive context for Stina including the email analyst response
    const analystResponse = meetingRequest.emailAnalystResponse;
    const enrichedEmailContext: EmailContext = {
      id: `enriched_${meetingRequestId}`,
      subject: `Meeting Request: ${analystResponse.meeting_intent}`,
      from: analystResponse.initiator.email,
      body: `
Original email analysis:

Meeting Intent: ${analystResponse.meeting_intent}
Initiator: ${analystResponse.initiator.name} (${analystResponse.initiator.email})
Invitees: ${analystResponse.invitees.map((inv) => `${inv.name || 'Unknown'} (${inv.email})`).join(', ')}
Requested Timeframe: ${analystResponse.requested_timeframe || 'Not specified'}
Duration: ${analystResponse.duration_minutes ? `${analystResponse.duration_minutes} minutes` : 'Not specified'}
Location Hint: ${analystResponse.location_hint || 'Not specified'}
Other Notes: ${analystResponse.other_notes || 'None'}

Original email content:
${emailContexts[0]?.body || 'No original email content available'}
      `.trim(),
      createdAt: meetingRequest.createdAt,
    };

    // Process with Stina using the enriched context
    await stinaAgent.processEmails([enrichedEmailContext]);

    return NextResponse.json({
      success: true,
      meetingRequestId,
      message: 'Meeting request processed with Stina successfully.',
      emailAnalystResponse: analystResponse,
    });
  } catch (error) {
    console.error('Error processing meeting request with Stina:', error);
    return NextResponse.json(
      {
        error: 'Failed to process meeting request with Stina',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
