'use client';

import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
}

interface Contact {
  resourceName?: string;
  displayName?: string;
  givenName?: string;
  familyName?: string;
  emailAddresses?: Array<{
    value: string;
    type?: string;
    formattedType?: string;
  }>;
  phoneNumbers?: Array<{
    value: string;
    type?: string;
    formattedType?: string;
  }>;
  organizations?: Array<{
    name?: string;
    title?: string;
  }>;
  photos?: Array<{
    url: string;
  }>;
}

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchEvents();
      fetchContacts();
    }
  }, [isAuthenticated]);

  const fetchEvents = async () => {
    setLoadingEvents(true);
    try {
      const response = await fetch('/api/calendar/events');
      const data = await response.json();
      if (data.events) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoadingEvents(false);
    }
  };

  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const response = await fetch('/api/contacts?pageSize=6');
      const data = await response.json();
      if (data.contacts) {
        setContacts(data.contacts);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoadingContacts(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Meetly Dashboard
            </h1>
            <div className="flex items-center gap-4">
              <Link href="/preferences">
                <Button variant="ghost" size="sm">
                  Preferences
                </Button>
              </Link>
              {user?.picture && (
                <Image
                  src={user.picture}
                  alt={user.name || user.email}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              )}
              <span className="text-sm text-gray-700">{user?.email}</span>
              <Button onClick={logout} variant="outline" size="sm">
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            Welcome, {user?.name || 'User'}!
          </h2>
          <p className="text-gray-600 mb-6">
            You have successfully connected your Google account. You can now
            access your Google Calendar events.
          </p>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Upcoming Events</h3>
              <Button onClick={fetchEvents} variant="outline" size="sm">
                Refresh
              </Button>
            </div>

            {loadingEvents ? (
              <div className="text-center py-8 text-gray-500">
                Loading events...
              </div>
            ) : events.length > 0 ? (
              <div className="space-y-3">
                {events.slice(0, 5).map((event) => (
                  <Card key={event.id} className="p-4">
                    <h4 className="font-medium">{event.summary}</h4>
                    <p className="text-sm text-gray-600">
                      {event.start.dateTime
                        ? new Date(event.start.dateTime).toLocaleString()
                        : event.start.date}
                    </p>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No upcoming events found in your calendar.
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6 mt-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Recent Contacts</h3>
              <Button onClick={fetchContacts} variant="outline" size="sm">
                Refresh
              </Button>
            </div>

            {loadingContacts ? (
              <div className="text-center py-8 text-gray-500">
                Loading contacts...
              </div>
            ) : contacts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {contacts.map((contact) => {
                  const displayName = contact.displayName || 
                    (contact.givenName || contact.familyName ? 
                      `${contact.givenName || ''} ${contact.familyName || ''}`.trim() : 
                      'No Name');
                  const primaryEmail = contact.emailAddresses?.[0]?.value;
                  const primaryPhone = contact.phoneNumbers?.[0]?.value;
                  const organization = contact.organizations?.[0];
                  const photo = contact.photos?.[0]?.url;

                  return (
                    <Card key={contact.resourceName} className="p-4">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          {photo ? (
                            <Image
                              src={photo}
                              alt={displayName}
                              width={40}
                              height={40}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-700">
                                {displayName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{displayName}</h4>
                          {primaryEmail && (
                            <p className="text-xs text-gray-600 truncate">{primaryEmail}</p>
                          )}
                          {primaryPhone && (
                            <p className="text-xs text-gray-600">{primaryPhone}</p>
                          )}
                          {organization && (
                            <p className="text-xs text-gray-500 truncate">
                              {organization.title && `${organization.title} at `}
                              {organization.name}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No contacts found in your Google account.
              </div>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
