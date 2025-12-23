# Speaker Notes Spell Checker

Context-aware spell checking for presentation speaker notes. Combines traditional dictionary checking with AI-powered contextual analysis.

## Quick Start

```bash
npm install
cp .env.example .env  # Add your OPENAI_API_KEY
npm start             # Open http://localhost:3000
```

## Features

- **Hybrid checking**: Fast dictionary check + AI contextual analysis
- **Terminology awareness**: Matches informal terms to your slide content (e.g., "gtm" → "go-to-market")
- **Grammarly-style UI**: Click highlighted words, accept/dismiss suggestions
- **Smart merging**: AI suggestions override unhelpful dictionary suggestions

## How It Works

1. **Traditional check** runs first (instant, free) - catches obvious typos
2. **AI check** adds context (if enabled) - catches terminology mismatches, grammar issues
3. **Smart merge** - AI wins for terminology conflicts (e.g., "gtm" → "go-to-market" beats "gtm" → "gem")

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Server status |
| `/api/check/quick` | POST | Traditional check only |
| `/api/check/full` | POST | Full hybrid check |

## Development

```bash
npm run dev   # Auto-reload on changes
npm test      # Run tests
```

## Environment

```
OPENAI_API_KEY=your_key_here
PORT=3000
```
