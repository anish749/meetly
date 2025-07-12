'use client';

import { useState } from 'react';

interface Email {
  id: string;
  subject?: string;
  from: string;
  body: string;
  createdAt: string;
}

export default function DevPage() {
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState<Email[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchEmails = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/mailslurp/fetch-emails', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch emails');
      }

      setEmails(data.emails);
      console.log('Fetched emails:', data.emails);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Dev Tools</h1>

      <div className="space-y-4">
        <button
          onClick={fetchEmails}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {loading ? 'Fetching...' : 'Fetch Unread Emails'}
        </button>

        {error && (
          <div className="p-4 bg-red-100 text-red-700 rounded">
            Error: {error}
          </div>
        )}

        {emails.length > 0 && (
          <div className="mt-4">
            <h2 className="text-xl font-semibold mb-2">
              Unread Emails ({emails.length})
            </h2>
            <div className="space-y-4">
              {emails.map((email) => (
                <div key={email.id} className="p-4 border rounded">
                  <p className="font-medium">
                    Subject: {email.subject || 'No subject'}
                  </p>
                  <p className="text-sm text-gray-600">From: {email.from}</p>
                  <p className="text-sm text-gray-600">
                    Date: {new Date(email.createdAt).toLocaleString()}
                  </p>
                  <div className="mt-2">
                    <p className="text-sm font-medium">Body:</p>
                    <p className="text-sm whitespace-pre-wrap">{email.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
