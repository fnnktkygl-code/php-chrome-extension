// background.js - Production Background Service Worker

const DEFAULT_MAX_CLIPS = 50;
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CLIP_LENGTH = 20000;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CLIPBOARD_COPY') {
    handleClipboardCopy(message)
      .then(() => sendResponse({ success: true }))
      .catch((err) => {
        console.error('Clipboard copy failed:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  } else if (message.type === 'SETTINGS_CHANGED') {
    handleSettingsChanged()
      .then(() => sendResponse({ success: true }))
      .catch((err) => {
        console.error('Settings change cleanup failed:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
});

async function handleSettingsChanged() {
  try {
    const { clips } = await chrome.storage.local.get(['clips']);
    const cleanedClips = await cleanupClips(clips || []);
    await chrome.storage.local.set({ clips: cleanedClips });
    await updateBadge(cleanedClips.length);
  } catch (err) {
    console.error('Error in handleSettingsChanged:', err);
    throw err;
  }
}

async function handleClipboardCopy(data) {
  try {
    const result = await chrome.storage.local.get(['clips', 'settings']);
    let clips = result.clips || [];
    const settings = result.settings || {};
    const saveUrl = settings.saveUrl !== undefined ? settings.saveUrl : true;

    if (!data.text || typeof data.text !== 'string') {
      return;
    }

    const trimmedText = data.text.trim();
    if (!trimmedText) {
      return;
    }

    if (trimmedText.length > MAX_CLIP_LENGTH) {
      return;
    }

    // Global Deduplication
    const existingIndex = clips.findIndex(c => c.text === trimmedText);

    if (existingIndex !== -1) {
      const existingClip = clips[existingIndex];
      if (existingClip.pinned) {
        existingClip.timestamp = data.timestamp || Date.now();
        if (saveUrl && data.url) existingClip.url = data.url;
        const cleanedClips = await cleanupClips(clips);
        await chrome.storage.local.set({ clips: cleanedClips });
        await updateBadge(cleanedClips.length);
        return;
      }
      clips.splice(existingIndex, 1);
    }

    const newClip = {
      id: data.timestamp || Date.now(),
      text: trimmedText,
      url: saveUrl ? (data.url || '') : '',
      timestamp: data.timestamp || Date.now(),
      pinned: false,
      copyCount: 0,
      lastCopied: null
    };

    clips.unshift(newClip);
    const cleanedClips = await cleanupClips(clips);

    await chrome.storage.local.set({ clips: cleanedClips });
    await updateBadge(cleanedClips.length);

  } catch (err) {
    console.error('Error saving clip:', err);
    throw err;
  }
}

async function cleanupClips(clips) {
  const result = await chrome.storage.local.get(['settings']);
  const settings = result.settings || {};
  const maxClips = settings.maxClips !== undefined ? settings.maxClips : DEFAULT_MAX_CLIPS;
  const maxAgeMs = settings.maxAgeMs !== undefined ? settings.maxAgeMs : DEFAULT_MAX_AGE_MS;
  const now = Date.now();

  const recentAndPinned = clips.filter(clip => {
    if (clip.pinned) return true;
    if (maxAgeMs === 0) return true;
    return (now - clip.timestamp) < maxAgeMs;
  });

  const pinnedClips = recentAndPinned.filter(c => c.pinned);
  const unpinnedClips = recentAndPinned.filter(c => !c.pinned);

  if (unpinnedClips.length > maxClips) {
    unpinnedClips.length = maxClips;
  }

  return [...pinnedClips, ...unpinnedClips];
}

async function updateBadge(count) {
  try {
    const text = count > 0 ? count.toString() : '';
    await chrome.action.setBadgeText({ text });
    if (text) {
      await chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
    }
  } catch (err) {
    console.error('Error updating badge:', err);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  try {
    const { clips } = await chrome.storage.local.get(['clips']);
    await updateBadge(clips ? clips.length : 0);

    const { theme, locale, settings } = await chrome.storage.local.get(['theme', 'locale', 'settings']);
    if (!theme) {
      await chrome.storage.local.set({ theme: 'dark' });
    }
    if (!locale) {
      const browserLang = navigator.language || 'en';
      const detectedLocale = browserLang.startsWith('fr') ? 'fr' : 'en';
      await chrome.storage.local.set({ locale: detectedLocale });
    }
    if (!settings) {
      await chrome.storage.local.set({
        settings: {
          saveUrl: true,
          ignorePasswords: true,
          maxClips: DEFAULT_MAX_CLIPS,
          maxAgeMs: DEFAULT_MAX_AGE_MS
        }
      });
    }

    if (chrome.tabs && chrome.scripting) {
      const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
      for (const tab of tabs) {
        if (tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          }).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error('Error in onInstalled:', err);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  try {
    const { clips } = await chrome.storage.local.get(['clips']);
    const cleanedClips = await cleanupClips(clips || []);
    await chrome.storage.local.set({ clips: cleanedClips });
    await updateBadge(cleanedClips.length);
  } catch (err) {
    console.error('Error in onStartup:', err);
  }
});

chrome.alarms.create('cleanupClips', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cleanupClips') {
    try {
      const { clips } = await chrome.storage.local.get(['clips']);
      const cleanedClips = await cleanupClips(clips || []);
      await chrome.storage.local.set({ clips: cleanedClips });
      await updateBadge(cleanedClips.length);
    } catch (err) {
      console.error('Error in cleanup alarm:', err);
    }
  }
});