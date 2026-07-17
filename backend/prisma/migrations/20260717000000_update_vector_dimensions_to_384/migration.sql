-- Alter the embedding column to 384 dimensions for local model support
ALTER TABLE "KnowledgeBaseChunk" ALTER COLUMN "embedding" TYPE vector(384);
