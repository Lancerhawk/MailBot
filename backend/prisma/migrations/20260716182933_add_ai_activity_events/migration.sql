-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'EMAIL_RECEIVED';
ALTER TYPE "ActivityType" ADD VALUE 'EMAIL_ANALYZED';
ALTER TYPE "ActivityType" ADD VALUE 'DOCUMENT_EMBEDDED';
ALTER TYPE "ActivityType" ADD VALUE 'CONTACT_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'ORGANIZATION_CREATED';
