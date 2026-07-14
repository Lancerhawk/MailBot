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

export interface DraftReplyResult {
  replyText: string;
  confidence: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export class GroqService {
  async analyzeConversation(contextText: string, retryCount = 0): Promise<AiAnalysisResult> {
    const prompt = `You are an AI assistant analyzing an email conversation.
Read the conversation history and the latest email, then return a strict JSON object with your analysis of the newest message in the context of the whole thread.

CRITICAL: Determine if the latest email actually requires a human response. If it is a newsletter, an automated receipt, a system notification, a social media/LinkedIn connection request or update, a simple "thank you" message, or otherwise does not require a reply, you MUST set "needsReply": false.

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

  async generateDraftReply(contextText: string, retryCount = 0): Promise<DraftReplyResult> {
    const prompt = `You are an AI assistant writing a reply to an email conversation.
Read the conversation history and the latest email carefully. Write a polite, appropriate reply that directly answers the latest email.

CRITICAL ZERO-TOLERANCE ANTI-HALLUCINATION & MEETING RULES:
- YOU ARE STRICTLY FORBIDDEN FROM HALLUCINATING, INVENTING, OR MAKING UP ANY FACTS, NUMBERS, NAMES, OR DETAILS WHATSOEVER.
- If you do not know the answer based explicitly on the provided context, DO NOT GUESS. Leave it out or use a placeholder.
- If the sender asks a personal question (e.g., "How are you?"), provide a very brief, polite, generic response (e.g., "I'm doing well, thank you.") without making up a backstory.
- ONLY include information that is explicitly stated in the Conversation Context or the Knowledge Documents.
- NEVER mention, offer, or try to schedule meetings or calls on behalf of the user. If the sender requests a meeting, provide a polite response leaving a placeholder for the user to fill in their details (e.g., "[Insert meeting link or availability here]").

CRITICAL RULES FOR KNOWLEDGE CONFLICTS:
- Documents in the knowledge context will have an "Uploaded X days ago" label.
- If you see contradictory or conflicting information across different documents, ALWAYS trust the document that was uploaded most recently (the one uploaded fewer days ago).
- Do NOT hallucinate or try to merge conflicting details. Only use the freshest, most recent fact.

Other Rules:
- Write ONLY the reply body text.
- Do NOT include a subject line.
- Do NOT use markdown formatting.
- Do NOT include formal greetings like "Dear" unless contextually appropriate (match the sender's tone).
- Do NOT explain your reasoning.
- Keep a natural tone matching the conversation style (if they are casual, be casual).
- CRITICAL: Make the email EXTREMELY short, strictly to the point, and highly direct.
- CRITICAL: Do NOT include long-winded "big talks", fluff, filler words, or unnecessary pleasantries. Less is more.
- If a "Relevant Knowledge from User's Documents" section is included below, use that information to write a more accurate and informed reply.
- Only use knowledge that is DIRECTLY relevant to answering the email.
- If the knowledge doesn't help answer the email, ignore it completely.
- NEVER invent or assume facts that aren't in the conversation or the provided knowledge.
- Conversation context always takes priority over retrieved knowledge.
- NEVER mention that you are using a document, resume, or knowledge base. 
- You are writing AS the user. Own the information in the documents as your own personal knowledge and experience. Do NOT say "Based on the resume" or "According to the provided document". Instead, say "I have experience in..." or "My skills include...".

Output format MUST be EXACTLY this JSON structure and absolutely nothing else:
{
  "replyText": "Your complete reply text here",
  "confidence": 0.0 to 1.0
}

Conversation Context:
${contextText}`;

    try {
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant',
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(responseText);
      const usage = completion.usage;

      return {
        replyText: parsed.replyText || '',
        confidence: parsed.confidence || 0.5,
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
        totalTokens: usage?.total_tokens || 0,
      };

    } catch (error: any) {
      const isTransient =
        error.status === 429 ||
        error.status >= 500 ||
        error.name === 'TimeoutError' ||
        error instanceof SyntaxError;

      if (isTransient && retryCount < 3) {
        const backoffMs = Math.pow(2, retryCount) * 1000;
        logger.warn(`Groq draft generation transient failure. Retrying in ${backoffMs}ms... (Attempt ${retryCount + 1}/3)`);
        await sleep(backoffMs);
        return this.generateDraftReply(contextText, retryCount + 1);
      }

      logger.error({ error }, 'Groq draft generation failed after all retries or due to a non-transient error.');
      throw error;
    }
  }

  async rawCompletion(prompt: string, retryCount = 0): Promise<string> {
    try {
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant',
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      return completion.choices[0]?.message?.content || '{}';
    } catch (error: any) {
      const isTransient =
        error.status === 429 ||
        error.status >= 500 ||
        error.name === 'TimeoutError' ||
        error instanceof SyntaxError;

      if (isTransient && retryCount < 3) {
        const backoffMs = Math.pow(2, retryCount) * 1000;
        logger.warn(`Groq rawCompletion transient failure. Retrying in ${backoffMs}ms... (Attempt ${retryCount + 1}/3)`);
        await sleep(backoffMs);
        return this.rawCompletion(prompt, retryCount + 1);
      }

      logger.error({ error }, 'Groq rawCompletion failed after all retries');
      throw error;
    }
  }
}
