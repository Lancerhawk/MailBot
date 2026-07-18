"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetrievalService = void 0;
const groq_service_1 = require("../../ai/groq.service");
const search_service_1 = require("./search.service");
const metadata_search_service_1 = require("./metadata-search.service");
const knowledge_db_service_1 = require("../knowledge.db.service");
const logger_1 = require("../../../config/logger");
const analytics_event_service_1 = require("../../analytics/services/analytics-event.service");
const prisma_1 = require("../../../lib/prisma");
const CASUAL_PATTERNS = [
    /^(thanks|thank you|thx|ty|thankyou)[.!\s]*$/i,
    /^(hi|hello|hey|howdy|greetings)[.!\s,]*$/i,
    /^(good\s*(morning|afternoon|evening|night|day))[.!\s,]*$/i,
    /^(ok|okay|sure|sounds good|got it|noted|acknowledged|roger)[.!\s]*$/i,
    /^(meeting\s*(accepted|declined|tentative))[.!\s]*$/i,
    /^(see you|talk soon|take care|best|regards|cheers|warm regards|kind regards)[.!\s]*$/i,
    /^(happy\s*(birthday|holidays|new year|anniversary))[.!\s!]*$/i,
    /^(congratulations|congrats)[.!\s!]*$/i,
    /^(welcome|you're welcome|no problem|np|no worries)[.!\s]*$/i,
    /^(bye|goodbye|cya|later|ttyl)[.!\s]*$/i,
];
const MAX_KNOWLEDGE_TOKENS = 3000;
function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}
function extractLatestEmailBody(contextText) {
    const cleanContext = contextText.replace(/---\s*Contact Context\s*---[\s\S]*?-----------------------[\r\n]*/gi, '').trim();
    const messages = cleanContext.split(/---\s*Message from/);
    if (messages.length <= 1)
        return cleanContext;
    const lastMessage = messages[messages.length - 1];
    const lines = lastMessage.split('\n');
    const bodyStart = lines.findIndex(l => !l.startsWith('To:') &&
        !l.startsWith('Cc:') &&
        !l.startsWith('Subject:') &&
        !l.startsWith('---') &&
        l.trim().length > 0 &&
        !/^\s/.test(l.substring(0, 1)));
    if (bodyStart > 0) {
        return lines.slice(bodyStart).join('\n').trim();
    }
    return lastMessage.trim();
}
function prepareSearchQuery(contextText) {
    const latestBody = extractLatestEmailBody(contextText);
    const query = latestBody
        .replace(/^(hi|hello|hey|dear|greetings).*?[\r\n]+/i, '')
        .replace(/(thanks|thank you|best|regards|cheers|sincerely).*?$/is, '')
        .replace(/<[^>]*>?/gm, '')
        .replace(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi, '')
        .replace(/\b(i wanted to ask|can you tell me|do you know|please|kindly|let me know|just wondering|could you|what is|which|tell me|are you|do you have|had a quick question|i was reviewing|looking through)\b/gi, ' ')
        .replace(/[^\w\s-?]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return query || latestBody;
}
class RetrievalService {
    groqService;
    searchService;
    metadataService;
    dbService;
    constructor() {
        this.groqService = new groq_service_1.GroqService();
        this.searchService = new search_service_1.SearchService();
        this.metadataService = new metadata_search_service_1.MetadataSearchService();
        this.dbService = new knowledge_db_service_1.KnowledgeDbService();
    }
    async retrieveForDraft(userId, contextText) {
        try {
            const latestBody = extractLatestEmailBody(contextText);
            if (this.isCasualEmail(latestBody)) {
                logger_1.logger.debug({ userId }, 'Knowledge retrieval skipped: deterministic heuristic matched casual email');
                return null;
            }
            const searchQuery = prepareSearchQuery(contextText);
            const metadataResults = await this.metadataService.searchDocuments(userId, searchQuery);
            const bestMetadataMatch = metadataResults.length > 0 ? metadataResults[0] : null;
            const threshold = parseFloat(process.env.METADATA_CONFIDENCE_THRESHOLD || '0.3');
            let decision;
            if (bestMetadataMatch && bestMetadataMatch.score >= threshold) {
                decision = {
                    shouldRetrieve: true,
                    searchQuery: searchQuery,
                    confidence: 1.0,
                };
            }
            else {
                let candidateDocsInfo = '';
                if (metadataResults.length > 0) {
                    const docIds = metadataResults.map(r => r.id);
                    const docs = await prisma_1.prisma.knowledgeBaseDocument.findMany({
                        where: { id: { in: docIds } },
                        select: { id: true, title: true, description: true, originalFileName: true }
                    });
                    const docsMap = new Map(docs.map(d => [d.id, d]));
                    const orderedDocs = docIds.map(id => docsMap.get(id)).filter(Boolean);
                    candidateDocsInfo = orderedDocs.map(d => `- Title/Filename: ${d.title || d.originalFileName}\n  Description: ${d.description || 'No description available'}`).join('\n\n');
                }
                decision = await this.makeRetrievalDecision(userId, contextText, candidateDocsInfo);
            }
            if (!decision.shouldRetrieve || decision.confidence < 0.5) {
                return null;
            }
            const chunks = await this.searchService.search(userId, decision.searchQuery, 20);
            if (chunks.length === 0) {
                logger_1.logger.debug({ userId, query: decision.searchQuery }, 'Knowledge retrieval: no relevant chunks found');
                return null;
            }
            const formattedContext = this.buildContext(chunks);
            if (!formattedContext) {
                return null;
            }
            const documentIds = [...new Set(chunks.map(c => c.documentId))];
            for (const docId of documentIds) {
                await this.dbService.incrementRetrievalCount(docId).catch(err => {
                    logger_1.logger.warn({ err, docId }, 'Failed to increment retrieval count');
                });
            }
            analytics_event_service_1.AnalyticsEventService.recordEvent(userId, analytics_event_service_1.AnalyticsEventType.KNOWLEDGE_RETRIEVAL);
            logger_1.logger.info({
                userId,
                chunksUsed: chunks.length,
                documentsUsed: documentIds.length,
                query: decision.searchQuery,
                confidence: decision.confidence,
            }, 'Knowledge retrieval completed');
            return { formattedContext, chunks, decision };
        }
        finally {
        }
    }
    clearCacheForUser(userId) {
        this.searchService.clearCacheForUser(userId);
    }
    isCasualEmail(body) {
        const trimmed = body.trim();
        if (trimmed.length < 5)
            return true;
        const lines = trimmed.split('\n').filter(l => l.trim().length > 0);
        const meaningful = lines.filter(l => !l.startsWith('--') && !l.startsWith('Sent from'));
        if (meaningful.length === 0)
            return true;
        if (meaningful.length > 3)
            return false;
        const coreText = meaningful.join(' ').trim();
        for (const pattern of CASUAL_PATTERNS) {
            if (pattern.test(coreText))
                return true;
        }
        if (coreText.length < 30 && !/\?/.test(coreText))
            return true;
        return false;
    }
    async makeRetrievalDecision(userId, contextText, candidateDocsInfo) {
        const docsContext = candidateDocsInfo
            ? `The user's knowledge base contains the following candidate documents:\n${candidateDocsInfo}\n\nCRITICAL: The metadata search has already identified these documents as semantically relevant to the user's question. You should STRONGLY favor retrieval. Only return shouldRetrieve=false if you are absolutely confident the matched documents are completely unrelated.`
            : `The user has uploaded documents to their knowledge base. If the email asks a factual question, set shouldRetrieve to true.`;
        const prompt = `You are classifying whether an incoming email requires external knowledge (documents, resume, notes) to draft a response.

RULES:
1. If the email is purely casual (simple greetings, "thanks", scheduling a meeting, small talk), set shouldRetrieve to false.
2. If the email sounds professional, asks about the user's background, requests specific data, asks for past experience/clients, or requires any factual information to answer properly, you MUST set shouldRetrieve to true.
3. When shouldRetrieve is true, provide a highly optimized searchQuery containing the core keywords needed to find the answer in a vector database.

${docsContext}

Return EXACTLY this JSON and absolutely nothing else:
{
  "shouldRetrieve": true or false,
  "searchQuery": "what to search for in user's documents",
  "confidence": 0.0 to 1.0
}

Email context:
${contextText.substring(0, 4000)}`;
        try {
            const completion = await this.groqService.rawCompletion(userId, prompt);
            const parsed = JSON.parse(completion);
            return {
                shouldRetrieve: Boolean(parsed.shouldRetrieve),
                searchQuery: String(parsed.searchQuery || ''),
                confidence: Number(parsed.confidence) || 0,
            };
        }
        catch (error) {
            logger_1.logger.warn({ error }, 'Failed to parse retrieval decision, defaulting to no retrieval');
            return { shouldRetrieve: false, searchQuery: '', confidence: 0 };
        }
    }
    buildContext(chunks) {
        const header = '--------------------------------\nRelevant Knowledge from User\'s Documents\n--------------------------------\n';
        const footer = '\n--------------------------------';
        let currentTokens = estimateTokens(header) + estimateTokens(footer);
        const sections = [];
        const now = Date.now();
        for (const chunk of chunks) {
            const ageDays = Math.floor((now - chunk.documentCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
            const ageStr = ageDays === 0 ? 'Uploaded today' : `Uploaded ${ageDays} days ago`;
            const docLabel = `[Document: ${chunk.documentTitle}${chunk.documentVersion > 1 ? ` (v${chunk.documentVersion})` : ''} | ${ageStr}]`;
            const chunkText = `${docLabel}\n${chunk.content}\n`;
            const chunkTokens = estimateTokens(chunkText);
            if (currentTokens + chunkTokens > MAX_KNOWLEDGE_TOKENS) {
                break;
            }
            sections.push(chunkText);
            currentTokens += chunkTokens;
        }
        if (sections.length === 0)
            return null;
        return header + sections.join('\n') + footer;
    }
}
exports.RetrievalService = RetrievalService;
