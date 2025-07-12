import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth-service';
import { EmailAnalyst } from '@/services/email-analyst';
import { adminDb } from '@/config/firebase-admin';
import { EmailAnalysisRecord, EmailContext } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const currentUser = await AuthService.getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { emailId } = await request.json();
    if (!emailId) {
      return NextResponse.json(
        { error: 'Email ID is required' },
        { status: 400 }
      );
    }

    // Fetch email from MailSlurp API
    const mailslurpResponse = await fetch(
      `${process.env.MAILSLURP_API_BASE_URL}/inboxes/646c0933-0fdf-49dd-bc04-53514b1f0b2d/emails/${emailId}`,
      {
        headers: {
          'x-api-key': process.env.MAILSLURP_API_KEY || '',
        },
      }
    );

    if (!mailslurpResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch email from MailSlurp' },
        { status: 500 }
      );
    }

    const emailData = await mailslurpResponse.json();

    const emailContext: EmailContext = {
      id: emailData.id,
      subject: emailData.subject || 'No Subject',
      from: emailData.from,
      body: emailData.body || '',
      createdAt: emailData.createdAt,
      status: 'analysing_email',
    };

    // Update email status to analysing_email
    await updateEmailStatus(currentUser.email, emailId, 'analysing_email');

    try {
      // Analyze email with Email Analyst AI
      const emailAnalyst = new EmailAnalyst();
      const analysisResult = await emailAnalyst.analyzeEmail(emailContext);

      // Store analysis results in database
      const analysisRecord: EmailAnalysisRecord = {
        email_id: emailId,
        subject: emailContext.subject,
        from: emailContext.from,
        analysed_at: new Date().toISOString(),
        analysis_result: analysisResult,
        status: 'completed',
        user_email: currentUser.email,
      };

      await adminDb
        .collection('users')
        .doc(currentUser.email)
        .collection('email_analysis_results')
        .doc(emailId)
        .set(analysisRecord);

      // Update email status to processing_with_stina
      await updateEmailStatus(
        currentUser.email,
        emailId,
        'processing_with_stina'
      );

      return NextResponse.json({
        success: true,
        analysis: analysisResult,
        status: 'processing_with_stina',
      });
    } catch (analysisError) {
      console.error('Email analysis failed:', analysisError);

      // Store failed analysis record
      const failedRecord: EmailAnalysisRecord = {
        email_id: emailId,
        subject: emailContext.subject,
        from: emailContext.from,
        analysed_at: new Date().toISOString(),
        analysis_result: {
          initiator: { name: '', email: '' },
          invitees: [],
          meeting_intent: 'Failed to analyze',
        },
        status: 'failed',
        error_message:
          analysisError instanceof Error
            ? analysisError.message
            : 'Unknown error',
        user_email: currentUser.email,
      };

      await adminDb
        .collection('users')
        .doc(currentUser.email)
        .collection('email_analysis_results')
        .doc(emailId)
        .set(failedRecord);

      // Update email status to failed
      await updateEmailStatus(currentUser.email, emailId, 'failed');

      return NextResponse.json(
        {
          error: 'Email analysis failed',
          details:
            analysisError instanceof Error
              ? analysisError.message
              : 'Unknown error',
          status: 'failed',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Email analysis endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to update email processing status
 */
async function updateEmailStatus(
  userEmail: string,
  emailId: string,
  status: 'analysing_email' | 'processing_with_stina' | 'failed'
): Promise<void> {
  try {
    await adminDb
      .collection('users')
      .doc(userEmail)
      .collection('email_status')
      .doc(emailId)
      .set(
        {
          email_id: emailId,
          status,
          updated_at: new Date().toISOString(),
          user_email: userEmail,
        },
        { merge: true }
      );
  } catch (error) {
    console.error('Failed to update email status:', error);
    // Don't throw here to avoid breaking the main flow
  }
}
