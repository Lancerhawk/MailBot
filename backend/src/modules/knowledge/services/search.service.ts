import { createHash } from 'crypto';
import { prisma } from '../../../lib/prisma';
import { localEmbeddingService } from './local-embedding.service';
import { logger } from '../../../config/logger';

export interface SearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  originalFileName: string | null;
  documentVersion: number;
  folder: string;
  documentCreatedAt: Date;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  heading: string | null;
  section: string | null;
  pageNumber: number | null;
  documentVersionChunk: number | null;
  metadata: any;
  similarity: number;
  sourceOffsetStart?: number | null;
  sourceOffsetEnd?: number | null;
}

interface RankedResult extends SearchResult {
  finalScore: number;
}

interface CacheEntry {
  results: RankedResult[];
  timestamp: number;
}

const CACHE_TTL_MS = 60_000;

export class SearchService {
  private cache: Map<string, CacheEntry> = new Map();

  constructor() { }

  clearCacheForUser(userId: string): void {
    for (const [key] of this.cache) {
      if (key.startsWith(userId + ':')) {
        this.cache.delete(key);
      }
    }
  }

  private getCacheKey(userId: string, queryText: string): string {
    const queryHash = createHash('sha256').update(queryText).digest('hex').substring(0, 16);
    return `${userId}:${queryHash}`;
  }

  private getCached(cacheKey: string): RankedResult[] | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.results;
  }

  private setCache(cacheKey: string, results: RankedResult[]): void {
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

  async search(
    userId: string,
    queryText: string,
    limit = 20
  ): Promise<RankedResult[]> {
    const cacheKey = this.getCacheKey(userId, queryText);
    const cached = this.getCached(cacheKey);
    if (cached) {
      logger.info({ userId, cacheHit: true }, 'Knowledge search cache hit');
      return cached;
    }


    const queryEmbedding = await localEmbeddingService.embedSingleText(queryText);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const rawResults: any[] = await prisma.$queryRawUnsafe(
      `SELECT
        c.id as "chunkId",
        c.content,
        c."chunkIndex",
        c."tokenCount",
        c.heading,
        c.section,
        c."pageNumber",
        c."sourceOffsetStart",
        c."sourceOffsetEnd",
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
      LIMIT $3`,
      userId,
      embeddingStr,
      limit
    );

    const searchResults: SearchResult[] = rawResults.map((r) => ({
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
      sourceOffsetStart: r.sourceOffsetStart ?? null,
      sourceOffsetEnd: r.sourceOffsetEnd ?? null,
      documentVersionChunk: r.documentVersion,
      metadata: r.metadata,
      similarity: parseFloat(r.similarity) || 0,
    }));

    const deduplicated = this.deduplicate(searchResults);
    const merged = this.mergeNeighbors(deduplicated);
    const reranked = this.rerank(merged, queryText);
    const topResults = reranked.slice(0, 8);


    logger.info(
      {
        userId,
        rawCount: rawResults.length,
        afterDedup: deduplicated.length,
        afterMerge: merged.length,
        finalCount: topResults.length,
      },
      'Knowledge search completed'
    );

    this.setCache(cacheKey, topResults);
    return topResults;
  }

  private deduplicate(results: SearchResult[]): SearchResult[] {
    const seen = new Map<string, SearchResult>();

    for (const result of results) {
      const key = `${result.documentId}:${result.heading || ''}:${result.chunkIndex}`;

      if (!seen.has(key)) {
        seen.set(key, result);
        continue;
      }

      const existing = seen.get(key)!;
      const overlapRatio = this.calculateOverlap(existing.content, result.content);
      if (overlapRatio < 0.8) {
        const altKey = `${key}:${result.chunkId}`;
        seen.set(altKey, result);
      }
    }

    return Array.from(seen.values());
  }

  private mergeNeighbors(results: SearchResult[]): SearchResult[] {
    if (results.length <= 1) return results;

    const sorted = [...results].sort((a, b) => {
      if (a.documentId !== b.documentId) return a.documentId.localeCompare(b.documentId);
      return a.chunkIndex - b.chunkIndex;
    });

    const merged: SearchResult[] = [];
    let current = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];

      if (
        current.documentId === next.documentId &&
        next.chunkIndex === current.chunkIndex + 1
      ) {
        current = {
          ...current,
          content: current.content + '\n\n' + next.content,
          tokenCount: current.tokenCount + next.tokenCount,
          similarity: Math.max(current.similarity, next.similarity),
          sourceOffsetEnd: next.sourceOffsetEnd ?? next.pageNumber,
        };
      } else {
        merged.push(current);
        current = next;
      }
    }
    merged.push(current);

    return merged;
  }

  private rerank(results: SearchResult[], queryText: string): RankedResult[] {
    const queryTerms = queryText.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const now = Date.now();

    const ranked: RankedResult[] = results.map((result) => {
      const similarity = result.similarity;

      const versionRecency = Math.min(result.documentVersion / 10, 1);

      const ageMs = now - new Date(result.documentCreatedAt).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const uploadRecency = Math.max(0, 1 - ageDays / 90);

      const contentLower = result.content.toLowerCase();
      let keywordMatches = 0;
      for (const term of queryTerms) {
        if (contentLower.includes(term)) keywordMatches++;
      }
      const keywordBoost = queryTerms.length > 0
        ? keywordMatches / queryTerms.length
        : 0;

      const finalScore =
        0.6 * similarity +
        0.2 * versionRecency +
        0.1 * uploadRecency +
        0.1 * keywordBoost;

      return { ...result, finalScore };
    });

    ranked.sort((a, b) => b.finalScore - a.finalScore);

    return ranked;
  }

  private calculateOverlap(textA: string, textB: string): number {
    const wordsA = new Set(textA.toLowerCase().split(/\s+/));
    const wordsB = new Set(textB.toLowerCase().split(/\s+/));
    let intersection = 0;
    for (const word of wordsA) {
      if (wordsB.has(word)) intersection++;
    }
    const union = wordsA.size + wordsB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }
}
