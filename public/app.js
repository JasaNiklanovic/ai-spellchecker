// Speaker Notes Spell Checker - Grammarly-inspired UI
// Traditional check first, AI adds more if enabled

// ============================================
// State
// ============================================

const state = {
  errors: [],
  currentErrorIndex: -1,
  originalText: '',
  aiConfigured: false,
  isChecking: false,
};

// ============================================
// DOM Elements
// ============================================

const elements = {
  slideContent: document.getElementById('slideContent'),
  editorContent: document.getElementById('editorContent'),
  checkBtn: document.getElementById('checkBtn'),
  aiToggle: document.getElementById('aiToggle'),
  resultsInfo: document.getElementById('resultsInfo'),
  issueCount: document.getElementById('issueCount'),
  aiStatus: document.getElementById('aiStatus'),
  // Popup elements
  popup: document.getElementById('suggestionPopup'),
  popupClose: document.getElementById('popupClose'),
  popupContext: document.getElementById('popupContext'),
  wrongWord: document.getElementById('wrongWord'),
  correctWord: document.getElementById('correctWord'),
  popupReason: document.getElementById('popupReason'),
  btnAccept: document.getElementById('btnAccept'),
  btnDismiss: document.getElementById('btnDismiss'),
  navPrev: document.getElementById('navPrev'),
  navNext: document.getElementById('navNext'),
  currentIndex: document.getElementById('currentIndex'),
  totalCount: document.getElementById('totalCount'),
};

// ============================================
// API
// ============================================

const api = {
  checkHealth: () =>
    fetch('/api/health')
      .then(r => r.json())
      .catch(() => ({ aiConfigured: false })),

  traditionalCheck: (text) =>
    fetch('/api/check/quick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, terminology: [] }),
    }).then(r => r.json()),

  aiCheck: (speakerNotes, slideContent) =>
    fetch('/api/check/full', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speakerNotes, slideContent, terminology: [] }),
    }).then(r => r.json()),
};

// ============================================
// Editor Functions
// ============================================

const getEditorText = () => {
  return elements.editorContent.innerText || '';
};

const setEditorContent = (html) => {
  elements.editorContent.innerHTML = html;
};

const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeRegex = (str) =>
  str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Apply highlights to the editor content
const applyHighlights = (text, errors) => {
  if (!errors.length) {
    setEditorContent(escapeHtml(text));
    return;
  }

  // Sort errors by word length (longest first to handle overlapping)
  // Keep track of original indices for correct popup mapping
  const sortedErrors = errors
    .map((error, originalIndex) => ({ error, originalIndex }))
    .sort((a, b) => b.error.word.length - a.error.word.length);

  let html = escapeHtml(text);
  const usedIndices = new Set();

  sortedErrors.forEach(({ error, originalIndex }) => {
    const escapedWord = escapeHtml(error.word);
    const regex = new RegExp(`\\b(${escapeRegex(escapedWord)})\\b`, 'gi');

    html = html.replace(regex, (match) => {
      const typeClass = error.type === 'terminology' ? 'terminology' :
                        error.type === 'grammar' ? 'grammar' : '';
      return `<span class="error-highlight ${typeClass}" data-error-index="${originalIndex}">${match}</span>`;
    });
  });

  setEditorContent(html);

  // Reattach click handlers to highlights
  document.querySelectorAll('.error-highlight').forEach(el => {
    el.addEventListener('click', handleHighlightClick);
  });
};

// ============================================
// Popup Functions
// ============================================

const showPopup = (errorIndex, anchorElement) => {
  const error = state.errors[errorIndex];
  if (!error) return;

  state.currentErrorIndex = errorIndex;

  // Update popup content
  const text = getEditorText();
  const wordIndex = text.toLowerCase().indexOf(error.word.toLowerCase());
  const contextStart = Math.max(0, wordIndex - 30);
  const contextEnd = Math.min(text.length, wordIndex + error.word.length + 30);
  const context = '...' + text.slice(contextStart, contextEnd) + '...';

  elements.popupContext.textContent = context;
  elements.wrongWord.textContent = error.word;
  elements.correctWord.textContent = error.suggestions?.[0] || error.suggestion || '?';
  elements.popupReason.textContent = error.reason || 'Potential issue';

  // Update navigation
  elements.currentIndex.textContent = errorIndex + 1;
  elements.totalCount.textContent = state.errors.length;
  elements.navPrev.disabled = errorIndex === 0;
  elements.navNext.disabled = errorIndex === state.errors.length - 1;

  // Position popup near the clicked element, never covering it
  let rect = anchorElement.getBoundingClientRect();

  // Show popup off-screen first to measure its actual size
  elements.popup.style.visibility = 'hidden';
  elements.popup.classList.remove('hidden');
  const popupRect = elements.popup.getBoundingClientRect();
  const popupHeight = popupRect.height;
  const popupWidth = popupRect.width;

  const gap = 12; // Space between highlight and popup
  const margin = 16; // Margin from viewport edges

  // Check if we need to scroll - ensure highlight is visible with room for popup
  const totalNeeded = rect.height + gap + popupHeight + margin * 2;
  const isHighlightVisible = rect.top >= margin && rect.bottom <= window.innerHeight - margin;

  if (!isHighlightVisible) {
    // Scroll the highlight into view, positioning it so there's room for popup
    const editorContent = document.getElementById('editorContent');
    const editorRect = editorContent.getBoundingClientRect();

    // Calculate where to scroll - prefer showing highlight with popup below
    const targetScrollTop = anchorElement.offsetTop - editorContent.offsetTop - 100;
    editorContent.scrollTop = Math.max(0, targetScrollTop);

    // Recalculate rect after scroll
    rect = anchorElement.getBoundingClientRect();
  }

  // Calculate available space above and below
  const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
  const spaceAbove = rect.top - gap - margin;

  let top, left;

  // Prefer below, but go above if not enough space
  if (spaceBelow >= popupHeight || spaceBelow >= spaceAbove) {
    // Position below
    top = rect.bottom + gap;
    // If it would overflow bottom, constrain it
    if (top + popupHeight > window.innerHeight - margin) {
      top = window.innerHeight - popupHeight - margin;
    }
  } else {
    // Position above
    top = rect.top - popupHeight - gap;
    // If it would overflow top, constrain it
    if (top < margin) {
      top = margin;
    }
  }

  // Horizontal positioning - center on the highlight, but keep in viewport
  left = rect.left + (rect.width / 2) - (popupWidth / 2);

  // Keep within horizontal bounds
  if (left < margin) {
    left = margin;
  } else if (left + popupWidth > window.innerWidth - margin) {
    left = window.innerWidth - popupWidth - margin;
  }

  elements.popup.style.top = `${top}px`;
  elements.popup.style.left = `${left}px`;
  elements.popup.style.visibility = 'visible';
};

const hidePopup = () => {
  elements.popup.classList.add('hidden');
  state.currentErrorIndex = -1;
};

const navigateError = (direction) => {
  const newIndex = state.currentErrorIndex + direction;
  if (newIndex >= 0 && newIndex < state.errors.length) {
    // Find highlight by data-error-index, not DOM position
    const targetHighlight = document.querySelector(`.error-highlight[data-error-index="${newIndex}"]`);
    if (targetHighlight) {
      showPopup(newIndex, targetHighlight);
    }
  }
};

// ============================================
// Action Handlers
// ============================================

const handleHighlightClick = (e) => {
  const index = parseInt(e.target.dataset.errorIndex, 10);
  showPopup(index, e.target);
};

const handleAccept = () => {
  const error = state.errors[state.currentErrorIndex];
  if (!error) return;

  const text = getEditorText();
  const suggestion = error.suggestions?.[0] || error.suggestion;
  if (!suggestion) return;

  // Replace the word in text
  const regex = new RegExp(`\\b${escapeRegex(error.word)}\\b`, 'gi');
  const newText = text.replace(regex, suggestion);

  // Remove this error from the list
  state.errors.splice(state.currentErrorIndex, 1);

  // Re-apply highlights
  applyHighlights(newText, state.errors);
  updateResultsInfo();

  // Navigate to next error or close popup
  if (state.errors.length > 0) {
    const nextIndex = Math.min(state.currentErrorIndex, state.errors.length - 1);
    // Find highlight by data-error-index, not DOM position
    const targetHighlight = document.querySelector(`.error-highlight[data-error-index="${nextIndex}"]`);
    if (targetHighlight) {
      showPopup(nextIndex, targetHighlight);
    } else {
      hidePopup();
    }
  } else {
    hidePopup();
  }
};

const handleDismiss = () => {
  // Remove this error from the list without fixing
  state.errors.splice(state.currentErrorIndex, 1);

  // Re-apply highlights
  const text = getEditorText();
  applyHighlights(text, state.errors);
  updateResultsInfo();

  // Navigate to next error or close popup
  if (state.errors.length > 0) {
    const nextIndex = Math.min(state.currentErrorIndex, state.errors.length - 1);
    // Find highlight by data-error-index, not DOM position
    const targetHighlight = document.querySelector(`.error-highlight[data-error-index="${nextIndex}"]`);
    if (targetHighlight) {
      showPopup(nextIndex, targetHighlight);
    } else {
      hidePopup();
    }
  } else {
    hidePopup();
  }
};

const updateResultsInfo = () => {
  if (state.errors.length > 0) {
    elements.resultsInfo.classList.remove('hidden');
    elements.issueCount.textContent = state.errors.length;
  } else {
    elements.resultsInfo.classList.add('hidden');
  }
};

// ============================================
// Check Functions
// ============================================

const setLoading = (loading, text = 'Check Spelling') => {
  state.isChecking = loading;
  elements.checkBtn.disabled = loading;

  if (loading) {
    elements.checkBtn.innerHTML = `<span class="spinner"></span> Checking...`;
    elements.checkBtn.classList.add('loading');
  } else {
    elements.checkBtn.innerHTML = text;
    elements.checkBtn.classList.remove('loading');
  }
};

const handleCheck = async () => {
  const text = getEditorText();
  if (!text.trim()) return;

  hidePopup();
  setLoading(true);
  state.errors = [];
  state.originalText = text;

  try {
    // Step 1: Traditional check (always runs)
    const traditionalResult = await api.traditionalCheck(text);
    const traditionalErrors = (traditionalResult.errors || []).map(err => ({
      ...err,
      reason: err.reason || 'Possible misspelling',
      source: 'traditional',
    }));

    // Sort by position in text so navigation follows reading order
    traditionalErrors.sort((a, b) => {
      const posA = text.toLowerCase().indexOf(a.word.toLowerCase());
      const posB = text.toLowerCase().indexOf(b.word.toLowerCase());
      return posA - posB;
    });

    state.errors = traditionalErrors;
    applyHighlights(text, state.errors);
    updateResultsInfo();

    // Step 2: AI check (if toggle is on)
    if (elements.aiToggle.checked && state.aiConfigured) {
      setLoading(true, 'AI analyzing...');
      elements.checkBtn.innerHTML = `<span class="spinner"></span> AI analyzing...`;

      const slideContent = elements.slideContent.value;
      const aiResult = await api.aiCheck(text, slideContent);

      if (aiResult.errors && aiResult.errors.length > 0) {
        // Smart merge: AI wins for terminology/contextual conflicts
        // Traditional is good for obvious typos, AI is better for context
        const aiErrors = aiResult.errors.map(e => ({ ...e, source: 'ai' }));

        // Build a map of AI errors by word for quick lookup
        const aiErrorsByWord = new Map();
        aiErrors.forEach(e => aiErrorsByWord.set(e.word.toLowerCase(), e));

        // Filter traditional errors: keep unless AI has a better contextual suggestion
        const filteredTraditional = state.errors.filter(tradErr => {
          const aiErr = aiErrorsByWord.get(tradErr.word.toLowerCase());
          if (!aiErr) return true; // AI didn't flag this word, keep traditional

          // AI flagged the same word - AI wins if it's terminology/contextual
          // (AI has slide context, so its suggestion is more relevant)
          if (aiErr.type === 'terminology' || aiErr.type === 'grammar') {
            return false; // Remove traditional, AI will provide better suggestion
          }

          // Both flagged as spelling - keep traditional (it's already displayed)
          return true;
        });

        // Add AI errors that aren't duplicates of remaining traditional errors
        const remainingWords = new Set(filteredTraditional.map(e => e.word.toLowerCase()));
        const newAiErrors = aiErrors.filter(e => !remainingWords.has(e.word.toLowerCase()));

        // Merge and sort by position in text so navigation follows reading order
        const mergedErrors = [...filteredTraditional, ...newAiErrors];
        mergedErrors.sort((a, b) => {
          const posA = text.toLowerCase().indexOf(a.word.toLowerCase());
          const posB = text.toLowerCase().indexOf(b.word.toLowerCase());
          return posA - posB;
        });

        state.errors = mergedErrors;
        applyHighlights(text, state.errors);
        updateResultsInfo();
      }
    }
  } catch (error) {
    console.error('Check failed:', error);
  } finally {
    setLoading(false);
  }
};

// ============================================
// Initialize
// ============================================

const init = async () => {
  // Check API health
  const health = await api.checkHealth();
  state.aiConfigured = health.aiConfigured;

  elements.aiStatus.textContent = health.aiConfigured ? 'Connected' : 'Not configured';
  elements.aiStatus.className = health.aiConfigured ? '' : 'disabled';

  // If AI not configured, disable toggle
  if (!health.aiConfigured) {
    elements.aiToggle.disabled = true;
  }

  // Event listeners
  elements.checkBtn.addEventListener('click', handleCheck);
  elements.popupClose.addEventListener('click', hidePopup);
  elements.btnAccept.addEventListener('click', handleAccept);
  elements.btnDismiss.addEventListener('click', handleDismiss);
  elements.navPrev.addEventListener('click', () => navigateError(-1));
  elements.navNext.addEventListener('click', () => navigateError(1));

  // Close popup when clicking outside
  document.addEventListener('click', (e) => {
    if (!elements.popup.contains(e.target) &&
        !e.target.classList.contains('error-highlight')) {
      hidePopup();
    }
  });

  // Handle keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (elements.popup.classList.contains('hidden')) return;

    if (e.key === 'Escape') {
      hidePopup();
    } else if (e.key === 'ArrowLeft') {
      navigateError(-1);
    } else if (e.key === 'ArrowRight') {
      navigateError(1);
    } else if (e.key === 'Enter') {
      handleAccept();
    }
  });

  // Paste as plain text
  elements.editorContent.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  });
};

init();
