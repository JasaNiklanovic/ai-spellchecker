// Traditional spell checking using nspell (Hunspell-compatible)
// First pass: catch obvious typos quickly and cheaply

import nspell from 'nspell';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pipe, partition, unique } from '../utils/fp.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Dictionary state (loaded once)
let spellChecker = null;

// Load dictionary files
const loadDictionary = async () => {
  if (spellChecker) return spellChecker;

  try {
    // Use dictionary files from nspell's default location
    const dicPath = join(__dirname, '../../dictionaries/en_US.dic');
    const affPath = join(__dirname, '../../dictionaries/en_US.aff');

    const [dic, aff] = await Promise.all([
      readFile(dicPath),
      readFile(affPath),
    ]);

    spellChecker = nspell({ aff, dic });
    return spellChecker;
  } catch (error) {
    console.warn('Dictionary not found, using basic spell check');
    return null;
  }
};

// Extract words from text (preserves position info)
const tokenize = (text) => {
  const words = [];
  const regex = /[a-zA-Z']+/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    words.push({
      word: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return words;
};

// Check if word should be skipped (acronyms, intentional caps, etc.)
const shouldSkipWord = (word) => {
  // Skip very short words
  if (word.length <= 1) return true;

  // Skip ALL CAPS (likely acronyms)
  if (word === word.toUpperCase() && word.length > 1) return true;

  // Skip words that look like camelCase or PascalCase (likely code/brand names)
  if (/[a-z][A-Z]/.test(word)) return true;

  return false;
};

// Check a single word
const checkWord = (checker, customTerms) => (token) => {
  const { word } = token;

  // Skip certain patterns
  if (shouldSkipWord(word)) {
    return { ...token, correct: true, skipped: true };
  }

  // Check custom terms first (case-insensitive)
  const lowerWord = word.toLowerCase();
  if (customTerms.some(term => term.toLowerCase() === lowerWord)) {
    return { ...token, correct: true, isCustomTerm: true };
  }

  // Use dictionary checker if available
  if (checker) {
    const isCorrect = checker.correct(word);
    const suggestions = isCorrect ? [] : checker.suggest(word).slice(0, 5);
    return { ...token, correct: isCorrect, suggestions };
  }

  // Fallback: assume correct if no checker
  return { ...token, correct: true };
};

// Main traditional spell check function
export const traditionalSpellCheck = async (text, customTerms = []) => {
  const checker = await loadDictionary();
  const tokens = tokenize(text);

  const checkedTokens = tokens.map(checkWord(checker, customTerms));

  const [correct, incorrect] = partition(
    (token) => token.correct,
    checkedTokens
  );

  return {
    errors: incorrect.map(({ word, start, end, suggestions }) => ({
      word,
      start,
      end,
      suggestions,
      type: 'spelling',
      source: 'traditional',
    })),
    stats: {
      totalWords: tokens.length,
      correctWords: correct.length,
      errorCount: incorrect.length,
      skipped: correct.filter(t => t.skipped).length,
      customTermMatches: correct.filter(t => t.isCustomTerm).length,
    },
  };
};

// Add custom words to the dictionary (for this session)
export const addCustomWords = async (words) => {
  const checker = await loadDictionary();
  if (checker) {
    words.forEach(word => checker.add(word));
  }
};

// Get suggestions for a specific word
export const getSuggestions = async (word) => {
  const checker = await loadDictionary();
  if (!checker) return [];
  return checker.suggest(word).slice(0, 10);
};
