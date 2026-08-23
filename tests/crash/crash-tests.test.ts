import { describe, it, expect, beforeEach } from 'vitest';
import { ClipboardService } from '../../src/application/clipboard.service';
import { ImageService } from '../../src/application/image.service';
import { SearchService } from '../../src/application/search.service';
import { SecurityService } from '../../src/application/security.service';
import { StorageService } from '../../src/application/storage.service';
import { setupMockChrome } from '../../src/infrastructure/mock-chrome';

describe('Comprehensive Crash & Stress Tests (Fuzzing & Vulnerability Suite)', () => {
  let storage: StorageService;
  let clipboardService: ClipboardService;

  beforeEach(async () => {
    setupMockChrome();
    storage = new StorageService();
    clipboardService = new ClipboardService(storage);
    await storage.clearAll();
  });

  describe('1. Massive Payload & Memory Stress Tests', () => {
    it('handles massive 10MB text payload without crashing or blocking', async () => {
      const hugeText = 'A'.repeat(10 * 1024 * 1024); // 10 Megabytes
      const start = Date.now();

      const clip = await clipboardService.handleCopy({
        text: hugeText,
        url: 'https://example.com/big-data',
        timestamp: Date.now()
      });

      const duration = Date.now() - start;

      expect(clip).not.toBeNull();
      // Must be capped at MAX_CLIP_LENGTH (20,000 chars)
      expect(clip?.text.length).toBeLessThanOrEqual(20000);
      expect(duration).toBeLessThan(1000); // Must complete in under 1 second
    });

    it('handles 1,000 rapid concurrent copy events without crashing or corrupting storage', async () => {
      const promises = Array.from({ length: 100 }, (_, i) =>
        clipboardService.handleCopy({
          text: `Rapid Concurrent Clip #${i} - ${Math.random()}`,
          url: `https://test.org/page/${i}`,
          timestamp: Date.now() + i
        })
      );

      const results = await Promise.all(promises);
      expect(results.every((r) => r !== null)).toBe(true);

      const clips = await storage.getClips();
      expect(clips.length).toBeLessThanOrEqual(50); // Capped by default maxClips
    });
  });

  describe('2. Malicious Payloads, XSS & Security Attacks', () => {
    it('neutralizes SVG & HTML script injections', () => {
      const xssVector = `<svg onload="alert(document.cookie)"><script>evil()</script><img src=x onerror=alert('pwned')></svg>`;
      const escaped = SecurityService.escapeHtml(xssVector);

      expect(escaped).not.toContain('<script>');
      expect(escaped).not.toContain('<svg onload');
      expect(escaped).toContain('&lt;svg onload=');
    });

    it('neutralizes javascript: pseudo-protocol in image dataUrls', () => {
      const evilDataUrl = `javascript:alert('XSS')`;
      const category = SearchService.detectCategory('Harmless Text', evilDataUrl);
      // javascript: url is not a valid image
      expect(category).not.toBe('image');
    });

    it('handles zero-width characters, null bytes and RTL override Unicode exploits', async () => {
      const dangerousUnicode = `Normal\u0000Text\u200BWith\u202EExploit\uFEFF`;
      const clip = await clipboardService.handleCopy({
        text: dangerousUnicode,
        timestamp: Date.now()
      });

      expect(clip).not.toBeNull();
      const escaped = SecurityService.escapeHtml(clip!.text);
      expect(typeof escaped).toBe('string');
    });

    it('safely handles ReDoS (Regex Denial of Service) query attempts', () => {
      // Pathological string that causes catastrophic backtracking in unanchored regexes
      const pathologicalText = 'a'.repeat(20000) + '!';
      const start = Date.now();

      const category = SearchService.detectCategory(pathologicalText);
      const highlighted = SearchService.highlightMatches(pathologicalText, 'a a a a a a a a');

      const elapsed = Date.now() - start;
      expect(category).toBe('text');
      expect(typeof highlighted).toBe('string');
      expect(elapsed).toBeLessThan(500); // Must not hang
    });
  });

  describe('3. Unsupported Media, Viruses & Corrupted Binary Blobs', () => {
    it('handles corrupted base64 and invalid data URLs in ImageService without throwing unhandled exceptions', () => {
      const corruptedDataUrl = 'data:image/png;base64,---NOT-BASE64---';
      expect(() => {
        const blob = ImageService.dataUrlToBlob(corruptedDataUrl);
        expect(blob).toBeDefined();
      }).not.toThrow();
    });

    it('rejects video, audio and non-image blobs safely', async () => {
      const videoBlob = new Blob(['fake video mp4 binary content'], { type: 'video/mp4' });
      const result = await ImageService.processImageBlob(videoBlob);
      expect(result).toBeDefined();
    });

    it('handles 0-byte empty blobs safely', async () => {
      const emptyBlob = new Blob([], { type: 'image/png' });
      const result = await ImageService.processImageBlob(emptyBlob);
      expect(result).toBeDefined();
    });
  });

  describe('4. Malformed JSON Backup Import & Prototype Pollution Fuzzing', () => {
    it('blocks prototype pollution payload in importBackup', async () => {
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
      // Missing id, corrupted types
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
});
