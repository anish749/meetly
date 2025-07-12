import { NextRequest, NextResponse } from 'next/server';
import { createOAuth2Client } from '@/config/google-oauth';
import { adminDb } from '@/config/firebase-admin';
import { cookies } from 'next/headers';
import { google } from 'googleapis';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

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

    // Check if user exists to determine if we need to generate inbox ID
    const existingUserDoc = await adminDb
      .collection('users')
      .doc(userInfo.email)
      .get();

    const isNewUser = !existingUserDoc.exists;

    // Prepare user document
    const userDoc: {
      email: string;
      name: string | null | undefined;
      picture: string | null | undefined;
      googleId: string | null | undefined;
      accessToken: string | null | undefined;
      refreshToken: string | null | undefined;
      expiryDate: number | null | undefined;
      sessionToken: string;
      updatedAt: string;
      mailslurpInboxId?: string;
      createdAt?: string;
    } = {
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      googleId: userInfo.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      sessionToken,
      updatedAt: new Date().toISOString(),
    };

    // Generate MailSlurp inbox ID for new users
    if (isNewUser) {
      userDoc.mailslurpInboxId = uuidv4();
      userDoc.createdAt = new Date().toISOString();
    }

    await adminDb
      .collection('users')
      .doc(userInfo.email)
      .set(userDoc, { merge: true });

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
