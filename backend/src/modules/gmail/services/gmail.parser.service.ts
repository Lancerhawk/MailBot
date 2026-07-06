import { gmail_v1 } from "googleapis";

export interface ParsedEmail {
  providerMessageId: string;
  providerThreadId: string;
  historyId?: string;
  internalDate: Date;
  subject: string;
  snippet: string;
  plainBody: string | null;
  htmlBody: string | null;
  headers: {
    messageId: string | null;
    inReplyTo: string | null;
    references: string[];
    replyTo: string | null;
    date: Date;
  };
  participants: {
    role: "SENDER" | "TO" | "CC" | "BCC";
    email: string;
    name: string | null;
  }[];
  attachments: {
    filename: string;
    mimeType: string;
    attachmentId: string;
    size: number;
  }[];
  labels: string[];
}

export class GmailParserService {
  parseMessage(message: gmail_v1.Schema$Message): ParsedEmail {
    const payload = message.payload;
    const headers = this.parseHeaders(payload?.headers || []);

    const { plainBody, htmlBody, attachments } = this.parseParts(payload);

    return {
      providerMessageId: message.id!,
      providerThreadId: message.threadId!,
      historyId: message.historyId ? message.historyId.toString() : undefined,
      internalDate: new Date(parseInt(message.internalDate || "0")),
      subject: headers.subject || "No Subject",
      snippet: message.snippet || "",
      plainBody,
      htmlBody,
      headers: {
        messageId: headers.messageId,
        inReplyTo: headers.inReplyTo,
        references: headers.references,
        replyTo: headers.replyTo,
        date: headers.date || new Date(),
      },
      participants: this.extractParticipants(headers),
      attachments,
      labels: message.labelIds || [],
    };
  }

  private parseHeaders(headers: gmail_v1.Schema$MessagePartHeader[]) {
    const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value;

    const referencesValue = getHeader("References");
    const references = referencesValue ? referencesValue.split(/\s+/).filter(Boolean) : [];

    return {
      subject: getHeader("Subject"),
      from: getHeader("From"),
      to: getHeader("To"),
      cc: getHeader("Cc"),
      bcc: getHeader("Bcc"),
      replyTo: getHeader("Reply-To") || null,
      messageId: getHeader("Message-ID") || null,
      inReplyTo: getHeader("In-Reply-To") || null,
      references,
      date: getHeader("Date") ? new Date(getHeader("Date")!) : null,
    };
  }

  private extractParticipants(parsedHeaders: ReturnType<typeof this.parseHeaders>) {
    const participants: ParsedEmail["participants"] = [];

    const addParticipants = (headerValue: string | null | undefined, role: "SENDER" | "TO" | "CC" | "BCC") => {
      if (!headerValue) return;
      const parts = headerValue.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      for (const part of parts) {
        const cleaned = part.trim();
        if (!cleaned) continue;

        const match = cleaned.match(/^(?:(.*)\s)?<([^>]+)>$/);
        if (match) {
          participants.push({
            role,
            name: match[1] ? match[1].replace(/"/g, "").trim() : null,
            email: match[2].trim().toLowerCase(),
          });
        } else {
          participants.push({
            role,
            name: null,
            email: cleaned.toLowerCase(),
          });
        }
      }
    };

    addParticipants(parsedHeaders.from, "SENDER");
    addParticipants(parsedHeaders.to, "TO");
    addParticipants(parsedHeaders.cc, "CC");
    addParticipants(parsedHeaders.bcc, "BCC");

    return participants;
  }

  private parseParts(payload: gmail_v1.Schema$MessagePart | undefined) {
    let plainBody: string | null = null;
    let htmlBody: string | null = null;
    const attachments: ParsedEmail["attachments"] = [];

    const traverse = (part: gmail_v1.Schema$MessagePart) => {
      if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType || "application/octet-stream",
          attachmentId: part.body!.attachmentId!,
          size: part.body!.size || 0,
        });
      }

      if (part.mimeType === "text/plain" && !part.filename && part.body?.data) {
        plainBody = Buffer.from(part.body!.data!, "base64url").toString("utf8");
      } else if (part.mimeType === "text/html" && !part.filename && part.body?.data) {
        htmlBody = Buffer.from(part.body!.data!, "base64url").toString("utf8");
      }

      if (part.parts) {
        for (const subPart of part.parts) {
          traverse(subPart);
        }
      }
    };

    if (payload) {
      traverse(payload);
    }

    return { plainBody, htmlBody, attachments };
  }
}
