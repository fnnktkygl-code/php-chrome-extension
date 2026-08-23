import { Clip, ClipCategory } from '../domain/types';

/**
 * SearchService handles search querying, category detection, and domain extraction.
 */
export class SearchService {
  private static readonly CODE_INDICATORS = [
    /^\s*(import|export|const|let|var|function|class|return|if|else|for|while)\b/m,
    /^\s*(def|class|print|from|import|elif|async|await)\b/m,
    /^\s*(<\?php|\$this->|namespace\s|public\s+function)/m,
    /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|ALTER TABLE)\b/im,
    /^\s*(echo\s|docker\s|git\s|npm\s|yarn\s|pnpm\s|kubectl\s|curl\s|ssh\s)/m,
    /[{}();]{2,}/,
    /=>\s*[{]/
  ];

  /**
   * Checks if text is a valid web URL or localhost.
   */
  public static isUrl(text: string): boolean {
    if (!text) return false;
    const trimmed = text.trim();
    if (trimmed.includes('\n') || trimmed.includes('\r') || trimmed.includes(' ')) return false;

    try {
      const url = new URL(
        trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`
      );
      return url.hostname.includes('.') || url.hostname === 'localhost';
    } catch {
      return false;
    }
  }

  /**
   * Determines the category of a clip (link, code, or text).
   */
  public static detectCategory(text: string): ClipCategory {
    if (this.isUrl(text)) {
      return 'link';
    }
    const trimmed = text.trim();
    for (const pattern of this.CODE_INDICATORS) {
      if (pattern.test(trimmed)) {
        return 'code';
      }
    }
    return 'text';
  }

  /**
   * Extracts clean hostname/domain from a URL.
   */
  public static extractDomain(url: string): string {
    if (!url) return '';
    try {
      let normalized = url.trim();
      if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        normalized = 'https://' + normalized;
      }
      const parsed = new URL(normalized);
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
    filterMode: 'all' | 'links' | 'pinned' | 'code',
    query: string
  ): Clip[] {
    let result = [...clips];

    // Apply category / tab filter
    if (filterMode === 'links') {
      result = result.filter((c) => c.category === 'link' || this.isUrl(c.text));
    } else if (filterMode === 'pinned') {
      result = result.filter((c) => c.pinned);
    } else if (filterMode === 'code') {
      result = result.filter((c) => c.category === 'code');
    }

    // Apply search query
    const cleanQuery = query.trim().toLowerCase();
    if (cleanQuery) {
      const queryTokens = cleanQuery.split(/\s+/).filter(Boolean);
      result = result.filter((clip) => {
        const textLower = clip.text.toLowerCase();
        const urlLower = (clip.url || '').toLowerCase();
        return queryTokens.every((token) => textLower.includes(token) || urlLower.includes(token));
      });
    }

    return result;
  }

  /**
   * Highlights matching search tokens in an HTML-escaped string.
   */
  public static highlightMatches(escapedText: string, query: string): string {
    if (!query.trim()) return escapedText;
    const tokens = query
      .trim()
      .split(/\s+/)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter(Boolean);

    if (tokens.length === 0) return escapedText;

    const regex = new RegExp(`(${tokens.join('|')})`, 'gi');
    return escapedText.replace(regex, '<mark class="search-highlight">$1</mark>');
  }
}
