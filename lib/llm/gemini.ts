import { ArchetypeZ, type Archetype, type Chart } from '@/lib/astro/chart-types';
import { SYSTEM_PROMPT, buildUserMessage } from './archetype-prompt';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

async function callLLM(userMsg: string): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('LLM_NO_KEY');
  const model = process.env.OPENROUTER_MODEL ?? 'google/gemini-2.0-flash-001';

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.OPENROUTER_REFERER ?? 'https://rashify.in',
      'X-Title': process.env.OPENROUTER_APP_TITLE ?? 'Rashify',
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMsg },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LLM_HTTP_${res.status}: ${body.slice(0, 200)}`);
  }

  const j = (await res.json()) as ChatResponse;
  const text = j.choices?.[0]?.message?.content ?? '';
  return text;
}

function safeJSON(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export async function generateArchetype(chart: Chart, firstName: string): Promise<Archetype> {
  const userMsg = buildUserMessage(chart, firstName);

  const first = await callLLM(userMsg);
  const parsed = ArchetypeZ.safeParse(safeJSON(first));
  if (parsed.success) return parsed.data;

  const stricter = `${userMsg}\n\nIMPORTANT: previous response was malformed. Output ONLY valid JSON matching the schema. coreTraits must have exactly 3 entries, growthEdges exactly 2, luckyNumber an integer 1-9.`;
  const second = await callLLM(stricter);
  const reparsed = ArchetypeZ.safeParse(safeJSON(second));
  if (reparsed.success) return reparsed.data;

  throw new Error('LLM_BAD');
}
