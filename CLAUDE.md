# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Meetly is a Next.js 15 meeting scheduling application with Google Calendar integration, built using TypeScript and the App Router architecture.

## Essential Commands

```bash
# Development
npm run dev          # Start development server with Turbopack

# Building and Production
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
npm run format:check # Check code formatting without changes
```

## Architecture Overview

### Authentication Flow

1. User authentication via Google OAuth 2.0 with calendar permissions
2. Session tokens stored in HTTP-only cookies (30-day expiration)
3. User data and OAuth tokens persisted in Firestore
4. Automatic token refresh with 5-minute buffer before expiry
5. Route protection via Next.js middleware (src/middleware.ts)

### Core Services

- **AuthService** (src/services/auth-service.ts): Handles authentication, sessions, and token management
- **GoogleCalendarService** (src/services/google-calendar-service.ts): Encapsulates all Google Calendar API operations

### Data Storage

- Firebase/Firestore for all persistence (no SQL database)
- User documents indexed by email
- Schema includes user profile, OAuth tokens, and session data

### API Structure

- RESTful API routes under `/api/`
- Protected routes require valid session cookie
- Consistent error handling and JSON responses
- Key endpoints:
  - `/api/auth/*` - Authentication flow
  - `/api/calendar/*` - Calendar operations
  - `/api/preferences/*` - User preferences
  - `/api/mailslurp/*` - Email integration

### UI Components

- Shadcn/ui components with "new-york" style
- Tailwind CSS v4 for styling
- React Hook Form + Zod for form validation
- Framer Motion for animations
- Sonner for toast notifications

### Security Implementation

- CSRF protection via state parameter in OAuth flow
- HTTP-only cookies with Secure and SameSite attributes
- Server-side token storage (no client-side tokens)
- Protected routes enforced at edge via middleware

## Key Development Patterns

### Adding New API Routes

1. Create route handler in `src/app/api/`
2. Always validate session with `AuthService.getCurrentUser()`
3. Return 401 for unauthorized requests
4. Use try-catch for error handling

### Working with Google Calendar

```typescript
const calendarService = new GoogleCalendarService(userEmail);
// Service handles token refresh automatically
const events = await calendarService.listEvents(calendarId);
```

### Environment Variables Required

- Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Firebase: `FIREBASE_SERVICE_ACCOUNT` (base64 encoded)
- URLs: `NEXT_PUBLIC_BASE_URL`, `MAILSLURP_API_BASE_URL`
- MailSlurp: `MAILSLURP_API_KEY`

## Code Style

- TypeScript strict mode enabled
- Path alias `@/*` maps to `./src/*`
- Prettier: single quotes, semicolons, 80-char lines
- Pre-commit hooks via Husky run formatting

## Testing Strategy

Currently no test framework is configured. When implementing tests, check for testing setup in package.json first.
