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
const SYSTEM_PROMPT = `You are a thorough spell checker. Find ALL issues in the speaker notes.

1. SPELLING - Every typo: realy→really, platfrom→platform, teh→the, recieve→receive
2. TERMINOLOGY - Match informal terms to formal slide content:
   - Acronyms: GTM→Go-to-market, K8s→Kubernetes, ARR→Annual Recurring Revenue
   - Abbreviations: rev teams→revenue teams, ppl→people, mgmt→management
   - Always suggest the EXACT term from the slide when available
3. GRAMMAR - Missing apostrophes: dont→don't, Im→I'm, wont→won't, cant→can't

Be thorough - check every word. Match terminology to slide content exactly.

Return JSON: {"errors":[{"word":"exact word","suggestion":"correction","reason":"brief explanation","type":"spelling|terminology|grammar"}]}
Empty if perfect: {"errors":[]}`;

// Build user prompt (dynamic content only)
const buildPrompt = ({ speakerNotes, slideContent, terminology = [] }) => {
  const slide = slideContent ? `SLIDE CONTENT (match terminology to this):\n${slideContent}` : 'No slide context provided';
  const terms = terminology.length ? `\n\nKEY TERMS TO MATCH: ${terminology.join(', ')}` : '';
  return `${slide}${terms}\n\nSPEAKER NOTES (check these):\n${speakerNotes}`;
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
export const aiSpellCheck = async ({ speakerNotes, slideContent = '', terminology = [] }) => {
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
        { role: 'user', content: buildPrompt({ speakerNotes, slideContent, terminology }) },
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
      max_tokens: 256,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Extract key terminology from slide content. Return JSON: {"terms":["term1","term2"]}',
        },
        {
          role: 'user',
          content: `Extract brand names, technical terms, acronyms, formal phrases from:\n\n${slideContent}`,
        },
      ],
    });

    const responseText = response.choices[0]?.message?.content || '{"terms":[]}';

    try {
      const parsed = JSON.parse(responseText);
      const terms = parsed.terms || [];
      return Result.ok(Array.isArray(terms) ? terms.filter(t => typeof t === 'string') : []);
    } catch {
      return Result.ok([]);
    }
  } catch (error) {
    return Result.err(`Terminology extraction failed: ${error.message}`);
  }
};
