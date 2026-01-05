// Main server entry point
import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { hybridSpellCheck, quickCheck } from './spellcheck/hybrid.js';
import { extractTerminology } from './spellcheck/ai.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    aiConfigured: !!process.env.OPENAI_API_KEY,
  });
});

// Quick spell check (traditional only, for real-time)
app.post('/api/check/quick', async (req, res) => {
  try {
    const { text, terminology = [] } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const result = await quickCheck(text, terminology);
    res.json(result);
  } catch (error) {
    console.error('Quick check error:', error);
    res.status(500).json({ error: 'Spell check failed' });
  }
});

// Full spell check (traditional + AI)
app.post('/api/check/full', async (req, res) => {
  try {
    const { speakerNotes, slideContent, terminology = [] } = req.body;

    if (!speakerNotes) {
      return res.status(400).json({ error: 'Speaker notes are required' });
    }

    const result = await hybridSpellCheck({
      speakerNotes,
      slideContent,
      terminology,
    });

    res.json(result);
  } catch (error) {
    console.error('Full check error:', error);
    res.status(500).json({ error: 'Spell check failed' });
  }
});

// Extract terminology from slide content
app.post('/api/terminology/extract', async (req, res) => {
  try {
    const { slideContent } = req.body;

    if (!slideContent) {
      return res.status(400).json({ error: 'Slide content is required' });
    }

    const result = await extractTerminology(slideContent);

    if (result.ok) {
      res.json({ terminology: result.value });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Terminology extraction error:', error);
    res.status(500).json({ error: 'Extraction failed' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     AI-Powered Speaker Notes Spell Checker                ║
╠═══════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                 ║
║  AI Status: ${process.env.OPENAI_API_KEY ? 'Configured ✓' : 'Not configured (set OPENAI_API_KEY)'}      ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
