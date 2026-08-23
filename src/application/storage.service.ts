import { Clip, DEFAULT_SETTINGS, ExportData, Settings } from '../domain/types';

export interface StorageBackend {
  get<T>(keys: string[]): Promise<Record<string, T>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
  clear(): Promise<void>;
}

export class ChromeStorageBackend implements StorageBackend {
  public async get<T>(keys: string[]): Promise<Record<string, T>> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return (await chrome.storage.local.get(keys)) as Record<string, T>;
    }
    const result: Record<string, T> = {};
    return result;
  }

  public async set(items: Record<string, unknown>): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set(items);
    }
  }

  public async remove(keys: string[]): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.remove(keys);
    }
  }

  public async clear(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.clear();
    }
  }
}

export class StorageService {
  private backend: StorageBackend;

  constructor(backend?: StorageBackend) {
    this.backend = backend || new ChromeStorageBackend();
  }

  public async clearAll(): Promise<void> {
    await this.backend.clear();
  }

  public async getClips(): Promise<Clip[]> {
    const result = await this.backend.get<Clip[]>(['clips']);
    return result.clips || [];
  }

  public async setClips(clips: Clip[]): Promise<void> {
    await this.backend.set({ clips });
  }

  public async getSettings(): Promise<Settings> {
    const result = await this.backend.get<Settings>(['settings']);
    return { ...DEFAULT_SETTINGS, ...(result.settings || {}) };
  }

  public async setSettings(settings: Settings): Promise<void> {
    await this.backend.set({ settings });
  }

  public async getTheme(): Promise<'dark' | 'light'> {
    const result = await this.backend.get<string>(['theme']);
    return result.theme === 'light' ? 'light' : 'dark';
  }

  public async setTheme(theme: 'dark' | 'light'): Promise<void> {
    await this.backend.set({ theme });
  }

  public async getLocale(): Promise<'en' | 'fr'> {
    const result = await this.backend.get<string>(['locale']);
    return result.locale === 'fr' ? 'fr' : 'en';
  }

  public async setLocale(locale: 'en' | 'fr'): Promise<void> {
    await this.backend.set({ locale });
  }

  public async exportBackup(): Promise<ExportData> {
    const clips = await this.getClips();
    const settings = await this.getSettings();
    return {
      app: 'PHP - Paste History Past',
      version: '2.0.0',
      exportedAt: Date.now(),
      clips,
      settings
    };
  }

  public async importBackup(data: unknown): Promise<{ success: boolean; count: number }> {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid backup data format');
    }

    const payload = data as Partial<ExportData>;
    if (!Array.isArray(payload.clips)) {
      throw new Error('Missing clips array in backup');
    }

    // Validate clips
    const validClips: Clip[] = payload.clips
      .filter((c): c is Clip => Boolean(c && typeof c === 'object' && typeof c.text === 'string' && c.text.trim().length > 0))
      .map((c) => ({
        id: typeof c.id === 'number' ? c.id : Date.now() + Math.random(),
        text: String(c.text).trim(),
        url: typeof c.url === 'string' ? c.url : '',
        timestamp: typeof c.timestamp === 'number' ? c.timestamp : Date.now(),
        pinned: Boolean(c.pinned),
        copyCount: typeof c.copyCount === 'number' ? c.copyCount : 0,
        lastCopied: typeof c.lastCopied === 'number' ? c.lastCopied : null,
        category: c.category === 'link' || c.category === 'code' || c.category === 'image' ? c.category : 'text',
        dataUrl: typeof c.dataUrl === 'string' && c.dataUrl.startsWith('data:image/') ? c.dataUrl : undefined,
        dimensions: c.dimensions && typeof c.dimensions.width === 'number' ? c.dimensions : undefined,
        ocrText: typeof c.ocrText === 'string' ? c.ocrText : undefined,
        qrData: typeof c.qrData === 'string' ? c.qrData : undefined
      }));

    if (validClips.length === 0) {
      throw new Error('No valid clips found in backup');
    }

    await this.setClips(validClips);

    if (payload.settings && typeof payload.settings === 'object') {
      // Safe assignment preventing prototype pollution
      const cleanSettings: Settings = {
        saveUrl: Boolean(payload.settings.saveUrl ?? DEFAULT_SETTINGS.saveUrl),
        ignorePasswords: Boolean(payload.settings.ignorePasswords ?? DEFAULT_SETTINGS.ignorePasswords),
        maxClips: typeof payload.settings.maxClips === 'number' ? payload.settings.maxClips : DEFAULT_SETTINGS.maxClips,
        maxAgeMs: typeof payload.settings.maxAgeMs === 'number' ? payload.settings.maxAgeMs : DEFAULT_SETTINGS.maxAgeMs,
        theme: payload.settings.theme === 'light' ? 'light' : 'dark',
        locale: payload.settings.locale === 'fr' ? 'fr' : 'en'
      };
      await this.setSettings(cleanSettings);
    }

    return { success: true, count: validClips.length };
  }
}
