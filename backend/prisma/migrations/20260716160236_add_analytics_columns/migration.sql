-- AlterTable
ALTER TABLE "Analytics" ADD COLUMN     "contactsCreated" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "documentsEmbedded" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "documentsUploaded" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "knowledgeRetrievalCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "organizationsCreated" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "processingFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "storageUsedBytes" BIGINT NOT NULL DEFAULT 0;
