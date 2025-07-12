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
      relationship: z.string().optional(),
      work_context: z.string().optional(),
    })
  ),
  meeting_intent: z.string(),
  requested_timeframe: z.string().optional(),
  duration_minutes: z.number().nullable().optional(),
  location_hint: z.string().nullable().optional(),
  other_notes: z.string().nullable().optional(),
});

// System prompt for Email Analyst
const EMAIL_ANALYST_SYSTEM_PROMPT = `You are Email-Analyst.

Task: read the email thread below and extract structured facts needed
for scheduling a meeting.  Produce ONLY valid JSON matching the schema
provided.  Do not output explanations or prose.

Guidelines
• "Initiator" = the person who first asked to meet (usually the Stina
  user).  If unclear, assume the Stina user.
• "Invitees" = everyone the initiator wants to meet (exclude Stina).
• Time phrases: capture as-written ("next Tuesday afternoon"),
  no date maths.
• Location: capture any hints (preferred café, postcode, "virtual").

Schema:
{
  "type": "object",
  "properties": {
    "initiator": {            // Who asked for the meeting
      "name":  { "type":"string" },
      "email": { "type":"string","format":"email" }
    },
    "invitees": {             // Array in case of >1 person
      "type":"array",
      "items":{
        "type":"object",
        "properties":{
          "name":  { "type":"string" },
          "email": { "type":"string","format":"email" },
           "relationship": { "type":"string" },
            "work_context": { "type": "string" } // title and workplace if exists
        },
        "required":["email"]
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
    }
  },
  "required": ["initiator","invitees"]
}`;

export class EmailAnalystService {
  private model = anthropic('claude-3-5-sonnet-20241022');

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

Stina user email: ${userEmail}

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
