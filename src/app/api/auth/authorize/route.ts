import { NextResponse } from 'next/server';
import { createOAuth2Client, getAuthUrl } from '@/config/google-oauth';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function GET() {
  try {
    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');

    // Store state in cookie for validation in callback
    const cookieStore = await cookies();
    cookieStore.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
    });

    const oauth2Client = createOAuth2Client();
    const authUrl = getAuthUrl(oauth2Client);

    // Add state to auth URL
    const urlWithState = `${authUrl}&state=${state}`;

    return NextResponse.redirect(urlWithState);
  } catch (error) {
    console.error('Error in authorize route:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=auth_error`
    );
  }
}
