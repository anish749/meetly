'use client';

import { useAuth } from '@/contexts/auth-context';
import { PreferencesForm } from '@/components/preferences/preferences-form';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function PreferencesPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">
                Meeting Preferences
              </h1>
            </div>
            <div className="flex items-center gap-4">
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">
              Your Meeting Preferences
            </h2>
            <p className="text-gray-600">
              Tell Meetly about your scheduling preferences, favorite meeting
              spots, and any other details that help us arrange better meetings
              for you.
            </p>
          </div>

          <PreferencesForm />
        </Card>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            Tip: Be specific about your time preferences, location preferences,
            and any constraints you have. The more detail you provide, the
            better Meetly can schedule meetings that work for you.
          </p>
        </div>
      </main>
    </div>
  );
}
