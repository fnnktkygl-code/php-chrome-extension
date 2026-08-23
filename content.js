// content.js - Robust Multi-source Clipboard Capture

function isSensitiveElement(el) {
  if (!el) return false;
  if (el.type === 'password' || el.getAttribute('type') === 'password') return true;
  const autocomplete = el.getAttribute('autocomplete');
  if (autocomplete && (autocomplete.includes('password') || autocomplete.includes('current-password') || autocomplete.includes('new-password'))) {
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
    } catch {
      // Ignore
    }
  }

  return text;
}

function handleCopyOrCut(e) {
  try {
    const activeEl = document.activeElement;
    if (isSensitiveElement(activeEl)) {
      return;
    }

    const text = getSelectedText(e);
    if (text && text.trim().length > 0) {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({
          type: 'CLIPBOARD_COPY',
          text: text.trim(),
          url: window.location.href,
          timestamp: Date.now()
        }).catch(err => console.debug('PHP: Copy message skipped', err));
      }
    }
  } catch (err) {
    console.debug('PHP: Copy handler error', err);
  }
}

document.addEventListener('copy', handleCopyOrCut, true);
document.addEventListener('cut', handleCopyOrCut, true);
