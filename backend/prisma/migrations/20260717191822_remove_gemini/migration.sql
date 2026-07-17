/*
  Warnings:

  - The values [GEMINI] on the enum `AiProvider` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AiProvider_new" AS ENUM ('GROQ', 'OPENAI', 'ANTHROPIC', 'CUSTOM');
ALTER TABLE "public"."UserSetting" ALTER COLUMN "preferredAiProvider" DROP DEFAULT;
ALTER TABLE "AiDraftReply" ALTER COLUMN "provider" TYPE "AiProvider_new" USING ("provider"::text::"AiProvider_new");
ALTER TABLE "UserSetting" ALTER COLUMN "preferredAiProvider" TYPE "AiProvider_new" USING ("preferredAiProvider"::text::"AiProvider_new");
ALTER TYPE "AiProvider" RENAME TO "AiProvider_old";
ALTER TYPE "AiProvider_new" RENAME TO "AiProvider";
DROP TYPE "public"."AiProvider_old";
ALTER TABLE "UserSetting" ALTER COLUMN "preferredAiProvider" SET DEFAULT 'GROQ';
COMMIT;
