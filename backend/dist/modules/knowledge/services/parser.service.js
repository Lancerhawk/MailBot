"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParserService = void 0;
const logger_1 = require("../../../config/logger");
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
class ParserService {
    async extractText(buffer, mimeType, filename) {
        if (IMAGE_TYPES.has(mimeType)) {
            logger_1.logger.info({ filename, mimeType }, 'Image file — skipping text extraction');
            return { text: '', metadata: { type: 'image', skipped: true } };
        }
        switch (mimeType) {
            case 'application/pdf':
                return this.parsePdf(buffer, filename);
            case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                return this.parseDocx(buffer, filename);
            case 'text/plain':
            case 'text/markdown':
                return this.parsePlainText(buffer, filename);
            case 'text/csv':
                return this.parseCsv(buffer, filename);
            case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                return this.parseXlsx(buffer, filename);
            case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
                return this.parsePptx(buffer, filename);
            default:
                logger_1.logger.warn({ filename, mimeType }, 'Unsupported MIME type for text extraction');
                return { text: '', metadata: { type: 'unsupported', skipped: true } };
        }
    }
    async parsePdf(buffer, filename) {
        try {
            const { PDFParse } = require('pdf-parse');
            const parser = new PDFParse({ data: buffer });
            const result = await parser.getText();
            const text = this.normalizeText(result.text);
            const info = await parser.getInfo();
            return {
                text,
                pageCount: info.total,
                metadata: {
                    type: 'pdf',
                    pages: info.total,
                    info: info.info || {},
                },
            };
        }
        catch (error) {
            logger_1.logger.error({ error: error.message || error.toString(), stack: error.stack, filename }, 'PDF parsing failed');
            throw new Error(`Failed to parse PDF: ${error.message || error.toString()}`);
        }
    }
    async parseDocx(buffer, _filename) {
        const mammoth = await Promise.resolve().then(() => __importStar(require('mammoth')));
        const result = await mammoth.extractRawText({ buffer });
        const text = this.normalizeText(result.value);
        return {
            text,
            metadata: {
                type: 'docx',
                messages: result.messages,
            },
        };
    }
    parsePlainText(buffer, filename) {
        const text = this.normalizeText(buffer.toString('utf-8'));
        return {
            text,
            metadata: {
                type: filename.endsWith('.md') ? 'markdown' : 'plaintext',
            },
        };
    }
    parseCsv(buffer, _filename) {
        const text = this.normalizeText(buffer.toString('utf-8'));
        return {
            text,
            metadata: { type: 'csv' },
        };
    }
    async parseXlsx(buffer, _filename) {
        const XLSX = await Promise.resolve().then(() => __importStar(require('xlsx')));
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheets = [];
        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet);
            if (csv.trim()) {
                sheets.push(`--- Sheet: ${sheetName} ---\n${csv}`);
            }
        }
        const text = this.normalizeText(sheets.join('\n\n'));
        return {
            text,
            metadata: {
                type: 'xlsx',
                sheetCount: workbook.SheetNames.length,
                sheetNames: workbook.SheetNames,
            },
        };
    }
    async parsePptx(buffer, filename) {
        try {
            const XLSX = await Promise.resolve().then(() => __importStar(require('xlsx')));
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const slides = [];
            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                const text = XLSX.utils.sheet_to_csv(sheet);
                if (text.trim()) {
                    slides.push(`--- Slide: ${sheetName} ---\n${text}`);
                }
            }
            const text = this.normalizeText(slides.join('\n\n'));
            return {
                text,
                metadata: { type: 'pptx', slideCount: workbook.SheetNames.length },
            };
        }
        catch (error) {
            logger_1.logger.warn({ error, filename }, 'PPTX parsing failed, attempting raw XML extraction');
            return { text: '', metadata: { type: 'pptx', skipped: true } };
        }
    }
    normalizeText(text) {
        return text
            .replace(/<[^>]*>/g, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
            .replace(/\uFFFD/g, '')
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .split('\n')
            .map(line => line.trim())
            .join('\n')
            .trim();
    }
}
exports.ParserService = ParserService;
