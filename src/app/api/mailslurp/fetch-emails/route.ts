import { NextResponse } from 'next/server';
import { MailSlurp } from 'mailslurp-client';
import { AuthService } from '@/services/auth-service';
import { adminDb } from '@/config/firebase-admin';

export async function POST() {
  try {
    // Verify user authentication
    const user = await AuthService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const apiKey = process.env.MAILSLURP_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'MailSlurp API key not configured' },
        { status: 500 }
      );
    }

    // Get user's MailSlurp inbox ID
    const userDoc = await adminDb.collection('users').doc(user.email).get();
    
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const inboxId = userData?.mailslurpInboxId;

    if (!inboxId) {
      return NextResponse.json(
        { error: 'MailSlurp inbox not configured. Please set up your email address in preferences.' },
        { status: 400 }
      );
    }

    const mailslurp = new MailSlurp({ apiKey });

    // Fetch emails
    const emails = await mailslurp.emailController.getEmailsPaginated({
      inboxId: [inboxId],
      unreadOnly: false,
    });

    // Get full email content for each email
    const emailContents = await Promise.all(
      emails.content?.map(async (email) => {
        const fullEmail = await mailslurp.emailController.getEmail({
          emailId: email.id!,
        });
        return {
          id: fullEmail.id,
          subject: fullEmail.subject,
          from: fullEmail.from,
          body: fullEmail.body,
          createdAt: fullEmail.createdAt,
        };
      }) || []
    );

    // Log the contents
    console.log('Emails:', emailContents);

    return NextResponse.json({
      success: true,
      emails: emailContents,
      count: emailContents.length,
    });
  } catch (error) {
    console.error('Error fetching emails:', error);
    return NextResponse.json(
      { error: 'Failed to fetch emails' },
      { status: 500 }
    );
  }
}
