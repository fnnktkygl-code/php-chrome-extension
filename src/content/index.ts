import { SecurityService } from '../application/security.service';

/**
 * PHP Content Script - Instant & Bulletproof Clipboard Capturer.
 * Intercepts copy events, shortcut keys (Cmd+C / Ctrl+C), context menus, and input selections.
 */

let lastSelectedText = '';

function getSelectedText(e?: ClipboardEvent): string {
  // 1. Check window selection
  let text = window.getSelection()?.toString() || '';

  // 2. Check active input / textarea element
  if (!text) {
    const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      if (typeof activeEl.selectionStart === 'number' && typeof activeEl.selectionEnd === 'number') {
        text = activeEl.value.substring(activeEl.selectionStart, activeEl.selectionEnd);
      }
    }
  }

  // 3. Check contentEditable container
  if (!text && document.activeElement && (document.activeElement as HTMLElement).isContentEditable) {
    text = window.getSelection()?.toString() || '';
  }

  // 4. Check clipboardData from event
  if (!text && e && e.clipboardData) {
    try {
      text = e.clipboardData.getData('text/plain') || '';
    } catch {
      // Ignore
    }
  }

  // 5. Fallback to pre-buffered selection
  if (!text && lastSelectedText) {
    text = lastSelectedText;
  }

  return text;
}

function sendClipboardMessage(rawText: string): void {
  try {
    const activeEl = document.activeElement;

    // Security check: Ignore copies inside sensitive / password fields
    if (SecurityService.isSensitiveElement(activeEl)) {
      return;
    }

    const text = rawText.trim();
    if (!text) return;

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      chrome.runtime
        .sendMessage({
          type: 'CLIPBOARD_COPY',
          text,
          url: window.location.href,
          timestamp: Date.now()
        })
        .catch((err) => {
          console.debug('PHP Content Script: Message dispatch skipped', err);
        });
    }
  } catch (err) {
    console.debug('PHP Content Script: Send error', err);
  }
}

function handleCopyOrCut(e: ClipboardEvent): void {
  try {
    const text = getSelectedText(e);
    if (text && text.trim().length > 0) {
      sendClipboardMessage(text);
    } else {
      // Asynchronous fallback for web apps that mutate selection on copy
      setTimeout(() => {
        const delayed = getSelectedText();
        if (delayed && delayed.trim().length > 0) {
          sendClipboardMessage(delayed);
        }
      }, 30);
    }
  } catch (err) {
    console.debug('PHP Content Script: Copy event error', err);
  }
}

// 1. Buffer selection continuously on selectionchange / keydown / contextmenu
document.addEventListener('selectionchange', () => {
  try {
    const sel = window.getSelection()?.toString();
    if (sel && sel.trim().length > 0) {
      lastSelectedText = sel;
    }
  } catch {}
});

// 2. Pre-buffer on Cmd+C / Ctrl+C / Cmd+X / Ctrl+X
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C' || e.key === 'x' || e.key === 'X')) {
    const activeEl = document.activeElement;
    if (!SecurityService.isSensitiveElement(activeEl)) {
      const text = getSelectedText();
      if (text && text.trim().length > 0) {
        lastSelectedText = text;
      }
    }
  }
}, true);

// 3. Attach listeners on capturing phase
document.addEventListener('copy', handleCopyOrCut, true);
document.addEventListener('cut', handleCopyOrCut, true);
window.addEventListener('copy', handleCopyOrCut, true);
window.addEventListener('cut', handleCopyOrCut, true);
