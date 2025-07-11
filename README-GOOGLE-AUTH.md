# Google Auth Setup for Meetly

This document explains how to set up Google OAuth authentication with Firebase storage for the Meetly application.

## Prerequisites

1. Google Cloud Console project with OAuth 2.0 credentials
2. Firebase project with Firestore enabled
3. Node.js 18+ installed

## Configuration Steps

### 1. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Calendar API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click Enable
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URI: `http://localhost:3000/api/auth/callback`
   - For production, add your production URL
5. Copy the Client ID and Client Secret

### 2. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Enable Firestore:
   - Go to "Firestore Database"
   - Click "Create database"
   - Choose production mode
   - Select your region
4. Get Firebase configuration:
   - Go to Project Settings
   - Under "Your apps", click web icon (</>)
   - Copy the configuration object
5. Create service account for admin SDK:
   - Go to Project Settings > Service Accounts
   - Click "Generate new private key"
   - Save the JSON file securely

### 3. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in the values:

```bash
cp .env.local.example .env.local
```

Update the following variables:

```env
# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Google OAuth Configuration
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-firebase-auth-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-firebase-storage-bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-firebase-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-firebase-app-id

# Firebase Admin Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-firebase-client-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-firebase-private-key\n-----END PRIVATE KEY-----\n"
```

### 4. Running the Application

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the development server:

   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000)

## Authentication Flow

1. User visits the application and is redirected to `/login`
2. User clicks "Continue with Google"
3. User is redirected to Google OAuth consent screen
4. After authorization, user is redirected back to `/api/auth/callback`
5. The callback exchanges the code for tokens
6. Refresh token is stored in Firestore
7. User is redirected to `/dashboard`

## Data Structure in Firestore

Users are stored in the `users` collection with email as document ID:

```typescript
{
  email: string;
  name: string | null;
  picture: string | null;
  googleId: string;
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
  sessionToken: string;
  createdAt: string;
  updatedAt: string;
}
```

## API Endpoints

- `GET /api/auth/authorize` - Initiates OAuth flow
- `GET /api/auth/callback` - Handles OAuth callback
- `GET /api/auth/session` - Returns current user session
- `POST /api/auth/logout` - Logs out the user
- `GET /api/calendar/events` - Fetches calendar events
- `POST /api/calendar/events` - Creates a calendar event

## Security Considerations

1. All tokens are stored server-side in Firestore
2. Session tokens are stored as httpOnly cookies
3. CSRF protection using state parameter
4. Automatic token refresh for expired access tokens
5. Protected routes using Next.js middleware

## Production Deployment

For production deployment:

1. Update `NEXT_PUBLIC_APP_URL` to your production URL
2. Add production redirect URI in Google Console
3. Use environment variables from your hosting provider
4. Ensure HTTPS is enabled
5. Set secure cookie options in production
