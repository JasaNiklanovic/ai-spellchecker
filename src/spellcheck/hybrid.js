// Hybrid spell checking: Traditional for quick feedback, AI for deep contextual analysis
// Strategy: Traditional first (fast), then AI reviews everything and becomes source of truth

import { traditionalSpellCheck, addCustomWords } from './traditional.js';
import { aiSpellCheck } from './ai.js';
import { pipe, unique, partition, Result } from '../utils/fp.js';

// Calculate confidence score based on error type and source
const calculateConfidence = (error) => {
  if (error.source === 'ai') {
    return error.confidence === 'high' ? 0.95 :
           error.confidence === 'medium' ? 0.8 : 0.6;
  }
  return 0.7; // Traditional checker
};

// Enrich errors with additional metadata
const enrichError = (error, index) => ({
  ...error,
  id: `err-${index}`,
  confidenceScore: calculateConfidence(error),
  suggestions: error.suggestions || (error.suggestion ? [error.suggestion] : []),
});

// Main hybrid spell check function
// For full check: AI only (faster). For quick check: traditional only.
export const hybridSpellCheck = async ({
  speakerNotes,
  slideContent = '',
  terminology = [],
  options = {},
}) => {
  const startTime = Date.now();
  const results = {
    errors: [],
    terminology: [...terminology],
    stats: {
      ai: null,
      totalTime: 0,
    },
  };

  // Go straight to AI - it handles everything
  const aiResult = await aiSpellCheck({
    speakerNotes,
    slideContent,
  });

  if (aiResult.ok) {
    results.stats.ai = {
      usage: aiResult.value.usage,
      errorCount: aiResult.value.errors.length,
    };
    results.errors = aiResult.value.errors.map(enrichError);
  } else {
    // AI failed - fall back to traditional
    const traditionalResult = await traditionalSpellCheck(speakerNotes, terminology);
    results.stats.traditional = traditionalResult.stats;
    results.errors = traditionalResult.errors.map(enrichError);
    results.fallbackMode = true;
  }

  results.stats.totalTime = Date.now() - startTime;

  return results;
};

// Quick check mode: traditional only, for real-time feedback while typing
export const quickCheck = async (speakerNotes, terminology = []) => {
  return traditionalSpellCheck(speakerNotes, terminology);
};

// Full check mode: hybrid with AI as source of truth
export const fullCheck = async ({ speakerNotes, slideContent, terminology }) => {
  return hybridSpellCheck({ speakerNotes, slideContent, terminology });
};
