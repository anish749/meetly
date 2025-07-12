import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth-service';
import { adminDb } from '@/config/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(request: NextRequest) {
  try {
    const user = await AuthService.getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const preferencesDoc = await adminDb
      .collection('users')
      .doc(user.email)
      .collection('preferences')
      .doc('primary')
      .get();

    if (!preferencesDoc.exists) {
      return NextResponse.json({
        content: '',
        wordCount: 0,
        createdAt: null,
        updatedAt: null,
      });
    }

    const data = preferencesDoc.data();
    return NextResponse.json({
      content: data?.content || '',
      wordCount: data?.wordCount || 0,
      createdAt: data?.createdAt || null,
      updatedAt: data?.updatedAt || null,
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

    const preferencesRef = adminDb
      .collection('users')
      .doc(user.email)
      .collection('preferences')
      .doc('primary');

    const preferencesDoc = await preferencesRef.get();
    const now = FieldValue.serverTimestamp();

    if (!preferencesDoc.exists) {
      await preferencesRef.set({
        content,
        wordCount,
        createdAt: now,
        updatedAt: now,
        version: 1,
      });
    } else {
      await preferencesRef.update({
        content,
        wordCount,
        updatedAt: now,
        version: FieldValue.increment(1),
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
