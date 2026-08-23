// background.js - Production Background Service Worker

const DEFAULT_MAX_CLIPS = 50;
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CLIP_LENGTH = 20000;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id && typeof chrome !== 'undefined' && chrome.runtime?.id && sender.id !== chrome.runtime.id) {
    sendResponse({ success: false, error: 'Unauthorized sender' });
    return false;
  }

  if (message.type === 'CLIPBOARD_COPY') {
    handleClipboardCopy(message)
      .then((clip) => sendResponse({ success: true, clip }))
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
  } else if (message.type === 'TOGGLE_PIN') {
    togglePin(message.id)
      .then((pinned) => sendResponse({ success: true, pinned }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  } else if (message.type === 'DELETE_CLIP') {
    deleteClip(message.id)
      .then((deleted) => sendResponse({ success: deleted }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  } else if (message.type === 'CLEAR_CLIPS') {
    clearUnpinned()
      .then((clearedCount) => sendResponse({ success: true, clearedCount }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  } else if (message.type === 'START_SNIP_OCR') {
    activateSnipperOnActiveTab().then((success) => sendResponse({ success }));
    return true;
  } else if (message.type === 'CAPTURE_TAB_VIEWPORT') {
    if (chrome.tabs && chrome.tabs.captureVisibleTab) {
      chrome.tabs
        .captureVisibleTab({ format: 'png' })
        .then((dataUrl) => {
          sendResponse({ success: true, dataUrl });
        })
        .catch((err) => {
          console.error('Failed to capture viewport:', err);
          sendResponse({ success: false, error: err ? err.message : 'Capture failed' });
        });
  } else if (message.type === 'OPEN_FULL_EXTENSION') {
    (async () => {
      try {
        if (typeof chrome !== 'undefined' && chrome.action && chrome.action.openPopup) {
          try {
            await chrome.action.openPopup();
            sendResponse({ success: true });
            return;
          } catch {}
        }
        if (typeof chrome !== 'undefined' && chrome.windows) {
          await chrome.windows.create({
            url: chrome.runtime.getURL('popup.html'),
            type: 'popup',
            width: 395,
            height: 600,
            focused: true
          });
          sendResponse({ success: true });
          return;
        }
        sendResponse({ success: false });
      } catch (err) {
        sendResponse({ success: false, error: err ? err.message : String(err) });
      }
    })();
    return true;
  }
});

/**
 * Robust helper to trigger Shottr-style ScreenSnipper on the active tab
 */
async function activateSnipperOnActiveTab() {
  if (typeof chrome === 'undefined' || !chrome.tabs) return false;

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    if (!activeTab || !activeTab.id) return false;

    if (activeTab.url) {
      const isRestricted =
        activeTab.url.startsWith('chrome://') ||
        activeTab.url.startsWith('edge://') ||
        activeTab.url.startsWith('about:') ||
        activeTab.url.startsWith('chrome-extension://') ||
        activeTab.url.includes('chromewebstore.google.com');

      if (isRestricted) {
        if (chrome.notifications) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'PHP Snip & OCR',
            message: 'Impossible de capturer les pages système Chrome. Ouvrez un site web (Google, GitHub, etc.).'
          });
        }
        return false;
      }
    }

    try {
      await chrome.tabs.sendMessage(activeTab.id, { type: 'ACTIVATE_SNIPPER' });
      return true;
    } catch {
      if (chrome.scripting) {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['content.js']
        });
        await new Promise((r) => setTimeout(r, 60));
        await chrome.tabs.sendMessage(activeTab.id, { type: 'ACTIVATE_SNIPPER' });
        return true;
      }
    }
  } catch (err) {
    console.warn('PHP Background: Failed to activate snipper on active tab:', err);
  }
  return false;
}

async function toggleQuickPasteOnActiveTab() {
  if (typeof chrome === 'undefined' || !chrome.tabs) return false;

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    if (!activeTab || !activeTab.id) return false;

    if (activeTab.url) {
      const isRestricted =
        activeTab.url.startsWith('chrome://') ||
        activeTab.url.startsWith('edge://') ||
        activeTab.url.startsWith('about:') ||
        activeTab.url.startsWith('chrome-extension://') ||
        activeTab.url.includes('chromewebstore.google.com');

      if (isRestricted) return false;
    }

    try {
      await chrome.tabs.sendMessage(activeTab.id, { type: 'TOGGLE_QUICK_PASTE' });
      return true;
    } catch {
      if (chrome.scripting) {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['content.js']
        });
        await new Promise((r) => setTimeout(r, 60));
        await chrome.tabs.sendMessage(activeTab.id, { type: 'TOGGLE_QUICK_PASTE' });
        return true;
      }
    }
  } catch (err) {
    console.warn('PHP Background: Failed to toggle quick paste on active tab:', err);
  }
  return false;
}

// Global Keyboard Shortcut Handler (Shottr Style & Quick Paste)
if (typeof chrome !== 'undefined' && chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener((command) => {
    if (command === 'snip_ocr') {
      activateSnipperOnActiveTab();
    } else if (command === 'quick_paste') {
      toggleQuickPasteOnActiveTab();
    }
  });
}

// Real-time Storage Observer for Instant Badge Synchronization
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.clips) {
      const newClips = changes.clips.newValue || [];
      updateBadge(newClips.length);
    }
  });
}

async function handleSettingsChanged() {
  try {
    const { clips, settings } = await chrome.storage.local.get(['clips', 'settings']);
    const cleanedClips = await cleanupClips(clips || [], settings || {});
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
      return null;
    }

    const trimmedText = data.text.trim();
    if (!trimmedText) {
      return null;
    }

    if (trimmedText.length > MAX_CLIP_LENGTH) {
      return null;
    }

    // Global Deduplication
    const existingIndex = clips.findIndex((c) => c.text === trimmedText);
    let clip;

    if (existingIndex !== -1) {
      const existing = clips[existingIndex];
      existing.timestamp = data.timestamp || Date.now();
      existing.copyCount = (existing.copyCount || 1) + 1;
      existing.lastCopied = Date.now();
      if (saveUrl && data.url) {
        existing.url = data.url;
      }
      clip = existing;
      clips.splice(existingIndex, 1);
      clips.unshift(clip);
    } else {
      clip = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        text: trimmedText,
        url: saveUrl && data.url ? data.url : '',
        timestamp: data.timestamp || Date.now(),
        pinned: false,
        copyCount: 1,
        lastCopied: Date.now(),
        category: data.category || detectCategory(trimmedText, data.dataUrl),
        dataUrl: data.dataUrl,
        dimensions: data.dimensions,
        ocrText: data.ocrText,
        qrData: data.qrData
      };
      clips.unshift(clip);
    }

    clips = await cleanupClips(clips, settings);
    await chrome.storage.local.set({ clips });
    await updateBadge(clips.length);
    return clip;
  } catch (err) {
    console.error('Error handling clipboard copy:', err);
    throw err;
  }
}

function detectCategory(text, dataUrl) {
  if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) return 'image';
  if (text.startsWith('http://') || text.startsWith('https://')) return 'link';
  if (text.includes('function') || text.includes('const ') || text.includes('let ') || text.includes('<svg') || text.includes('<div')) return 'code';
  return 'text';
}

async function cleanupClips(clips, settings) {
  const maxClips = (settings && typeof settings.maxClips === 'number') ? settings.maxClips : DEFAULT_MAX_CLIPS;
  const now = Date.now();

  const validClips = clips.filter((clip) => {
    if (clip.pinned) return true;
    return now - clip.timestamp < DEFAULT_MAX_AGE_MS;
  });

  const pinned = validClips.filter((c) => c.pinned);
  const unpinned = validClips.filter((c) => !c.pinned);
  const cappedUnpinned = unpinned.slice(0, maxClips);

  return [...pinned, ...cappedUnpinned];
}

async function togglePin(id) {
  const { clips = [] } = await chrome.storage.local.get(['clips']);
  const clip = clips.find((c) => c.id === id);
  if (!clip) return false;
  clip.pinned = !clip.pinned;
  await chrome.storage.local.set({ clips });
  return clip.pinned;
}

async function deleteClip(id) {
  const { clips = [] } = await chrome.storage.local.get(['clips']);
  const filtered = clips.filter((c) => c.id !== id);
  await chrome.storage.local.set({ clips: filtered });
  await updateBadge(filtered.length);
  return true;
}

async function clearUnpinned() {
  const { clips = [] } = await chrome.storage.local.get(['clips']);
  const pinnedOnly = clips.filter((c) => c.pinned);
  const clearedCount = clips.length - pinnedOnly.length;
  await chrome.storage.local.set({ clips: pinnedOnly });
  await updateBadge(pinnedOnly.length);
  return clearedCount;
}

async function updateBadge(count) {
  if (typeof chrome !== 'undefined' && chrome.action && chrome.action.setBadgeText) {
    try {
      const text = count > 0 ? String(count) : '';
      await chrome.action.setBadgeText({ text });
      if (text) {
        if (chrome.action.setBadgeBackgroundColor) {
          await chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
        }
        if (chrome.action.setBadgeTextColor) {
          await chrome.action.setBadgeTextColor({ color: '#ffffff' });
        }
      }
    } catch (err) {
      console.debug('Badge update skipped:', err);
    }
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  try {
    const { clips = [] } = await chrome.storage.local.get(['clips']);
    await updateBadge(clips.length);

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
    console.error('onInstalled error:', err);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  try {
    const { clips = [] } = await chrome.storage.local.get(['clips']);
    await updateBadge(clips.length);
  } catch (err) {
    console.error('onStartup error:', err);
  }
});