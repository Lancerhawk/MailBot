import { logger } from '../../../config/logger';

interface ParseResult {
  text: string;
  pageCount?: number;
  metadata: Record<string, any>;
}

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export class ParserService {
  async extractText(buffer: Buffer, mimeType: string, filename: string): Promise<ParseResult> {
    if (IMAGE_TYPES.has(mimeType)) {
      logger.info({ filename, mimeType }, 'Image file — skipping text extraction');
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
        logger.warn({ filename, mimeType }, 'Unsupported MIME type for text extraction');
        return { text: '', metadata: { type: 'unsupported', skipped: true } };
    }
  }

  private async parsePdf(buffer: Buffer, filename: string): Promise<ParseResult> {
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
    } catch (error: any) {
      logger.error({ error: error.message || error.toString(), stack: error.stack, filename }, 'PDF parsing failed');
      throw new Error(`Failed to parse PDF: ${error.message || error.toString()}`);
    }
  }

  private async parseDocx(buffer: Buffer, filename: string): Promise<ParseResult> {
    const mammoth = await import('mammoth');
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

  private parsePlainText(buffer: Buffer, filename: string): ParseResult {
    const text = this.normalizeText(buffer.toString('utf-8'));
    return {
      text,
      metadata: {
        type: filename.endsWith('.md') ? 'markdown' : 'plaintext',
      },
    };
  }

  private parseCsv(buffer: Buffer, filename: string): ParseResult {
    const text = this.normalizeText(buffer.toString('utf-8'));
    return {
      text,
      metadata: { type: 'csv' },
    };
  }

  private async parseXlsx(buffer: Buffer, filename: string): Promise<ParseResult> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheets: string[] = [];

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

  private async parsePptx(buffer: Buffer, filename: string): Promise<ParseResult> {
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const slides: string[] = [];

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
    } catch (error) {
      logger.warn({ error, filename }, 'PPTX parsing failed, attempting raw XML extraction');
      return { text: '', metadata: { type: 'pptx', skipped: true } };
    }
  }

  private normalizeText(text: string): string {
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
