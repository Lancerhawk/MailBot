"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const crypto_1 = require("crypto");
const env_1 = require("../../../config/env");
const logger_1 = require("../../../config/logger");
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
const s3Client = new client_s3_1.S3Client({
    region: env_1.env.AWS_REGION,
    credentials: {
        accessKeyId: env_1.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env_1.env.AWS_SECRET_ACCESS_KEY,
    },
});
class StorageService {
    validateMimeType(mimeType) {
        return ALLOWED_MIME_TYPES.has(mimeType);
    }
    isImageType(mimeType) {
        return IMAGE_MIME_TYPES.has(mimeType);
    }
    validateFileSize(sizeBytes) {
        return sizeBytes > 0 && sizeBytes <= MAX_FILE_SIZE;
    }
    sanitizeFilename(filename) {
        const sanitized = filename
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^[._-]+/, '')
            .substring(0, MAX_FILENAME_LENGTH);
        return sanitized || 'untitled';
    }
    calculateChecksum(buffer) {
        return (0, crypto_1.createHash)('sha256').update(buffer).digest('hex');
    }
    generateStorageKey(userId, filename) {
        const sanitized = this.sanitizeFilename(filename);
        const uniqueId = (0, crypto_1.randomUUID)();
        return `knowledge/${userId}/${uniqueId}/${sanitized}`;
    }
    async uploadFile(userId, buffer, filename, mimeType) {
        const storageKey = this.generateStorageKey(userId, filename);
        const checksum = this.calculateChecksum(buffer);
        const command = new client_s3_1.PutObjectCommand({
            Bucket: env_1.env.AWS_S3_BUCKET,
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
            logger_1.logger.info({ storageKey, userId, sizeBytes: buffer.length }, 'File uploaded to S3');
            return { storageKey, checksum };
        }
        catch (error) {
            logger_1.logger.error({ error, storageKey, userId }, 'S3 upload failed');
            throw error;
        }
    }
    async deleteFile(storageKey) {
        const command = new client_s3_1.DeleteObjectCommand({
            Bucket: env_1.env.AWS_S3_BUCKET,
            Key: storageKey,
        });
        try {
            await s3Client.send(command);
            logger_1.logger.info({ storageKey }, 'File deleted from S3');
        }
        catch (error) {
            logger_1.logger.error({ error, storageKey }, 'S3 delete failed');
            throw error;
        }
    }
    async generateSignedUrl(storageKey, expiresIn = 3600) {
        const command = new client_s3_1.GetObjectCommand({
            Bucket: env_1.env.AWS_S3_BUCKET,
            Key: storageKey,
        });
        try {
            const url = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn });
            return url;
        }
        catch (error) {
            logger_1.logger.error({ error, storageKey }, 'Failed to generate signed URL');
            throw error;
        }
    }
}
exports.StorageService = StorageService;
