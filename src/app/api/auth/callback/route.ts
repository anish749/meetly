import { NextRequest, NextResponse } from 'next/server';
import { createOAuth2Client } from '@/config/google-oauth';
import { adminDb } from '@/config/firebase-admin';
import { cookies } from 'next/headers';
import { google } from 'googleapis';
import crypto from 'crypto';
import { MailSlurpService } from '@/services/mailslurp-service';

/**
 * Background function to create MailSlurp inbox for a new user
 */
async function createMailSlurpInboxForUser(
  userEmail: string,
  userName: string
): Promise<void> {
  try {
    console.log(`Creating MailSlurp inbox for user: ${userEmail}`);

    const mailSlurpService = new MailSlurpService();

    // Generate a custom email based on user name, fallback to "inbox"
    const customEmailBase =
      userName
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'inbox';

    // Add some uniqueness to avoid conflicts
    const customEmail = `${customEmailBase}-${userEmail.split('@')[0]}`;

    // Attempt to create the inbox
    const inboxResult = await mailSlurpService.createInbox(customEmail);

    let mailSlurpConfig;

    if (inboxResult) {
      // Success case
      console.log(
        `MailSlurp inbox created successfully for ${userEmail}:`,
        inboxResult
      );
      mailSlurpConfig = {
        status: 'ready' as const,
        inboxId: inboxResult.inboxId,
        mailslurpEmail: inboxResult.mailslurpEmail,
      };
    } else {
      // Fallback case
      console.log(
        `MailSlurp inbox creation failed for ${userEmail}, using fallback`
      );
      const fallbackConfig = mailSlurpService.getFallbackInbox(customEmail);
      mailSlurpConfig = {
        status: 'ready' as const,
        inboxId: fallbackConfig.inboxId,
        mailslurpEmail: fallbackConfig.mailslurpEmail,
      };
    }

    // Update the user document with the MailSlurp configuration
    await adminDb.collection('users').doc(userEmail).update({
      mailSlurp: mailSlurpConfig,
      updatedAt: new Date().toISOString(),
    });

    console.log(
      `MailSlurp configuration updated for ${userEmail}:`,
      mailSlurpConfig
    );
  } catch (error) {
    console.error(`Failed to create MailSlurp inbox for ${userEmail}:`, error);

    // Even if creation fails completely, update to fallback
    try {
      const mailSlurpService = new MailSlurpService();
      const customEmail = `fallback-${userEmail.split('@')[0]}`;
      const fallbackConfig = mailSlurpService.getFallbackInbox(customEmail);

      await adminDb
        .collection('users')
        .doc(userEmail)
        .update({
          mailSlurp: {
            status: 'ready' as const,
            inboxId: fallbackConfig.inboxId,
            mailslurpEmail: fallbackConfig.mailslurpEmail,
          },
          updatedAt: new Date().toISOString(),
        });

      console.log(`Fallback MailSlurp configuration set for ${userEmail}`);
    } catch (fallbackError) {
      console.error(
        `Failed to set fallback MailSlurp config for ${userEmail}:`,
        fallbackError
      );
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/login?error=${error}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/login?error=missing_params`
      );
    }

    // Verify state for CSRF protection
    const cookieStore = await cookies();
    const storedState = cookieStore.get('oauth_state')?.value;

    if (!storedState || storedState !== state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/login?error=invalid_state`
      );
    }

    // Clear the state cookie
    cookieStore.delete('oauth_state');

    // Exchange code for tokens
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    if (!userInfo.email) {
      throw new Error('No email found in user info');
    }

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // Store tokens and user info in Firestore
    const userDoc = {
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      googleId: userInfo.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      sessionToken,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Initialize MailSlurp config with not-setup status
      mailSlurp: {
        status: 'not-setup' as const,
        inboxId: '',
        mailslurpEmail: '',
      },
    };

    await adminDb
      .collection('users')
      .doc(userInfo.email)
      .set(userDoc, { merge: true });

    // Start background process to create MailSlurp inbox
    // We don't await this to keep the auth flow fast
    createMailSlurpInboxForUser(userInfo.email, userInfo.name || 'user').catch(
      (error) => {
        console.error('Background MailSlurp inbox creation failed:', error);
      }
    );

    // Set session cookie
    cookieStore.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    // Redirect to dashboard
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
    );
  } catch (error) {
    console.error('Error in callback route:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=callback_error`
    );
  }
}
