'use client';

import { useAuth } from '@/contexts/auth-context';
import { MeetingRequestsDashboard } from '@/components/meeting-requests/meeting-requests-dashboard';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';

export default function MeetingRequestsPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();

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
            <div className="flex items-center gap-6">
              <Link href="/dashboard">
                <h1 className="text-2xl font-bold text-gray-900">
                  Meetly Dashboard
                </h1>
              </Link>
              <nav className="flex gap-1">
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm">
                    Overview
                  </Button>
                </Link>
                <Link href="/dashboard/meeting-requests">
                  <Button variant="ghost" size="sm" className="bg-gray-100">
                    Meeting Requests
                  </Button>
                </Link>
                <Link href="/stina">
                  <Button variant="ghost" size="sm">
                    Stina AI
                  </Button>
                </Link>
              </nav>
            </div>
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
        <MeetingRequestsDashboard />
      </main>
    </div>
  );
}
