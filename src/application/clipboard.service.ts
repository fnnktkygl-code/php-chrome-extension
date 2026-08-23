import { Clip, ClipCategory, Settings } from '../domain/types';
import { SearchService } from './search.service';
import { SecurityService } from './security.service';
import { StorageService } from './storage.service';

export interface ClipboardPayload {
  text: string;
  url?: string;
  timestamp?: number;
  category?: ClipCategory;
  dataUrl?: string;
  dimensions?: { width: number; height: number };
  ocrText?: string;
  qrData?: string;
}

export class ClipboardService {
  private storage: StorageService;

  constructor(storage?: StorageService) {
    this.storage = storage || new StorageService();
  }

  /**
   * Processes an incoming clipboard capture.
   */
  public async handleCopy(payload: ClipboardPayload): Promise<Clip | null> {
    const isImage = payload.category === 'image' || Boolean(payload.dataUrl);
    let cleanText = '';

    if (isImage) {
      cleanText = payload.text || payload.ocrText || payload.qrData || 'Image Clip';
    } else {
      const sanitized = SecurityService.sanitizeClipText(payload.text);
      if (!sanitized) {
        return null;
      }
      cleanText = sanitized;
    }

    const settings = await this.storage.getSettings();
    let clips = await this.storage.getClips();
    const timestamp = payload.timestamp || Date.now();
    const url = settings.saveUrl ? (payload.url || '') : '';
    const category: ClipCategory = isImage
      ? 'image'
      : SearchService.detectCategory(cleanText, payload.dataUrl);

    // Deduplication check
    const existingIndex = clips.findIndex((c) => {
      if (isImage && payload.dataUrl && c.dataUrl) {
        return c.dataUrl === payload.dataUrl;
      }
      return c.text === cleanText;
    });

    let savedClip: Clip;

    if (existingIndex !== -1) {
      const existing = clips[existingIndex];
      // If pinned, keep pinned status and update timestamp & metadata
      if (existing.pinned) {
        existing.timestamp = timestamp;
        if (url) existing.url = url;
        existing.category = category;
        if (payload.dataUrl) existing.dataUrl = payload.dataUrl;
        if (payload.ocrText) existing.ocrText = payload.ocrText;
        if (payload.qrData) existing.qrData = payload.qrData;
        savedClip = existing;
      } else {
        // Move to top with updated timestamp
        clips.splice(existingIndex, 1);
        savedClip = {
          ...existing,
          timestamp,
          url: url || existing.url,
          category,
          dataUrl: payload.dataUrl || existing.dataUrl,
          dimensions: payload.dimensions || existing.dimensions,
          ocrText: payload.ocrText || existing.ocrText,
          qrData: payload.qrData || existing.qrData
        };
        clips.unshift(savedClip);
      }
    } else {
      savedClip = {
        id: timestamp,
        text: cleanText,
        url,
        timestamp,
        pinned: false,
        copyCount: 0,
        lastCopied: null,
        category,
        dataUrl: payload.dataUrl,
        dimensions: payload.dimensions,
        ocrText: payload.ocrText,
        qrData: payload.qrData
      };
      clips.unshift(savedClip);
    }

    // Clean up clips according to retention settings
    clips = this.cleanupClips(clips, settings);

    // Save and sort
    this.sortClips(clips);
    await this.storage.setClips(clips);

    // Update badge count
    await this.updateActionBadge(clips.length);

    return savedClip;
  }

  /**
   * Sorts clips: pinned first (by timestamp desc), then unpinned by timestamp desc.
   */
  public sortClips(clips: Clip[]): void {
    clips.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.timestamp - a.timestamp;
    });
  }

  /**
   * Evicts expired or excess unpinned clips based on settings.
   */
  public cleanupClips(clips: Clip[], settings: Settings, now: number = Date.now()): Clip[] {
    const { maxClips, maxAgeMs } = settings;

    // 1. Evict expired unpinned clips
    const validClips = clips.filter((clip) => {
      if (clip.pinned) return true; // Pinned never expire
      if (maxAgeMs === 0) return true; // Retention set to Never
      return now - clip.timestamp < maxAgeMs;
    });

    // 2. Separate pinned and unpinned
    const pinned = validClips.filter((c) => c.pinned);
    const unpinned = validClips.filter((c) => !c.pinned);

    // 3. Limit unpinned capacity
    const cappedUnpinned = unpinned.slice(0, maxClips);

    return [...pinned, ...cappedUnpinned];
  }

  /**
   * Updates Chrome extension action badge text with the active clip count.
   */
  public async updateActionBadge(count: number): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.action && chrome.action.setBadgeText) {
      try {
        const text = count > 0 ? String(count) : '';
        await chrome.action.setBadgeText({ text });
        if (text && chrome.action.setBadgeBackgroundColor) {
          await chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
        }
      } catch (err) {
        console.debug('Badge update skipped in test environment', err);
      }
    }
  }

  /**
   * Toggles pin status for a given clip id.
   */
  public async togglePin(id: number): Promise<boolean> {
    const clips = await this.storage.getClips();
    const clip = clips.find((c) => c.id === id);
    if (!clip) {
      return false;
    }

    clip.pinned = !clip.pinned;
    this.sortClips(clips);
    await this.storage.setClips(clips);
    return clip.pinned;
  }

  /**
   * Deletes a clip by id.
   */
  public async deleteClip(id: number): Promise<boolean> {
    let clips = await this.storage.getClips();
    const beforeCount = clips.length;
    clips = clips.filter((c) => c.id !== id);

    if (clips.length !== beforeCount) {
      await this.storage.setClips(clips);
      await this.updateActionBadge(clips.length);
      return true;
    }
    return false;
  }

  /**
   * Clears all unpinned clips.
   */
  public async clearUnpinned(): Promise<number> {
    const clips = await this.storage.getClips();
    const pinnedClips = clips.filter((c) => c.pinned);
    const clearedCount = clips.length - pinnedClips.length;

    await this.storage.setClips(pinnedClips);
    await this.updateActionBadge(pinnedClips.length);
    return clearedCount;
  }

  /**
   * Increments copy counter for analytics & metadata.
   */
  public async recordCopy(id: number): Promise<boolean> {
    const clips = await this.storage.getClips();
    const clip = clips.find((c) => c.id === id);
    if (!clip) return false;
    clip.copyCount = (clip.copyCount || 0) + 1;
    clip.lastCopied = Date.now();
    await this.storage.setClips(clips);
    return true;
  }
}
