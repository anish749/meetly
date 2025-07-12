import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth-service';
import { adminDb } from '@/config/firebase-admin';
import { EmailProcessingStatus } from '@/types/database';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const currentUser = await AuthService.getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get email IDs from query parameters
    const { searchParams } = new URL(request.url);
    const emailIds = searchParams.get('emailIds')?.split(',') || [];

    if (emailIds.length === 0) {
      return NextResponse.json({ statuses: {} });
    }

    // Fetch email statuses from database
    const statusPromises = emailIds.map(async (emailId) => {
      try {
        const statusDoc = await adminDb
          .collection('users')
          .doc(currentUser.email)
          .collection('email_status')
          .doc(emailId)
          .get();

        if (statusDoc.exists) {
          const data = statusDoc.data();
          return {
            emailId,
            status: (data?.status as EmailProcessingStatus) || 'pending',
            updated_at: data?.updated_at,
          };
        } else {
          return {
            emailId,
            status: 'pending' as EmailProcessingStatus,
            updated_at: null,
          };
        }
      } catch (error) {
        console.error(`Error fetching status for email ${emailId}:`, error);
        return {
          emailId,
          status: 'pending' as EmailProcessingStatus,
          updated_at: null,
        };
      }
    });

    const statusResults = await Promise.all(statusPromises);

    // Convert to object format for easier lookup
    const statuses = statusResults.reduce(
      (acc, result) => {
        acc[result.emailId] = {
          status: result.status,
          updated_at: result.updated_at,
        };
        return acc;
      },
      {} as Record<
        string,
        { status: EmailProcessingStatus; updated_at: string | null }
      >
    );

    return NextResponse.json({ statuses });
  } catch (error) {
    console.error('Email status endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
