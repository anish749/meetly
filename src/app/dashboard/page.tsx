'use client';

import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar, Settings } from 'lucide-react';

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
  calendarId?: string;
}

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [calendarsUsed, setCalendarsUsed] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

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
        setCalendarsUsed(data.calendarsUsed || 1);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoadingEvents(false);
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
            access your Google Calendar events from {calendarsUsed} calendar{calendarsUsed !== 1 ? 's' : ''}.
          </p>

          <div className="flex items-center gap-4 mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <Calendar className="h-5 w-5 text-blue-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">
                Multi-Calendar Support Active
              </p>
              <p className="text-xs text-blue-700">
                Events are being aggregated from {calendarsUsed} connected calendar{calendarsUsed !== 1 ? 's' : ''}
              </p>
            </div>
            <Link href="/preferences">
              <Button variant="outline" size="sm" className="text-blue-700 border-blue-300 hover:bg-blue-100">
                <Settings className="h-4 w-4 mr-2" />
                Manage Calendars
              </Button>
            </Link>
          </div>

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
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium">{event.summary}</h4>
                        <p className="text-sm text-gray-600">
                          {event.start.dateTime
                            ? new Date(event.start.dateTime).toLocaleString()
                            : event.start.date}
                        </p>
                      </div>
                      {event.calendarId && event.calendarId !== 'primary' && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {event.calendarId === 'primary' ? 'Primary' : 'Multi-Cal'}
                        </Badge>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No upcoming events found in your connected calendars.
                <br />
                <Link href="/preferences" className="text-blue-600 hover:underline text-sm">
                  Manage your calendar connections
                </Link>
              </div>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
