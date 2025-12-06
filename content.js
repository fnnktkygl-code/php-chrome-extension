// content.js - Robust Production Version
// Uses synchronous selection capture for maximum stability

document.addEventListener('copy', () => {
  try {
    // 1. Try to get the selection from the window immediately (Synchronous)
    // This is the most reliable method during a 'copy' event.
    const selection = window.getSelection().toString();

    if (selection && selection.trim().length > 0) {
      chrome.runtime.sendMessage({
        type: 'CLIPBOARD_COPY',
        text: selection,
        url: window.location.href,
        timestamp: Date.now()
      }).catch(err => console.debug('PHP Extension: Send failed', err));
      return;
    }

    // 2. Fallback: If window selection is empty (e.g. copying from a specific input element or "Copy Link Address"),
    // we can try the async clipboard API.
    // We wait slightly longer to ensure the system clipboard has been updated.
    setTimeout(async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text && text.trim().length > 0) {
          chrome.runtime.sendMessage({
            type: 'CLIPBOARD_COPY',
            text: text,
            url: window.location.href,
            timestamp: Date.now()
          }).catch(err => console.debug('PHP Extension: Send failed', err));
        }
      } catch (err) {
        // Silently fail on permission errors
      }
    }, 200);

  } catch (e) {
    // Catch-all for any unexpected runtime errors
    console.debug('PHP Extension: Copy event capture failed', e);
  }
});
