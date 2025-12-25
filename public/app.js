// Speaker Notes Spell Checker - Compact UI with Modal

// ============================================
// State
// ============================================

const state = {
  errors: [],
  currentErrorIndex: -1,
  originalText: '',
  aiConfigured: false,
  isChecking: false,
  slideContext: '',
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
  correctAllBtn: document.getElementById('correctAllBtn'),
  aiStatus: document.getElementById('aiStatus'),
  editorStatus: document.getElementById('editorStatus'),
  statusText: document.getElementById('statusText'),
  // Context button & modal
  slideContextBtn: document.getElementById('slideContextBtn'),
  contextModal: document.getElementById('contextModal'),
  modalClose: document.getElementById('modalClose'),
  modalSave: document.getElementById('modalSave'),
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
  // innerText can produce extra newlines from div/br structure
  // Normalize: collapse 3+ newlines to 2 (preserve paragraph breaks)
  const text = elements.editorContent.innerText || '';
  return text.replace(/\n{3,}/g, '\n\n').trim();
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
// Modal Functions
// ============================================

const openModal = () => {
  elements.contextModal.classList.remove('hidden');
  elements.slideContent.focus();
};

const closeModal = () => {
  elements.contextModal.classList.add('hidden');
};

const saveContext = () => {
  state.slideContext = elements.slideContent.value.trim();
  updateContextButton();
  closeModal();
};

const updateContextButton = () => {
  if (state.slideContext) {
    const wordCount = state.slideContext.split(/\s+/).length;
    elements.slideContextBtn.innerHTML = `<span class="step-num">1</span> ${wordCount} words loaded`;
    elements.slideContextBtn.classList.add('has-context');
  } else {
    elements.slideContextBtn.innerHTML = `<span class="step-num">1</span> Add slide context`;
    elements.slideContextBtn.classList.remove('has-context');
  }
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

  const gap = 12;
  const margin = 16;

  // Check if we need to scroll
  const isHighlightVisible = rect.top >= margin && rect.bottom <= window.innerHeight - margin;

  if (!isHighlightVisible) {
    const editorContent = document.getElementById('editorContent');
    const targetScrollTop = anchorElement.offsetTop - editorContent.offsetTop - 100;
    editorContent.scrollTop = Math.max(0, targetScrollTop);
    rect = anchorElement.getBoundingClientRect();
  }

  // Calculate available space above and below
  const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
  const spaceAbove = rect.top - gap - margin;

  let top, left;

  // Prefer below, but go above if not enough space
  if (spaceBelow >= popupHeight || spaceBelow >= spaceAbove) {
    top = rect.bottom + gap;
    if (top + popupHeight > window.innerHeight - margin) {
      top = window.innerHeight - popupHeight - margin;
    }
  } else {
    top = rect.top - popupHeight - gap;
    if (top < margin) {
      top = margin;
    }
  }

  // Horizontal positioning
  left = rect.left + (rect.width / 2) - (popupWidth / 2);

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
  state.errors.splice(state.currentErrorIndex, 1);

  const text = getEditorText();
  applyHighlights(text, state.errors);
  updateResultsInfo();

  if (state.errors.length > 0) {
    const nextIndex = Math.min(state.currentErrorIndex, state.errors.length - 1);
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

const handleCorrectAll = () => {
  if (state.errors.length === 0) return;

  hidePopup();
  let text = getEditorText();

  // Find positions and sort by position descending (end to start)
  const errorsWithPositions = state.errors
    .map(error => {
      const suggestion = error.suggestions?.[0] || error.suggestion;
      if (!suggestion) return null;

      const regex = new RegExp(`\\b${escapeRegex(error.word)}\\b`, 'gi');
      const match = regex.exec(text);
      if (!match) return null;

      return {
        error,
        suggestion,
        position: match.index,
        word: match[0],
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.position - a.position);

  // Apply all corrections from end to start
  errorsWithPositions.forEach(({ position, word, suggestion }) => {
    text = text.slice(0, position) + suggestion + text.slice(position + word.length);
  });

  // Clear all errors and update UI
  state.errors = [];
  setEditorContent(escapeHtml(text));
  updateResultsInfo();
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

const showStatus = (message, isDone = false) => {
  elements.statusText.textContent = message;
  elements.editorStatus.classList.remove('hidden', 'done');
  if (isDone) {
    elements.editorStatus.classList.add('done');
    setTimeout(() => {
      elements.editorStatus.classList.add('hidden');
    }, 2000);
  }
};

const hideStatus = () => {
  elements.editorStatus.classList.add('hidden');
};

const handleCheck = async () => {
  const text = getEditorText();
  if (!text.trim()) return;

  hidePopup();
  setLoading(true);
  state.errors = [];
  state.originalText = text;

  try {
    const useAI = elements.aiToggle.checked && state.aiConfigured;

    // Step 1: Traditional check (fast, no status needed)
    const traditionalResult = await api.traditionalCheck(text);
    const traditionalErrors = (traditionalResult.errors || []).map(err => ({
      ...err,
      reason: err.reason || 'Possible misspelling',
      source: 'traditional',
    }));

    // Sort by position in text
    traditionalErrors.sort((a, b) => {
      const posA = text.toLowerCase().indexOf(a.word.toLowerCase());
      const posB = text.toLowerCase().indexOf(b.word.toLowerCase());
      return posA - posB;
    });

    state.errors = traditionalErrors;
    applyHighlights(text, state.errors);
    updateResultsInfo();

    // Step 2: AI check (if toggle is on)
    if (useAI) {
      showStatus('Typos checked. AI matching your brand terminology ...');
      elements.checkBtn.innerHTML = `<span class="spinner"></span> Checking with AI ...`;
      elements.checkBtn.disabled = true;

      const slideContent = state.slideContext;
      const aiResult = await api.aiCheck(text, slideContent);

      if (aiResult.errors && aiResult.errors.length > 0) {
        const aiErrors = aiResult.errors.map(e => ({ ...e, source: 'ai' }));

        const aiErrorsByWord = new Map();
        aiErrors.forEach(e => aiErrorsByWord.set(e.word.toLowerCase(), e));

        const filteredTraditional = state.errors.filter(tradErr => {
          const aiErr = aiErrorsByWord.get(tradErr.word.toLowerCase());
          if (!aiErr) return true;
          if (aiErr.type === 'terminology' || aiErr.type === 'grammar') {
            return false;
          }
          return true;
        });

        const remainingWords = new Set(filteredTraditional.map(e => e.word.toLowerCase()));
        const newAiErrors = aiErrors.filter(e => !remainingWords.has(e.word.toLowerCase()));

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
    hideStatus();
  } finally {
    setLoading(false);
    if (elements.aiToggle.checked && state.aiConfigured) {
      showStatus('Done! Click underlined words to review.', true);
    }
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

  if (!health.aiConfigured) {
    elements.aiToggle.disabled = true;
    elements.aiToggle.parentElement.style.opacity = '0.5';
  }

  // Event listeners
  elements.checkBtn.addEventListener('click', handleCheck);
  elements.correctAllBtn.addEventListener('click', handleCorrectAll);
  elements.popupClose.addEventListener('click', hidePopup);
  elements.btnAccept.addEventListener('click', handleAccept);
  elements.btnDismiss.addEventListener('click', handleDismiss);
  elements.navPrev.addEventListener('click', () => navigateError(-1));
  elements.navNext.addEventListener('click', () => navigateError(1));

  // Modal listeners
  elements.slideContextBtn.addEventListener('click', openModal);
  elements.modalClose.addEventListener('click', closeModal);
  elements.modalSave.addEventListener('click', saveContext);
  elements.contextModal.querySelector('.modal-backdrop').addEventListener('click', closeModal);

  // Close popup when clicking outside
  document.addEventListener('click', (e) => {
    if (!elements.popup.contains(e.target) &&
        !e.target.classList.contains('error-highlight')) {
      hidePopup();
    }
  });

  // Handle keyboard navigation
  document.addEventListener('keydown', (e) => {
    // Modal escape
    if (!elements.contextModal.classList.contains('hidden') && e.key === 'Escape') {
      closeModal();
      return;
    }

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
