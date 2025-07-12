import { MailSlurp } from 'mailslurp-client';

// Fallback inbox ID for when creation fails
const FALLBACK_INBOX_ID = '646c0933-0fdf-49dd-bc04-53514b1f0b2d';

// Email response interface
interface EmailResponse {
  id: string;
  subject: string;
  from: string;
  body: string;
  createdAt: string;
}

export class MailSlurpService {
  private mailslurp: MailSlurp;

  constructor() {
    const apiKey = process.env.MAILSLURP_API_KEY;
    if (!apiKey) {
      throw new Error('MailSlurp API key not configured');
    }
    this.mailslurp = new MailSlurp({ apiKey });
  }

  /**
   * Creates a new MailSlurp inbox for a user
   * @param customEmail - The custom email prefix (e.g., "my-meetings")
   * @returns Promise containing inbox data or null if creation fails
   */
  async createInbox(customEmail: string): Promise<{
    inboxId: string;
    mailslurpEmail: string;
  } | null> {
    try {
      // Create a new inbox with the custom email
      const inbox = await this.mailslurp.inboxController.createInbox({
        allowTeamAccess: false,
        description: `Inbox for ${customEmail}`,
        name: customEmail,
        // Use custom email if provided, otherwise let MailSlurp generate one
        ...(customEmail && { prefix: customEmail }),
      });

      if (!inbox.id || !inbox.emailAddress) {
        console.error('MailSlurp inbox creation failed: missing id or email');
        return null;
      }

      return {
        inboxId: inbox.id,
        mailslurpEmail: inbox.emailAddress,
      };
    } catch (error) {
      console.error('Error creating MailSlurp inbox:', error);
      return null;
    }
  }

  /**
   * Gets the fallback inbox configuration
   * @param customEmail - The custom email prefix to use with fallback
   * @returns Fallback inbox configuration
   */
  getFallbackInbox(customEmail: string): {
    inboxId: string;
    mailslurpEmail: string;
  } {
    return {
      inboxId: FALLBACK_INBOX_ID,
      mailslurpEmail: `${customEmail}@mailslurp.io`,
    };
  }

  /**
   * Fetches emails from a specific inbox
   * @param inboxId - The inbox ID to fetch emails from
   * @returns Promise containing email data
   */
  async fetchEmails(inboxId: string): Promise<EmailResponse[]> {
    try {
      const emails = await this.mailslurp.emailController.getEmailsPaginated({
        inboxId: [inboxId],
        unreadOnly: false,
      });

      // Get full email content for each email
      const emailContents = await Promise.all(
        emails.content?.map(async (email) => {
          const fullEmail = await this.mailslurp.emailController.getEmail({
            emailId: email.id!,
          });
          return {
            id: fullEmail.id!,
            subject: fullEmail.subject || '',
            from: fullEmail.from || '',
            body: fullEmail.body || '',
            createdAt:
              fullEmail.createdAt?.toISOString() || new Date().toISOString(),
          };
        }) || []
      );

      return emailContents;
    } catch (error) {
      console.error('Error fetching emails from inbox:', inboxId, error);
      throw error;
    }
  }

  /**
   * Gets a specific email by ID
   * @param emailId - The email ID to fetch
   * @returns Promise containing email data
   */
  async getEmail(emailId: string): Promise<EmailResponse> {
    try {
      const email = await this.mailslurp.emailController.getEmail({
        emailId,
      });
      return {
        id: email.id!,
        subject: email.subject || '',
        from: email.from || '',
        body: email.body || '',
        createdAt: email.createdAt?.toISOString() || new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching email:', emailId, error);
      throw error;
    }
  }

  /**
   * Validates if a custom email format is valid
   * @param customEmail - The custom email to validate
   * @returns boolean indicating if the email format is valid
   */
  static validateCustomEmail(customEmail: string): boolean {
    // Allow alphanumeric characters, dots, underscores, and hyphens
    const validPattern = /^[a-zA-Z0-9._-]+$/;
    return validPattern.test(customEmail) && customEmail.length > 0;
  }
}
