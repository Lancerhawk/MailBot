import { env } from '../../../config/env';
import { logger } from '../../../config/logger';

const EMBEDDING_MODEL = 'models/gemini-embedding-001';
const REQUIRED_DIMENSIONS = 1536;
const BATCH_SIZE = 100;
const MAX_RETRIES = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class EmbeddingService {
  private apiKey: string;

  constructor() {
    this.apiKey = env.GEMINI_API_KEY;
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const allEmbeddings: number[][] = [];
    const totalBatches = Math.ceil(texts.length / BATCH_SIZE);

    console.time(`Embedding-Total-${texts.length}-texts`);

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const start = batchIdx * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, texts.length);
      const batch = texts.slice(start, end);

      console.time(`Embedding-Batch-${batchIdx + 1}/${totalBatches}`);
      const batchEmbeddings = await this.embedBatchWithRetry(batch, 0);
      console.timeEnd(`Embedding-Batch-${batchIdx + 1}/${totalBatches}`);

      allEmbeddings.push(...batchEmbeddings);
    }

    console.timeEnd(`Embedding-Total-${texts.length}-texts`);

    logger.info(
      { textCount: texts.length, batches: totalBatches, model: EMBEDDING_MODEL },
      'Batch embedding completed (Gemini 768-dim padded to 1536-dim)'
    );

    return allEmbeddings;
  }

  async embedSingleText(text: string): Promise<number[]> {
    const results = await this.embedBatchWithRetry([text], 0);
    return results[0];
  }

  private async embedBatchWithRetry(texts: string[], retryCount: number): Promise<number[][]> {
    try {
      const embeddings: number[][] = [];

      for (const text of texts) {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${this.apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'models/gemini-embedding-001',
              content: { parts: [{ text }] },
            }),
          }
        );

        if (!response.ok) {
          const errorBody = await response.text();
          const error: any = new Error(`Gemini API error: ${response.status} ${errorBody}`);
          error.status = response.status;
          throw error;
        }

        const data = await response.json();

        const nativeVector = data.embedding?.values || data.embedding?.value || [];
        const paddedVector = new Array(REQUIRED_DIMENSIONS).fill(0);
        for (let i = 0; i < Math.min(nativeVector.length, REQUIRED_DIMENSIONS); i++) {
          paddedVector[i] = nativeVector[i];
        }
        embeddings.push(paddedVector);

        await sleep(250);
      }

      return embeddings;
    } catch (error: any) {
      const isTransient =
        error.status === 429 ||
        (error.status && error.status >= 500) ||
        error.name === 'TimeoutError' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT';

      if (isTransient && retryCount < MAX_RETRIES) {
        const backoffMs = Math.pow(2, retryCount) * 1000;
        logger.warn(
          `Gemini embedding transient failure. Retrying in ${backoffMs}ms... (Attempt ${retryCount + 1}/${MAX_RETRIES})`
        );
        await sleep(backoffMs);
        return this.embedBatchWithRetry(texts, retryCount + 1);
      }

      logger.error({ status: error.status, message: error.message || error.toString() }, 'Gemini embedding failed after all retries');
      throw error;
    }
  }
}
