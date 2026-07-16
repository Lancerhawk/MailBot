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

export interface DraftReplyResult {
  replyText: string;
  confidence: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

const MAX_GLOBAL_CONCURRENCY = parseInt(process.env.GROQ_CONCURRENCY_LIMIT || '2', 10);
const MAX_PENDING_PER_USER = 100;
const REQUEST_TIMEOUT_MS = 60000;

interface Task<T = any> {
  taskFn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
  retryCount: number;
}

const userQueues = new Map<string, Task[]>();
const readyUsers: string[] = [];
const activeUsers = new Set<string>();
let currentGlobalConcurrency = 0;

function enqueueTask<T>(userId: string, taskFn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    let queue = userQueues.get(userId);
    if (!queue) {
      queue = [];
      userQueues.set(userId, queue);
    }

    if (queue.length >= MAX_PENDING_PER_USER) {
      return reject(new Error(`Max queue size (${MAX_PENDING_PER_USER}) exceeded for user ${userId}`));
    }

    queue.push({ taskFn, resolve, reject, retryCount: 0 });

    if (!activeUsers.has(userId) && !readyUsers.includes(userId)) {
      readyUsers.push(userId);
    }

    processScheduler();
  });
}

function processScheduler() {
  while (currentGlobalConcurrency < MAX_GLOBAL_CONCURRENCY && readyUsers.length > 0) {
    const userId = readyUsers.shift()!;
    const queue = userQueues.get(userId);

    if (!queue || queue.length === 0) {
      userQueues.delete(userId);
      continue;
    }

    if (activeUsers.has(userId)) {
      continue;
    }

    const task = queue.shift()!;
    activeUsers.add(userId);
    currentGlobalConcurrency++;

    executeTaskWorker(userId, task);
  }
}

async function executeTaskWorker(userId: string, task: Task) {
  let isTransientRetry = false;
  let delayMs = 0;

  try {
    const result = await Promise.race([
      task.taskFn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Groq request timed out')), REQUEST_TIMEOUT_MS)
      )
    ]);

    task.resolve(result);
  } catch (error: any) {
    const isTransient = error.status === 429 || error.status >= 500 || error.name === 'TimeoutError' || error.message === 'Groq request timed out' || error instanceof SyntaxError;

    if (isTransient && task.retryCount < 5) {
      isTransientRetry = true;
      task.retryCount++;

      const retryAfter = error.headers?.['retry-after'] || error.response?.headers?.['retry-after'];
      if (retryAfter && !isNaN(parseInt(retryAfter, 10))) {
        delayMs = parseInt(retryAfter, 10) * 1000;
      } else {
        const baseDelay = Math.pow(2, task.retryCount) * 1000;
        const jitter = Math.random() * 2000;
        delayMs = baseDelay + jitter;
      }

      logger.warn(`Groq transient error. User ${userId} retrying in ${Math.round(delayMs)}ms (Attempt ${task.retryCount}/5)`);

      const queue = userQueues.get(userId) || [];
      queue.unshift(task);
      userQueues.set(userId, queue);
    } else {
      if (task.retryCount >= 5) {
        logger.error({ error }, `Groq task for user ${userId} discarded after 5 failed retries.`);
      } else {
        logger.error({ error }, `Groq task for user ${userId} failed due to a non-transient error.`);
      }
      task.reject(error);
    }
  } finally {
    currentGlobalConcurrency--;

    if (isTransientRetry) {
      setTimeout(() => {
        activeUsers.delete(userId);
        if (!readyUsers.includes(userId)) {
          readyUsers.push(userId);
        }
        processScheduler();
      }, delayMs);
    } else {
      activeUsers.delete(userId);
      const remainingQueue = userQueues.get(userId);
      if (remainingQueue && remainingQueue.length > 0) {
        if (!readyUsers.includes(userId)) {
          readyUsers.push(userId);
        }
      } else {
        userQueues.delete(userId);
      }
    }

    processScheduler();
  }
}

export class GroqService {
  async analyzeConversation(userId: string, contextText: string): Promise<AiAnalysisResult> {
    const prompt = `You are an AI assistant analyzing an email conversation.
Read the conversation history and the latest email, then return a strict JSON object with your analysis of the newest message in the context of the whole thread.

CRITICAL: Determine if the latest email actually requires a human response. If it is a newsletter, a marketing ad, a cold sales pitch, a generic company announcement, an automated receipt, a system notification, a social media/LinkedIn connection invite or update, a simple "thank you" message, or otherwise does not require a reply, you MUST set "needsReply": false.

Output format MUST be EXACTLY this JSON structure and absolutely nothing else (no markdown, no explanations):
{
  "summary": "1-2 sentences summarizing the newest message",
  "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "MIXED",
  "intent": "INQUIRY" | "SUPPORT" | "MEETING" | "FEEDBACK" | "SPAM" | "OTHER",
  "needsReply": true | false,
  "priority": "LOW" | "NORMAL" | "HIGH" | "URGENT",
  "confidence": 0.0 to 1.0
}

CRITICAL RULES FOR CONTACT CONTEXT:
- If Contact Context is provided, use it to understand the social dynamic and intent of the message better.
- Never invent facts or override the thread conversation.
- Never expose internal notes or CRM structure.

PROMPT CONTEXT PRIORITY RULES:
Explicitly enforce the following hierarchy:
1. Conversation Thread (highest priority)
2. Contact Context
3. Knowledge Base
4. General Model Knowledge (lowest priority)
- The conversation always represents the latest truth.
- Contact Context is for personalization only and must never override facts from the conversation.
- Knowledge Base is for factual reference only.
- If Contact Context and Knowledge Base conflict, use Contact Context for style/tone and Knowledge Base for facts.
- Never merge conflicting facts. Prefer Conversation first, then newest Knowledge Base.

Conversation Context (including optional Contact Context):
${contextText}`;

    return enqueueTask(userId, async () => {
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant',
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      return JSON.parse(responseText) as AiAnalysisResult;
    });
  }

  async generateDraftReply(userId: string, contextText: string): Promise<DraftReplyResult> {
    const prompt = `You are an AI assistant writing a reply to an email conversation.
Read the conversation history and the latest email carefully. Write a polite, appropriate reply that directly answers the latest email.

CRITICAL ZERO-TOLERANCE ANTI-HALLUCINATION & MEETING RULES:
- YOU ARE STRICTLY FORBIDDEN FROM HALLUCINATING, INVENTING, OR MAKING UP ANY FACTS, NUMBERS, NAMES, OR DETAILS WHATSOEVER.
- If you do not know the answer based explicitly on the provided context, DO NOT GUESS. Leave it out or use a placeholder.
- If the sender asks a personal question (e.g., "How are you?"), provide a very brief, polite, generic response (e.g., "I'm doing well, thank you.") without making up a backstory.
- ONLY include information that is explicitly stated in the Conversation Context or the Knowledge Documents.
- NEVER mention, offer, or try to schedule meetings or calls on behalf of the user. If the sender requests a meeting, provide a polite response leaving a placeholder for the user to fill in their details (e.g., "[Insert meeting link or availability here]").

CRITICAL RULES FOR CONTACT CONTEXT:
- If Contact Context is provided, MATCH the Preferred AI Tone whenever appropriate.
- Use the Relationship to adjust writing style only.
- Respect Custom Notes for communication style (e.g. formatting, conciseness).
- Never invent facts using Contact Context.
- Never contradict the conversation.
- Never expose internal notes, CRM mentions, or relationship labels in the output.
- Never say "According to your contact information".
- Use Contact Context strictly to personalize the response.

PROMPT CONTEXT PRIORITY RULES:
Explicitly enforce the following hierarchy:
1. Conversation Thread (highest priority)
2. Contact Context
3. Knowledge Base
4. General Model Knowledge (lowest priority)
- The conversation always represents the latest truth.
- Contact Context is for personalization only (tone, relationship, preferences, notes) and must never override facts from the conversation.
- Knowledge Base is for factual reference only and must never override either the conversation or the contact's communication preferences.
- If Contact Context and Knowledge Base conflict, use Contact Context for communication style and Knowledge Base for factual information.
- Never merge conflicting facts. Prefer Conversation first, then newest Knowledge Base information.

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

    return enqueueTask(userId, async () => {
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
    });
  }

  async rawCompletion(userId: string, prompt: string): Promise<string> {
    return enqueueTask(userId, async () => {
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant',
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      return completion.choices[0]?.message?.content || '{}';
    });
  }
}
