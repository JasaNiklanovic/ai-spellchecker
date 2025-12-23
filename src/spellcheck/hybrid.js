// Hybrid spell checking: Traditional for quick feedback, AI for deep contextual analysis

import { traditionalSpellCheck } from './traditional.js';
import { aiSpellCheck } from './ai.js';

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

// Full hybrid spell check: AI as primary, traditional as fallback
export const hybridSpellCheck = async ({
  speakerNotes,
  slideContent = '',
  terminology = [],
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

  // Go straight to AI - it handles spelling, terminology, and grammar
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

// Quick check: traditional only, for real-time feedback
export const quickCheck = async (speakerNotes, terminology = []) => {
  return traditionalSpellCheck(speakerNotes, terminology);
};
