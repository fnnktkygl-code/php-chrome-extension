import { MAX_CLIP_LENGTH } from '../domain/types';

/**
 * SecurityService provides comprehensive defense against:
 * 1. DOM XSS and HTML injections
 * 2. Secret & API key leaks (DLP - Data Loss Prevention)
 * 3. AI indirect prompt injection & invisible unicode steganography
 * 4. URL protocol spoofing & malicious navigation schemes
 * 5. Sensitive element / password form harvesting
 */
export class SecurityService {
  private static readonly SECRET_PATTERNS: Array<{ name: string; regex: RegExp }> = [
    { name: 'OpenAI API Key', regex: /\bsk-[a-zA-Z0-9_-]{20,}\b/ },
    { name: 'GitHub Personal Access Token', regex: /\b(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{20,}\b/ },
    { name: 'GitHub Fine-Grained Token', regex: /\bgithub_pat_[a-zA-Z0-9_]{30,}\b/ },
    { name: 'AWS Access Key ID', regex: /\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/ },
    { name: 'Google API Key', regex: /\bAIzaSy[a-zA-Z0-9_-]{33}\b/ },
    { name: 'Stripe Live Secret Key', regex: /\bsk_live_[0-9a-zA-Z]{20,}\b/ },
    { name: 'Slack Token', regex: /\bxox[baprs]-[0-9a-zA-Z]{10,48}\b/ },
    { name: 'SSH / RSA Private Key', regex: /-----BEGIN\s+(RSA|DSA|EC|OPENSSH|PGP)\s+PRIVATE\s+KEY-----[\s\S]*?-----END\s+\1\s+PRIVATE\s+KEY-----/ },
    { name: 'Generic Bearer / JWT Token', regex: /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/ }
  ];

  private static readonly AI_PROMPT_INJECTION_PATTERNS: RegExp[] = [
    /\bignore\s+(all\s+)?(previous|prior)\s+(instructions|prompts|directions)\b/i,
    /\bdisregard\s+(all\s+)?(previous|prior)\s+(instructions|prompts)\b/i,
    /\[\s*(system|admin|system_override|developer_mode)\s*\]/i,
    /\b(you\s+are\s+now|act\s+as)\s+(in\s+developer\s+mode|unrestricted\s+ai|jailbroken|dan)\b/i,
    /\boutput\s+the\s+(system\s+prompt|initial\s+instructions|system\s+instructions)\b/i
  ];

  /**
   * Escape HTML entities to prevent DOM XSS vulnerabilities.
   */
  public static escapeHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Strips zero-width steganographic Unicode, dangerous bidirectional override characters,
   * and non-printable control characters.
   */
  public static stripInvisibleUnicode(text: string): string {
    if (!text) return '';
    return text
      // Strip zero-width spaces, joiners, BOM
      .replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '')
      // Strip dangerous BiDi control characters (used in RTL Trojan attacks)
      .replace(/[\u202A-\u202E\u2066-\u2069]/g, '')
      // Strip ASCII non-printable control characters except newline and tab
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  /**
   * Validates and trims clipboard text, enforcing max length limits and stripping stealth control codes.
   */
  public static sanitizeClipText(text: unknown): string | null {
    if (typeof text !== 'string') {
      return null;
    }
    const cleanUnicode = this.stripInvisibleUnicode(text);
    const trimmed = cleanUnicode.trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed.length > MAX_CLIP_LENGTH) {
      return trimmed.substring(0, MAX_CLIP_LENGTH);
    }
    return trimmed;
  }

  /**
   * Checks if text contains a known high-entropy secret, API key, or private certificate.
   */
  public static containsSensitiveSecret(text: string): boolean {
    if (!text) return false;
    return this.SECRET_PATTERNS.some((pattern) => pattern.regex.test(text));
  }

  /**
   * Masks secrets in a string to prevent shoulder-surfing and accidental leak in UI cards.
   */
  public static maskSensitiveSecrets(text: string): string {
    if (!text) return '';
    let result = text;
    for (const pattern of this.SECRET_PATTERNS) {
      result = result.replace(pattern.regex, (match) => {
        if (match.length <= 8) return '••••••••';
        return match.substring(0, 4) + '••••••••••••' + match.substring(match.length - 4);
      });
    }
    return result;
  }

  /**
   * Detects potential Indirect Prompt Injection vectors in copied content.
   */
  public static detectAiPromptInjection(text: string): { suspicious: boolean; patternName?: string } {
    if (!text) return { suspicious: false };
    for (const pattern of this.AI_PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        return { suspicious: true, patternName: pattern.source };
      }
    }
    return { suspicious: false };
  }

  /**
   * Sanitizes URLs, allowing only safe HTTP/HTTPS/mailto protocols and rejecting javascript: or data: exploits.
   */
  public static sanitizeUrl(url: string): string {
    if (!url) return '';
    const trimmed = url.trim();

    // Explicit protocol blocklist
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
      const parsed = new URL(
        lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('mailto:')
          ? trimmed
          : `https://${trimmed}`
      );
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
        return parsed.toString();
      }
      return '';
    } catch {
      return '';
    }
  }

  /**
   * Checks if an HTML element is a password or sensitive input field.
   */
  public static isSensitiveElement(el: Element | null): boolean {
    if (!el) return false;

    const tagName = el.tagName.toLowerCase();
    if (tagName === 'input') {
      const inputEl = el as HTMLInputElement;
      const type = (inputEl.type || '').toLowerCase();
      if (type === 'password') return true;

      const autocomplete = (inputEl.getAttribute('autocomplete') || '').toLowerCase();
      if (
        autocomplete === 'current-password' ||
        autocomplete === 'new-password' ||
        autocomplete === 'cc-number' ||
        autocomplete === 'cc-csc' ||
        autocomplete === 'one-time-code'
      ) {
        return true;
      }
    }

    if (el.getAttribute('data-sensitive') === 'true') {
      return true;
    }

    // Check parent tree up to 3 levels for sensitive container
    let parent = el.parentElement;
    let depth = 0;
    while (parent && depth < 3) {
      if (
        parent.getAttribute('data-sensitive') === 'true' ||
        parent.classList.contains('sensitive-field') ||
        parent.classList.contains('password-container')
      ) {
        return true;
      }
      parent = parent.parentElement;
      depth++;
    }

    return false;
  }
}
