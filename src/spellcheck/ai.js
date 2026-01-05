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

// System prompt (static, can be cached by API)
const SYSTEM_PROMPT = `You are a spell checker. Find issues in NOTES considering SLIDE context.

Check for:
- SPELLING: typos (realy→really, platfrom→platform)
- TERMINOLOGY: informal→formal from slide (gtm→go-to-market, rev teams→revenue teams)
- GRAMMAR: missing apostrophes (dont→don't, Im→I'm)

Return JSON: {"errors":[{"word":"X","suggestion":"Y","reason":"brief reason","type":"spelling|terminology|grammar"}]}
Return {"errors":[]} if perfect.`;

// Build user prompt (dynamic content only)
const buildPrompt = ({ speakerNotes, slideContent }) => {
  return `SLIDE: ${slideContent || 'None'}\n\nNOTES: ${speakerNotes}`;
};

// Parse AI response safely
const parseAIResponse = (content) => {
  try {
    const parsed = JSON.parse(content);
    const errors = parsed.errors || parsed || [];
    if (!Array.isArray(errors)) return Result.ok([]);

    return Result.ok(
      errors
        .filter(item => item.word && item.suggestion)
        .map(item => ({
          word: String(item.word),
          suggestion: String(item.suggestion),
          reason: String(item.reason || 'Potential issue'),
          type: item.type || 'spelling',
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
      max_tokens: 1024,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildPrompt({ speakerNotes, slideContent }) },
      ],
    });

    const responseText = response.choices[0]?.message?.content || '{"errors":[]}';
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
