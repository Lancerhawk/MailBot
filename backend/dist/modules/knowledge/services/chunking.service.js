"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChunkingService = void 0;
const logger_1 = require("../../../config/logger");
const TARGET_CHUNK_SIZE = 800;
const MIN_CHUNK_SIZE = 200;
const MAX_CHUNK_SIZE = 1000;
function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}
function isHeading(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 200)
        return false;
    if (/^#{1,6}\s+/.test(trimmed))
        return true;
    if (/^\d+(\.\d+)*\.?\s+\S/.test(trimmed) && trimmed.length < 100)
        return true;
    if (trimmed.length > 3 && trimmed.length < 80 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed))
        return true;
    return false;
}
function splitIntoSections(text) {
    const lines = text.split('\n');
    const sections = [];
    let currentHeading = null;
    let currentContent = [];
    let sectionStartOffset = 0;
    let currentOffset = 0;
    for (const line of lines) {
        if (isHeading(line) && currentContent.length > 0) {
            const content = currentContent.join('\n').trim();
            if (content) {
                sections.push({
                    heading: currentHeading,
                    content,
                    startOffset: sectionStartOffset,
                    endOffset: currentOffset,
                });
            }
            currentHeading = line.trim().replace(/^#+\s*/, '');
            currentContent = [];
            sectionStartOffset = currentOffset;
        }
        else if (isHeading(line) && currentContent.length === 0) {
            currentHeading = line.trim().replace(/^#+\s*/, '');
            sectionStartOffset = currentOffset;
        }
        else {
            currentContent.push(line);
        }
        currentOffset += line.length + 1;
    }
    const content = currentContent.join('\n').trim();
    if (content) {
        sections.push({
            heading: currentHeading,
            content,
            startOffset: sectionStartOffset,
            endOffset: currentOffset,
        });
    }
    if (sections.length === 0 && text.trim()) {
        sections.push({
            heading: null,
            content: text.trim(),
            startOffset: 0,
            endOffset: text.length,
        });
    }
    return sections;
}
function splitSentences(text) {
    const sentences = [];
    const parts = text.split(/(?<=[.!?])\s+/);
    for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed) {
            sentences.push(trimmed);
        }
    }
    return sentences;
}
function splitParagraphs(text) {
    return text.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 0);
}
function chunkSection(section, version, startIndex) {
    const chunks = [];
    const sectionTokens = estimateTokens(section.content);
    if (sectionTokens <= MAX_CHUNK_SIZE) {
        chunks.push({
            content: section.content,
            chunkIndex: startIndex,
            tokenCount: sectionTokens,
            heading: section.heading,
            section: section.heading,
            pageNumber: null,
            sourceOffsetStart: section.startOffset,
            sourceOffsetEnd: section.endOffset,
            documentVersion: version,
        });
        return chunks;
    }
    const paragraphs = splitParagraphs(section.content);
    let currentChunkParts = [];
    let currentTokens = 0;
    let chunkStartOffset = section.startOffset;
    let overlapSentences = [];
    for (let i = 0; i < paragraphs.length; i++) {
        const para = paragraphs[i];
        const paraTokens = estimateTokens(para);
        if (paraTokens > MAX_CHUNK_SIZE) {
            if (currentChunkParts.length > 0) {
                const content = currentChunkParts.join('\n\n');
                chunks.push({
                    content,
                    chunkIndex: startIndex + chunks.length,
                    tokenCount: estimateTokens(content),
                    heading: section.heading,
                    section: section.heading,
                    pageNumber: null,
                    sourceOffsetStart: chunkStartOffset,
                    sourceOffsetEnd: chunkStartOffset + content.length,
                    documentVersion: version,
                });
                overlapSentences = splitSentences(content).slice(-3);
                chunkStartOffset += content.length;
                currentChunkParts = [];
                currentTokens = 0;
            }
            const sentences = splitSentences(para);
            let sentenceBuffer = [...overlapSentences];
            let bufferTokens = estimateTokens(sentenceBuffer.join(' '));
            for (const sentence of sentences) {
                const sentTokens = estimateTokens(sentence);
                if (bufferTokens + sentTokens > TARGET_CHUNK_SIZE && sentenceBuffer.length > 0) {
                    const content = sentenceBuffer.join(' ');
                    chunks.push({
                        content,
                        chunkIndex: startIndex + chunks.length,
                        tokenCount: estimateTokens(content),
                        heading: section.heading,
                        section: section.heading,
                        pageNumber: null,
                        sourceOffsetStart: chunkStartOffset,
                        sourceOffsetEnd: chunkStartOffset + content.length,
                        documentVersion: version,
                    });
                    chunkStartOffset += content.length;
                    overlapSentences = sentenceBuffer.slice(-3);
                    sentenceBuffer = [...overlapSentences, sentence];
                    bufferTokens = estimateTokens(sentenceBuffer.join(' '));
                }
                else {
                    sentenceBuffer.push(sentence);
                    bufferTokens += sentTokens;
                }
            }
            if (sentenceBuffer.length > overlapSentences.length) {
                const content = sentenceBuffer.join(' ');
                chunks.push({
                    content,
                    chunkIndex: startIndex + chunks.length,
                    tokenCount: estimateTokens(content),
                    heading: section.heading,
                    section: section.heading,
                    pageNumber: null,
                    sourceOffsetStart: chunkStartOffset,
                    sourceOffsetEnd: chunkStartOffset + content.length,
                    documentVersion: version,
                });
                overlapSentences = sentenceBuffer.slice(-3);
                chunkStartOffset += content.length;
            }
            continue;
        }
        if (currentTokens + paraTokens > TARGET_CHUNK_SIZE && currentChunkParts.length > 0) {
            const content = currentChunkParts.join('\n\n');
            chunks.push({
                content,
                chunkIndex: startIndex + chunks.length,
                tokenCount: estimateTokens(content),
                heading: section.heading,
                section: section.heading,
                pageNumber: null,
                sourceOffsetStart: chunkStartOffset,
                sourceOffsetEnd: chunkStartOffset + content.length,
                documentVersion: version,
            });
            chunkStartOffset += content.length;
            overlapSentences = splitSentences(content).slice(-3);
            const overlapText = overlapSentences.join(' ');
            const overlapTokens = estimateTokens(overlapText);
            currentChunkParts = overlapTokens > 0 ? [overlapText, para] : [para];
            currentTokens = overlapTokens + paraTokens;
        }
        else {
            currentChunkParts.push(para);
            currentTokens += paraTokens;
        }
    }
    if (currentChunkParts.length > 0) {
        const content = currentChunkParts.join('\n\n');
        const tokenCount = estimateTokens(content);
        if (tokenCount > MIN_CHUNK_SIZE || chunks.length === 0) {
            chunks.push({
                content,
                chunkIndex: startIndex + chunks.length,
                tokenCount,
                heading: section.heading,
                section: section.heading,
                pageNumber: null,
                sourceOffsetStart: chunkStartOffset,
                sourceOffsetEnd: chunkStartOffset + content.length,
                documentVersion: version,
            });
        }
        else if (chunks.length > 0) {
            const last = chunks[chunks.length - 1];
            last.content += '\n\n' + content;
            last.tokenCount = estimateTokens(last.content);
            last.sourceOffsetEnd = chunkStartOffset + content.length;
        }
    }
    return chunks;
}
class ChunkingService {
    chunkText(text, version) {
        if (!text || text.trim().length === 0) {
            return [];
        }
        console.time('Chunking-SplitSections');
        const sections = splitIntoSections(text);
        console.timeEnd('Chunking-SplitSections');
        const allChunks = [];
        let globalIndex = 0;
        for (const section of sections) {
            const sectionChunks = chunkSection(section, version, globalIndex);
            allChunks.push(...sectionChunks);
            globalIndex += sectionChunks.length;
        }
        for (let i = 0; i < allChunks.length; i++) {
            allChunks[i].chunkIndex = i;
        }
        logger_1.logger.info({
            totalChunks: allChunks.length,
            avgTokens: allChunks.length > 0
                ? Math.round(allChunks.reduce((sum, c) => sum + c.tokenCount, 0) / allChunks.length)
                : 0,
            totalTokens: allChunks.reduce((sum, c) => sum + c.tokenCount, 0),
        }, 'Text chunking completed');
        return allChunks;
    }
}
exports.ChunkingService = ChunkingService;
