// content.js - Instant & Robust Multi-Event Clipboard Capture

let lastSelectedText = '';

function isSensitiveElement(el) {
  if (!el) return false;
  if (el.type === 'password' || el.getAttribute('type') === 'password') return true;
  const autocomplete = (el.getAttribute('autocomplete') || '').toLowerCase();
  if (autocomplete.includes('password') || autocomplete.includes('cc-number')) {
    return true;
  }
  if (el.getAttribute('data-sensitive') === 'true') return true;
  return false;
}

function getSelectedText(e) {
  let text = window.getSelection() ? window.getSelection().toString() : '';

  if (!text) {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      if (typeof activeEl.selectionStart === 'number' && typeof activeEl.selectionEnd === 'number') {
        text = activeEl.value.substring(activeEl.selectionStart, activeEl.selectionEnd);
      }
    }
  }

  if (!text && document.activeElement && document.activeElement.isContentEditable) {
    text = window.getSelection() ? window.getSelection().toString() : '';
  }

  if (!text && e && e.clipboardData) {
    try {
      text = e.clipboardData.getData('text/plain') || '';
    } catch {}
  }

  if (!text && lastSelectedText) {
    text = lastSelectedText;
  }

  return text;
}

function sendClipboardMessage(rawText) {
  try {
    const activeEl = document.activeElement;
    if (isSensitiveElement(activeEl)) return;

    const text = (rawText || '').trim();
    if (!text) return;

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      chrome.runtime.sendMessage({
        type: 'CLIPBOARD_COPY',
        text,
        url: window.location.href,
        timestamp: Date.now()
      }).catch(() => {});
    }
  } catch (err) {
    console.debug('PHP: sendClipboardMessage error', err);
  }
}

function handleCopyOrCut(e) {
  try {
    const text = getSelectedText(e);
    if (text && text.trim().length > 0) {
      sendClipboardMessage(text);
    } else {
      setTimeout(() => {
        const delayed = getSelectedText();
        if (delayed && delayed.trim().length > 0) {
          sendClipboardMessage(delayed);
        }
      }, 30);
    }
  } catch (err) {
    console.debug('PHP: Copy handler error', err);
  }
}

document.addEventListener('selectionchange', () => {
  try {
    const sel = window.getSelection() ? window.getSelection().toString() : '';
    if (sel && sel.trim().length > 0) {
      lastSelectedText = sel;
    }
  } catch {}
});

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C' || e.key === 'x' || e.key === 'X')) {
    const activeEl = document.activeElement;
    if (!isSensitiveElement(activeEl)) {
      const text = getSelectedText();
      if (text && text.trim().length > 0) {
        lastSelectedText = text;
      }
    }
  }
}, true);

document.addEventListener('copy', handleCopyOrCut, true);
document.addEventListener('cut', handleCopyOrCut, true);
window.addEventListener('copy', handleCopyOrCut, true);
window.addEventListener('cut', handleCopyOrCut, true);
