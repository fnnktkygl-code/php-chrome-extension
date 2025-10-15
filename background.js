// background.js - UPDATED VERSION

const MAX_CLIPS = 50;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CLIP_LENGTH = 5000;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CLIPBOARD_COPY') {
    handleClipboardCopy(message);
    return true;
  }
});

async function handleClipboardCopy(data) {
  try {
    const result = await chrome.storage.local.get(['clips']);
    let clips = result.clips || [];

    // Validate clip data
    if (!data.text || typeof data.text !== 'string') {
      return;
    }

    // Trim whitespace
    const trimmedText = data.text.trim();
    
    if (!trimmedText || trimmedText.length > MAX_CLIP_LENGTH) {
      return;
    }

    // Prevent duplicate of the most recent clip
    if (clips.length > 0 && clips[0].text === trimmedText) {
      return;
    }

    // La vérification de similarité a été supprimée ici

    const newClip = {
      id: data.timestamp,
      text: trimmedText,
      url: data.url,
      timestamp: data.timestamp,
      pinned: false,
      copyCount: 0,
      lastCopied: null
    };

    // Add the new clip to the start
    clips.unshift(newClip);

    // Clean up and limit
    const cleanedClips = cleanupClips(clips);

    await chrome.storage.local.set({ clips: cleanedClips });
    await updateBadge(cleanedClips.length);

  } catch (err) {
    console.error('Error saving clip:', err);
  }
}

function cleanupClips(clips) {
  const now = Date.now();
  
  // Filter out old, unpinned clips
  const recentAndPinned = clips.filter(clip => {
    if (clip.pinned) return true;
    return (now - clip.timestamp) < MAX_AGE_MS;
  });

  // Separate pinned and unpinned
  const pinnedClips = recentAndPinned.filter(c => c.pinned);
  const unpinnedClips = recentAndPinned.filter(c => !c.pinned);

  // Limit unpinned clips
  if (unpinnedClips.length > MAX_CLIPS) {
    unpinnedClips.length = MAX_CLIPS;
  }
  
  // Recombine: pinned first, then unpinned by timestamp
  return [...pinnedClips, ...unpinnedClips];
}

// La fonction calculateSimilarity a été supprimée

async function updateBadge(count) {
  const text = count > 0 ? count.toString() : '';
  await chrome.action.setBadgeText({ text });
  if (text) {
    await chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
  }
}

// Update badge on install and startup
chrome.runtime.onInstalled.addListener(async () => {
  const { clips } = await chrome.storage.local.get(['clips']);
  await updateBadge(clips ? clips.length : 0);
  
  // Set default settings
  const { theme, locale } = await chrome.storage.local.get(['theme', 'locale']);
  if (!theme) {
    await chrome.storage.local.set({ theme: 'dark' });
  }
  if (!locale) {
    // Detect browser language
    const browserLang = navigator.language || navigator.userLanguage;
    const detectedLocale = browserLang.startsWith('fr') ? 'fr' : 'en';
    await chrome.storage.local.set({ locale: detectedLocale });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  const { clips } = await chrome.storage.local.get(['clips']);
  const cleanedClips = cleanupClips(clips || []);
  await chrome.storage.local.set({ clips: cleanedClips });
  await updateBadge(cleanedClips.length);
});

// Periodic cleanup (every hour)
chrome.alarms.create('cleanupClips', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cleanupClips') {
    const { clips } = await chrome.storage.local.get(['clips']);
    const cleanedClips = cleanupClips(clips || []);
    await chrome.storage.local.set({ clips: cleanedClips });
    await updateBadge(cleanedClips.length);
  }
});