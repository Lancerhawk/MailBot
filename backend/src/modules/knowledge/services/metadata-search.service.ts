import { prisma } from '../../../lib/prisma';
import { logger } from '../../../config/logger';

export interface MetadataSearchResult {
  id: string;
  score: number;
}

export class MetadataSearchService {
  async searchDocuments(
    userId: string,
    queryText: string,
    limit: number = parseInt(process.env.METADATA_TOP_K || '5', 10)
  ): Promise<MetadataSearchResult[]> {
    if (!queryText || queryText.trim().length === 0) {
      return [];
    }

    const cleanQuery = queryText.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();

    try {
      const tsQueryParam = cleanQuery.split(/\s+/).join(' | ');
      if (!tsQueryParam) return [];

      const results: any[] = await prisma.$queryRawUnsafe(
        `WITH search_data AS (
          SELECT
            d.id,
            d.title,
            d.description,
            ts_rank(
              to_tsvector('english', COALESCE(d.title, '') || ' ' || COALESCE(d."originalFileName", '') || ' ' || COALESCE(d.description, '')),
              to_tsquery('english', $2)
            ) as ts_rank_score,
            similarity(COALESCE(d.title, '') || ' ' || COALESCE(d."originalFileName", '') || ' ' || COALESCE(d.description, ''), $3) as sim_score
          FROM "KnowledgeBaseDocument" d
          WHERE d."userId" = $1
            AND d."isArchived" = false
            AND d."processingStatus" = 'COMPLETED'
            AND d."deletedAt" IS NULL
        )
        SELECT 
          id,
          title,
          description,
          ts_rank_score,
          sim_score,
          (
            CASE 
              WHEN ts_rank_score > 0 
              THEN ts_rank_score * 5.0
              ELSE 0
            END
          ) + (sim_score * 0.3) as score
        FROM search_data
        WHERE ts_rank_score > 0 OR sim_score > 0.1
        ORDER BY score DESC
        LIMIT $4`,
        userId,
        tsQueryParam,
        queryText,
        limit
      );

      return results.map(r => ({
        id: r.id,
        score: parseFloat(r.score) || 0
      }));
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err.message : err, userId }, 'Primary metadata search failed (pg_trgm might be missing). Falling back to basic ILIKE search.');
      
      try {
        const fallbackRegex = cleanQuery.split(/\s+/).filter(w => w.length > 2).join('|');
        if (!fallbackRegex) return [];

        const fallbackResults: any[] = await prisma.$queryRawUnsafe(
          `SELECT
            d.id,
            1.0 as score
          FROM "KnowledgeBaseDocument" d
          WHERE d."userId" = $1
            AND d."isArchived" = false
            AND d."processingStatus" = 'COMPLETED'
            AND d."deletedAt" IS NULL
            AND (COALESCE(d.title, '') || ' ' || COALESCE(d."originalFileName", '') || ' ' || COALESCE(d.description, '')) ~* $2
          LIMIT $3`,
          userId,
          fallbackRegex,
          limit
        );

        return fallbackResults.map(r => ({
          id: r.id,
          score: parseFloat(r.score) || 0
        }));
      } catch (fallbackErr) {
        logger.error({ err: fallbackErr, userId }, 'Fallback metadata search failed');
        return [];
      }
    }
  }
}
