'use client';

import { useState, Suspense, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useSearchParams, useRouter } from 'next/navigation';

function LoginContent() {
  const [email, setEmail] = useState('');
  const { login, isAuthenticated, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const router = useRouter();

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement email authentication
    console.log('Email login not implemented yet:', email);
  };

  const handleMicrosoftLogin = () => {
    // TODO: Implement Microsoft authentication
    console.log('Microsoft login not implemented yet');
  };

  useEffect(() => {
    // Only redirect if we have a truly authenticated user
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <Button
            variant="ghost"
            className="mb-8 text-sm text-gray-600 hover:text-gray-900"
          >
            <span className="mr-2">🔗</span>
            Explore our Integrations
            <span className="ml-2">→</span>
          </Button>
        </div>

        {/* Main content */}
        <div className="space-y-6">
          <h1 className="text-3xl font-bold text-center text-gray-900">
            Log in to your account
          </h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error === 'auth_error' &&
                'Authentication failed. Please try again.'}
              {error === 'callback_error' &&
                'Failed to complete login. Please try again.'}
              {error === 'missing_params' &&
                'Invalid login request. Please try again.'}
              {error === 'invalid_state' &&
                'Security check failed. Please try again.'}
              {error === 'access_denied' &&
                'Access was denied. Please try again.'}
            </div>
          )}

          <Card className="p-6 space-y-4">
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full"
              />
              <Button type="submit" className="w-full">
                Continue
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">OR</span>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={login}
                variant="outline"
                className="w-full flex items-center justify-center gap-3 hover:bg-gray-50"
              >
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>

              <Button
                onClick={handleMicrosoftLogin}
                variant="outline"
                className="w-full flex items-center justify-center gap-3 hover:bg-gray-50"
              >
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path fill="#F25022" d="M11.4 11.4H2.6V2.6h8.8v8.8z" />
                  <path fill="#00A4EF" d="M21.4 11.4h-8.8V2.6h8.8v8.8z" />
                  <path fill="#7FBA00" d="M11.4 21.4H2.6v-8.8h8.8v8.8z" />
                  <path fill="#FFB900" d="M21.4 21.4h-8.8v-8.8h8.8v8.8z" />
                </svg>
                Continue with Microsoft
              </Button>
            </div>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-600">
          Don&apos;t have an account?{' '}
          <Button variant="link" className="p-0 h-auto font-normal">
            Sign up for free
            <span className="ml-1">→</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
