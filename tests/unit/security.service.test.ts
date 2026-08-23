import { describe, it, expect } from 'vitest';
import { SecurityService } from '../../src/application/security.service';
import { MAX_CLIP_LENGTH } from '../../src/domain/types';

describe('SecurityService', () => {
  describe('escapeHtml', () => {
    it('escapes standard HTML tags and special characters', () => {
      const malicious = '<script>alert("XSS & attack")</script>';
      const escaped = SecurityService.escapeHtml(malicious);
      expect(escaped).toBe('&lt;script&gt;alert(&quot;XSS &amp; attack&quot;)&lt;/script&gt;');
    });

    it('escapes single and double quotes', () => {
      const input = `Hello 'world' and "universe"`;
      const escaped = SecurityService.escapeHtml(input);
      expect(escaped).toBe('Hello &#039;world&#039; and &quot;universe&quot;');
    });

    it('handles empty or null strings gracefully', () => {
      expect(SecurityService.escapeHtml('')).toBe('');
      expect(SecurityService.escapeHtml(null as unknown as string)).toBe('');
    });
  });

  describe('sanitizeClipText', () => {
    it('returns trimmed string for valid inputs', () => {
      expect(SecurityService.sanitizeClipText('  hello world  ')).toBe('hello world');
    });

    it('returns null for non-string or whitespace-only inputs', () => {
      expect(SecurityService.sanitizeClipText(12345)).toBeNull();
      expect(SecurityService.sanitizeClipText(null)).toBeNull();
      expect(SecurityService.sanitizeClipText('    ')).toBeNull();
    });

    it('enforces MAX_CLIP_LENGTH limit by truncating', () => {
      const hugeString = 'a'.repeat(MAX_CLIP_LENGTH + 5000);
      const sanitized = SecurityService.sanitizeClipText(hugeString);
      expect(sanitized).not.toBeNull();
      expect(sanitized?.length).toBe(MAX_CLIP_LENGTH);
    });
  });

  describe('isSensitiveElement', () => {
    it('detects input[type=password]', () => {
      const input = document.createElement('input');
      input.type = 'password';
      expect(SecurityService.isSensitiveElement(input)).toBe(true);
    });

    it('detects autocomplete="current-password" or "new-password"', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('autocomplete', 'current-password');
      expect(SecurityService.isSensitiveElement(input)).toBe(true);

      input.setAttribute('autocomplete', 'new-password');
      expect(SecurityService.isSensitiveElement(input)).toBe(true);
    });

    it('detects data-sensitive="true"', () => {
      const div = document.createElement('div');
      div.setAttribute('data-sensitive', 'true');
      expect(SecurityService.isSensitiveElement(div)).toBe(true);
    });

    it('detects sensitive parent containers', () => {
      const parent = document.createElement('div');
      parent.classList.add('password-container');
      const childInput = document.createElement('input');
      parent.appendChild(childInput);

      expect(SecurityService.isSensitiveElement(childInput)).toBe(true);
    });

    it('returns false for normal elements', () => {
      const input = document.createElement('input');
      input.type = 'text';
      expect(SecurityService.isSensitiveElement(input)).toBe(false);
      expect(SecurityService.isSensitiveElement(null)).toBe(false);
    });
  });
});
