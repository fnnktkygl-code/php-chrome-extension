// content.js

function handleCopyEvent() {
    // This is the most reliable check. It stops the script if it's running in a context
    // where it cannot communicate with the extension (e.g., a sandboxed iframe or after an update).
    if (!chrome.runtime || !chrome.runtime.id) {
      return;
    }
  
    try {
      const copiedText = window.getSelection().toString().trim();
  
      // Ignore empty or overly long selections.
      if (!copiedText || copiedText.length > 5000) {
        return;
      }
  
      // Wrap the API call in its own try-catch to handle the "context invalidated" error specifically.
      try {
        chrome.runtime.sendMessage({
          type: 'CLIPBOARD_COPY',
          text: copiedText,
          url: window.location.href,
          timestamp: Date.now()
        }, () => {
          // This callback gracefully handles the "message port closed" error.
          if (chrome.runtime.lastError) {
            // It's safe to ignore this error as it doesn't crash the script.
          }
        });
      } catch (error) {
        if (error.message.includes("Extension context invalidated")) {
          console.log("Clipboard History: Context was invalidated. Ignoring copy event.");
        } else {
          console.error("Clipboard History: An unexpected error occurred.", error);
        }
      }
    } catch (e) {
      console.error("Clipboard History: A critical error occurred during the copy event.", e);
    }
  }
  
  // Attach the hardened function to the copy event.
  document.addEventListener('copy', handleCopyEvent);