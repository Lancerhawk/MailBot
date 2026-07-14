"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchService = void 0;
const crypto_1 = require("crypto");
const prisma_1 = require("../../../lib/prisma");
const embedding_service_1 = require("./embedding.service");
const logger_1 = require("../../../config/logger");
const CACHE_TTL_MS = 60_000;
class SearchService {
    embeddingService;
    cache = new Map();
    constructor() {
        this.embeddingService = new embedding_service_1.EmbeddingService();
    }
    clearCacheForUser(userId) {
        for (const [key] of this.cache) {
            if (key.startsWith(userId + ':')) {
                this.cache.delete(key);
            }
        }
    }
    getCacheKey(userId, queryText) {
        const queryHash = (0, crypto_1.createHash)('sha256').update(queryText).digest('hex').substring(0, 16);
        return `${userId}:${queryHash}`;
    }
    getCached(cacheKey) {
        const entry = this.cache.get(cacheKey);
        if (!entry)
            return null;
        if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
            this.cache.delete(cacheKey);
            return null;
        }
        return entry.results;
    }
    setCache(cacheKey, results) {
        if (this.cache.size > 500) {
            const now = Date.now();
            for (const [key, entry] of this.cache) {
                if (now - entry.timestamp > CACHE_TTL_MS) {
                    this.cache.delete(key);
                }
            }
        }
        this.cache.set(cacheKey, { results, timestamp: Date.now() });
    }
    async search(userId, queryText, limit = 20) {
        const cacheKey = this.getCacheKey(userId, queryText);
        const cached = this.getCached(cacheKey);
        if (cached) {
            logger_1.logger.info({ userId, cacheHit: true }, 'Knowledge search cache hit');
            return cached;
        }
        // console.time(`Knowledge-Search-${userId}`);
        const queryEmbedding = await this.embeddingService.embedSingleText(queryText);
        const embeddingStr = `[${queryEmbedding.join(',')}]`;
        const rawResults = await prisma_1.prisma.$queryRawUnsafe(`SELECT
        c.id as "chunkId",
        c.content,
        c."chunkIndex",
        c."tokenCount",
        c.heading,
        c.section,
        c."pageNumber",
        c."documentVersion",
        c.metadata,
        d.id as "documentId",
        d.title as "documentTitle",
        d."originalFileName",
        d.version as "documentVersion",
        d.folder,
        d."createdAt" as "documentCreatedAt",
        1 - (c.embedding <=> $2::vector) as similarity
      FROM "KnowledgeBaseChunk" c
      JOIN "KnowledgeBaseDocument" d ON c."documentId" = d.id
      WHERE d."userId" = $1
        AND d."isArchived" = false
        AND d."processingStatus" = 'COMPLETED'
        AND d."deletedAt" IS NULL
        AND (c."deletedAt" IS NULL)
      ORDER BY c.embedding <=> $2::vector ASC
      LIMIT $3`, userId, embeddingStr, limit);
        const searchResults = rawResults.map((r) => ({
            chunkId: r.chunkId,
            documentId: r.documentId,
            documentTitle: r.documentTitle,
            originalFileName: r.originalFileName,
            documentVersion: r.documentVersion,
            folder: r.folder,
            documentCreatedAt: r.documentCreatedAt,
            chunkIndex: r.chunkIndex,
            content: r.content,
            tokenCount: r.tokenCount || 0,
            heading: r.heading,
            section: r.section,
            pageNumber: r.pageNumber,
            documentVersionChunk: r.documentVersion,
            metadata: r.metadata,
            similarity: parseFloat(r.similarity) || 0,
        }));
        const deduplicated = this.deduplicate(searchResults);
        const merged = this.mergeNeighbors(deduplicated);
        const reranked = this.rerank(merged, queryText);
        const topResults = reranked.slice(0, 8);
        // console.timeEnd(`Knowledge-Search-${userId}`);
        logger_1.logger.info({
            userId,
            rawCount: rawResults.length,
            afterDedup: deduplicated.length,
            afterMerge: merged.length,
            finalCount: topResults.length,
        }, 'Knowledge search completed');
        this.setCache(cacheKey, topResults);
        return topResults;
    }
    deduplicate(results) {
        const seen = new Map();
        for (const result of results) {
            const key = `${result.documentId}:${result.heading || ''}:${result.chunkIndex}`;
            if (!seen.has(key)) {
                seen.set(key, result);
                continue;
            }
            const existing = seen.get(key);
            const overlapRatio = this.calculateOverlap(existing.content, result.content);
            if (overlapRatio < 0.8) {
                const altKey = `${key}:${result.chunkId}`;
                seen.set(altKey, result);
            }
        }
        return Array.from(seen.values());
    }
    mergeNeighbors(results) {
        if (results.length <= 1)
            return results;
        const sorted = [...results].sort((a, b) => {
            if (a.documentId !== b.documentId)
                return a.documentId.localeCompare(b.documentId);
            return a.chunkIndex - b.chunkIndex;
        });
        const merged = [];
        let current = sorted[0];
        for (let i = 1; i < sorted.length; i++) {
            const next = sorted[i];
            if (current.documentId === next.documentId &&
                next.chunkIndex === current.chunkIndex + 1) {
                current = {
                    ...current,
                    content: current.content + '\n\n' + next.content,
                    tokenCount: current.tokenCount + next.tokenCount,
                    similarity: Math.max(current.similarity, next.similarity),
                    sourceOffsetEnd: next.pageNumber,
                };
            }
            else {
                merged.push(current);
                current = next;
            }
        }
        merged.push(current);
        return merged;
    }
    rerank(results, queryText) {
        const queryTerms = queryText.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        const now = Date.now();
        const ranked = results.map((result) => {
            const similarity = result.similarity;
            const versionRecency = Math.min(result.documentVersion / 10, 1);
            const ageMs = now - new Date(result.documentCreatedAt).getTime();
            const ageDays = ageMs / (1000 * 60 * 60 * 24);
            const uploadRecency = Math.max(0, 1 - ageDays / 90);
            const contentLower = result.content.toLowerCase();
            let keywordMatches = 0;
            for (const term of queryTerms) {
                if (contentLower.includes(term))
                    keywordMatches++;
            }
            const keywordBoost = queryTerms.length > 0
                ? keywordMatches / queryTerms.length
                : 0;
            const finalScore = 0.6 * similarity +
                0.2 * versionRecency +
                0.1 * uploadRecency +
                0.1 * keywordBoost;
            return { ...result, finalScore };
        });
        ranked.sort((a, b) => b.finalScore - a.finalScore);
        return ranked;
    }
    calculateOverlap(textA, textB) {
        const wordsA = new Set(textA.toLowerCase().split(/\s+/));
        const wordsB = new Set(textB.toLowerCase().split(/\s+/));
        let intersection = 0;
        for (const word of wordsA) {
            if (wordsB.has(word))
                intersection++;
        }
        const union = wordsA.size + wordsB.size - intersection;
        return union > 0 ? intersection / union : 0;
    }
}
exports.SearchService = SearchService;
