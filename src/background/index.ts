import { ClipboardService } from '../application/clipboard.service';
import { StorageService } from '../application/storage.service';
import { DEFAULT_SETTINGS, RuntimeMessage } from '../domain/types';

const storageService = new StorageService();
const clipboardService = new ClipboardService(storageService);

// 1. Message Dispatcher
chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') {
    return false;
  }

  switch (message.type) {
    case 'CLIPBOARD_COPY': {
      clipboardService
        .handleCopy({
          text: message.text,
          url: message.url,
          timestamp: message.timestamp
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

    default:
      return false;
  }
});

// 2. Lifecycle Handlers
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

// 3. Periodic Cleanup Alarm (every 60 minutes)
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
