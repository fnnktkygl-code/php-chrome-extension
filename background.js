// background.js - UPDATED VERSION

const DEFAULT_MAX_CLIPS = 50;
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CLIP_LENGTH = 20000; // Increased to 20k (approx 10 pages) for better utility

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CLIPBOARD_COPY') {
    // We must return true to indicate we will respond asynchronously
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

    // Validate clip data
    if (!data.text || typeof data.text !== 'string') {
      return;
    }

    // Trim whitespace
    const trimmedText = data.text.trim();

    if (!trimmedText) {
      return;
    }

    if (trimmedText.length > MAX_CLIP_LENGTH) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Clip too long!',
        message: `Text ignored (${trimmedText.length} chars). Limit is ${MAX_CLIP_LENGTH}.`
      });
      return;
    }

    // Global Deduplication
    const existingIndex = clips.findIndex(c => c.text === trimmedText);

    if (existingIndex !== -1) {
      const existingClip = clips[existingIndex];

      // If it's pinned, just update its timestamp so it stays fresh
      if (existingClip.pinned) {
        existingClip.timestamp = data.timestamp;
        existingClip.url = saveUrl ? data.url : '';
        // We don't add a new clip, just save the update
        const cleanedClips = await cleanupClips(clips);
        await chrome.storage.local.set({ clips: cleanedClips });
        await updateBadge(cleanedClips.length);
        return;
      }

      // If it's not pinned, remove the old one so we can add the new one at the top
      clips.splice(existingIndex, 1);
    }

    const newClip = {
      id: data.timestamp,
      text: trimmedText,
      url: saveUrl ? data.url : '',
      timestamp: data.timestamp,
      pinned: false,
      copyCount: 0,
      lastCopied: null
    };

    // Add the new clip to the start
    clips.unshift(newClip);

    // Clean up and limit
    const cleanedClips = await cleanupClips(clips);

    await chrome.storage.local.set({ clips: cleanedClips });
    await updateBadge(cleanedClips.length);

  } catch (err) {
    console.error('Error saving clip:', err);
    throw err; // Re-throw to be caught by the listener
  }
}

async function cleanupClips(clips) {
  const result = await chrome.storage.local.get(['settings']);
  const settings = result.settings || {};
  const maxClips = settings.maxClips !== undefined ? settings.maxClips : DEFAULT_MAX_CLIPS;
  const maxAgeMs = settings.maxAgeMs !== undefined ? settings.maxAgeMs : DEFAULT_MAX_AGE_MS;

  const now = Date.now();

  // Filter out old, unpinned clips
  const recentAndPinned = clips.filter(clip => {
    if (clip.pinned) return true;
    if (maxAgeMs === 0) return true; // Never expire
    return (now - clip.timestamp) < maxAgeMs;
  });

  // Separate pinned and unpinned
  const pinnedClips = recentAndPinned.filter(c => c.pinned);
  const unpinnedClips = recentAndPinned.filter(c => !c.pinned);

  // Limit unpinned clips
  if (unpinnedClips.length > maxClips) {
    unpinnedClips.length = maxClips;
  }

  // Recombine: pinned first, then unpinned by timestamp
  return [...pinnedClips, ...unpinnedClips];
}

async function updateBadge(count) {
  try {
    const text = count > 0 ? count.toString() : '';
    await chrome.action.setBadgeText({ text });
    if (text) {
      await chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
    }
  } catch (err) {
    console.error('Error updating badge:', err);
  }
}

// Update badge on install and startup
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const { clips } = await chrome.storage.local.get(['clips']);
    await updateBadge(clips ? clips.length : 0);

    // Set default settings
    const { theme, locale, settings } = await chrome.storage.local.get(['theme', 'locale', 'settings']);
    if (!theme) {
      await chrome.storage.local.set({ theme: 'dark' });
    }
    if (!locale) {
      // Detect browser language
      const browserLang = navigator.language || navigator.userLanguage;
      const detectedLocale = browserLang.startsWith('fr') ? 'fr' : 'en';
      await chrome.storage.local.set({ locale: detectedLocale });
    }
    if (!settings) {
      await chrome.storage.local.set({
        settings: {
          saveUrl: true,
          maxClips: DEFAULT_MAX_CLIPS,
          maxAgeMs: DEFAULT_MAX_AGE_MS
        }
      });
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

// Periodic cleanup (every hour)
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