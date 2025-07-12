import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth-service';
import { EmailAnalystService } from '@/services/email-analyst-service';
import { MeetingRequestService } from '@/services/meeting-request-service';
import { MailSlurp } from 'mailslurp-client';
import { adminDb } from '@/config/firebase-admin';
import { z } from 'zod';

const analyzeEmailSchema = z.object({
  emailId: z.string(),
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
    const validatedData = analyzeEmailSchema.parse(body);
    const { emailId } = validatedData;

    // Initialize services
    const emailAnalyst = new EmailAnalystService();

    // Fetch email from MailSlurp
    const apiKey = process.env.MAILSLURP_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'MailSlurp API key not configured' },
        { status: 500 }
      );
    }

    const mailslurp = new MailSlurp({ apiKey });

    // Get the specific email
    const email = await mailslurp.emailController.getEmail({
      emailId,
    });

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    // Create a meeting request with analysing_email status
    const meetingRequest = await MeetingRequestService.create(
      {
        participants: [], // Will be populated from analyst response
        creator: {
          email: user.email,
          source: 'email',
        },
        context: {
          summary: `Email analysis for: ${email.subject || 'No subject'}`,
        },
        communications: [
          {
            type: 'email',
            content: email.body || '',
            sender: email.from || '',
            timestamp:
              email.createdAt?.toISOString() || new Date().toISOString(),
            processed: false,
          },
        ],
        metadata: {},
      },
      'analysing_email'
    );

    // Analyze the email content
    const emailContent = `
Subject: ${email.subject || 'No subject'}
From: ${email.from || 'Unknown sender'}
Date: ${email.createdAt?.toISOString() || 'Unknown date'}

${email.body || 'No content'}
    `.trim();

    const analysisResult = await emailAnalyst.analyzeEmail(
      emailContent,
      user.email
    );

    // Update the meeting request with the analysis result
    if (emailAnalyst.isSuccessfulResponse(analysisResult)) {
      // Update participants based on analyst response
      const participants = analysisResult.invitees.map((invitee) => ({
        email: invitee.email,
        name: invitee.name,
        isRegisteredUser: false, // We'll determine this later
        preferences: invitee.work_context || invitee.relationship,
      }));

      // Update meeting request with analyst response and move to processing_with_stina
      await MeetingRequestService.update(meetingRequest.id, {
        status: 'processing_with_stina',
        context: {
          summary: analysisResult.meeting_intent,
        },
        metadata: {
          duration: analysisResult.duration_minutes || undefined,
          location: analysisResult.location_hint || undefined,
          agenda: analysisResult.meeting_intent,
        },
      });

      // Update the meeting request document with email analyst response and participants
      // Use direct Firestore update since the service doesn't support emailAnalystResponse field yet
      const meetingRequestRef = adminDb
        .collection('meetingRequests')
        .doc(meetingRequest.id);

      await meetingRequestRef.update({
        participants,
        emailAnalystResponse: analysisResult,
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        meetingRequestId: meetingRequest.id,
        status: 'processing_with_stina',
        message: 'Email analyzed successfully. Ready for Stina processing.',
        analysis: {
          meetingIntent: analysisResult.meeting_intent,
          duration: analysisResult.duration_minutes,
          location: analysisResult.location_hint,
          invitees: analysisResult.invitees,
          confidence: analysisResult.confidence,
        },
        rawAnalysisResult: analysisResult,
      });
    } else {
      // Analysis failed, update status and store error
      await MeetingRequestService.update(meetingRequest.id, {
        status: 'cancelled',
      });

      // Store error in meeting request
      const meetingRequestRef = adminDb
        .collection('meetingRequests')
        .doc(meetingRequest.id);

      await meetingRequestRef.update({
        emailAnalystResponse: analysisResult,
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Email analysis failed',
          details: analysisResult.error,
          meetingRequestId: meetingRequest.id,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error analyzing email:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze email',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
