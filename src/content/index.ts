import { SecurityService } from '../application/security.service';

/**
 * PHP Content Script - Robust, reliable, and secure clipboard capturer.
 */

function getSelectedText(e?: ClipboardEvent): string {
  // 1. Check window standard selection
  let text = window.getSelection()?.toString() || '';

  // 2. If empty, check focused input or textarea element
  if (!text) {
    const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      if (typeof activeEl.selectionStart === 'number' && typeof activeEl.selectionEnd === 'number') {
        text = activeEl.value.substring(activeEl.selectionStart, activeEl.selectionEnd);
      }
    }
  }

  // 3. If still empty, check contentEditable container
  if (!text && document.activeElement && (document.activeElement as HTMLElement).isContentEditable) {
    text = window.getSelection()?.toString() || '';
  }

  // 4. If still empty, check clipboardData if available
  if (!text && e && e.clipboardData) {
    try {
      text = e.clipboardData.getData('text/plain') || '';
    } catch {
      // Ignore clipboardData read restrictions
    }
  }

  return text;
}

function handleCopyOrCut(e: ClipboardEvent): void {
  try {
    const activeEl = document.activeElement;

    // Security check: Ignore copies inside password or sensitive form fields
    if (SecurityService.isSensitiveElement(activeEl)) {
      return;
    }

    const text = getSelectedText(e);

    if (text && text.trim().length > 0) {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        chrome.runtime
          .sendMessage({
            type: 'CLIPBOARD_COPY',
            text: text.trim(),
            url: window.location.href,
            timestamp: Date.now()
          })
          .catch((err) => {
            console.debug('PHP: Direct copy message skipped', err);
          });
      }
    }
  } catch (err) {
    console.debug('PHP: Copy handler error', err);
  }
}

// Attach listeners for both 'copy' and 'cut'
document.addEventListener('copy', handleCopyOrCut, true);
document.addEventListener('cut', handleCopyOrCut, true);
