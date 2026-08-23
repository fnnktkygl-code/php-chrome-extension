import { Clip, Settings } from '../domain/types';
import { SearchService } from './search.service';
import { SecurityService } from './security.service';
import { StorageService } from './storage.service';

export interface ClipboardPayload {
  text: string;
  url?: string;
  timestamp?: number;
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
    const cleanText = SecurityService.sanitizeClipText(payload.text);
    if (!cleanText) {
      return null;
    }

    const settings = await this.storage.getSettings();
    let clips = await this.storage.getClips();
    const timestamp = payload.timestamp || Date.now();
    const url = settings.saveUrl ? (payload.url || '') : '';
    const category = SearchService.detectCategory(cleanText);

    // Deduplication check
    const existingIndex = clips.findIndex((c) => c.text === cleanText);

    let savedClip: Clip;

    if (existingIndex !== -1) {
      const existing = clips[existingIndex];
      // If pinned, keep pinned status and update timestamp & metadata
      if (existing.pinned) {
        existing.timestamp = timestamp;
        if (url) existing.url = url;
        existing.category = category;
        savedClip = existing;
      } else {
        // Move to top with updated timestamp
        clips.splice(existingIndex, 1);
        savedClip = {
          ...existing,
          timestamp,
          url: url || existing.url,
          category
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
        category
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

    // Filter out expired unpinned clips
    const validClips = clips.filter((clip) => {
      if (clip.pinned) return true;
      if (maxAgeMs === 0) return true; // never expire
      return now - clip.timestamp < maxAgeMs;
    });

    const pinned = validClips.filter((c) => c.pinned);
    const unpinned = validClips.filter((c) => !c.pinned);

    // Enforce max clips limit on unpinned
    if (unpinned.length > maxClips) {
      unpinned.length = maxClips;
    }

    return [...pinned, ...unpinned];
  }

  /**
   * Toggles the pinned status of a clip.
   */
  public async togglePin(clipId: number): Promise<boolean> {
    const clips = await this.storage.getClips();
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return false;

    clip.pinned = !clip.pinned;
    this.sortClips(clips);
    await this.storage.setClips(clips);
    return clip.pinned;
  }

  /**
   * Deletes a specific clip by ID.
   */
  public async deleteClip(clipId: number): Promise<boolean> {
    let clips = await this.storage.getClips();
    const initialLen = clips.length;
    clips = clips.filter((c) => c.id !== clipId);

    if (clips.length !== initialLen) {
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
   * Records that a clip was copied back to clipboard.
   */
  public async recordCopy(clipId: number): Promise<void> {
    const clips = await this.storage.getClips();
    const clip = clips.find((c) => c.id === clipId);
    if (clip) {
      clip.copyCount = (clip.copyCount || 0) + 1;
      clip.lastCopied = Date.now();
      await this.storage.setClips(clips);
    }
  }

  /**
   * Updates the extension action badge with current count.
   */
  public async updateActionBadge(count: number): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.action) {
      try {
        const text = count > 0 ? (count > 99 ? '99+' : String(count)) : '';
        await chrome.action.setBadgeText({ text });
        if (text) {
          await chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
        }
      } catch (err) {
        console.debug('Badge update skipped:', err);
      }
    }
  }
}
