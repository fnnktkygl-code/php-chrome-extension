import { SecurityService } from '../application/security.service';

/**
 * PHP Content Script - Robust, secure, and privacy-preserving clipboard capturer.
 */

document.addEventListener('copy', () => {
  try {
    const activeEl = document.activeElement;

    // Security check: Ignore copies triggered within password/sensitive fields
    if (SecurityService.isSensitiveElement(activeEl)) {
      return;
    }

    // 1. Synchronous selection capture (most reliable during copy event)
    const selection = window.getSelection()?.toString();

    if (selection && selection.trim().length > 0) {
      chrome.runtime
        .sendMessage({
          type: 'CLIPBOARD_COPY',
          text: selection,
          url: window.location.href,
          timestamp: Date.now()
        })
        .catch((err) => {
          console.debug('PHP Extension: Selection message dispatch skipped', err);
        });
      return;
    }

    // 2. Asynchronous fallback for input elements, code blocks, or context menu copies
    setTimeout(async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text && text.trim().length > 0) {
            chrome.runtime
              .sendMessage({
                type: 'CLIPBOARD_COPY',
                text: text,
                url: window.location.href,
                timestamp: Date.now()
              })
              .catch((err) => {
                console.debug('PHP Extension: Async clipboard dispatch skipped', err);
              });
          }
        }
      } catch {
        // Silently handle permission or focus restrictions
      }
    }, 150);
  } catch (err) {
    console.debug('PHP Extension: Copy capture error caught', err);
  }
});
