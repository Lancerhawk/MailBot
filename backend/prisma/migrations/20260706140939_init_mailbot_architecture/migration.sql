CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "EmailProvider" AS ENUM ('GMAIL', 'OUTLOOK', 'IMAP');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('IDLE', 'SYNCING', 'ERROR', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'BOUNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('EMAIL_SYNC', 'AI_ANALYSIS', 'DRAFT_GENERATION', 'DOCUMENT_EMBEDDING', 'ATTACHMENT_PROCESSING', 'EMAIL_SEND', 'EMAIL_CLASSIFICATION', 'EMAIL_SUMMARIZATION', 'THREAD_SYNC');

-- CreateEnum
CREATE TYPE "ProcessingEntityType" AS ENUM ('EMAIL', 'ATTACHMENT', 'DOCUMENT', 'THREAD', 'CONTACT');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "EmailCategory" AS ENUM ('PRIMARY', 'SOCIAL', 'PROMOTIONS', 'UPDATES', 'FORUMS', 'SPAM', 'TRASH');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ReplyStatus" AS ENUM ('NOT_NEEDED', 'PENDING', 'DRAFTED', 'SENT');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED');

-- CreateEnum
CREATE TYPE "Intent" AS ENUM ('INQUIRY', 'SUPPORT', 'MEETING', 'FEEDBACK', 'SPAM', 'OTHER');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('SENDER', 'TO', 'CC', 'BCC');

-- CreateEnum
CREATE TYPE "KnowledgeSource" AS ENUM ('UPLOAD', 'WEB', 'EMAIL_HISTORY');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_EMAIL', 'DRAFT_READY', 'ERROR', 'ALERT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('LOGIN', 'SETTINGS_CHANGE', 'EMAIL_SENT', 'DRAFT_APPROVED', 'DATA_EXPORT', 'SYSTEM_ERROR');

-- CreateEnum
CREATE TYPE "PromptType" AS ENUM ('SYSTEM', 'USER_CUSTOM', 'SUMMARIZATION', 'EXTRACTION');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'AUTO_APPROVED');

-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('OPENAI', 'ANTHROPIC', 'GEMINI', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DraftApprovalMode" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "ContactRelationship" AS ENUM ('CLIENT', 'CUSTOMER', 'SUPPLIER', 'PARTNER', 'INTERNAL', 'OTHER');

-- CreateEnum
CREATE TYPE "AttachmentCategory" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'PDF', 'DOCUMENT', 'SPREADSHEET', 'ARCHIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "EmailLabelType" AS ENUM ('SYSTEM', 'USER', 'CATEGORY', 'FOLDER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('SUPABASE', 'S3', 'LOCAL', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "locale" TEXT NOT NULL DEFAULT 'en-US',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailAccountConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "EmailProvider" NOT NULL DEFAULT 'GMAIL',
    "providerAccountId" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "syncToken" TEXT,
    "lastHistoryId" BIGINT,
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "watchExpiration" TIMESTAMP(3),
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'IDLE',
    "lastSyncError" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EmailAccountConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "companyWebsite" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "emailAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "jobTitle" TEXT,
    "phoneNumber" TEXT,
    "preferredTone" TEXT,
    "relationship" "ContactRelationship",
    "interactionCount" INTEGER NOT NULL DEFAULT 0,
    "lastInteraction" TIMESTAMP(3),
    "customNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailThread" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountConnectionId" TEXT NOT NULL,
    "providerThreadId" TEXT NOT NULL,
    "subject" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 1,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EmailThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Email" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountConnectionId" TEXT NOT NULL,
    "emailThreadId" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "providerConversationId" TEXT,
    "internetMessageId" TEXT,
    "inReplyTo" TEXT,
    "referencesHeader" TEXT[],
    "subject" TEXT,
    "plainBody" TEXT,
    "htmlBody" TEXT,
    "snippet" TEXT,
    "providerInternalDate" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "isImportant" BOOLEAN NOT NULL DEFAULT false,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isSpam" BOOLEAN NOT NULL DEFAULT false,
    "category" "EmailCategory" NOT NULL DEFAULT 'PRIMARY',
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "needsReply" BOOLEAN NOT NULL DEFAULT false,
    "replyStatus" "ReplyStatus" NOT NULL DEFAULT 'NOT_NEEDED',
    "summary" TEXT,
    "sentiment" "Sentiment",
    "intent" "Intent",
    "confidence" DOUBLE PRECISION,
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "providerHistoryId" BIGINT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLabel" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "providerLabelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EmailLabelType",
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailParticipant" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "contactId" TEXT,
    "emailAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "role" "ParticipantRole" NOT NULL,

    CONSTRAINT "EmailParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "mimeCategory" "AttachmentCategory" NOT NULL DEFAULT 'OTHER',
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT,
    "storageProvider" "StorageProvider",
    "checksum" TEXT,
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiDraftReply" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "generatedText" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "modelName" TEXT NOT NULL,
    "promptVersion" TEXT,
    "temperature" DOUBLE PRECISION,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "generationLatencyMs" INTEGER,
    "cost" DECIMAL(65,30),
    "confidence" DOUBLE PRECISION NOT NULL,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "editedText" TEXT,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "reasoningMetadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AiDraftReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentReply" (
    "id" TEXT NOT NULL,
    "originalEmailId" TEXT NOT NULL,
    "draftId" TEXT,
    "sentEmailId" TEXT,
    "providerMessageId" TEXT,
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SentReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeBaseDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileType" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "checksum" TEXT,
    "storagePath" TEXT,
    "storageProvider" "StorageProvider",
    "source" "KnowledgeSource" NOT NULL DEFAULT 'UPLOAD',
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isEmbedded" BOOLEAN NOT NULL DEFAULT false,
    "embeddedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "KnowledgeBaseDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeBaseChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "embeddingModel" TEXT,
    "embedding" vector(1536),
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "KnowledgeBaseChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "PromptType" NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "autoReply" BOOLEAN NOT NULL DEFAULT false,
    "businessHoursStart" TEXT NOT NULL DEFAULT '09:00',
    "businessHoursEnd" TEXT NOT NULL DEFAULT '17:00',
    "businessHoursTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "replySignature" TEXT,
    "preferredAiProvider" "AiProvider" NOT NULL DEFAULT 'OPENAI',
    "preferredAiModel" TEXT NOT NULL DEFAULT 'gpt-4o',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "notifyOnNewEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnDraftReady" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnErrors" BOOLEAN NOT NULL DEFAULT true,
    "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "draftApprovalMode" "DraftApprovalMode" NOT NULL DEFAULT 'MANUAL',
    "dynamicConfig" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "linkUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobType" "JobType" NOT NULL,
    "entityType" "ProcessingEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "errorLog" TEXT,
    "workerId" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analytics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "emailsReceived" INTEGER NOT NULL DEFAULT 0,
    "emailsClassified" INTEGER NOT NULL DEFAULT 0,
    "emailsSummarized" INTEGER NOT NULL DEFAULT 0,
    "emailsReplied" INTEGER NOT NULL DEFAULT 0,
    "draftsGenerated" INTEGER NOT NULL DEFAULT 0,
    "draftsApproved" INTEGER NOT NULL DEFAULT 0,
    "draftsRejected" INTEGER NOT NULL DEFAULT 0,
    "averageConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "averageLatency" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "averageReplyGenerationTime" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalPromptTokens" INTEGER NOT NULL DEFAULT 0,
    "totalCompletionTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "timeSavedSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "ActivityType" NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "severity" "Severity" NOT NULL DEFAULT 'INFO',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "lastRotatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "EmailAccountConnection_provider_providerAccountId_idx" ON "EmailAccountConnection"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "EmailAccountConnection_userId_idx" ON "EmailAccountConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailAccountConnection_userId_providerAccountId_key" ON "EmailAccountConnection"("userId", "providerAccountId");

-- CreateIndex
CREATE INDEX "Organization_userId_idx" ON "Organization"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_userId_domain_key" ON "Organization"("userId", "domain");

-- CreateIndex
CREATE INDEX "Contact_userId_displayName_idx" ON "Contact"("userId", "displayName");

-- CreateIndex
CREATE INDEX "Contact_organizationId_idx" ON "Contact"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_userId_emailAddress_key" ON "Contact"("userId", "emailAddress");

-- CreateIndex
CREATE INDEX "EmailThread_userId_lastMessageAt_idx" ON "EmailThread"("userId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailThread_accountConnectionId_providerThreadId_key" ON "EmailThread"("accountConnectionId", "providerThreadId");

-- CreateIndex
CREATE INDEX "Email_userId_receivedAt_idx" ON "Email"("userId", "receivedAt");

-- CreateIndex
CREATE INDEX "Email_userId_processingStatus_idx" ON "Email"("userId", "processingStatus");

-- CreateIndex
CREATE INDEX "Email_userId_needsReply_idx" ON "Email"("userId", "needsReply");

-- CreateIndex
CREATE INDEX "Email_userId_category_idx" ON "Email"("userId", "category");

-- CreateIndex
CREATE INDEX "Email_userId_priority_idx" ON "Email"("userId", "priority");

-- CreateIndex
CREATE INDEX "Email_emailThreadId_idx" ON "Email"("emailThreadId");

-- CreateIndex
CREATE INDEX "Email_needsReply_replyStatus_idx" ON "Email"("needsReply", "replyStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Email_accountConnectionId_providerMessageId_key" ON "Email"("accountConnectionId", "providerMessageId");

-- CreateIndex
CREATE INDEX "EmailLabel_emailId_idx" ON "EmailLabel"("emailId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailLabel_emailId_providerLabelId_key" ON "EmailLabel"("emailId", "providerLabelId");

-- CreateIndex
CREATE INDEX "EmailParticipant_emailId_idx" ON "EmailParticipant"("emailId");

-- CreateIndex
CREATE INDEX "EmailParticipant_contactId_idx" ON "EmailParticipant"("contactId");

-- CreateIndex
CREATE INDEX "Attachment_emailId_idx" ON "Attachment"("emailId");

-- CreateIndex
CREATE INDEX "AiDraftReply_emailId_approvalStatus_idx" ON "AiDraftReply"("emailId", "approvalStatus");

-- CreateIndex
CREATE INDEX "AiDraftReply_userId_approvalStatus_idx" ON "AiDraftReply"("userId", "approvalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SentReply_draftId_key" ON "SentReply"("draftId");

-- CreateIndex
CREATE INDEX "SentReply_originalEmailId_idx" ON "SentReply"("originalEmailId");

-- CreateIndex
CREATE INDEX "KnowledgeBaseDocument_userId_idx" ON "KnowledgeBaseDocument"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeBaseChunk_documentId_chunkIndex_key" ON "KnowledgeBaseChunk"("documentId", "chunkIndex");

-- CreateIndex
CREATE INDEX "PromptTemplate_userId_type_idx" ON "PromptTemplate"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "UserSetting_userId_key" ON "UserSetting"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "ProcessingJob_status_priority_idx" ON "ProcessingJob"("status", "priority");

-- CreateIndex
CREATE INDEX "ProcessingJob_status_nextRetryAt_idx" ON "ProcessingJob"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "ProcessingJob_userId_status_idx" ON "ProcessingJob"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Analytics_userId_date_key" ON "Analytics"("userId", "date");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- AddForeignKey
ALTER TABLE "EmailAccountConnection" ADD CONSTRAINT "EmailAccountConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_accountConnectionId_fkey" FOREIGN KEY ("accountConnectionId") REFERENCES "EmailAccountConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_accountConnectionId_fkey" FOREIGN KEY ("accountConnectionId") REFERENCES "EmailAccountConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_emailThreadId_fkey" FOREIGN KEY ("emailThreadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLabel" ADD CONSTRAINT "EmailLabel_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailParticipant" ADD CONSTRAINT "EmailParticipant_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailParticipant" ADD CONSTRAINT "EmailParticipant_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiDraftReply" ADD CONSTRAINT "AiDraftReply_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiDraftReply" ADD CONSTRAINT "AiDraftReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentReply" ADD CONSTRAINT "SentReply_originalEmailId_fkey" FOREIGN KEY ("originalEmailId") REFERENCES "Email"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentReply" ADD CONSTRAINT "SentReply_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "AiDraftReply"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBaseDocument" ADD CONSTRAINT "KnowledgeBaseDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBaseChunk" ADD CONSTRAINT "KnowledgeBaseChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeBaseDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptTemplate" ADD CONSTRAINT "PromptTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSetting" ADD CONSTRAINT "UserSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingJob" ADD CONSTRAINT "ProcessingJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analytics" ADD CONSTRAINT "Analytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
