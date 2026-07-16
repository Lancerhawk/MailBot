-- CreateEnum
CREATE TYPE "ContactDirection" AS ENUM ('INCOMING', 'OUTGOING');

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "aiSummary" TEXT,
ADD COLUMN     "company" TEXT,
ADD COLUMN     "favorite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "labels" TEXT[],
ADD COLUMN     "lastContactedDirection" "ContactDirection",
ADD COLUMN     "lastSummaryGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twitterUrl" TEXT,
ADD COLUMN     "website" TEXT;

-- CreateIndex
CREATE INDEX "Contact_userId_favorite_idx" ON "Contact"("userId", "favorite");

-- CreateIndex
CREATE INDEX "Contact_userId_pinned_idx" ON "Contact"("userId", "pinned");

-- CreateIndex
CREATE INDEX "Contact_userId_lastInteraction_idx" ON "Contact"("userId", "lastInteraction");

-- CreateIndex
CREATE INDEX "Contact_userId_interactionCount_idx" ON "Contact"("userId", "interactionCount");

-- CreateIndex
CREATE INDEX "Contact_userId_deletedAt_idx" ON "Contact"("userId", "deletedAt");
