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

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const router = useRouter();

  // Middleware handles authentication redirect

  useEffect(() => {
    if (isAuthenticated) {
      fetchEvents();
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

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
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
              <Link href="/stina">
                <Button variant="ghost" size="sm">
                  Stina AI
                </Button>
              </Link>
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
      </main>
    </div>
  );
}
