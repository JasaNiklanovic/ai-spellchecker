# Design Document: AI-Powered Speaker Notes Spell Checker

## Approach & Key Decisions

### 1. Hybrid Architecture (Traditional + AI)

**Decision**: Run traditional spell checking first, then AI analysis second.

**Rationale**:
- Traditional checkers catch ~80% of typos instantly and for free
- AI is reserved for what it does best: understanding context
- Reduces API costs by ~5-10x compared to AI-only approach
- Provides instant feedback while AI processes in background

**Trade-off**: Slightly more complex architecture, but significant cost and latency benefits.

### 2. Context Passing Strategy

**Decision**: Pass slide content directly in the prompt rather than using vector DB/RAG.

**Rationale**:
- A typical presentation (20-30 slides) is ~5-10K tokens—well within context window
- Vector DB adds infrastructure complexity and latency
- Direct context is more accurate for single-presentation checking
- Simpler to debug and maintain

**Trade-off**: Won't scale to enterprise "check against all company presentations" use case. For that, vector DB would be appropriate. This is noted as a future enhancement.

### 3. Functional Programming Style

**Decision**: Pure functions, immutable data, composition over inheritance.

**Implementation**:
- `fp.js` utilities: `pipe`, `compose`, `curry`, `Result` type
- State management via simple store pattern
- Side effects isolated to event handlers and API boundaries

**Benefits**:
- Easier to test (pure functions)
- Predictable state changes
- Aligns with Clojure philosophy (relevant for target role)

### 4. Terminology Extraction Feature

**Decision**: Allow users to extract brand/technical terms from slides automatically.

**Rationale**:
- Biggest pain point with traditional spell checkers: flagging correct domain terms
- Manual whitelist management is tedious
- AI can identify terms contextually (e.g., "K8s" as Kubernetes abbreviation)

## Trade-offs Considered

| Aspect | Choice | Alternative | Why This Choice |
|--------|--------|-------------|-----------------|
| AI Model | GPT-4o-mini | GPT-4o, Claude Sonnet | Fastest and cheapest option that's "good enough" for spell checking |
| Dictionary | nspell | LanguageTool, custom | Lightweight, no external service dependency |
| Frontend | Vanilla JS | React, Vue | Simplicity for POC, no build step needed |
| Highlighting | CSS overlay | ContentEditable | More predictable, easier to maintain |
| State | Custom store | Redux, Zustand | Minimal overhead for small app |

## Production Considerations

### Scalability
- **Current**: Single-user, single-presentation focus
- **Production**: Add request queuing, rate limiting per user
- **Enterprise**: Vector DB for organization-wide terminology, batch processing

### Privacy
- **Current**: All data sent to OpenAI API
- **Production considerations**:
  - Option for on-premise LLM (Llama, Mistral)
  - Data retention policies
  - PII detection before sending to API
  - Opt-in analytics

### Offline Support
- **Current**: Requires internet for AI features
- **Production**:
  - Traditional check works offline already
  - Cache extracted terminology locally
  - Progressive Web App for offline-first experience
  - Local LLM option (Ollama integration)

### Performance
- **Current**: Synchronous checking on button click
- **Production**:
  - Debounced real-time checking
  - Web Workers for non-blocking traditional check
  - Streaming AI responses for progressive feedback

## Future AI Enhancements

### 1. Tone Consistency Checker
Analyze speaker notes for consistent tone (formal vs. casual) and flag jarring transitions. Useful for presentations written by multiple people.

### 2. Audience Adaptation
"Simplify for non-technical audience" or "Add technical depth" suggestions based on detected audience level in slide content.

### 3. Timing Estimation
Estimate speaking time per slide based on notes length and complexity. Flag slides that are too dense or too sparse.

### 4. Cross-Slide Coherence
Check for narrative flow across slides. Detect if speaker notes tell a coherent story or have logical gaps.

### 5. Pronunciation Guide
For technical terms and names, auto-generate phonetic pronunciation hints in speaker notes.

## Evaluation Strategy

### Testing the Feature's Effectiveness

1. **Precision/Recall Testing**
   - Create test corpus of speaker notes with known errors
   - Include: typos, wrong words, brand name misspellings, grammar issues
   - Measure: precision (flagged items that are actual errors) and recall (errors caught)

2. **A/B Comparison**
   - Compare against: Word spell check, Grammarly, LanguageTool
   - Metrics: errors caught, false positives, time to correct

3. **User Testing**
   - Task: "Prepare these speaker notes for a presentation"
   - Measure: time to completion, final error count, user satisfaction

### Key Metrics

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Precision | >90% | Avoid annoying false positives |
| Recall | >85% | Catch real errors before presenting |
| Latency (quick) | <100ms | Real-time feedback feel |
| Latency (full) | <3s | Acceptable for "check document" action |
| Cost per check | <$0.01 | Sustainable at scale |
| User correction rate | >60% | Users trust and apply suggestions |

### Qualitative Evaluation
- Do users feel more confident in their notes?
- Does it catch errors traditional checkers miss?
- Is the terminology extraction useful?
- Would users pay for this feature?

## Conclusion

This POC demonstrates a pragmatic approach to AI-enhanced spell checking:
- Use AI where it adds unique value (context understanding)
- Keep traditional methods for what they do well (fast typo detection)
- Design for real user workflows (extract terms → check notes → apply fixes)
- Consider production realities (cost, privacy, offline) even in a prototype

The hybrid approach provides the best of both worlds: instant feedback for obvious errors and intelligent analysis for contextual issues—at a fraction of the cost of AI-only solutions.
