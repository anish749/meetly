import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth-service';
import { StinaAgent, EmailContext } from '@/services/stina-agent';
import { MailSlurp } from 'mailslurp-client';

const INBOX_ID = '646c0933-0fdf-49dd-bc04-53514b1f0b2d';

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

    // Initialize Stina agent
    const stinaAgent = new StinaAgent(user.email);
    await stinaAgent.initializeContext();

    // Fetch unread emails from MailSlurp
    const apiKey = process.env.MAILSLURP_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'MailSlurp API key not configured' },
        { status: 500 }
      );
    }

    const mailslurp = new MailSlurp({ apiKey });

    // Get unread emails
    const emails = await mailslurp.emailController.getEmailsPaginated({
      inboxId: [INBOX_ID],
      unreadOnly: false,
    });

    if (!emails.content || emails.content.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unread emails found',
        processedCount: 0,
      });
    }

    // Convert emails to EmailContext format
    const emailContexts: EmailContext[] = await Promise.all(
      emails.content.map(async (email) => {
        const fullEmail = await mailslurp.emailController.getEmail({
          emailId: email.id!,
        });

        return {
          id: fullEmail.id!,
          subject: fullEmail.subject || '',
          from: fullEmail.from || '',
          body: fullEmail.body || '',
          createdAt:
            fullEmail.createdAt?.toISOString() || new Date().toISOString(),
        };
      })
    );

    // Process emails with Stina
    await stinaAgent.processEmails(emailContexts);

    // Mark emails as read (optional - you might want to keep them unread)
    // await Promise.all(
    //   emails.content.map(async (email) => {
    //     try {
    //       await mailslurp.emailController.markAsRead({
    //         emailId: email.id!,
    //         read: true,
    //       });
    //     } catch (error) {
    //       console.error(`Failed to mark email ${email.id} as read:`, error);
    //     }
    //   })
    // );

    return NextResponse.json({
      success: true,
      message: `Processed ${emailContexts.length} emails`,
      processedCount: emailContexts.length,
      emails: emailContexts.map((email) => ({
        id: email.id,
        subject: email.subject,
        from: email.from,
        createdAt: email.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error processing emails with Stina:', error);
    return NextResponse.json(
      { error: 'Failed to process emails' },
      { status: 500 }
    );
  }
}

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

    // Check the status of unread emails without processing
    const apiKey = process.env.MAILSLURP_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'MailSlurp API key not configured' },
        { status: 500 }
      );
    }

    const mailslurp = new MailSlurp({ apiKey });

    const emails = await mailslurp.emailController.getEmailsPaginated({
      inboxId: [INBOX_ID],
      unreadOnly: true,
    });

    return NextResponse.json({
      success: true,
      unreadCount: emails.content?.length || 0,
      emails:
        emails.content?.map((email) => ({
          id: email.id,
          subject: email.subject,
          from: email.from,
          createdAt: email.createdAt,
        })) || [],
    });
  } catch (error) {
    console.error('Error checking email status:', error);
    return NextResponse.json(
      { error: 'Failed to check email status' },
      { status: 500 }
    );
  }
}
