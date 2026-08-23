import { describe, it, expect, beforeEach } from 'vitest';
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

describe('StorageService', () => {
  let storage: StorageService;
  let backend: MemoryStorageBackend;

  beforeEach(() => {
    backend = new MemoryStorageBackend();
    storage = new StorageService(backend);
  });

  it('manages clips array in storage', async () => {
    expect(await storage.getClips()).toEqual([]);

    const testClips: Clip[] = [
      {
        id: 1,
        text: 'hello',
        url: '',
        timestamp: 1000,
        pinned: false,
        copyCount: 0,
        lastCopied: null,
        category: 'text'
      }
    ];

    await storage.setClips(testClips);
    expect(await storage.getClips()).toEqual(testClips);
  });

  it('provides default settings when none are stored', async () => {
    const settings = await storage.getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('exports and imports backup JSON data accurately', async () => {
    const clips: Clip[] = [
      {
        id: 101,
        text: 'backup text',
        url: 'https://example.com',
        timestamp: 5000,
        pinned: true,
        copyCount: 2,
        lastCopied: 5500,
        category: 'text'
      }
    ];
    await storage.setClips(clips);

    const backup = await storage.exportBackup();
    expect(backup.app).toBe('PHP - Paste History Past');
    expect(backup.version).toBe('2.0.0');
    expect(backup.clips).toHaveLength(1);
    expect(backup.clips[0].text).toBe('backup text');

    // Wipe store
    await backend.clear();
    expect(await storage.getClips()).toHaveLength(0);

    // Import
    const importRes = await storage.importBackup(backup);
    expect(importRes.success).toBe(true);
    expect(importRes.count).toBe(1);

    const restoredClips = await storage.getClips();
    expect(restoredClips).toHaveLength(1);
    expect(restoredClips[0].text).toBe('backup text');
  });

  it('rejects invalid backup payloads with meaningful errors', async () => {
    await expect(storage.importBackup(null)).rejects.toThrow();
    await expect(storage.importBackup({ clips: 'not an array' })).rejects.toThrow();
    await expect(storage.importBackup({ clips: [] })).rejects.toThrow();
  });

  it('blocks prototype pollution payloads in importBackup', async () => {
    const evilJson = {
      app: 'PHP - Paste History Past',
      version: '2.0.0',
      exportedAt: Date.now(),
      __proto__: {
        polluted: 'yes'
      },
      clips: [
        {
          id: 12345,
          text: 'Safe clip',
          timestamp: Date.now(),
          pinned: false,
          copyCount: 0,
          lastCopied: null,
          category: 'text'
        }
      ]
    };

    await storage.importBackup(evilJson);
    expect((Object.prototype as { polluted?: string }).polluted).toBeUndefined();
  });

  it('rejects corrupt, deeply recursive or invalid clips in importBackup', async () => {
    const corruptPayload = {
      app: 'PHP - Paste History Past',
      version: '2.0.0',
      exportedAt: Date.now(),
      clips: [
        { invalidField: 123 },
        null,
        undefined,
        'not a clip',
        { id: 'not a number', text: 42 }
      ]
    };

    await expect(storage.importBackup(corruptPayload)).rejects.toThrow();
  });
});
