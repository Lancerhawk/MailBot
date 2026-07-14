-- AlterTable
ALTER TABLE "KnowledgeBaseChunk" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "documentVersion" INTEGER,
ADD COLUMN     "heading" TEXT,
ADD COLUMN     "pageNumber" INTEGER,
ADD COLUMN     "section" TEXT,
ADD COLUMN     "sourceOffsetEnd" INTEGER,
ADD COLUMN     "sourceOffsetStart" INTEGER;

-- AlterTable
ALTER TABLE "KnowledgeBaseDocument" ADD COLUMN     "chunkCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fileHash" TEXT,
ADD COLUMN     "folder" TEXT NOT NULL DEFAULT 'Personal',
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastAccessedAt" TIMESTAMP(3),
ADD COLUMN     "lastRetrievedAt" TIMESTAMP(3),
ADD COLUMN     "originalFileName" TEXT,
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "processingError" TEXT,
ADD COLUMN     "retrievalCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "storageKey" TEXT;

-- CreateIndex
CREATE INDEX "KnowledgeBaseChunk_documentId_idx" ON "KnowledgeBaseChunk"("documentId");

-- CreateIndex
CREATE INDEX "KnowledgeBaseDocument_userId_processingStatus_idx" ON "KnowledgeBaseDocument"("userId", "processingStatus");

-- CreateIndex
CREATE INDEX "KnowledgeBaseDocument_userId_folder_idx" ON "KnowledgeBaseDocument"("userId", "folder");

-- CreateIndex
CREATE INDEX "KnowledgeBaseDocument_userId_fileHash_idx" ON "KnowledgeBaseDocument"("userId", "fileHash");

-- CreateIndex
CREATE INDEX "KnowledgeBaseDocument_userId_isArchived_idx" ON "KnowledgeBaseDocument"("userId", "isArchived");
