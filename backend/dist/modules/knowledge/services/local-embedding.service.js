"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.localEmbeddingService = exports.LocalEmbeddingService = void 0;
const transformers_1 = require("@huggingface/transformers");
const logger_1 = require("../../../config/logger");
const env_1 = require("../../../config/env");
const path_1 = __importDefault(require("path"));
class LocalEmbeddingService {
    static instance;
    embedder = null;
    isInitialized = false;
    initPromise = null;
    MODEL_NAME = 'Xenova/bge-small-en-v1.5';
    constructor() {
        transformers_1.env.allowRemoteModels = false;
        transformers_1.env.useBrowserCache = false;
        transformers_1.env.localModelPath = path_1.default.join(process.cwd(), 'models');
        transformers_1.env.useBrowserCache = false;
        if (env_1.env.MODEL_CACHE_DIRECTORY) {
            transformers_1.env.cacheDir = env_1.env.MODEL_CACHE_DIRECTORY;
        }
    }
    static getInstance() {
        if (!LocalEmbeddingService.instance) {
            LocalEmbeddingService.instance = new LocalEmbeddingService();
        }
        return LocalEmbeddingService.instance;
    }
    async init() {
        if (this.isInitialized)
            return;
        if (this.initPromise)
            return this.initPromise;
        this.initPromise = (async () => {
            try {
                logger_1.logger.info(`Initializing local embedding model: ${this.MODEL_NAME}...`);
                this.embedder = await (0, transformers_1.pipeline)('feature-extraction', this.MODEL_NAME, {
                    dtype: 'q8',
                    local_files_only: true,
                });
                logger_1.logger.info("Warmup start");
                const t1 = Date.now();
                const output = await this.embedder("Warmup sequence initialized.", {
                    pooling: "mean",
                    normalize: true,
                });
                logger_1.logger.info(`Warmup finished in ${Date.now() - t1} ms`);
                logger_1.logger.info(`Embedding length: ${output.data.length}`);
                this.isInitialized = true;
                logger_1.logger.info(`Local embedding model initialized and warmed up successfully.`);
            }
            catch (error) {
                logger_1.logger.error({ err: error, errorMessage: error.message }, 'Failed to initialize local embedding model');
                throw error;
            }
        })();
        return this.initPromise;
    }
    async embedSingleText(text) {
        if (!this.isInitialized) {
            await this.init();
        }
        const output = await this.embedder(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
    }
    async embedBatch(texts) {
        if (!this.isInitialized) {
            await this.init();
        }
        if (texts.length === 0)
            return [];
        const output = await this.embedder(texts, { pooling: 'mean', normalize: true });
        const dimensions = 384;
        const embeddings = [];
        const flatData = output.data;
        for (let i = 0; i < texts.length; i++) {
            const start = i * dimensions;
            const end = start + dimensions;
            embeddings.push(Array.from(flatData.slice(start, end)));
        }
        return embeddings;
    }
}
exports.LocalEmbeddingService = LocalEmbeddingService;
exports.localEmbeddingService = LocalEmbeddingService.getInstance();
