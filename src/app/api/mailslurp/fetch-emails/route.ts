import { NextResponse } from 'next/server';
import { MailSlurp } from 'mailslurp-client';

const INBOX_ID = '646c0933-0fdf-49dd-bc04-53514b1f0b2d';

export async function POST() {
  try {
    const apiKey = process.env.MAILSLURP_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'MailSlurp API key not configured' },
        { status: 500 }
      );
    }

    const mailslurp = new MailSlurp({ apiKey });

    // Fetch unread emails
    const emails = await mailslurp.emailController.getEmailsPaginated({
      inboxId: [INBOX_ID],
      unreadOnly: true,
    });

    // Get full email content for each unread email
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
    console.log('Unread emails:', emailContents);

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
