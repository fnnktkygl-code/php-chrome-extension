import { MAX_CLIP_LENGTH } from '../domain/types';

/**
 * SecurityService provides XSS sanitization, sensitive data detection, and boundary checks.
 */
export class SecurityService {
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
   * Validates and trims clipboard text, enforcing max length limits.
   */
  public static sanitizeClipText(text: unknown): string | null {
    if (typeof text !== 'string') {
      return null;
    }
    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed.length > MAX_CLIP_LENGTH) {
      return trimmed.substring(0, MAX_CLIP_LENGTH);
    }
    return trimmed;
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
        autocomplete === 'cc-csc'
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
