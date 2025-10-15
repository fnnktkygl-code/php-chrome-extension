// background.js

const MAX_CLIPS = 50;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CLIPBOARD_COPY') {
    handleClipboardCopy(message);
    return true; // Indicates an async response.
  }
});

async function handleClipboardCopy(data) {
  try {
    const result = await chrome.storage.local.get(['clips']);
    let clips = result.clips || [];

    // Prevent duplicate of the most recent clip
    if (clips.length > 0 && clips[0].text === data.text) {
      return;
    }

    const newClip = {
      id: data.timestamp, // Using timestamp as a unique ID
      text: data.text,
      url: data.url,
      timestamp: data.timestamp,
      pinned: false
    };

    // Add the new clip to the start of the array
    clips.unshift(newClip);

    // Clean up old clips and limit the total number
    const cleanedClips = cleanupClips(clips);

    await chrome.storage.local.set({ clips: cleanedClips });
    await updateBadge(cleanedClips.length);

  } catch (err) {
    console.error('Error saving clip:', err);
  }
}

function cleanupClips(clips) {
  const now = Date.now();
  
  // 1. Filter out old, unpinned clips
  const recentAndPinned = clips.filter(clip => {
    if (clip.pinned) return true;
    return (now - clip.timestamp) < MAX_AGE_MS;
  });

  // 2. Ensure the total number of unpinned clips does not exceed the limit
  const pinnedClips = recentAndPinned.filter(c => c.pinned);
  const unpinnedClips = recentAndPinned.filter(c => !c.pinned);

  if (unpinnedClips.length > MAX_CLIPS) {
    unpinnedClips.length = MAX_CLIPS; // Truncate the array to the max size
  }
  
  // 3. Recombine and return
  return [...pinnedClips, ...unpinnedClips];
}

async function updateBadge(count) {
  const text = count > 0 ? count.toString() : '';
  await chrome.action.setBadgeText({ text });
  if (text) {
    await chrome.action.setBadgeBackgroundColor({ color: '#764ba2' }); // A color from your UI
  }
}

// Update badge on install and startup
chrome.runtime.onInstalled.addListener(async () => {
  const { clips } = await chrome.storage.local.get(['clips']);
  await updateBadge(clips ? clips.length : 0);
});

chrome.runtime.onStartup.addListener(async () => {
  const { clips } = await chrome.storage.local.get(['clips']);
  await updateBadge(clips ? clips.length : 0);
});
