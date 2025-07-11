import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminDb } from '@/config/firebase-admin';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ authenticated: false });
    }

    // Find user by session token
    const usersSnapshot = await adminDb
      .collection('users')
      .where('sessionToken', '==', sessionToken)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return NextResponse.json({ authenticated: false });
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    // Return user data (without sensitive tokens)
    return NextResponse.json({
      authenticated: true,
      user: {
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
        googleId: userData.googleId,
      },
    });
  } catch (error) {
    console.error('Error in session route:', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}
