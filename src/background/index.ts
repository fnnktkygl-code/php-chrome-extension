import { ClipboardService } from '../application/clipboard.service';
import { StorageService } from '../application/storage.service';
import { Clip, DEFAULT_SETTINGS, RuntimeMessage } from '../domain/types';

const storageService = new StorageService();
const clipboardService = new ClipboardService(storageService);

// 1. Message Dispatcher
chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  if (!message || typeof message !== 'object') {
    return false;
  }

  // Security verification: Block untrusted external extension origins
  if (sender.id && typeof chrome !== 'undefined' && chrome.runtime?.id && sender.id !== chrome.runtime.id) {
    console.warn('PHP Background: Blocked untrusted external sender', sender);
    sendResponse({ success: false, error: 'Unauthorized sender' });
    return false;
  }

  switch (message.type) {
    case 'CLIPBOARD_COPY': {
      clipboardService
        .handleCopy({
          text: message.text,
          url: message.url,
          timestamp: message.timestamp,
          category: message.category,
          dataUrl: message.dataUrl,
          dimensions: message.dimensions,
          ocrText: message.ocrText,
          qrData: message.qrData
        })
        .then((clip) => {
          sendResponse({ success: true, clip });
        })
        .catch((err) => {
          console.error('PHP Background: Failed to handle copy', err);
          sendResponse({ success: false, error: err?.message || 'Unknown error' });
        });
      return true; // Keep message channel open for async response
    }

    case 'SETTINGS_CHANGED': {
      (async () => {
        try {
          const settings = await storageService.getSettings();
          const clips = await storageService.getClips();
          const cleaned = clipboardService.cleanupClips(clips, settings);
          await storageService.setClips(cleaned);
          await clipboardService.updateActionBadge(cleaned.length);
          sendResponse({ success: true });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          sendResponse({ success: false, error: errMsg });
        }
      })();
      return true;
    }

    case 'TOGGLE_PIN': {
      clipboardService
        .togglePin(message.id)
        .then((pinned) => sendResponse({ success: true, pinned }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case 'DELETE_CLIP': {
      clipboardService
        .deleteClip(message.id)
        .then((deleted) => sendResponse({ success: deleted }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case 'CLEAR_CLIPS': {
      clipboardService
        .clearUnpinned()
        .then((clearedCount) => sendResponse({ success: true, clearedCount }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case 'EXPORT_BACKUP': {
      storageService
        .exportBackup()
        .then((data) => sendResponse({ success: true, data }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case 'IMPORT_BACKUP': {
      storageService
        .importBackup(message.data)
        .then((result) => sendResponse({ success: true, count: result.count }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case 'START_SNIP_OCR': {
      if (chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
          const activeTab = tabs[0];
          if (activeTab && activeTab.id) {
            chrome.tabs.sendMessage(activeTab.id, { type: 'ACTIVATE_SNIPPER' }).catch(() => {
              if (chrome.scripting) {
                chrome.scripting
                  .executeScript({
                    target: { tabId: activeTab.id! },
                    files: ['content.js']
                  })
                  .then(() => {
                    setTimeout(() => {
                      chrome.tabs.sendMessage(activeTab.id!, { type: 'ACTIVATE_SNIPPER' }).catch(() => {});
                    }, 50);
                  })
                  .catch(() => {});
              }
            });
          }
        });
      }
      sendResponse({ success: true });
      return true;
    }

    case 'CAPTURE_TAB_VIEWPORT': {
      if (chrome.tabs && chrome.tabs.captureVisibleTab) {
        chrome.tabs
          .captureVisibleTab({ format: 'png' })
          .then((dataUrl) => {
            sendResponse({ success: true, dataUrl });
          })
          .catch((err) => {
            console.error('PHP Background: Failed to capture viewport:', err);
            sendResponse({ success: false, error: err?.message || 'Capture failed' });
          });
        return true;
      }
      sendResponse({ success: false, error: 'captureVisibleTab not available' });
      return true;
    }

    default:
      return false;
  }
});

// 2. Real-time Storage Observer for Instant Badge Synchronization
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.clips) {
      const newClips = (changes.clips.newValue as Clip[]) || [];
      clipboardService.updateActionBadge(newClips.length);
    }
  });
}

// 3. Lifecycle Handlers
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const clips = await storageService.getClips();
    const theme = await storageService.getTheme();
    const locale = await storageService.getLocale();
    const settings = await storageService.getSettings();

    // Ensure defaults exist
    if (!theme) {
      await storageService.setTheme('dark');
    }
    if (!locale) {
      const browserLang = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase();
      await storageService.setLocale(browserLang.startsWith('fr') ? 'fr' : 'en');
    }
    if (!settings) {
      await storageService.setSettings(DEFAULT_SETTINGS);
    }

    await clipboardService.updateActionBadge(clips.length);

    // Auto-inject content script into all currently open tabs
    if (chrome.tabs && chrome.scripting) {
      const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
      for (const tab of tabs) {
        if (tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          chrome.scripting
            .executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            })
            .catch(() => {
              // Ignore tabs that restrict scripting
            });
        }
      }
    }
  } catch (err) {
    console.error('PHP Background onInstalled error:', err);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  try {
    const settings = await storageService.getSettings();
    const clips = await storageService.getClips();
    const cleaned = clipboardService.cleanupClips(clips, settings);
    await storageService.setClips(cleaned);
    await clipboardService.updateActionBadge(cleaned.length);
  } catch (err) {
    console.error('PHP Background onStartup error:', err);
  }
});

// 4. Periodic Cleanup Alarm (every 60 minutes)
chrome.alarms.create('periodicCleanup', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'periodicCleanup') {
    try {
      const settings = await storageService.getSettings();
      const clips = await storageService.getClips();
      const cleaned = clipboardService.cleanupClips(clips, settings);
      await storageService.setClips(cleaned);
      await clipboardService.updateActionBadge(cleaned.length);
    } catch (err) {
      console.error('PHP Background alarm error:', err);
    }
  }
});
