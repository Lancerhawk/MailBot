import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash, randomUUID } from 'crypto';
import { env } from '../../../config/env';
import { logger } from '../../../config/logger';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_FILENAME_LENGTH = 255;

const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export class StorageService {
  validateMimeType(mimeType: string): boolean {
    return ALLOWED_MIME_TYPES.has(mimeType);
  }

  isImageType(mimeType: string): boolean {
    return IMAGE_MIME_TYPES.has(mimeType);
  }

  validateFileSize(sizeBytes: number): boolean {
    return sizeBytes > 0 && sizeBytes <= MAX_FILE_SIZE;
  }

  sanitizeFilename(filename: string): string {
    const sanitized = filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^[._-]+/, '')
      .substring(0, MAX_FILENAME_LENGTH);

    return sanitized || 'untitled';
  }

  calculateChecksum(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  generateStorageKey(userId: string, filename: string): string {
    const sanitized = this.sanitizeFilename(filename);
    const uniqueId = randomUUID();
    return `knowledge/${userId}/${uniqueId}/${sanitized}`;
  }

  async uploadFile(
    userId: string,
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<{ storageKey: string; checksum: string }> {
    const storageKey = this.generateStorageKey(userId, filename);
    const checksum = this.calculateChecksum(buffer);

    const command = new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: storageKey,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        userId,
        checksum,
        originalFilename: this.sanitizeFilename(filename),
      },
    });

    try {
      await s3Client.send(command);
      logger.info({ storageKey, userId, sizeBytes: buffer.length }, 'File uploaded to S3');
      return { storageKey, checksum };
    } catch (error) {
      logger.error({ error, storageKey, userId }, 'S3 upload failed');
      throw error;
    }
  }

  async deleteFile(storageKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: storageKey,
    });

    try {
      await s3Client.send(command);
      logger.info({ storageKey }, 'File deleted from S3');
    } catch (error) {
      logger.error({ error, storageKey }, 'S3 delete failed');
      throw error;
    }
  }

  async generateSignedUrl(storageKey: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: storageKey,
    });

    try {
      const url = await getSignedUrl(s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      logger.error({ error, storageKey }, 'Failed to generate signed URL');
      throw error;
    }
  }
}
