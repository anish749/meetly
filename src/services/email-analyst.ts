import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

// Email Analyst AI Service for preprocessing emails before Stina AI Agent

/**
 * JSON Schema interfaces for Email Analyst output
 */
export interface EmailAnalysisResult {
  initiator: {
    name: string;
    email: string;
  };
  invitees: Array<{
    name?: string;
    email: string;
    relationship?: string;
    work_context?: string;
  }>;
  meeting_intent: string;
  requested_timeframe?: string;
  duration_minutes?: number | null;
  location_hint?: string | null;
  other_notes?: string | null;
}

export interface EmailContext {
  id: string;
  subject: string;
  from: string;
  body: string;
  createdAt: string;
}

export class EmailAnalyst {
  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
  }

  /**
   * System prompt for the Email Analyst AI
   */
  private getSystemPrompt(): string {
    return `You are Email-Analyst.

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
  }

  /**
   * Define the Zod schema for email analysis
   */
  private getEmailAnalysisSchema() {
    return z.object({
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
  }

  /**
   * Analyze an email to extract meeting scheduling information
   */
  async analyzeEmail(email: EmailContext): Promise<EmailAnalysisResult> {
    try {
      const emailContent = `
Subject: ${email.subject}
From: ${email.from}
Date: ${email.createdAt}

${email.body}
      `.trim();

      const result = await generateObject({
        model: anthropic('claude-3-5-sonnet-20241022'),
        system: this.getSystemPrompt(),
        prompt: emailContent,
        schema: this.getEmailAnalysisSchema(),
      });

      return result.object as EmailAnalysisResult;
    } catch (error) {
      console.error('Email analysis failed:', error);
      throw new Error(
        `Email analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
