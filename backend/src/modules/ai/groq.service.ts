import Groq from 'groq-sdk';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

const groq = new Groq({
  apiKey: env.GROQ_API_KEY || 'dummy-key-will-fail',
});

export interface AiAnalysisResult {
  summary: string;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'MIXED';
  intent: 'INQUIRY' | 'SUPPORT' | 'MEETING' | 'FEEDBACK' | 'SPAM' | 'OTHER';
  needsReply: boolean;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  confidence: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class GroqService {
  async analyzeConversation(contextText: string, retryCount = 0): Promise<AiAnalysisResult> {
    const prompt = `You are an AI assistant analyzing an email conversation.
Read the conversation history and the latest email, then return a strict JSON object with your analysis of the newest message in the context of the whole thread.

Output format MUST be EXACTLY this JSON structure and absolutely nothing else (no markdown, no explanations):
{
  "summary": "1-2 sentences summarizing the newest message",
  "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "MIXED",
  "intent": "INQUIRY" | "SUPPORT" | "MEETING" | "FEEDBACK" | "SPAM" | "OTHER",
  "needsReply": true | false,
  "priority": "LOW" | "NORMAL" | "HIGH" | "URGENT",
  "confidence": 0.0 to 1.0
}

Conversation Context:
${contextText}`;

    try {
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant',
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      return JSON.parse(responseText) as AiAnalysisResult;

    } catch (error: any) {
      const isTransient =
        error.status === 429 ||
        error.status >= 500 ||
        error.name === 'TimeoutError' ||
        error instanceof SyntaxError;

      if (isTransient && retryCount < 3) {
        const backoffMs = Math.pow(2, retryCount) * 1000;
        logger.warn(`Groq analysis transient failure. Retrying in ${backoffMs}ms... (Attempt ${retryCount + 1}/3)`);
        await sleep(backoffMs);
        return this.analyzeConversation(contextText, retryCount + 1);
      }

      logger.error({ error }, 'Groq analysis failed after all retries or due to a non-transient error.');
      throw error;
    }
  }
}
