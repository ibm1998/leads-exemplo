// src/ingestion/gmail/client.ts

import { google, gmail_v1 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { logger } from "../../utils/logger";
import { RawLeadData } from "../../ingestion/types";

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
}

export interface GmailMessage extends gmail_v1.Schema$Message {
  id: string;
  threadId: string;
  snippet: string;
  payload: gmail_v1.Schema$MessagePart;
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
  private gmail: gmail_v1.Gmail;

  constructor(oauth2Client: OAuth2Client) {
    this.oauth2Client = oauth2Client;
    this.gmail = google.gmail({ version: "v1", auth: this.oauth2Client as any });
  }

  /**
   * Initialize the Gmail client and verify authentication
   */
  async initialize(): Promise<void> {
    try {
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
  async getRecentEmails(options: {
    maxResults?: number;
    query?: string;
    since?: Date;
  } = {}): Promise<ParsedEmail[]> {
    try {
      const { maxResults = 50, query = "is:unread -from:me", since } = options;
      let searchQuery = query;

      if (since) {
        const dateStr = since.toISOString().split("T")[0];
        searchQuery += ` after:${dateStr}`;
      }

      logger.info(`Fetching emails with query: ${searchQuery}`);
      const resp = await this.gmail.users.messages.list({
        userId: "me",
        q: searchQuery,
        maxResults,
      });

      const msgs = resp.data.messages || [];
      logger.info(`Found ${msgs.length} messages`);

      const emails: ParsedEmail[] = [];
      for (const msg of msgs) {
        try {
          const full = await this.gmail.users.messages.get({
            userId: "me",
            id: msg.id!,
            format: "full",
          });
          const parsed = this.parseEmail(full.data as GmailMessage);
          if (parsed && this.isLeadEmail(parsed)) {
            emails.push(parsed);
          }
        } catch (err) {
          logger.warn(`Failed to parse message ${msg.id}:`, err);
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
      const headers = this.extractHeaders(message.payload.headers || []);
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
        receivedAt: new Date(+message.internalDate),
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
  private extractHeaders(
    headers: gmail_v1.Schema$MessagePartHeader[] = []
  ): Record<string, string> {
    const map: Record<string, string> = {};
    for (const h of headers) {
      map[h.name!.toLowerCase()] = h.value!;
    }
    return map;
  }

  /**
   * Parse the From header to extract name and email
   */
  private parseFromHeader(fromHeader: string): {
    name?: string;
    email: string;
  } {
    const nameEmailMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/);
    if (nameEmailMatch) {
      return {
        name: nameEmailMatch[1].trim().replace(/^["']|["']$/g, ""),
        email: nameEmailMatch[2].trim(),
      };
    }
    const emailOnly = fromHeader.trim();
    return {
      email: emailOnly,
      name: emailOnly.split("@")[0],
    };
  }

 
  private extractBody(part: gmail_v1.Schema$MessagePart): string {
    let text = "";

    if (part.body?.data) {
      text = Buffer.from(part.body.data, "base64").toString("utf-8");
    } else if (part.parts) {
      for (const p of part.parts) {
        if (p.mimeType === "text/plain" && p.body?.data) {
          text += Buffer.from(p.body.data, "base64").toString("utf-8");
        } else if (
          p.mimeType === "text/html" &&
          p.body?.data &&
          !text
        ) {
          const html = Buffer.from(p.body.data, "base64").toString("utf-8");
          text = this.stripHtml(html);
        }
      }
    }

    return text.trim();
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, " ").trim();
  }

  /**
   * Determine if an email is likely to be a lead
   */
  private isLeadEmail(email: ParsedEmail): boolean {
    const content = `${email.subject} ${email.body}`.toLowerCase();
    if (this.isAutomatedEmail(email)) return false;

    const realEstateTerms = [
      "property","house","home","real estate","buy","sell","rent",
      "listing","agent","realtor","mortgage","investment","condo",
      "apartment","commercial","residential","valuation","appraisal",
    ];
    const inquiryTerms = [
      "interested","inquiry","question","help","looking for","need",
      "want","contact","information","quote","price",
    ];

    const hasRE = realEstateTerms.some(t => content.includes(t));
    const hasInquiry = inquiryTerms.some(t => content.includes(t));
    return hasRE || hasInquiry;
  }

  /**
   * Check if email is automated (newsletters, notifications, etc.)
   */
  private isAutomatedEmail(email: ParsedEmail): boolean {
    const from = email.from.email.toLowerCase();
    const subj = email.subject.toLowerCase();
    const patterns = [
      "noreply","no-reply","donotreply","notification","newsletter",
      "alert","marketing","support","system","admin","automated",
    ];

    const autoFrom = patterns.some(p => from.includes(p));
    const autoSubj =
      subj.includes("unsubscribe") ||
      subj.includes("newsletter") ||
      subj.includes("notification");

    return autoFrom || autoSubj;
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
        requestBody: { removeLabelIds: ["UNREAD"] },
      });
      logger.debug(`Marked message ${messageId} as read`);
    } catch (error) {
      logger.warn(`Failed to mark message ${messageId} as read:`, error);
    }
  }

  /**
   * Add a label to an email, creating it if necessary
   */
  async addLabel(messageId: string, labelName: string): Promise<void> {
    try {
      // fetch existing labels
      const { data } = await this.gmail.users.labels.list({ userId: "me" });
      let label = data.labels?.find(l => l.name === labelName);

      // create label if not exists
      if (!label) {
        const created = await this.gmail.users.labels.create({
          userId: "me",
          requestBody: {
            name: labelName,
            labelListVisibility: "labelShow",
            messageListVisibility: "show",
          },
        });
        label = created.data;
        logger.debug(`Created new label "${labelName}" (${label.id})`);
      }

      

      // Add the label to the message
      // Explicitly type params for type safety
      const params: gmail_v1.Params$Resource$Users$Messages$Modify = {
        userId: "me",
        id: String(messageId),
        requestBody: {
          addLabelIds: [label.id!], // non-null assertion for id
        },
      };
      await this.gmail.users.messages.modify(params);
    } catch (error) {
      logger.warn(
        `Failed to add label ${labelName} to message ${messageId}:`,
        error
      );
    }
  }
}
