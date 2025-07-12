import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth-service';
import { MeetingRequestService } from '@/services/meeting-request-service';
import { Communication } from '@/types/meeting-request';
import { z } from 'zod';

const addCommunicationSchema = z.object({
  type: z.enum(['email', 'text', 'whatsapp']),
  content: z.string(),
  sender: z.string(),
  timestamp: z.string().optional(),
  processed: z.boolean().default(false),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await AuthService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const canAccess = await MeetingRequestService.canUserAccess(id, user.email);
    if (!canAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();

    const validationResult = addCommunicationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const communicationData = validationResult.data;

    const communication: Omit<Communication, 'id'> = {
      type: communicationData.type,
      content: communicationData.content,
      sender: communicationData.sender,
      timestamp: communicationData.timestamp || new Date().toISOString(),
      processed: communicationData.processed,
    };

    await MeetingRequestService.addCommunication(id, communication);

    return NextResponse.json(
      {
        success: true,
        message: 'Communication added successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error adding communication to meeting request:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Meeting request not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to add communication' },
      { status: 500 }
    );
  }
}
