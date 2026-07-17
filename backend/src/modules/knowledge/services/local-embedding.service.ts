import { pipeline, env as transformersEnv } from '@huggingface/transformers';
import { logger } from '../../../config/logger';
import { env } from '../../../config/env';
import path from 'path';

export class LocalEmbeddingService {
  private static instance: LocalEmbeddingService;
  private embedder: any = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  private readonly MODEL_NAME = 'Xenova/bge-small-en-v1.5';

  private constructor() {
    transformersEnv.allowRemoteModels = false;
    transformersEnv.useBrowserCache = false;
    transformersEnv.localModelPath = path.join(process.cwd(), 'models');
    transformersEnv.useBrowserCache = false;
    if (env.MODEL_CACHE_DIRECTORY) {
      transformersEnv.cacheDir = env.MODEL_CACHE_DIRECTORY;
    }
  }

  public static getInstance(): LocalEmbeddingService {
    if (!LocalEmbeddingService.instance) {
      LocalEmbeddingService.instance = new LocalEmbeddingService();
    }
    return LocalEmbeddingService.instance;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        logger.info(`Initializing local embedding model: ${this.MODEL_NAME}...`);

        this.embedder = await pipeline('feature-extraction', this.MODEL_NAME, {
          dtype: 'q8',
          local_files_only: true,
        });

        logger.info("Warmup start");
        const t1 = Date.now();

        const output = await this.embedder("Warmup sequence initialized.", {
          pooling: "mean",
          normalize: true,
        });

        logger.info(`Warmup finished in ${Date.now() - t1} ms`);
        logger.info(`Embedding length: ${output.data.length}`);

        this.isInitialized = true;
        logger.info(`Local embedding model initialized and warmed up successfully.`);
      } catch (error: any) {
        logger.error({ err: error, errorMessage: error.message }, 'Failed to initialize local embedding model');
        throw error;
      }
    })();

    return this.initPromise;
  }

  public async embedSingleText(text: string): Promise<number[]> {
    if (!this.isInitialized) {
      await this.init();
    }

    const output = await this.embedder(text, { pooling: 'mean', normalize: true });

    return Array.from(output.data);
  }

  public async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.isInitialized) {
      await this.init();
    }

    if (texts.length === 0) return [];

    const output = await this.embedder(texts, { pooling: 'mean', normalize: true });

    const dimensions = 384;
    const embeddings: number[][] = [];
    const flatData = output.data;

    for (let i = 0; i < texts.length; i++) {
      const start = i * dimensions;
      const end = start + dimensions;
      embeddings.push(Array.from(flatData.slice(start, end)));
    }

    return embeddings;
  }
}

export const localEmbeddingService = LocalEmbeddingService.getInstance();
