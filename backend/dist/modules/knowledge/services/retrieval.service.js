"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetrievalService = void 0;
const groq_service_1 = require("../../ai/groq.service");
const search_service_1 = require("./search.service");
const knowledge_db_service_1 = require("../knowledge.db.service");
const logger_1 = require("../../../config/logger");
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
    const messages = contextText.split(/---\s*Message from/);
    if (messages.length <= 1)
        return contextText;
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
class RetrievalService {
    groqService;
    searchService;
    dbService;
    constructor() {
        this.groqService = new groq_service_1.GroqService();
        this.searchService = new search_service_1.SearchService();
        this.dbService = new knowledge_db_service_1.KnowledgeDbService();
    }
    async retrieveForDraft(userId, contextText) {
        // console.time(`Knowledge-Retrieval-${userId}`);
        try {
            const latestBody = extractLatestEmailBody(contextText);
            if (this.isCasualEmail(latestBody)) {
                logger_1.logger.debug({ userId }, 'Knowledge retrieval skipped: deterministic heuristic matched casual email');
                return null;
            }
            // console.log(`\n[INFO] [RAG] Evaluating need for external knowledge retrieval...`);
            const decision = await this.makeRetrievalDecision(contextText);
            if (!decision.shouldRetrieve || decision.confidence < 0.5) {
                // console.log(`[INFO] [RAG] Decision: SKIPPED (Confidence: ${(decision.confidence * 100).toFixed(0)}%) - No knowledge required`);
                logger_1.logger.debug({ userId, confidence: decision.confidence, shouldRetrieve: decision.shouldRetrieve }, 'Knowledge retrieval skipped: AI decision');
                return null;
            }
            // console.log(`[INFO] [RAG] Decision: SEARCH INITIATED (Confidence: ${(decision.confidence * 100).toFixed(0)}%)`);
            // console.log(`[INFO] [RAG] Generated Search Query: "${decision.searchQuery}"`);
            const chunks = await this.searchService.search(userId, decision.searchQuery, 20);
            if (chunks.length === 0) {
                // console.log(`[WARN] [RAG] Vector Search returned 0 relevant documents.`);
                logger_1.logger.debug({ userId, query: decision.searchQuery }, 'Knowledge retrieval: no relevant chunks found');
                return null;
            }
            // console.log(`[INFO] [RAG] Vector Search returned ${chunks.length} highly relevant chunks.`);
            // console.log(`[INFO] [RAG] Top result snippet: "${chunks[0].content.substring(0, 100)}..." (Score: ${chunks[0].similarity.toFixed(2)})`);
            const formattedContext = this.buildContext(chunks);
            if (!formattedContext) {
                return null;
            }
            // console.log(`[INFO] [RAG] Context window successfully constructed.`);
            const documentIds = [...new Set(chunks.map(c => c.documentId))];
            for (const docId of documentIds) {
                await this.dbService.incrementRetrievalCount(docId).catch(err => {
                    logger_1.logger.warn({ err, docId }, 'Failed to increment retrieval count');
                });
            }
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
            // console.timeEnd(`Knowledge-Retrieval-${userId}`);
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
    async makeRetrievalDecision(contextText) {
        const prompt = `You are classifying whether an email requires external knowledge to answer.

External knowledge means: resume, portfolio, pricing, company info, policies, product details, documentation, contracts, services, project details, or any factual information the user may have uploaded.

Simple conversational emails (greetings, thanks, small talk, scheduling confirmations, meeting logistics) do NOT need external knowledge.

Return EXACTLY this JSON and absolutely nothing else:
{
  "shouldRetrieve": true or false,
  "searchQuery": "what to search for in user's documents",
  "confidence": 0.0 to 1.0
}

Email context:
${contextText.substring(0, 4000)}`;
        try {
            const completion = await this.groqService.rawCompletion(prompt);
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
        for (const chunk of chunks) {
            const docLabel = `[Document: ${chunk.documentTitle}${chunk.documentVersion > 1 ? ` (v${chunk.documentVersion})` : ''}]`;
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
