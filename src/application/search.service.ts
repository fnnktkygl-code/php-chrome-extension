import { Clip, ClipCategory, FilterMode } from '../domain/types';

/**
 * SearchService handles search querying, comprehensive category detection, and domain extraction.
 */
export class SearchService {
  private static readonly CODE_INDICATORS: RegExp[] = [
    // 1. XML / HTML / SVG tags & structures
    /<\/?(svg|path|circle|rect|line|polygon|polyline|ellipse|g|defs|use|symbol|clipPath|mask|text|tspan)\b/i,
    /<\/?(html|head|body|div|span|p|a|button|input|form|table|thead|tbody|tr|td|th|ul|ol|li|h[1-6]|script|style|link|meta|template|header|footer|nav|main|section|article)\b/i,
    /xmlns="http:\/\/www\.w3\.org\/(2000\/svg|1999\/xhtml)"/i,
    /<!DOCTYPE\s+html>/i,
    /<[a-zA-Z0-9_\-:]+(\s+[^>]*)?\/?>.*?<\/[a-zA-Z0-9_\-:]+>/s,

    // 2. JavaScript / TypeScript
    /^\s*(import\s+.*\s+from\s+['"]|export\s+(default\s+)?(const|let|var|function|class|type|interface)|const\s+[\w${}\[\],\s]+\s*=|let\s+[\w${}\[\],\s]+\s*=|var\s+[\w${}\[\],\s]+\s*=)/m,
    /^\s*(function\s*[\w$]*\s*\(|async\s+function|const\s+[\w$]+\s*=\s*(async\s*)?\([^)]*\)\s*=>)/m,
    /=>\s*[{]/,
    /\b(console\.(log|error|warn|info|debug)|document\.getElementById|window\.addEventListener)\b/,

    // 3. Python
    /^\s*(def\s+[\w_]+\s*\(|class\s+[\w_]+(\s*\([^)]*\))?\s*:|from\s+[\w_.]+\s+import|import\s+[\w_.]+|elif\s+.*:|async\s+def\s+|raise\s+\w+|yield\s+)/m,
    /if\s+__name__\s*==\s*['"]__main__['"]\s*:/,

    // 4. PHP
    /^\s*(<\?php|\$this->|namespace\s+[\w\\]+;|public\s+function|private\s+function|protected\s+function|\$\w+\s*=)/m,

    // 5. SQL
    /^\s*(SELECT\s+[\s\S]+\s+FROM|INSERT\s+INTO\s+|UPDATE\s+[\s\S]+\s+SET|DELETE\s+FROM\s+|CREATE\s+(TABLE|DATABASE|INDEX|VIEW)|ALTER\s+TABLE|DROP\s+(TABLE|DATABASE)|TRUNCATE\s+TABLE)\b/im,

    // 6. CSS / SCSS
    /^\s*([.#@:a-z][\w\-.:#\s,>+~*]*)\s*\{[\s\S]*\}/m,
    /@(media|keyframes|import|font-face|tailwind|apply)\b/i,

    // 7. Shell / Terminal / Docker Commands
    /^\s*(echo\s+|sudo\s+|docker\s+|docker-compose\s+|npm\s+|npx\s+|yarn\s+|pnpm\s+|bun\s+|pip\s+|pip3\s+|cargo\s+|git\s+|kubectl\s+|curl\s+|wget\s+|ssh\s+|scp\s+|brew\s+|apt\s+|apt-get\s+|chmod\s+|chown\s+|mkdir\s+|touch\s+|systemctl\s+|service\s+|export\s+[\w_]+=)/m,

    // 8. Rust / Go / C / C++ / Java
    /^\s*(fn\s+[\w_]+\s*\(|pub\s+fn\s+|impl\s+|struct\s+\w+\s*\{|enum\s+\w+\s*\{|trait\s+\w+\s*\{|let\s+mut\s+)/m,
    /^\s*(package\s+main|func\s+(\([^)]+\)\s*)?[\w_]+\s*\(|type\s+\w+\s+struct)/m,
    /^\s*(#include\s+[<"]|int\s+main\s*\(|std::|public\s+static\s+void\s+main)/m,

    // 9. JSON & Data objects
    /^\s*\{\s*"[\w\-]+"\s*:\s*[\s\S]+\}\s*$/,
    /^\s*\[\s*\{\s*"[\w\-]+"\s*:\s*[\s\S]+\}\s*\]\s*$/
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
   * Determines the category of a clip (link, code, text, or image).
   */
  public static detectCategory(text: string, dataUrl?: string): ClipCategory {
    if ((dataUrl && dataUrl.startsWith('data:image/')) || (text && text.startsWith('data:image/'))) {
      return 'image';
    }

    if (this.isUrl(text)) {
      return 'link';
    }

    const trimmed = text.trim();
    const sample = trimmed.substring(0, 4000);
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
    filterMode: FilterMode,
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
    } else if (filterMode === 'images') {
      result = result.filter((c) => c.category === 'image');
    }

    // Apply search query
    const cleanQuery = query.trim().toLowerCase();
    if (cleanQuery) {
      const queryTokens = cleanQuery.split(/\s+/).filter(Boolean);
      result = result.filter((clip) => {
        const textLower = (clip.text || '').toLowerCase();
        const urlLower = (clip.url || '').toLowerCase();
        const ocrLower = (clip.ocrText || '').toLowerCase();
        const qrLower = (clip.qrData || '').toLowerCase();

        return queryTokens.every(
          (token) =>
            textLower.includes(token) ||
            urlLower.includes(token) ||
            ocrLower.includes(token) ||
            qrLower.includes(token)
        );
      });
    }

    return result;
  }

  /**
   * Highlights matching search tokens in an HTML-escaped string.
   */
  public static highlightMatches(escapedText: string, query: string): string {
    if (!escapedText || !query.trim()) return escapedText;
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
