import { Clip, ClipCategory, FilterMode } from '../domain/types';

/**
 * SearchService provides fuzzy matching, text highlighting, and content category classification.
 */
export class SearchService {
  private static readonly URL_REGEX =
    /^(https?:\/\/)?((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|((\d{1,3}\.){3}\d{1,3})|localhost)(:\d+)?(\/[-a-z\d%_.~+]*)*(\?[;&a-z\d%_.~+=-]*)?(#[-a-z\d_]*)?$/i;

  private static readonly CODE_INDICATORS: RegExp[] = [
    // 1. XML, HTML, SVG Tags (including <svg>, <circle>, <path>, <rect>, <div>, etc.)
    /<\/?(svg|circle|path|rect|line|polyline|polygon|g|defs|linearGradient|pattern|text|use|html|head|body|div|span|p|a|button|input|form|table|thead|tbody|tr|td|th|ul|ol|li|script|style|link|meta)\b/i,
    /xmlns="http:\/\/www\.w3\.org\/(2000\/svg|1999\/xhtml)"/i,
    /<!DOCTYPE\s+html>/i,

    // 2. JavaScript / TypeScript / Modern Web
    /^\s*(import\s+.*\s+from\s+['"]|export\s+(default\s+)?(class|function|const|let|var|type|interface)|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|function\s*\w*\s*\(|=>\s*\{|\(\)\s*=>)/m,

    // 3. Control Flow & Language Keywords
    /^\s*(if\s*\(.+\)\s*\{|for\s*\(.+\)\s*\{|while\s*\(.+\)\s*\{|switch\s*\(.+\)\s*\{|try\s*\{|catch\s*\(.+\)\s*\{)/m,

    // 4. SQL Statements
    /^\s*(SELECT\s+[\s\S]+\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\b/im,

    // 5. CSS / SCSS Selectors and Rules
    /^\s*([.#@:a-z][\w\-.:#\s,>+~*]*)\s*\{[\s\S]*\}/m,

    // 6. JSON Object / Array (multi-line or structured)
    /^\s*\{\s*"[\w\-]+"\s*:\s*[\s\S]+\}\s*$/,
    /^\s*\[\s*\{\s*"[\w\-]+"\s*:\s*[\s\S]+\}\s*\]\s*$/,

    // 7. Python, PHP, Rust, Go patterns
    /^\s*(def\s+\w+\s*\(|class\s+\w+(\(.*\))?\s*:|<\?php|fn\s+\w+\s*\(|package\s+main|func\s+\w+\s*\()/m,

    // 8. Terminal / Shell Commands & Scripts
    /^\s*(echo\s+|npm\s+(run|test|install|i|build)|git\s+(commit|push|pull|status|checkout|add)|docker\s+(run|build|compose|ps)|curl\s+-|brew\s+install|chmod\s+\+x|sudo\s+apt)/im
  ];

  /**
   * Checks whether the given text is a valid HTTP(S) URL.
   */
  public static isUrl(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (trimmed.includes('\n') || trimmed.includes('\r') || trimmed.includes(' ')) {
      return false;
    }
    return this.URL_REGEX.test(trimmed);
  }

  /**
   * Detects the category of a text or image payload: 'link' | 'code' | 'image' | 'text'.
   */
  public static detectCategory(text: string, dataUrl?: string): ClipCategory {
    if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
      return 'image';
    }

    if (this.isUrl(text)) {
      return 'link';
    }

    // Safety sample cap: inspect the first 4,000 chars to avoid ReDoS on huge 10MB inputs
    const sample = text.substring(0, 4000);

    for (const pattern of this.CODE_INDICATORS) {
      if (pattern.test(sample)) {
        return 'code';
      }
    }

    return 'text';
  }

  /**
   * Extracts clean hostname/domain from a URL.
   */
  public static extractDomain(url: string): string {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    const lower = trimmed.toLowerCase();

    if (
      lower.startsWith('javascript:') ||
      lower.startsWith('data:') ||
      lower.startsWith('blob:') ||
      lower.startsWith('file:') ||
      lower.startsWith('vbscript:')
    ) {
      return '';
    }

    try {
      let normalized = trimmed;
      if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
        if (normalized.includes('://')) {
          return '';
        }
        normalized = 'https://' + normalized;
      }
      const parsed = new URL(normalized);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return '';
      }
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  /**
   * Filters a list of clips by search term and filter mode.
   */
  public static filterClips(
    clips: Clip[],
    filter: FilterMode = 'all',
    query: string = ''
  ): Clip[] {
    let filtered = clips;

    // 1. Filter by category
    if (filter === 'links') {
      filtered = filtered.filter((c) => c.category === 'link' || this.isUrl(c.text));
    } else if (filter === 'code') {
      filtered = filtered.filter((c) => c.category === 'code');
    } else if (filter === 'images') {
      filtered = filtered.filter((c) => c.category === 'image');
    } else if (filter === 'pinned') {
      filtered = filtered.filter((c) => c.pinned);
    }

    // 2. Search query matching
    const q = query.trim().toLowerCase();
    if (!q) {
      return filtered;
    }

    const tokens = q.split(/\s+/).filter(Boolean);

    return filtered.filter((clip) => {
      const textMatch = clip.text ? clip.text.toLowerCase() : '';
      const urlMatch = clip.url ? clip.url.toLowerCase() : '';
      const domainMatch = clip.url ? this.extractDomain(clip.url).toLowerCase() : '';
      const ocrMatch = clip.ocrText ? clip.ocrText.toLowerCase() : '';
      const qrMatch = clip.qrData ? clip.qrData.toLowerCase() : '';

      return tokens.every(
        (token) =>
          textMatch.includes(token) ||
          urlMatch.includes(token) ||
          domainMatch.includes(token) ||
          ocrMatch.includes(token) ||
          qrMatch.includes(token)
      );
    });
  }

  /**
   * Returns HTML string with highlighted matching words.
   */
  public static highlightMatches(escapedText: string, query: string): string {
    if (!query.trim() || !escapedText) return escapedText;

    const terms = Array.from(
      new Set(
        query
          .trim()
          .split(/\s+/)
          .filter((t) => t.length > 0)
          .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      )
    );

    if (terms.length === 0) return escapedText;

    // Safety boundary: Cap to 5,000 characters to prevent HTML memory blowup on single-character mass replacements
    const sample = escapedText.length > 5000 ? escapedText.substring(0, 5000) : escapedText;
    const regex = new RegExp(`(${terms.join('|')})`, 'gi');
    return sample.replace(regex, '<mark class="search-highlight">$1</mark>');
  }
}
