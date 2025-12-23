// AI-powered contextual spell checking using OpenAI GPT-4o-mini

import OpenAI from 'openai';
import { Result } from '../utils/fp.js';

// Initialize OpenAI client (lazy)
let client = null;
const getClient = () => {
  if (!client) {
    client = new OpenAI();
  }
  return client;
};

// Build prompt for contextual spell checking
const buildPrompt = ({ speakerNotes, slideContent }) => {
  return `SLIDE: ${slideContent || 'None'}

NOTES: ${speakerNotes}

Find EVERY issue in NOTES. Be extremely thorough - check each word.

1. SPELLING - ALL typos: realy, platfrom, alot, messagin, guidlines, diferently, togther, mesage, becaus, consistancy, actualy, disconected, experiance, etc.
2. TERMINOLOGY - informal when slide is formal:
   - "rev teams" → "revenue teams" (slide term)
   - "gtm" → "go-to-market" (slide term)
   - "ppl" → "people"
3. GRAMMAR - missing apostrophes: doesnt→doesn't, dont→don't

RULES:
- Find ALL errors, not just some - be thorough
- No duplicates
- Full phrases for terminology ("rev teams" not "rev")
- Helpful, contextual reasons:
  - For terminology: "Your slide uses 'X' — match it for a consistent, on-brand presentation"
  - For spelling: describe the specific error (e.g., "Transposed letters", "Missing letter")
  - For grammar: explain the issue (e.g., "Missing apostrophe in contraction")

JSON (complete list, no duplicates):
[{"word":"X","suggestion":"Y","reason":"helpful reason","type":"spelling|terminology|grammar","confidence":"high"}]

[] only if perfect. JSON only.`;
};

// Parse AI response safely
const parseAIResponse = (content) => {
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return Result.ok([]);

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return Result.ok([]);

    return Result.ok(
      parsed
        .filter(item => item.word && item.suggestion)
        .map(item => ({
          word: String(item.word),
          suggestion: String(item.suggestion),
          reason: String(item.reason || 'Potential issue'),
          type: item.type || 'spelling',
          confidence: item.confidence || 'medium',
          source: 'ai',
          suggestions: [String(item.suggestion)],
        }))
    );
  } catch (error) {
    return Result.err(`Failed to parse AI response: ${error.message}`);
  }
};

// Main AI spell check function
export const aiSpellCheck = async ({ speakerNotes, slideContent = '' }) => {
  if (!process.env.OPENAI_API_KEY) {
    return Result.err('OPENAI_API_KEY not configured');
  }

  if (speakerNotes.trim().length < 10) {
    return Result.ok({ errors: [], usage: { inputTokens: 0, outputTokens: 0 } });
  }

  try {
    const openai = getClient();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 2048,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: buildPrompt({ speakerNotes, slideContent }),
        },
      ],
    });

    const responseText = response.choices[0]?.message?.content || '[]';
    const parseResult = parseAIResponse(responseText);

    if (!parseResult.ok) {
      return Result.err(parseResult.error);
    }

    return Result.ok({
      errors: parseResult.value,
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
      },
    });
  } catch (error) {
    return Result.err(`AI spell check failed: ${error.message}`);
  }
};

// Extract terminology from slide content
export const extractTerminology = async (slideContent) => {
  if (!process.env.OPENAI_API_KEY) {
    return Result.err('OPENAI_API_KEY not configured');
  }

  if (!slideContent?.trim()) {
    return Result.ok([]);
  }

  try {
    const openai = getClient();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 512,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: `Extract terminology from this slide content that should be preserved during spell checking.

Include: brand names, technical terms, acronyms, industry jargon, proper nouns.

Content:
${slideContent}

Return a JSON array of terms: ["term1", "term2"]
Return ONLY the JSON array.`,
        },
      ],
    });

    const responseText = response.choices[0]?.message?.content || '[]';

    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return Result.ok([]);

      const terms = JSON.parse(jsonMatch[0]);
      return Result.ok(Array.isArray(terms) ? terms.filter(t => typeof t === 'string') : []);
    } catch {
      return Result.ok([]);
    }
  } catch (error) {
    return Result.err(`Terminology extraction failed: ${error.message}`);
  }
};
