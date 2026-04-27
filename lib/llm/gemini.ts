import { GoogleGenerativeAI } from '@google/generative-ai';
import { ArchetypeZ, type Archetype, type Chart } from '@/lib/astro/chart-types';
import { SYSTEM_PROMPT, buildUserMessage } from './archetype-prompt';

export async function generateArchetype(chart: Chart, firstName: string): Promise<Archetype> {
  const key = process.env.GEMINI_API_KEY!;
  const client = new GoogleGenerativeAI(key);
  const model = client.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800,
      responseMimeType: 'application/json',
    },
  });

  const userMsg = buildUserMessage(chart, firstName);

  const first = await model.generateContent(userMsg);
  const parsed = ArchetypeZ.safeParse(safeJSON(first.response.text()));
  if (parsed.success) return parsed.data;

  // retry once with stricter wrapper
  const stricter = `${userMsg}\n\nIMPORTANT: previous response was malformed. Output ONLY valid JSON matching the schema. coreTraits must have exactly 3 entries, growthEdges exactly 2, luckyNumber an integer 1-9.`;
  const second = await model.generateContent(stricter);
  const reparsed = ArchetypeZ.safeParse(safeJSON(second.response.text()));
  if (reparsed.success) return reparsed.data;

  throw new Error('LLM_BAD');
}

function safeJSON(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}
