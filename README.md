# AI-Powered Speaker Notes Spell Checker

A context-aware spell checking system for presentation speaker notes that combines traditional dictionary-based checking with AI-powered contextual analysis.

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file and add your API key
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Start the server
npm start

# Open http://localhost:3000 in your browser
```

## Features

- **Hybrid spell checking**: Traditional dictionary check (fast, free) + AI contextual check (smart, thorough)
- **Context-aware**: Understands slide content to avoid flagging brand names, technical terms, and domain jargon
- **Terminology extraction**: Automatically extracts technical terms from your slides
- **Real-time feedback**: Quick check for instant typo detection while typing
- **Suggestion UI**: Click-to-apply corrections with visual highlighting

## Architecture

```
src/
├── index.js                 # Express server
├── spellcheck/
│   ├── traditional.js       # Dictionary-based spell check (nspell)
│   ├── ai.js               # OpenAI GPT-4o-mini contextual check
│   └── hybrid.js           # Combines both approaches
└── utils/
    └── fp.js               # Functional programming utilities

public/
├── index.html              # Main UI
├── styles.css              # Styling
└── app.js                  # Frontend logic (functional pattern)
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Check server and AI status |
| `/api/check/quick` | POST | Fast traditional spell check |
| `/api/check/full` | POST | Full hybrid check (traditional + AI) |
| `/api/terminology/extract` | POST | Extract terms from slide content |

## How It Works

1. **Quick Check (Traditional)**
   - Uses nspell (Hunspell-compatible) dictionary
   - Instant feedback, no API costs
   - Catches obvious typos

2. **Full Check (Hybrid)**
   - First runs traditional check
   - Then sends to GPT-4o-mini for contextual analysis
   - AI catches: wrong word usage, inconsistent capitalization, near-miss brand names
   - Respects custom terminology list

3. **Terminology Extraction**
   - AI analyzes slide content
   - Extracts brand names, acronyms, technical terms
   - These terms are preserved during spell checking

## Configuration

Environment variables (`.env`):

```
OPENAI_API_KEY=your_key_here
PORT=3000
```

## Development

```bash
# Run with auto-reload
npm run dev
```

## Cost Considerations

### Why GPT-4o-mini?

For spell checking, we need **fast + cheap + good enough** — not the smartest model. I evaluated several options:

| Model | Latency | Cost per check* | Quality |
|-------|---------|-----------------|---------|
| **GPT-4o-mini** | ~0.5-1s | **~$0.0003** | ✓ Good enough |
| Claude Haiku 3.5 | ~0.5-1s | ~$0.001 | ✓ Good |
| GPT-4o | ~1-2s | ~$0.004 | Overkill |
| Claude Sonnet | ~1-2s | ~$0.006 | Overkill |

*Per check with ~1000 token input, ~200 token output

**GPT-4o-mini is 5-20x cheaper** than larger models while being fast and accurate enough for catching contextual spelling errors. For a feature that might run dozens of times per presentation, this adds up.

### Cost Breakdown

| Operation | Tokens | Cost |
|-----------|--------|------|
| Quick check | 0 | Free (local dictionary) |
| Full AI check | ~1000-1500 | ~$0.0003 |
| Terminology extraction | ~500-800 | ~$0.0002 |

**Example**: Checking a 30-slide presentation with 5 full AI checks = ~$0.0015 total.

### The Hybrid Approach

The traditional spell checker catches ~80% of typos instantly and for free. AI is reserved for what it does best:
- Understanding context ("Gogle" → "Google")
- Brand name capitalization
- Industry-specific terminology

This hybrid approach reduces AI costs by ~5-10x compared to AI-only checking.
