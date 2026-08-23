import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { setupMockChrome } from '../../src/infrastructure/mock-chrome';

describe('Background Worker Integration', () => {
  let mockChrome: ReturnType<typeof setupMockChrome>;

  beforeAll(async () => {
    mockChrome = setupMockChrome();
    await import('../../src/background/index');
  });

  beforeEach(async () => {
    await mockChrome.storage.local.clear();
  });

  it('handles CLIPBOARD_COPY message and updates badge', async () => {
    const now = Date.now();
    const response = (await mockChrome.runtime.sendMessage({
      type: 'CLIPBOARD_COPY',
      text: 'Integration Test Clip',
      url: 'https://example.com',
      timestamp: now
    })) as { success: boolean; clip: { text: string } };

    expect(response.success).toBe(true);
    expect(response.clip.text).toBe('Integration Test Clip');

    const storedClips = (await mockChrome.storage.local.get('clips')) as { clips: Array<{ text: string }> };
    expect(storedClips.clips).toHaveLength(1);
    expect(mockChrome.action._getBadgeText()).toBe('1');
  });

  it('blocks messages sent from untrusted external extension senders', async () => {
    const response = (await mockChrome.runtime.sendMessage(
      {
        type: 'CLEAR_CLIPS'
      },
      { id: 'rogue-malicious-extension-id' }
    )) as { success: boolean; error: string };

    expect(response.success).toBe(false);
    expect(response.error).toBe('Unauthorized sender');
  });

  it('handles TOGGLE_PIN, DELETE_CLIP and CLEAR_CLIPS messages', async () => {
    const now = Date.now();
    await mockChrome.runtime.sendMessage({
      type: 'CLIPBOARD_COPY',
      text: 'Clip 1',
      url: '',
      timestamp: now - 2000
    });
    await mockChrome.runtime.sendMessage({
      type: 'CLIPBOARD_COPY',
      text: 'Clip 2',
      url: '',
      timestamp: now - 1000
    });

    const stored = (await mockChrome.storage.local.get('clips')) as { clips: Array<{ id: number }> };
    expect(stored.clips).toHaveLength(2);
    const idToPin = stored.clips[0].id;

    // Pin Clip 2
    const pinRes = (await mockChrome.runtime.sendMessage({
      type: 'TOGGLE_PIN',
      id: idToPin
    })) as { success: boolean; pinned: boolean };
    expect(pinRes.success).toBe(true);
    expect(pinRes.pinned).toBe(true);

    // Clear unpinned
    const clearRes = (await mockChrome.runtime.sendMessage({
      type: 'CLEAR_CLIPS'
    })) as { success: boolean; clearedCount: number };
    expect(clearRes.success).toBe(true);
    expect(clearRes.clearedCount).toBe(1);

    // Delete remaining
    const delRes = (await mockChrome.runtime.sendMessage({
      type: 'DELETE_CLIP',
      id: idToPin
    })) as { success: boolean };
    expect(delRes.success).toBe(true);
  });

  it('handles CAPTURE_TAB_VIEWPORT message and returns image dataUrl', async () => {
    const captureRes = (await mockChrome.runtime.sendMessage({
      type: 'CAPTURE_TAB_VIEWPORT'
    })) as { success: boolean; dataUrl: string };

    expect(captureRes.success).toBe(true);
    expect(captureRes.dataUrl).toContain('data:image/png;base64');
  });

  it('handles START_SNIP_OCR message safely', async () => {
    const snipRes = (await mockChrome.runtime.sendMessage({
      type: 'START_SNIP_OCR'
    })) as { success: boolean };

    expect(snipRes).toBeDefined();
  });

  it('handles SETTINGS_CHANGED message and performs proactive pruning', async () => {
    // Populate 10 clips
    for (let i = 0; i < 10; i++) {
      await mockChrome.runtime.sendMessage({
        type: 'CLIPBOARD_COPY',
        text: `Item #${i}`,
        url: 'https://example.com',
        timestamp: Date.now() + i
      });
    }

    // Set maxClips to 5
    await mockChrome.storage.local.set({
      settings: {
        saveUrl: true,
        maxClips: 5,
        maxAgeMs: 0,
        theme: 'dark',
        locale: 'fr',
        ignorePasswords: true
      }
    });

    const settingsRes = (await mockChrome.runtime.sendMessage({
      type: 'SETTINGS_CHANGED'
    })) as { success: boolean };

    expect(settingsRes.success).toBe(true);

    const stored = (await mockChrome.storage.local.get('clips')) as { clips: Array<unknown> };
    expect(stored.clips.length).toBeLessThanOrEqual(5);
    expect(mockChrome.action._getBadgeText()).toBe('5');
  });

  it('handles EXPORT_BACKUP and IMPORT_BACKUP messages', async () => {
    await mockChrome.runtime.sendMessage({
      type: 'CLIPBOARD_COPY',
      text: 'Exportable clip',
      url: 'https://export.com',
      timestamp: Date.now()
    });

    const exportRes = (await mockChrome.runtime.sendMessage({
      type: 'EXPORT_BACKUP'
    })) as { success: boolean; data: { clips: Array<{ text: string }> } };

    expect(exportRes.success).toBe(true);
    expect(exportRes.data.clips.some((c) => c.text === 'Exportable clip')).toBe(true);

    // Import
    const importRes = (await mockChrome.runtime.sendMessage({
      type: 'IMPORT_BACKUP',
      data: exportRes.data
    })) as { success: boolean; count: number };

    expect(importRes.success).toBe(true);
    expect(importRes.count).toBeGreaterThan(0);
  });

  it('handles OPEN_FULL_EXTENSION message', async () => {
    const openRes = (await mockChrome.runtime.sendMessage({
      type: 'OPEN_FULL_EXTENSION'
    })) as { success: boolean };

    expect(openRes.success).toBe(true);
  });
});
