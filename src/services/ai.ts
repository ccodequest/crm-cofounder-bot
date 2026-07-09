import { getSystemPrompt, getLeadResearchPrompt } from '../utils/prompts.js';
import { Tone } from '../types/index.js';

interface AIConfig {
  model: string;
  apiKey: string;
}

function getConfig(): AIConfig {
  return {
    model: process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b',
    apiKey: process.env.NVIDIA_API_KEY || '',
  };
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const FETCH_TIMEOUT = 9000;

async function fetchWithTimeout(url: string, options: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

export async function chatCompletion(
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const config = getConfig();
  const response = await fetchWithTimeout(
    'https://api.nvidia.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: options?.maxTokens ?? 1024,
        temperature: options?.temperature ?? 0.8,
      }),
    },
    FETCH_TIMEOUT
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`NVIDIA API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

export async function reviewReport(
  reportContent: string,
  taskTitle: string,
  memberName: string,
  tone: Tone
): Promise<string> {
  const systemPrompt = getSystemPrompt(tone, memberName, `Reviewing completion report for task: "${taskTitle}"`);
  const response = await chatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Review this completion report for task "${taskTitle}":\n\n${reportContent}\n\nAnalyze: Is it genuinely done? What's missing? What questions should the Owner ask? Be brutal.` },
  ]);
  return response;
}

export async function researchLead(
  domain: string,
  companyName?: string
): Promise<string> {
  const prompt = getLeadResearchPrompt(domain, companyName);
  const response = await chatCompletion([
    { role: 'system', content: 'You are a lead research analyst. Be thorough and brutally honest.' },
    { role: 'user', content: prompt },
  ], { maxTokens: 2048 });
  return response;
}

export async function generateFounderBriefing(
  debateSummary: string,
  reportContent: string,
  taskTitle: string
): Promise<string> {
  const response = await chatCompletion([
    { role: 'system', content: 'You are the AI Co-Founder briefing the actual Founder. Compress the key debate points, decisions, and unresolved issues into a concise briefing. No fluff. Just facts.' },
    { role: 'user', content: `Task: "${taskTitle}"\nReport: ${reportContent}\nDebate: ${debateSummary}\n\nCreate a founder briefing covering: what was reported, what I challenged, what the Owner decided, what still needs attention.` },
  ]);
  return response;
}