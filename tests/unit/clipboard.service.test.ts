import { describe, it, expect, beforeEach } from 'vitest';
import { ClipboardService } from '../../src/application/clipboard.service';
import { StorageService, StorageBackend } from '../../src/application/storage.service';
import { Clip, DEFAULT_SETTINGS } from '../../src/domain/types';

class MemoryStorageBackend implements StorageBackend {
  private store: Record<string, unknown> = {};

  async get<T>(keys: string[]): Promise<Record<string, T>> {
    const res: Record<string, T> = {};
    for (const k of keys) {
      if (this.store[k] !== undefined) {
        res[k] = this.store[k] as T;
      }
    }
    return res;
  }

  async set(items: Record<string, unknown>): Promise<void> {
    this.store = { ...this.store, ...items };
  }

  async remove(keys: string[]): Promise<void> {
    for (const k of keys) {
      delete this.store[k];
    }
  }

  async clear(): Promise<void> {
    this.store = {};
  }
}

describe('ClipboardService', () => {
  let clipboardService: ClipboardService;
  let storage: StorageService;

  beforeEach(() => {
    storage = new StorageService(new MemoryStorageBackend());
    clipboardService = new ClipboardService(storage);
  });

  describe('handleCopy', () => {
    it('creates and persists a new clip', async () => {
      const now = Date.now();
      const clip = await clipboardService.handleCopy({
        text: 'echo "Hello world"',
        url: 'https://github.com',
        timestamp: now
      });

      expect(clip).not.toBeNull();
      expect(clip?.text).toBe('echo "Hello world"');
      expect(clip?.category).toBe('code');
      expect(clip?.pinned).toBe(false);

      const all = await storage.getClips();
      expect(all).toHaveLength(1);
    });

    it('deduplicates existing clips by moving them to top', async () => {
      const now = Date.now();
      await clipboardService.handleCopy({ text: 'Clip A', timestamp: now - 3000 });
      await clipboardService.handleCopy({ text: 'Clip B', timestamp: now - 2000 });
      await clipboardService.handleCopy({ text: 'Clip A', timestamp: now - 1000 });

      const all = await storage.getClips();
      expect(all).toHaveLength(2);
      expect(all[0].text).toBe('Clip A');
      expect(all[0].timestamp).toBe(now - 1000);
      expect(all[1].text).toBe('Clip B');
    });

    it('preserves pinned state during deduplication', async () => {
      const now = Date.now();
      await clipboardService.handleCopy({ text: 'Important Note', timestamp: now - 2000 });
      const clips = await storage.getClips();
      await clipboardService.togglePin(clips[0].id);

      // Copy again
      await clipboardService.handleCopy({ text: 'Important Note', timestamp: now - 1000 });
      const updated = await storage.getClips();
      expect(updated).toHaveLength(1);
      expect(updated[0].pinned).toBe(true);
      expect(updated[0].timestamp).toBe(now - 1000);
    });

    it('ignores invalid or empty text', async () => {
      const res = await clipboardService.handleCopy({ text: '   ' });
      expect(res).toBeNull();
      expect(await storage.getClips()).toHaveLength(0);
    });
  });

  describe('cleanupClips', () => {
    it('evicts unpinned clips exceeding max limit while preserving pinned clips', () => {
      const now = Date.now();
      const clips: Clip[] = [
        { id: 1, text: 'Pinned 1', url: '', timestamp: now - 500, pinned: true, copyCount: 0, lastCopied: null, category: 'text' },
        { id: 2, text: 'Pinned 2', url: '', timestamp: now - 400, pinned: true, copyCount: 0, lastCopied: null, category: 'text' },
        { id: 3, text: 'Unpinned 1', url: '', timestamp: now - 300, pinned: false, copyCount: 0, lastCopied: null, category: 'text' },
        { id: 4, text: 'Unpinned 2', url: '', timestamp: now - 200, pinned: false, copyCount: 0, lastCopied: null, category: 'text' },
        { id: 5, text: 'Unpinned 3', url: '', timestamp: now - 100, pinned: false, copyCount: 0, lastCopied: null, category: 'text' }
      ];

      const cleaned = clipboardService.cleanupClips(clips, {
        ...DEFAULT_SETTINGS,
        maxClips: 2,
        maxAgeMs: 0 // no age limit
      });

      // 2 pinned + 2 max unpinned = 4
      expect(cleaned).toHaveLength(4);
      expect(cleaned.filter((c) => c.pinned)).toHaveLength(2);
      expect(cleaned.filter((c) => !c.pinned)).toHaveLength(2);
    });

    it('evicts expired unpinned clips based on maxAgeMs', () => {
      const now = 1000000;
      const clips: Clip[] = [
        { id: 1, text: 'Pinned Old', url: '', timestamp: now - 50000, pinned: true, copyCount: 0, lastCopied: null, category: 'text' },
        { id: 2, text: 'Unpinned Old', url: '', timestamp: now - 50000, pinned: false, copyCount: 0, lastCopied: null, category: 'text' },
        { id: 3, text: 'Unpinned Fresh', url: '', timestamp: now - 1000, pinned: false, copyCount: 0, lastCopied: null, category: 'text' }
      ];

      const cleaned = clipboardService.cleanupClips(
        clips,
        {
          ...DEFAULT_SETTINGS,
          maxClips: 10,
          maxAgeMs: 10000 // 10s retention
        },
        now
      );

      expect(cleaned).toHaveLength(2);
      expect(cleaned.find((c) => c.text === 'Pinned Old')).toBeDefined();
      expect(cleaned.find((c) => c.text === 'Unpinned Fresh')).toBeDefined();
      expect(cleaned.find((c) => c.text === 'Unpinned Old')).toBeUndefined();
    });
  });

  describe('togglePin, deleteClip, clearUnpinned', () => {
    it('toggles pin and clears unpinned clips', async () => {
      const now = Date.now();
      await clipboardService.handleCopy({ text: 'Clip 1', timestamp: now - 2000 });
      await clipboardService.handleCopy({ text: 'Clip 2', timestamp: now - 1000 });

      const all = await storage.getClips();
      await clipboardService.togglePin(all[0].id); // Pin Clip 2

      const cleared = await clipboardService.clearUnpinned();
      expect(cleared).toBe(1);

      const remaining = await storage.getClips();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].text).toBe('Clip 2');
      expect(remaining[0].pinned).toBe(true);

      const deleted = await clipboardService.deleteClip(remaining[0].id);
      expect(deleted).toBe(true);
      expect(await storage.getClips()).toHaveLength(0);
    });

    it('records copy counts accurately', async () => {
      const now = Date.now();
      await clipboardService.handleCopy({ text: 'Target Clip', timestamp: now });
      const clips = await storage.getClips();

      await clipboardService.recordCopy(clips[0].id);
      await clipboardService.recordCopy(clips[0].id);

      const updated = await storage.getClips();
      expect(updated[0].copyCount).toBe(2);
      expect(updated[0].lastCopied).not.toBeNull();
    });
  });
});
