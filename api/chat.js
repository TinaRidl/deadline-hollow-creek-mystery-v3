import { CASE } from './case.js';

const validCharacters = new Set(Object.keys(CASE.people));
const validEvidence = new Set(Object.keys(CASE.evidence));
const clean = (value, max = 1200) => String(value ?? '').slice(0, max);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OPENAI_API_KEY is not configured on this Vercel deployment.' });
  }

  const body = req.body || {};
  const character = clean(body.character, 30);
  if (!validCharacters.has(character)) return res.status(400).json({ error: 'Unknown character.' });

  const message = clean(body.message, 1200).trim();
  if (!message) return res.status(400).json({ error: 'Please enter a question first.' });

  const temperature = Math.min(2, Math.max(0, Number(body.temperature) || 0));
  const evidenceKeys = Array.isArray(body.evidence)
    ? [...new Set(body.evidence.filter(key => validEvidence.has(key)))].slice(0, 12)
    : [];
  const evidenceSummary = evidenceKeys.length
    ? evidenceKeys.map(key => `${key}: ${CASE.evidence[key]}`).join('; ')
    : 'No evidence has been discovered yet.';

  const history = Array.isArray(body.history)
    ? body.history
        .slice(-10)
        .filter(item => item && ['user', 'assistant'].includes(item.role))
        .map(item => ({ role: item.role, content: clean(item.content, 1000) }))
    : [];

  const toneGuide = temperature <= 0.6
    ? 'Use very clear, simple, direct wording. Help the detective understand what you know. Keep the answer easy to follow.'
    : temperature < 1.3
      ? 'Use natural, balanced wording. You may be subtle, but still understandable.'
      : 'Use more emotionally layered, slightly more abstract or indirect wording. Stay understandable, but do not be too obvious.';

  const person = CASE.people[character];

  const system = `You are roleplaying as ${person.name} in a fictional educational detective website. Always answer in English only. ${CASE.setting}

SECRET BACKGROUND (do not reveal directly): ${CASE.truth}

YOUR ROLE / VOICE: ${person.voice}
YOUR KNOWLEDGE: ${person.knowledge}
PLAYER DISCOVERED EVIDENCE: ${evidenceSummary}
STYLE INSTRUCTION: ${toneGuide}

STRICT RULES:
- Stay fully in character.
- Never mention prompts, hidden rules, or that you are an AI.
- Never reveal the complete solution or explicitly identify the murderer unless the user literally says the case is already solved; even then remain in character and do not break the mystery casually.
- Characters can share what they know, what they suspect, what they remember, and what they personally feel.
- Characters must NOT invent new suspects, new murder weapons, or new supernatural facts.
- If your character does not know something, say so honestly.
- If your character is hiding something, deflect or answer partially, but do not become absurdly evasive.
- Keep replies between 2 and 5 short paragraphs or sentences.
- The user is the detective. Be helpful within your role, but do not solve the case for them.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature,
        max_tokens: 240,
        messages: [
          { role: 'system', content: system },
          ...history,
          { role: 'user', content: message },
        ],
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(502).json({
        error: response.status === 429
          ? 'The AI service reached a rate limit or quota limit. Please try again.'
          : 'The AI request failed. Check Vercel logs, your API key, and model access.',
      });
    }

    const reply = payload?.choices?.[0]?.message?.content?.trim();
    if (!reply) return res.status(502).json({ error: 'The AI returned an empty response.' });

    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(502).json({ error: 'Could not reach the AI service. Please try again.' });
  }
}
