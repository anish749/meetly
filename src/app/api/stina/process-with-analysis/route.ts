import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth-service';
import { StinaAgent } from '@/services/stina-agent';
import { adminDb } from '@/config/firebase-admin';
import { EmailContext, EmailAnalysisRecord } from '@/types/database';

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

    // Get email analysis results from database
    const analysisDoc = await adminDb
      .collection('users')
      .doc(currentUser.email)
      .collection('email_analysis_results')
      .doc(emailId)
      .get();

    if (!analysisDoc.exists) {
      return NextResponse.json(
        { error: 'Email analysis not found. Please analyze the email first.' },
        { status: 404 }
      );
    }

    const analysisData = analysisDoc.data() as EmailAnalysisRecord;

    if (analysisData.status !== 'completed') {
      return NextResponse.json(
        { error: 'Email analysis not completed or failed' },
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
      status: 'processing_with_stina',
    };

    // Update email status to processing_with_stina
    await updateEmailStatus(
      currentUser.email,
      emailId,
      'processing_with_stina'
    );

    try {
      // Initialize and process with Stina AI using analysis results
      const stinaAgent = new StinaAgent(currentUser.email);
      await stinaAgent.initializeContext();
      await stinaAgent.processEmailWithAnalysis(
        emailContext,
        analysisData.analysis_result
      );

      // Update email status to completed
      await updateEmailStatus(currentUser.email, emailId, 'completed');

      return NextResponse.json({
        success: true,
        message: 'Email processed successfully with Stina AI',
        status: 'completed',
      });
    } catch (processingError) {
      console.error('Stina AI processing failed:', processingError);

      // Update email status to failed
      await updateEmailStatus(currentUser.email, emailId, 'failed');

      return NextResponse.json(
        {
          error: 'Stina AI processing failed',
          details:
            processingError instanceof Error
              ? processingError.message
              : 'Unknown error',
          status: 'failed',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Process with analysis endpoint error:', error);
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
  status: 'processing_with_stina' | 'completed' | 'failed'
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
