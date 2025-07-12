import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth-service';
import { adminDb } from '@/config/firebase-admin';

export async function GET() {
  try {
    const user = await AuthService.getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userDoc = await adminDb.collection('users').doc(user.email).get();

    if (!userDoc.exists) {
      return NextResponse.json({
        content: '',
        wordCount: 0,
        createdAt: null,
        updatedAt: null,
      });
    }

    const userData = userDoc.data();
    const content = userData?.stinaPreferences?.freeformPreferences || '';
    const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

    return NextResponse.json({
      content,
      wordCount,
      createdAt: userData?.stinaPreferences?.createdAt || null,
      updatedAt: userData?.stinaPreferences?.updatedAt || null,
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await AuthService.getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { content } = body;

    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'Invalid content' }, { status: 400 });
    }

    // Count words
    const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

    if (wordCount > 5000) {
      return NextResponse.json(
        { error: 'Content exceeds 5000 word limit' },
        { status: 400 }
      );
    }

    const userRef = adminDb.collection('users').doc(user.email);

    const userDoc = await userRef.get();
    const now = new Date().toISOString();

    if (!userDoc.exists) {
      // Create user document with preferences
      await userRef.set({
        email: user.email,
        stinaPreferences: {
          freeformPreferences: content,
          wordCount,
          createdAt: now,
          updatedAt: now,
          version: 1,
        },
        updatedAt: now,
      });
    } else {
      // Update existing user document
      const existingPrefs = userDoc.data()?.stinaPreferences || {};
      await userRef.update({
        stinaPreferences: {
          ...existingPrefs,
          freeformPreferences: content,
          wordCount,
          updatedAt: now,
          version: (existingPrefs.version || 0) + 1,
        },
        updatedAt: now,
      });
    }

    return NextResponse.json({
      success: true,
      wordCount,
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
