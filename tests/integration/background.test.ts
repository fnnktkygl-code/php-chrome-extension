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
});
