"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GmailParserService = void 0;
class GmailParserService {
    parseMessage(message) {
        const payload = message.payload;
        const headers = this.parseHeaders(payload?.headers || []);
        const { plainBody, htmlBody, attachments } = this.parseParts(payload);
        return {
            providerMessageId: message.id,
            providerThreadId: message.threadId,
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
    parseHeaders(headers) {
        const getHeader = (name) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value;
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
            date: getHeader("Date") ? new Date(getHeader("Date")) : null,
        };
    }
    extractParticipants(parsedHeaders) {
        const participants = [];
        const addParticipants = (headerValue, role) => {
            if (!headerValue)
                return;
            const parts = headerValue.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            for (const part of parts) {
                const cleaned = part.trim();
                if (!cleaned)
                    continue;
                const match = cleaned.match(/^(?:(.*)\s)?<([^>]+)>$/);
                if (match) {
                    participants.push({
                        role,
                        name: match[1] ? match[1].replace(/"/g, "").trim() : null,
                        email: match[2].trim().toLowerCase(),
                    });
                }
                else {
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
    parseParts(payload) {
        let plainBody = null;
        let htmlBody = null;
        const attachments = [];
        const traverse = (part) => {
            if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
                attachments.push({
                    filename: part.filename,
                    mimeType: part.mimeType || "application/octet-stream",
                    attachmentId: part.body.attachmentId,
                    size: part.body.size || 0,
                });
            }
            if (part.mimeType === "text/plain" && !part.filename && part.body?.data) {
                plainBody = Buffer.from(part.body.data, "base64url").toString("utf8");
            }
            else if (part.mimeType === "text/html" && !part.filename && part.body?.data) {
                htmlBody = Buffer.from(part.body.data, "base64url").toString("utf8");
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
exports.GmailParserService = GmailParserService;
