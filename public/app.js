// Frontend application - Simplified UX
// AI handles terminology automatically, user just pastes content and clicks check

// ============================================
// State Management
// ============================================

const createStore = (initialState) => {
  let state = initialState;
  const listeners = new Set();

  return {
    getState: () => state,
    setState: (updater) => {
      state = typeof updater === 'function' ? updater(state) : { ...state, ...updater };
      listeners.forEach(fn => fn(state));
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
};

const store = createStore({
  errors: [],
  isLoading: false,
  lastCheck: null,
  stats: null,
  aiConfigured: false,
});

// ============================================
// Pure Helper Functions
// ============================================

const escapeHtml = (text) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

const sortByPosition = (errors) =>
  [...errors].sort((a, b) => (b.start || 0) - (a.start || 0));

const findWordPositions = (text, word) => {
  const positions = [];
  const regex = new RegExp(`\\b${word}\\b`, 'gi');
  let match;
  while ((match = regex.exec(text)) !== null) {
    positions.push({ start: match.index, end: match.index + word.length });
  }
  return positions;
};

// ============================================
// API Functions
// ============================================

const api = {
  checkHealth: () =>
    fetch('/api/health')
      .then(r => r.json())
      .catch(() => ({ status: 'error', aiConfigured: false })),

  quickCheck: (text) =>
    fetch('/api/check/quick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, terminology: [] }),
    })
      .then(r => r.json())
      .catch(() => ({ errors: [], stats: {} })),

  fullCheck: (speakerNotes, slideContent) =>
    fetch('/api/check/full', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speakerNotes, slideContent, terminology: [] }),
    })
      .then(r => r.json())
      .catch(() => ({ errors: [], stats: {}, fallbackMode: true })),
};

// ============================================
// DOM References
// ============================================

const elements = {
  slideContent: document.getElementById('slideContent'),
  speakerNotes: document.getElementById('speakerNotes'),
  highlights: document.getElementById('highlights'),
  quickCheck: document.getElementById('quickCheck'),
  fullCheck: document.getElementById('fullCheck'),
  errors: document.getElementById('errors'),
  stats: document.getElementById('stats'),
  status: document.getElementById('status'),
  aiStatus: document.getElementById('aiStatus'),
};

// ============================================
// Render Functions
// ============================================

const renderHighlights = (text, errors) => {
  if (!errors.length) {
    elements.highlights.innerHTML = escapeHtml(text);
    return;
  }

  const allPositions = errors.flatMap(error => {
    const positions = findWordPositions(text, error.word);
    return positions.map(pos => ({ ...pos, type: error.type }));
  });

  const sorted = sortByPosition(allPositions);

  let result = text;
  sorted.forEach(({ start, end, type }) => {
    const word = result.slice(start, end);
    const className = type === 'grammar' || type === 'tone' ? 'highlight-warning' : 'highlight-error';
    result = result.slice(0, start) +
      `<mark class="${className}">${escapeHtml(word)}</mark>` +
      result.slice(end);
  });

  elements.highlights.innerHTML = result;
};

const getTypeLabel = (type) => {
  const labels = {
    spelling: 'Spelling',
    terminology: 'Terminology',
    tone: 'Tone',
    grammar: 'Grammar',
  };
  return labels[type] || type;
};

const getTypeClass = (type) => {
  if (type === 'tone' || type === 'grammar') return 'warning';
  if (type === 'terminology') return 'terminology';
  return '';
};

const renderErrors = (errors) => {
  if (!errors.length) {
    elements.errors.innerHTML = '<p class="placeholder success">No issues found! Your speaker notes look good.</p>';
    return;
  }

  elements.errors.innerHTML = errors.map(error => `
    <div class="error-card ${getTypeClass(error.type)} ${error.confidence === 'low' ? 'low-confidence' : ''}" data-word="${escapeHtml(error.word)}">
      <div class="error-header">
        <span class="error-word">${escapeHtml(error.word)}</span>
        <span class="error-type ${error.type}">${getTypeLabel(error.type)}</span>
      </div>
      <div class="error-reason">${escapeHtml(error.reason)}</div>
      ${error.context ? `<div class="error-context">"...${escapeHtml(error.context)}..."</div>` : ''}
      <div class="suggestions">
        ${(error.suggestions || []).slice(0, 5).map(s => `
          <button class="suggestion" data-original="${escapeHtml(error.word)}" data-suggestion="${escapeHtml(s)}">
            ${escapeHtml(s)}
          </button>
        `).join('')}
      </div>
    </div>
  `).join('');
};

const renderStats = (stats) => {
  if (!stats) {
    elements.stats.innerHTML = '';
    return;
  }

  const parts = [];
  if (stats.ai?.usage) {
    parts.push(`<span>AI tokens: ${stats.ai.usage.inputTokens + stats.ai.usage.outputTokens}</span>`);
  }
  if (stats.totalTime) {
    parts.push(`<span>${stats.totalTime}ms</span>`);
  }

  elements.stats.innerHTML = parts.join('');
};

const setStatus = (text, type = '') => {
  elements.status.textContent = text;
  elements.status.className = `status ${type}`;
};

const setLoading = (isLoading) => {
  elements.quickCheck.disabled = isLoading;
  elements.fullCheck.disabled = isLoading;
  setStatus(isLoading ? 'Analyzing...' : 'Ready', isLoading ? 'loading' : '');
};

// ============================================
// Event Handlers
// ============================================

const handleQuickCheck = async () => {
  const text = elements.speakerNotes.value;
  if (!text.trim()) {
    setStatus('Enter speaker notes first', 'error');
    return;
  }

  setLoading(true);
  try {
    const result = await api.quickCheck(text);
    store.setState({
      errors: result.errors || [],
      stats: { traditional: result.stats },
      lastCheck: 'quick',
    });
  } catch (error) {
    setStatus('Check failed', 'error');
  } finally {
    setLoading(false);
  }
};

const handleFullCheck = async () => {
  const speakerNotes = elements.speakerNotes.value;
  if (!speakerNotes.trim()) {
    setStatus('Enter speaker notes first', 'error');
    return;
  }

  setLoading(true);
  setStatus('AI analyzing...', 'loading');

  try {
    const result = await api.fullCheck(
      speakerNotes,
      elements.slideContent.value
    );
    store.setState({
      errors: result.errors || [],
      stats: result.stats,
      lastCheck: 'full',
    });

    if (result.fallbackMode) {
      setStatus('AI unavailable, used dictionary only');
    }
  } catch (error) {
    setStatus('Check failed', 'error');
  } finally {
    setLoading(false);
  }
};

const handleApplySuggestion = (original, suggestion) => {
  const text = elements.speakerNotes.value;
  const regex = new RegExp(`\\b${original}\\b`, 'g');
  elements.speakerNotes.value = text.replace(regex, suggestion);

  store.setState(state => ({
    errors: state.errors.filter(e => e.word.toLowerCase() !== original.toLowerCase()),
  }));
};

// ============================================
// Initialize
// ============================================

const init = async () => {
  // Check API health
  const health = await api.checkHealth();
  store.setState({ aiConfigured: health.aiConfigured });

  elements.aiStatus.textContent = health.aiConfigured ? 'Connected' : 'Not configured';
  elements.aiStatus.className = health.aiConfigured ? '' : 'disabled';

  // Subscribe to state changes
  store.subscribe(state => {
    renderErrors(state.errors);
    renderStats(state.stats);
    renderHighlights(elements.speakerNotes.value, state.errors);
  });

  // Event listeners
  elements.quickCheck.addEventListener('click', handleQuickCheck);
  elements.fullCheck.addEventListener('click', handleFullCheck);

  elements.errors.addEventListener('click', (e) => {
    if (e.target.classList.contains('suggestion')) {
      const { original, suggestion } = e.target.dataset;
      handleApplySuggestion(original, suggestion);
      e.target.classList.add('applied');
    }
  });

  // Sync highlights with textarea scroll
  elements.speakerNotes.addEventListener('scroll', () => {
    elements.highlights.scrollTop = elements.speakerNotes.scrollTop;
  });

  // Re-render highlights on text change
  elements.speakerNotes.addEventListener('input', debounce(() => {
    renderHighlights(elements.speakerNotes.value, store.getState().errors);
  }, 100));

  setStatus('Ready');
};

init();
