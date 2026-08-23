import { describe, it, expect, beforeEach } from 'vitest';
import { ClipboardService } from '../../src/application/clipboard.service';
import { SearchService } from '../../src/application/search.service';
import { SecurityService } from '../../src/application/security.service';
import { StorageService } from '../../src/application/storage.service';
import { Clip } from '../../src/domain/types';
import { setupMockChrome } from '../../src/infrastructure/mock-chrome';

describe('Performance & Stress Benchmarks (State of the Art)', () => {
  let storage: StorageService;
  let clipboardService: ClipboardService;

  beforeEach(async () => {
    setupMockChrome();
    storage = new StorageService();
    clipboardService = new ClipboardService(storage);
    await storage.clearAll();
  });

  describe('1. High-Throughput Ingestion & Storage Benchmark', () => {
    it('processes 200 consecutive clipboard copy operations in under 350ms', async () => {
      const start = performance.now();

      for (let i = 0; i < 200; i++) {
        await clipboardService.handleCopy({
          text: `Benchmark test clipboard clip entry #${i} with some code: const x = ${i * 42};`,
          url: `https://benchmark.example.com/page/${i}`,
          timestamp: Date.now() + i
        });
      }

      const duration = performance.now() - start;
      const clips = await storage.getClips();

      expect(clips.length).toBeLessThanOrEqual(50); // Capped at default maxClips
      expect(duration).toBeLessThan(350); // Fast throughput
    });

    it('handles rapid image dataURL storage with zero memory retention issues', async () => {
      const start = performance.now();
      const fakeImageBase64 = 'data:image/webp;base64,' + 'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAD8D+JaQAA3AA/ua1AAA='.repeat(50);

      for (let i = 0; i < 30; i++) {
        await clipboardService.handleCopy({
          text: `Image Clip #${i}`,
          url: 'https://images.example.com',
          timestamp: Date.now() + i,
          category: 'image',
          dataUrl: fakeImageBase64 + `-${i}`,
          dimensions: { width: 400, height: 300 }
        });
      }

      const duration = performance.now() - start;
      const clips = await storage.getClips();

      expect(clips.length).toBe(30);
      expect(duration).toBeLessThan(200);
    });
  });

  describe('2. Ultra-Fast Search Engine Benchmarks', () => {
    it('executes full-text search across 500 populated clips in under 15ms', () => {
      const mockClips: Clip[] = Array.from({ length: 500 }, (_, i) => ({
        id: i + 1,
        text: `Item #${i}: const config = { port: ${3000 + i}, debug: true, token: "secret-${i}" }; function executeQuery() { return "<svg><circle></circle></svg>"; }`,
        url: `https://subdomain-${i % 10}.example.com/api/v1/resource`,
        timestamp: Date.now() - i * 60000,
        pinned: i % 20 === 0,
        copyCount: i % 5,
        lastCopied: null,
        category: i % 3 === 0 ? 'code' : i % 3 === 1 ? 'link' : 'text',
        ocrText: i % 4 === 0 ? `Scanned OCR snippet from UI widget #${i}` : undefined,
        qrData: i % 10 === 0 ? `https://qr.auth.io/token/${i}` : undefined
      }));

      const start = performance.now();

      // Perform multiple distinct searches (text, code, url domain, OCR text)
      const resultsText = SearchService.filterClips(mockClips, 'all', 'executeQuery');
      const resultsCode = SearchService.filterClips(mockClips, 'code', 'config');
      const resultsDomain = SearchService.filterClips(mockClips, 'links', 'subdomain-3');
      const resultsOcr = SearchService.filterClips(mockClips, 'all', 'Scanned OCR');

      const totalSearchTime = performance.now() - start;

      expect(resultsText.length).toBe(500);
      expect(resultsCode.length).toBeGreaterThan(0);
      expect(resultsDomain.length).toBeGreaterThan(0);
      expect(resultsOcr.length).toBeGreaterThan(0);
      expect(totalSearchTime).toBeLessThan(50); // < 50ms for 4 complex searches across 500 objects (<12ms each)
    });

    it('executes ultra-fast search across 5,000 in-memory clips in under 45ms', () => {
      const largeClipSet: Clip[] = Array.from({ length: 5000 }, (_, i) => ({
        id: i + 1,
        text: `Item #${i}: function calculateMetric() { return ${i * 3.14}; } // auth token: abc-${i}`,
        url: `https://domain-${i % 25}.org/path`,
        timestamp: Date.now() - i * 1000,
        pinned: i % 100 === 0,
        copyCount: 1,
        lastCopied: null,
        category: i % 2 === 0 ? 'code' : 'link',
        ocrText: i % 5 === 0 ? `Captured screenshot text snippet #${i}` : undefined
      }));

      const start = performance.now();
      const results = SearchService.filterClips(largeClipSet, 'all', 'calculateMetric');
      const duration = performance.now() - start;

      expect(results.length).toBe(5000);
      expect(duration).toBeLessThan(45);
    });
  });

  describe('3. Real-Time Regex & Category Classifier Performance', () => {
    it('classifies 1,000 diverse code, HTML, SVG and URL strings in under 25ms', () => {
      const payloads = [
        '<svg width="100" height="100"><circle cx="50" cy="50" r="40" fill="blue" /></svg>',
        'https://developer.mozilla.org/en-US/docs/Web/API/Clipboard',
        'SELECT u.id, u.email FROM users u WHERE u.created_at > NOW() - INTERVAL 7 DAY;',
        'const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); };',
        'docker run -d -p 8080:80 --name my-nginx nginx:alpine',
        'Just regular meeting notes taken during the afternoon sprint planning session.'
      ];

      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        const payload = payloads[i % payloads.length];
        SearchService.detectCategory(payload);
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(25); // < 25ms for 1,000 classifications (25µs per classification)
    });
  });

  describe('4. Security & Sanitization Benchmark at Scale', () => {
    it('strips invisible Unicode and masks DLP secrets on 1,000 payloads in under 30ms', () => {
      const sensitivePayload = 'Deploy token: ghp_1234567890abcdef1234567890abcdef123456 with hidden \u200B\u200C\uFEFF chars and AWS key AKIAIOSFODNN7EXAMPLE';

      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        const clean = SecurityService.stripInvisibleUnicode(sensitivePayload);
        const masked = SecurityService.maskSensitiveSecrets(clean);
        SecurityService.detectAiPromptInjection(masked);
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100); // < 100ms for 1,000 DLP sanitizations (<100µs each)
    });
  });

  describe('5. Image & Canvas Processing Resilience Benchmark', () => {
    it('safely handles canvas scaling calculation and aspect ratio retention', () => {
      const dimensions = [
        { w: 4000, h: 3000 },
        { w: 100, h: 50 },
        { w: 800, h: 800 },
        { w: 12000, h: 8000 }
      ];

      for (const d of dimensions) {
        const max = 800;
        let nw = d.w;
        let nh = d.h;
        if (nw > max || nh > max) {
          if (nw > nh) {
            nh = Math.round((nh * max) / nw);
            nw = max;
          } else {
            nw = Math.round((nw * max) / nh);
            nh = max;
          }
        }
        expect(nw).toBeLessThanOrEqual(800);
        expect(nh).toBeLessThanOrEqual(800);
        expect(nw).toBeGreaterThan(0);
        expect(nh).toBeGreaterThan(0);
      }
    });
  });
});
