import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth-service';
import { GoogleContactsService } from '@/services/google-contacts-service';

export async function GET(request: NextRequest) {
  try {
    const user = await AuthService.getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const pageSize = searchParams.get('pageSize');
    const pageToken = searchParams.get('pageToken');
    const sortOrder = searchParams.get('sortOrder') as 'LAST_MODIFIED_ASCENDING' | 'LAST_MODIFIED_DESCENDING' | 'FIRST_NAME_ASCENDING' | 'LAST_NAME_ASCENDING';
    const query = searchParams.get('query');

    const contactsService = new GoogleContactsService(user.email);

    // If there's a search query, use search endpoint
    if (query) {
      const results = await contactsService.searchContacts(query, {
        pageSize: pageSize ? parseInt(pageSize) : undefined,
      });
      
      const formattedContacts = results.map(result => 
        result.person ? contactsService.formatContact(result.person) : null
      ).filter(Boolean);

      return NextResponse.json({ 
        contacts: formattedContacts,
        totalPeople: results.length
      });
    }

    // Otherwise, list all contacts
    const result = await contactsService.listContacts({
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      pageToken: pageToken || undefined,
      sortOrder: sortOrder || undefined,
    });

    const formattedContacts = result.contacts.map(contact => 
      contactsService.formatContact(contact)
    );

    return NextResponse.json({
      contacts: formattedContacts,
      nextPageToken: result.nextPageToken,
      totalPeople: result.totalPeople,
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}