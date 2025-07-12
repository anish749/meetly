import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth-service';
import { adminDb } from '@/config/firebase-admin';
import { MailSlurpService } from '@/services/mailslurp-service';

export async function GET() {
  try {
    const user = await AuthService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user document to fetch MailSlurp config
    const userDoc = await adminDb.collection('users').doc(user.email).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const mailSlurpConfig = userData?.mailSlurp;

    return NextResponse.json({
      success: true,
      mailSlurp: mailSlurpConfig || {
        status: 'not-setup',
        inboxId: '',
        mailslurpEmail: '',
      },
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
    const user = await AuthService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { customEmail } = await request.json();

    if (!customEmail || typeof customEmail !== 'string') {
      return NextResponse.json(
        { error: 'Custom email is required and must be a string' },
        { status: 400 }
      );
    }

    // Validate custom email format
    if (!MailSlurpService.validateCustomEmail(customEmail)) {
      return NextResponse.json(
        {
          error:
            'Invalid email format. Use only letters, numbers, dots, underscores, and hyphens.',
        },
        { status: 400 }
      );
    }

    // Get current user document
    const userDoc = await adminDb.collection('users').doc(user.email).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const currentMailSlurp = userData?.mailSlurp;

    if (!currentMailSlurp || !currentMailSlurp.inboxId) {
      return NextResponse.json(
        { error: 'MailSlurp inbox not configured. Please contact support.' },
        { status: 400 }
      );
    }

    // Update the custom email part while keeping the same inbox ID
    const updatedMailSlurp = {
      ...currentMailSlurp,
      mailslurpEmail: `${customEmail}@mailslurp.io`,
    };

    // Update the user document
    await adminDb.collection('users').doc(user.email).update({
      mailSlurp: updatedMailSlurp,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      mailSlurp: updatedMailSlurp,
      message: 'MailSlurp email updated successfully',
    });
  } catch (error) {
    console.error('Error updating MailSlurp config:', error);
    return NextResponse.json(
      { error: 'Failed to update MailSlurp configuration' },
      { status: 500 }
    );
  }
}
