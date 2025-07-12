import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth-service';
import { adminDb } from '@/config/firebase-admin';
import { v4 as uuidv4 } from 'uuid';

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

    // Get user's MailSlurp config
    const userDoc = await adminDb.collection('users').doc(user.email).get();
    
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    
    return NextResponse.json({
      success: true,
      mailslurpInboxId: userData?.mailslurpInboxId || null,
      mailslurpCustomEmail: userData?.mailslurpCustomEmail || null,
    });

  } catch (error) {
    console.error('Error fetching MailSlurp config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch MailSlurp configuration' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify user authentication
    const user = await AuthService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { customEmail } = body;

    if (!customEmail || typeof customEmail !== 'string') {
      return NextResponse.json(
        { error: 'Valid custom email required' },
        { status: 400 }
      );
    }

    // Validate custom email format (basic validation)
    const emailRegex = /^[a-zA-Z0-9._-]+$/;
    if (!emailRegex.test(customEmail)) {
      return NextResponse.json(
        { error: 'Custom email can only contain letters, numbers, dots, underscores, and hyphens' },
        { status: 400 }
      );
    }

    // Get current user data
    const userDoc = await adminDb.collection('users').doc(user.email).get();
    
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    let inboxId = userData?.mailslurpInboxId;

    // Generate inbox ID if it doesn't exist (for existing users)
    if (!inboxId) {
      inboxId = uuidv4();
    }

    // Update user document with MailSlurp config
    await adminDb
      .collection('users')
      .doc(user.email)
      .update({
        mailslurpInboxId: inboxId,
        mailslurpCustomEmail: customEmail,
        updatedAt: new Date().toISOString(),
      });

    return NextResponse.json({
      success: true,
      message: 'MailSlurp email configuration updated successfully',
      mailslurpInboxId: inboxId,
      mailslurpCustomEmail: customEmail,
    });

  } catch (error) {
    console.error('Error updating MailSlurp config:', error);
    return NextResponse.json(
      { error: 'Failed to update MailSlurp configuration' },
      { status: 500 }
    );
  }
}