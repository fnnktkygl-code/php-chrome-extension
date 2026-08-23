# Security Policy & Architecture Guarantees

## 🛡️ Zero-Trust, 100% Local Privacy Architecture

**PHP - Paste History Past** is engineered under strict offline-first and zero-leakage security principles:

1. **Zero External Network Connections**: The extension has no external API endpoints, telemetry, tracking scripts, or cloud servers. All operations happen exclusively in your browser memory and `chrome.storage.local`.
2. **Sensitive Input & Password Shield**:
   - The content script actively filters out copy actions originating inside `input[type="password"]`, `autocomplete="current-password"`, `autocomplete="new-password"`, and elements marked with `[data-sensitive="true"]`.
3. **DOM-Based XSS Prevention**:
   - Every piece of clipboard text rendered into the popup DOM is sanitized using strict HTML entity escaping.
   - Dynamic search highlighting uses strictly escaped substrings.
4. **Storage Quota & Boundary Protection**:
   - Clips are capped at `MAX_CLIP_LENGTH = 20,000` characters to prevent memory exhaustion.
   - Automatic background lifecycle workers enforce FIFO eviction of unpinned clips based on user-defined retention periods (24h, 7d, 30d, Never) and capacity limits (25, 50, 100, 200).
5. **Content Security Policy (CSP)**:
   - Manifest V3 compliant:
     ```json
     "content_security_policy": {
       "extension_pages": "script-src 'self'; object-src 'self';"
     }
     ```

---

## 🔒 Reporting a Vulnerability

If you discover a security vulnerability within **PHP - Paste History Past**, please report it responsibly:

- **Email**: [fnnktkygl@gmail.com](mailto:fnnktkygl@gmail.com)
- **GitHub**: Open a security advisory under the repository Security tab.

We take all security reports with high urgency and will respond within 24 hours.
