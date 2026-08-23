import { describe, it, expect } from 'vitest';
import { SearchService } from '../../src/application/search.service';
import { Clip } from '../../src/domain/types';

describe('SearchService', () => {
  describe('isUrl', () => {
    it('accurately identifies HTTP and HTTPS URLs', () => {
      expect(SearchService.isUrl('https://github.com/fnnktkygl-code')).toBe(true);
      expect(SearchService.isUrl('http://localhost:3000')).toBe(true);
      expect(SearchService.isUrl('subdomain.example.org/path?param=1#hash')).toBe(true);
    });

    it('rejects multi-line text or non-URLs', () => {
      expect(SearchService.isUrl('This is just normal text.')).toBe(false);
      expect(SearchService.isUrl('https://example.com\nAnother line')).toBe(false);
      expect(SearchService.isUrl('')).toBe(false);
    });
  });

  describe('detectCategory', () => {
    it('identifies links', () => {
      expect(SearchService.detectCategory('https://developer.chrome.com')).toBe('link');
    });

    it('identifies SVG snippets as code', () => {
      const svgCode = `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" fill="blue" />
</svg>`;
      expect(SearchService.detectCategory(svgCode)).toBe('code');
    });

    it('identifies HTML / XML snippets as code', () => {
      expect(SearchService.detectCategory('<!DOCTYPE html><html><body><h1>Title</h1></body></html>')).toBe('code');
      expect(SearchService.detectCategory('<button class="btn btn-primary" onclick="alert(1)">Click</button>')).toBe('code');
      expect(SearchService.detectCategory('<div id="app"><span class="badge">Active</span></div>')).toBe('code');
    });

    it('identifies SQL, JSON, CSS, Shell and programming code', () => {
      expect(SearchService.detectCategory('const x = () => { return 42; };')).toBe('code');
      expect(SearchService.detectCategory('def calculate_sum(a, b):\n    return a + b')).toBe('code');
      expect(SearchService.detectCategory('SELECT id, name FROM users WHERE active = 1;')).toBe('code');
      expect(SearchService.detectCategory('docker run -d -p 8080:80 nginx:latest')).toBe('code');
      expect(SearchService.detectCategory('git checkout -b feature/login')).toBe('code');
      expect(SearchService.detectCategory('.card-header { display: flex; align-items: center; }')).toBe('code');
      expect(SearchService.detectCategory('{\n  "name": "php-chrome-extension",\n  "version": "2.0.0"\n}')).toBe('code');
    });

    it('identifies image data URLs as image category', () => {
      expect(SearchService.detectCategory('Image Clip', 'data:image/png;base64,iVBORw0KGgo=')).toBe('image');
    });

    it('identifies standard text', () => {
      expect(SearchService.detectCategory('Hello world! How are you doing today?')).toBe('text');
      expect(SearchService.detectCategory('A shopping list: apples, milk, bread')).toBe('text');
    });
  });

  describe('extractDomain', () => {
    it('extracts clean domains from full URLs', () => {
      expect(SearchService.extractDomain('https://www.google.com/search?q=test')).toBe('google.com');
      expect(SearchService.extractDomain('github.com/facebook/react')).toBe('github.com');
      expect(SearchService.extractDomain('http://api.sub.domain.co.uk/v1')).toBe('api.sub.domain.co.uk');
    });

    it('returns empty string for invalid inputs', () => {
      expect(SearchService.extractDomain('')).toBe('');
      expect(SearchService.extractDomain('not a url')).toBe('');
    });
  });

  describe('filterClips', () => {
    const mockClips: Clip[] = [
      {
        id: 1,
        text: 'https://vitejs.dev',
        url: 'https://vitejs.dev',
        timestamp: 1000,
        pinned: false,
        copyCount: 1,
        lastCopied: null,
        category: 'link'
      },
      {
        id: 2,
        text: '<svg viewBox="0 0 100 100"><circle r="40" /></svg>',
        url: 'https://github.com',
        timestamp: 2000,
        pinned: true,
        copyCount: 5,
        lastCopied: null,
        category: 'code'
      },
      {
        id: 3,
        text: 'Doctor appointment on Monday 10am',
        url: '',
        timestamp: 3000,
        pinned: false,
        copyCount: 0,
        lastCopied: null,
        category: 'text'
      },
      {
        id: 4,
        text: 'Qr Code Receipt',
        url: 'https://store.example.com',
        timestamp: 4000,
        pinned: false,
        copyCount: 0,
        lastCopied: null,
        category: 'image',
        dataUrl: 'data:image/png;base64,mock',
        ocrText: 'TOTAL PAID: $42.50 INVOICE #9812',
        qrData: 'https://pay.example.com/receipt/9812'
      }
    ];

    it('filters by category tab including images', () => {
      expect(SearchService.filterClips(mockClips, 'all', '')).toHaveLength(4);
      expect(SearchService.filterClips(mockClips, 'links', '')).toHaveLength(1);
      expect(SearchService.filterClips(mockClips, 'links', '')[0].id).toBe(1);
      expect(SearchService.filterClips(mockClips, 'code', '')).toHaveLength(1);
      expect(SearchService.filterClips(mockClips, 'code', '')[0].id).toBe(2);
      expect(SearchService.filterClips(mockClips, 'images', '')).toHaveLength(1);
      expect(SearchService.filterClips(mockClips, 'images', '')[0].id).toBe(4);
      expect(SearchService.filterClips(mockClips, 'pinned', '')).toHaveLength(1);
      expect(SearchService.filterClips(mockClips, 'pinned', '')[0].id).toBe(2);
    });

    it('filters by search keyword', () => {
      const results = SearchService.filterClips(mockClips, 'all', 'svg');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(2);
    });

    it('searches across OCR text and QR data', () => {
      const ocrResults = SearchService.filterClips(mockClips, 'all', 'INVOICE');
      expect(ocrResults).toHaveLength(1);
      expect(ocrResults[0].id).toBe(4);

      const qrResults = SearchService.filterClips(mockClips, 'all', 'pay.example.com');
      expect(qrResults).toHaveLength(1);
      expect(qrResults[0].id).toBe(4);
    });
  });

  describe('highlightMatches', () => {
    it('wraps matching query tokens with mark elements', () => {
      const text = 'Quick brown fox jumps over lazy dog';
      const highlighted = SearchService.highlightMatches(text, 'brown dog');
      expect(highlighted).toContain('<mark class="search-highlight">brown</mark>');
      expect(highlighted).toContain('<mark class="search-highlight">dog</mark>');
    });

    it('returns raw string when query is empty', () => {
      const text = 'Hello world';
      expect(SearchService.highlightMatches(text, '')).toBe(text);
    });
  });
});
