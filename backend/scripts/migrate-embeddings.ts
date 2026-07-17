import { PrismaClient, ProcessingStatus, JobType, ProcessingEntityType } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateEmbeddings() {
  console.log('Starting Embedding Migration for 384 dimensions...');
  try {
    console.log('Clearing existing 1536-dim embeddings from KnowledgeBaseChunk...');
    await prisma.$executeRawUnsafe(`UPDATE "KnowledgeBaseChunk" SET "embedding" = NULL, "embeddingModel" = NULL`);

    const documents = await prisma.knowledgeBaseDocument.findMany({
      where: {
        isArchived: false,
        deletedAt: null
      },
      select: { id: true, userId: true }
    });

    console.log(`Found ${documents.length} active documents to re-embed.`);

    let queuedCount = 0;
    for (const doc of documents) {
      await prisma.knowledgeBaseDocument.update({
        where: { id: doc.id },
        data: {
          processingStatus: ProcessingStatus.PENDING,
          isEmbedded: false,
          embeddedAt: null
        }
      });

      const existingJob = await prisma.processingJob.findFirst({
        where: {
          entityId: doc.id,
          entityType: ProcessingEntityType.DOCUMENT,
          jobType: JobType.DOCUMENT_EMBEDDING,
          status: { in: [ProcessingStatus.PENDING, ProcessingStatus.PROCESSING] }
        }
      });

      if (!existingJob) {
        await prisma.processingJob.create({
          data: {
            userId: doc.userId,
            jobType: JobType.DOCUMENT_EMBEDDING,
            entityType: ProcessingEntityType.DOCUMENT,
            entityId: doc.id,
            status: ProcessingStatus.PENDING,
            priority: 1
          }
        });
        queuedCount++;
      }
    }

    console.log(`Successfully queued ${queuedCount} documents for re-embedding.`);
    console.log('Migration coordinate script completed. Please run prisma db push to apply schema changes before starting the server.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateEmbeddings();
