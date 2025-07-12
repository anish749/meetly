import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { EmailAnalystResponse, EmailAnalystError } from '@/types/email-analyst';

// Schema definition for Email Analyst response
const emailAnalystSchema = z.object({
  initiator: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
  invitees: z.array(
    z.object({
      name: z.string().optional(),
      email: z.string().email(),
      role: z.enum(['attendee', 'coordinator']),
      relationship: z.string().optional(),
      work_context: z.string().optional(),
      coordinates_for: z.string().optional(),
    })
  ),
  meeting_intent: z.string(),
  requested_timeframe: z.string().optional(),
  duration_minutes: z.number().nullable().optional(),
  location_hint: z.string().nullable().optional(),
  other_notes: z.string().nullable().optional(),
  confidence: z.enum(['high', 'medium', 'low']),
});

// System prompt for Email Analyst
const EMAIL_ANALYST_SYSTEM_PROMPT = `You are Email-Analyst.

Task: read the email thread below and extract structured facts needed
for scheduling a meeting.  Produce ONLY valid JSON matching the schema
provided.  Do not output explanations or prose.

Guidelines
• "Invitees" = ALL people involved in the meeting process (both attendees and their coordinators).
• CRITICAL: Include both executives/decision-makers AND their assistants/coordinators who help with scheduling.
• CRITICAL: Use "role" field to distinguish between "attendee" (will attend meeting) and "coordinator" (schedules for someone else).
• CRITICAL: Look for phrases like "on behalf of", "assistant to", "scheduling for" to identify coordinators.
• CRITICAL: If someone has a title like "Executive Assistant", "EA", mark their role as "coordinator".
• CRITICAL: Include the actual executive they represent as a separate invitee with role "attendee".
• CRITICAL: NEVER include the current user email (provided below) in the invitees list.
• CRITICAL: NEVER include Stina AI assistant emails (like stina@meetly.com) in the invitees list.
• Time phrases: capture as-written ("next Tuesday afternoon"), no date maths.
• Location: capture any hints (preferred café, postcode, "virtual").

Schema:
{
  "type": "object",
  "properties": {
    "invitees": {             // ALL people involved (attendees and coordinators)
      "type":"array",
      "items":{
        "type":"object",
        "properties":{
          "name":  { "type":"string" },
          "email": { "type":"string","format":"email" },
          "role": { "type":"string","enum":["attendee","coordinator"] },
          "relationship": { "type":"string" },
          "work_context": { "type": "string" }, // title and workplace
          "coordinates_for": { "type": "string" } // if coordinator, who they schedule for
        },
        "required":["email","role"]
      }
    },
    "meeting_intent": {       // free-form description
      "type":"string"
    },
    "requested_timeframe": {  // parsed if any: "next week", "Tue after 3"
      "type":"string"
    },
    "duration_minutes": {
      "type":"integer","nullable":true
    },
    "location_hint": {        // "near EC2A", "virtual", etc.
      "type":"string","nullable":true
    },
    "other_notes": {          // anything else worth surfacing to Stina
      "type":"string","nullable":true
    },
    "confidence": {           // how confident are you in this analysis
      "type":"string","enum":["high","medium","low"]
    }
  },
  "required": ["initiator","invitees","meeting_intent","confidence"]
}`;

export class EmailAnalystService {
  private model = anthropic('claude-sonnet-4-20250514');

  /**
   * Analyzes an email thread and extracts structured meeting information
   * @param emailContent The full email thread content
   * @param userEmail The email of the Stina user for context
   * @returns Structured meeting information or error
   */
  async analyzeEmail(
    emailContent: string,
    userEmail: string
  ): Promise<EmailAnalystResponse | EmailAnalystError> {
    try {
      const prompt = `Email thread for analysis:

${emailContent}

Current user email (DO NOT include in invitees): ${userEmail}

IMPORTANT: Include ALL people involved in the scheduling process:
- Mark executives/decision-makers as role "attendee" 
- Mark assistants/coordinators as role "coordinator"
- If a coordinator schedules for someone, specify who in "coordinates_for" field
- This gives full visibility into who needs to be involved in scheduling

Extract the structured meeting information according to the schema.`;

      const result = await generateObject({
        model: this.model,
        system: EMAIL_ANALYST_SYSTEM_PROMPT,
        prompt,
        schema: emailAnalystSchema,
        maxTokens: 1000,
      });

      return result.object as EmailAnalystResponse;
    } catch (error) {
      console.error('Email analysis failed:', error);
      return {
        error: 'Failed to analyze email',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validates if the email analyst response is successful
   * @param result The result from analyzeEmail
   * @returns True if the result is a successful EmailAnalystResponse
   */
  isSuccessfulResponse(
    result: EmailAnalystResponse | EmailAnalystError
  ): result is EmailAnalystResponse {
    return !('error' in result);
  }
}
