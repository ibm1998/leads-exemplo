import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { logger } from "../../utils/logger";
import { RawLeadData } from "../../ingestion/types";

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload: any;
  internalDate: string;
}

export interface ParsedEmail {
  messageId: string;
  threadId: string;
  from: {
    name?: string;
    email: string;
  };
  subject: string;
  body: string;
  snippet: string;
  receivedAt: Date;
  headers: Record<string, string>;
}

/**
 * Gmail API client for lead capture from emails
 */
export class GmailClient {
  private oauth2Client: OAuth2Client;
  private gmail: any;

  constructor(private config: GmailConfig) {
    this.oauth2Client = new OAuth2Client(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );

    this.oauth2Client.setCredentials({
      refresh_token: config.refreshToken,
    });

    this.gmail = google.gmail({ version: "v1", auth: this.oauth2Client });
  }

  /**
   * Initialize the Gmail client and verify authentication
   */
  async initialize(): Promise<void> {
    try {
      // Test the connection by getting user profile
      const profile = await this.gmail.users.getProfile({ userId: "me" });
      logger.info(`Gmail client initialized for ${profile.data.emailAddress}`);
    } catch (error) {
      logger.error("Gmail client initialization failed:", error);
      throw new Error(`Failed to initialize Gmail client: ${error}`);
    }
  }

  /**
   * Get recent emails that might contain leads
   */
  async getRecentEmails(
    options: {
      maxResults?: number;
      query?: string;
      since?: Date;
    } = {}
  ): Promise<ParsedEmail[]> {
    try {
      const { maxResults = 50, query = "is:unread -from:me", since } = options;

      let searchQuery = query;

      // Add date filter if specified
      if (since) {
        const dateStr = since.toISOString().split("T")[0].replace(/-/g, "/");
        searchQuery += ` after:${dateStr}`;
      }

      logger.info(`Fetching emails with query: ${searchQuery}`);

      // Search for messages
      const response = await this.gmail.users.messages.list({
        userId: "me",
        q: searchQuery,
        maxResults,
      });

      const messages = response.data.messages || [];
      logger.info(`Found ${messages.length} messages`);

      // Get full message details
      const emails: ParsedEmail[] = [];
      for (const message of messages) {
        try {
          const fullMessage = await this.gmail.users.messages.get({
            userId: "me",
            id: message.id,
            format: "full",
          });

          const parsedEmail = this.parseEmail(fullMessage.data);
          if (parsedEmail && this.isLeadEmail(parsedEmail)) {
            emails.push(parsedEmail);
          }
        } catch (error) {
          logger.warn(`Failed to parse message ${message.id}:`, error);
        }
      }

      logger.info(`Parsed ${emails.length} potential lead emails`);
      return emails;
    } catch (error) {
      logger.error("Failed to get recent emails:", error);
      throw new Error(`Failed to fetch emails: ${error}`);
    }
  }

  /**
   * Parse Gmail message into structured email data
   */
  private parseEmail(message: GmailMessage): ParsedEmail | null {
    try {
      const headers = this.extractHeaders(message.payload.headers);
      const from = this.parseFromHeader(headers.from || "");
      const subject = headers.subject || "";
      const body = this.extractBody(message.payload);

      return {
        messageId: message.id,
        threadId: message.threadId,
        from,
        subject,
        body,
        snippet: message.snippet,
        receivedAt: new Date(parseInt(message.internalDate)),
        headers,
      };
    } catch (error) {
      logger.warn("Failed to parse email:", error);
      return null;
    }
  }

  /**
   * Extract headers from Gmail message
   */
  private extractHeaders(headers: any[]): Record<string, string> {
    const headerMap: Record<string, string> = {};

    for (const header of headers || []) {
      headerMap[header.name.toLowerCase()] = header.value;
    }

    return headerMap;
  }

  /**
   * Parse the From header to extract name and email
   */
  private parseFromHeader(fromHeader: string): {
    name?: string;
    email: string;
  } {
    // Handle formats like "John Doe <john@example.com>" or "john@example.com"
    const match =
      fromHeader.match(/^(.+?)\s*<(.+?)>$/) || fromHeader.match(/^(.+)$/);

    if (match && match[2]) {
      // Format: "Name <email>"
      return {
        name: match[1].trim().replace(/^["']|["']$/g, ""), // Remove quotes
        email: match[2].trim(),
      };
    } else if (match && match[1]) {
      // Format: "email" only
      const email = match[1].trim();
      return {
        email,
        name: email.split("@")[0], // Use part before @ as name
      };
    }

    return { email: fromHeader };
  }

  /**
   * Extract email body from Gmail message payload
   */
  private extractBody(payload: any): string {
    let body = "";

    if (payload.body && payload.body.data) {
      // Simple text body
      body = Buffer.from(payload.body.data, "base64").toString("utf-8");
    } else if (payload.parts) {
      // Multipart message
      for (const part of payload.parts) {
        if (part.mimeType === "text/plain" && part.body && part.body.data) {
          body += Buffer.from(part.body.data, "base64").toString("utf-8");
        } else if (
          part.mimeType === "text/html" &&
          part.body &&
          part.body.data &&
          !body
        ) {
          // Use HTML as fallback if no plain text
          const htmlBody = Buffer.from(part.body.data, "base64").toString(
            "utf-8"
          );
          body = this.stripHtml(htmlBody);
        }
      }
    }

    return body.trim();
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, "")
      .replace(/&[^;]+;/g, " ")
      .trim();
  }

  /**
   * Determine if an email is likely to be a lead
   */
  private isLeadEmail(email: ParsedEmail): boolean {
    const text = `${email.subject} ${email.body}`.toLowerCase();

    // Skip automated emails
    if (this.isAutomatedEmail(email)) {
      return false;
    }

    // Look for real estate related keywords
    const realEstateKeywords = [
      "property",
      "house",
      "home",
      "real estate",
      "buy",
      "sell",
      "rent",
      "listing",
      "agent",
      "realtor",
      "mortgage",
      "investment",
      "condo",
      "apartment",
      "commercial",
      "residential",
      "valuation",
      "appraisal",
    ];

    // Look for inquiry keywords
    const inquiryKeywords = [
      "interested",
      "inquiry",
      "question",
      "help",
      "looking for",
      "need",
      "want",
      "contact",
      "information",
      "quote",
      "price",
    ];

    const hasRealEstateKeywords = realEstateKeywords.some((keyword) =>
      text.includes(keyword)
    );

    const hasInquiryKeywords = inquiryKeywords.some((keyword) =>
      text.includes(keyword)
    );

    // Consider it a lead if it has real estate keywords OR inquiry keywords
    return hasRealEstateKeywords || hasInquiryKeywords;
  }

  /**
   * Check if email is automated (newsletters, notifications, etc.)
   */
  private isAutomatedEmail(email: ParsedEmail): boolean {
    const fromEmail = email.from.email.toLowerCase();
    const subject = email.subject.toLowerCase();

    // Common automated email patterns
    const automatedPatterns = [
      "noreply",
      "no-reply",
      "donotreply",
      "do-not-reply",
      "notification",
      "alert",
      "newsletter",
      "marketing",
      "support",
      "help",
      "system",
      "admin",
      "automated",
    ];

    const isAutomatedFrom = automatedPatterns.some((pattern) =>
      fromEmail.includes(pattern)
    );

    const isAutomatedSubject =
      subject.includes("unsubscribe") ||
      subject.includes("newsletter") ||
      subject.includes("notification");

    return isAutomatedFrom || isAutomatedSubject;
  }

  /**
   * Convert parsed email to raw lead data
   */
  emailToRawLeadData(email: ParsedEmail): RawLeadData {
    return {
      source: "gmail",
      sourceId: email.messageId,
      rawData: {
        messageId: email.messageId,
        threadId: email.threadId,
        from: email.from,
        subject: email.subject,
        body: email.body,
        snippet: email.snippet,
        receivedAt: email.receivedAt,
        headers: email.headers,
      },
      timestamp: email.receivedAt,
    };
  }

  /**
   * Mark email as read
   */
  async markAsRead(messageId: string): Promise<void> {
    try {
      await this.gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          removeLabelIds: ["UNREAD"],
        },
      });
    } catch (error) {
      logger.warn(`Failed to mark message ${messageId} as read:`, error);
    }
  }

  /**
   * Add label to email
   */
  async addLabel(messageId: string, labelName: string): Promise<void> {
    try {
      // First, get or create the label
      const labels = await this.gmail.users.labels.list({ userId: "me" });
      let labelId = labels.data.labels?.find(
        (l: any) => l.name === labelName
      )?.id;

      if (!labelId) {
        // Create the label if it doesn't exist
        const newLabel = await this.gmail.users.labels.create({
          userId: "me",
          requestBody: {
            name: labelName,
            labelListVisibility: "labelShow",
            messageListVisibility: "show",
          },
        });
        labelId = newLabel.data.id;
      }

      // Add the label to the message
      await this.gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          addLabelIds: [labelId],
        },
      });
    } catch (error) {
      logger.warn(
        `Failed to add label ${labelName} to message ${messageId}:`,
        error
      );
    }
  }
}
