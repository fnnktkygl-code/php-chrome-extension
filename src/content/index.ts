import { SecurityService } from '../application/security.service';

/**
 * PHP Content Script - Instant & Robust Clipboard Capturer + Shottr-style Snip & OCR Tool.
 */

let lastSelectedText = '';

function getSelectedText(e?: ClipboardEvent): string {
  // 1. Check window selection
  let text = window.getSelection()?.toString() || '';

  // 2. Check active input / textarea element
  if (!text) {
    const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      if (typeof activeEl.selectionStart === 'number' && typeof activeEl.selectionEnd === 'number') {
        text = activeEl.value.substring(activeEl.selectionStart, activeEl.selectionEnd);
      }
    }
  }

  // 3. Check contentEditable container
  if (!text && document.activeElement && (document.activeElement as HTMLElement).isContentEditable) {
    text = window.getSelection()?.toString() || '';
  }

  // 4. Check clipboardData from event
  if (!text && e && e.clipboardData) {
    try {
      text = e.clipboardData.getData('text/plain') || '';
    } catch {
      // Ignore
    }
  }

  // 5. Fallback to pre-buffered selection
  if (!text && lastSelectedText) {
    text = lastSelectedText;
  }

  return text;
}

function sendClipboardMessage(rawText: string): void {
  try {
    const activeEl = document.activeElement;
    if (SecurityService.isSensitiveElement(activeEl)) return;

    const text = rawText.trim();
    if (!text) return;

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      chrome.runtime
        .sendMessage({
          type: 'CLIPBOARD_COPY',
          text,
          url: window.location.href,
          timestamp: Date.now()
        })
        .catch((err) => {
          console.debug('PHP Content Script: Message dispatch skipped', err);
        });
    }
  } catch (err) {
    console.debug('PHP Content Script: Send error', err);
  }
}

function handleCopyOrCut(e: ClipboardEvent): void {
  try {
    const text = getSelectedText(e);
    if (text && text.trim().length > 0) {
      sendClipboardMessage(text);
    } else {
      setTimeout(() => {
        const delayed = getSelectedText();
        if (delayed && delayed.trim().length > 0) {
          sendClipboardMessage(delayed);
        }
      }, 30);
    }
  } catch (err) {
    console.debug('PHP Content Script: Copy event error', err);
  }
}

// 1. Buffer selection continuously
document.addEventListener('selectionchange', () => {
  try {
    const sel = window.getSelection()?.toString();
    if (sel && sel.trim().length > 0) {
      lastSelectedText = sel;
    }
  } catch {}
});

// 2. Pre-buffer on Shortcut Keys
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C' || e.key === 'x' || e.key === 'X')) {
    const activeEl = document.activeElement;
    if (!SecurityService.isSensitiveElement(activeEl)) {
      const text = getSelectedText();
      if (text && text.trim().length > 0) {
        lastSelectedText = text;
      }
    }
  }
}, true);

document.addEventListener('copy', handleCopyOrCut, true);
document.addEventListener('cut', handleCopyOrCut, true);
window.addEventListener('copy', handleCopyOrCut, true);
window.addEventListener('cut', handleCopyOrCut, true);

/* =========================================================================
 * 📸 Interactive Shottr-Style Snip & OCR Area Tool
 * ========================================================================= */

interface CropBounds {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

class ScreenSnipper {
  private overlay: HTMLDivElement | null = null;
  private cropBox: HTMLDivElement | null = null;
  private isDrawing = false;
  private bounds: CropBounds = { startX: 0, startY: 0, endX: 0, endY: 0 };

  public activate(): void {
    // 0. Remove any old lingering overlay
    const oldOverlay = document.getElementById('php-snipper-overlay');
    if (oldOverlay) oldOverlay.remove();

    this.overlay = document.createElement('div');
    this.overlay.id = 'php-snipper-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      background: rgba(0, 0, 0, 0.08);
      cursor: crosshair;
      user-select: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Subtle, Minimalist Crop Box (Crisp macOS-style selection outline)
    this.cropBox = document.createElement('div');
    this.cropBox.style.cssText = `
      position: absolute;
      display: none;
      border: 1px solid rgba(255, 255, 255, 0.95);
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45), 0 0 0 9999px rgba(0, 0, 0, 0.28);
      background: rgba(255, 255, 255, 0.02);
      border-radius: 1px;
      pointer-events: none;
    `;
    this.overlay.appendChild(this.cropBox);

    this.attachEvents();
    document.body.appendChild(this.overlay);
  }

  private attachEvents(): void {
    if (!this.overlay) return;

    const onMouseDown = (e: MouseEvent) => {
      this.isDrawing = true;
      this.bounds.startX = e.clientX;
      this.bounds.startY = e.clientY;
      this.bounds.endX = e.clientX;
      this.bounds.endY = e.clientY;
      this.updateBox();
      if (this.cropBox) this.cropBox.style.display = 'block';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isDrawing) return;
      this.bounds.endX = e.clientX;
      this.bounds.endY = e.clientY;
      this.updateBox();
    };

    const onMouseUp = async () => {
      if (!this.isDrawing) return;
      this.isDrawing = false;

      const left = Math.min(this.bounds.startX, this.bounds.endX);
      const top = Math.min(this.bounds.startY, this.bounds.endY);
      const width = Math.abs(this.bounds.endX - this.bounds.startX);
      const height = Math.abs(this.bounds.endY - this.bounds.startY);

      if (width < 8 || height < 8) {
        this.close();
        return;
      }

      await this.processCrop({
        x: left,
        y: top,
        width,
        height,
        dpr: window.devicePixelRatio || 1
      });

      this.close();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };

    const onBlur = () => {
      this.close();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        this.close();
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      this.close();
    };

    this.overlay.addEventListener('mousedown', onMouseDown);
    this.overlay.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Cleanup reference
    (this.overlay as unknown as { _cleanup: () => void })._cleanup = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }

  private updateBox(): void {
    if (!this.cropBox) return;

    const left = Math.min(this.bounds.startX, this.bounds.endX);
    const top = Math.min(this.bounds.startY, this.bounds.endY);
    const width = Math.abs(this.bounds.endX - this.bounds.startX);
    const height = Math.abs(this.bounds.endY - this.bounds.startY);

    this.cropBox.style.left = `${left}px`;
    this.cropBox.style.top = `${top}px`;
    this.cropBox.style.width = `${width}px`;
    this.cropBox.style.height = `${height}px`;
  }

  private async processCrop(crop: { x: number; y: number; width: number; height: number; dpr: number }): Promise<void> {
    try {
      // Temporarily hide overlay so screenshot doesn't have dark mask
      if (this.overlay) {
        this.overlay.style.display = 'none';
      }

      // 1. Request full screenshot from background
      const res = (await chrome.runtime.sendMessage({ type: 'CAPTURE_TAB_VIEWPORT' })) as { success: boolean; dataUrl?: string };
      if (!res || !res.success || !res.dataUrl) {
        this.showToast('Impossible de capturer l\'écran', true);
        return;
      }

      // 2. Load screenshot and crop region
      const img = new Image();
      const loadPromise = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load captured image'));
      });
      img.src = res.dataUrl;
      await loadPromise;

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(crop.width * crop.dpr);
      canvas.height = Math.round(crop.height * crop.dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(
        img,
        crop.x * crop.dpr,
        crop.y * crop.dpr,
        crop.width * crop.dpr,
        crop.height * crop.dpr,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const croppedDataUrl = canvas.toDataURL('image/png', 0.95);

      // 3. Scan for QR code with native BarcodeDetector if supported
      let qrData: string | undefined = undefined;
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          // @ts-expect-error Chromium native BarcodeDetector
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          const barcodes = await detector.detect(canvas);
          if (barcodes && barcodes.length > 0) {
            qrData = barcodes[0].rawValue;
          }
        } catch {}
      }

      // 4. Offline OCR Text extraction heuristics from crop & DOM elements
      const ocrText = qrData || this.detectDomTextInArea(crop.x, crop.y, crop.width, crop.height);

      // 5. If text was extracted, copy and save as real Text / Code / Link Clip
      if (ocrText && ocrText.trim().length > 0) {
        const trimmedText = ocrText.trim();
        try {
          await navigator.clipboard.writeText(trimmedText);
          this.showToast(`✓ Texte copié : ${trimmedText.substring(0, 35)}...`);
        } catch {
          this.showToast('✓ Texte copié dans l\'historique PHP !');
        }

        // Save as Text clip in PHP clipboard history
        chrome.runtime.sendMessage({
          type: 'CLIPBOARD_COPY',
          text: trimmedText,
          url: window.location.href,
          timestamp: Date.now(),
          ocrText: trimmedText,
          qrData
        }).catch(() => {});
      } else {
        // Pure graphic / image selection without recognized text
        canvas.toBlob(async (blob) => {
          if (blob && navigator.clipboard && navigator.clipboard.write) {
            try {
              await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
              this.showToast('✓ Image capturée et copiée dans le presse-papiers !');
            } catch {
              this.showToast('✓ Image enregistrée dans l\'historique PHP !');
            }
          }
        }, 'image/png');

        // Save as Image clip in PHP clipboard history
        chrome.runtime.sendMessage({
          type: 'CLIPBOARD_COPY',
          text: 'Image Clip',
          url: window.location.href,
          timestamp: Date.now(),
          category: 'image',
          dataUrl: croppedDataUrl,
          dimensions: { width: Math.round(crop.width), height: Math.round(crop.height) }
        }).catch(() => {});
      }
    } catch (err) {
      console.error('PHP Snipper process error:', err);
      this.showToast('Erreur lors du traitement de la capture', true);
    }
  }

  private detectDomTextInArea(x: number, y: number, w: number, h: number): string {
    try {
      const texts: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let node: Node | null;

      while ((node = walker.nextNode())) {
        const text = node.textContent?.trim();
        if (!text || text.length === 0) continue;

        const parent = node.parentElement;
        if (!parent || parent.offsetParent === null) continue;

        const rect = parent.getBoundingClientRect();
        // Check if element intersects with crop area
        if (
          rect.right >= x &&
          rect.left <= x + w &&
          rect.bottom >= y &&
          rect.top <= y + h
        ) {
          texts.push(text);
        }
      }

      // Also check images, inputs, and aria-labels inside the area
      const elements = document.querySelectorAll('img[alt], img[title], input, textarea, [aria-label]');
      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (
          rect.right >= x &&
          rect.left <= x + w &&
          rect.bottom >= y &&
          rect.top <= y + h
        ) {
          if (el instanceof HTMLImageElement) {
            const alt = el.alt || el.title;
            if (alt && alt.trim()) texts.push(alt.trim());
          } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            if (el.value && el.value.trim()) texts.push(el.value.trim());
          } else {
            const aria = el.getAttribute('aria-label');
            if (aria && aria.trim()) texts.push(aria.trim());
          }
        }
      });

      return Array.from(new Set(texts)).join('\n');
    } catch {
      return '';
    }
  }

  private showToast(message: string, isError = false): void {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 2147483647;
      background: ${isError ? '#dc2626' : '#0f172a'};
      color: #ffffff;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.15);
      animation: phpSlideDown 0.25s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  public close(): void {
    if (this.overlay) {
      if ((this.overlay as unknown as { _cleanup?: () => void })._cleanup) {
        (this.overlay as unknown as { _cleanup: () => void })._cleanup();
      }
      this.overlay.remove();
      this.overlay = null;
    }
  }
}

interface QuickClip {
  id: number;
  text: string;
  url?: string;
  timestamp: number;
  category?: 'text' | 'link' | 'code' | 'image';
  ocrText?: string;
  dataUrl?: string;
}

/* =========================================================================
 * 📋 Sleek In-Page Quick Paste Menu (Spotlight-Style 5 Recent Clips)
 * ========================================================================= */
function ensureStylesInjected(): void {
  if (document.getElementById('php-injected-styles')) return;
  const style = document.createElement('style');
  style.id = 'php-injected-styles';
  style.textContent = `
    @keyframes phpFadeIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes phpSlideDown {
      from { opacity: 0; transform: translateY(-16px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

let lastMouseX = typeof window !== 'undefined' ? window.innerWidth / 2 : 400;
let lastMouseY = typeof window !== 'undefined' ? window.innerHeight / 3 : 200;

if (typeof window !== 'undefined') {
  window.addEventListener('mousemove', (e: MouseEvent) => {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }, { passive: true });
}

class QuickPasteMenu {
  private overlay: HTMLDivElement | null = null;
  private selectedIndex = 0;
  private clips: QuickClip[] = [];
  private isFr = true;

  public async toggle(): Promise<void> {
    if (this.overlay) {
      this.close();
    } else {
      await this.open();
    }
  }

  public async open(): Promise<void> {
    this.close();
    ensureStylesInjected();

    let clips: QuickClip[] = [];
    let isDark = true;
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const data = await chrome.storage.local.get(['clips', 'theme', 'locale']);
        clips = data.clips || [];
        isDark = data.theme !== 'light';
        const browserLang = (typeof navigator !== 'undefined' ? navigator.language : 'fr').toLowerCase();
        this.isFr = data.locale ? data.locale === 'fr' : browserLang.startsWith('fr');
      }
    } catch {}

    this.clips = clips.slice(0, 5);
    this.selectedIndex = 0;

    // Overlay backdrop (transparent click-catcher)
    this.overlay = document.createElement('div');
    this.overlay.id = 'php-quick-paste-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      background: rgba(0, 0, 0, 0.12);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      user-select: none;
    `;

    // Modal Card positioned right at the mouse cursor
    const card = document.createElement('div');
    card.id = 'php-quick-paste-card';
    const bgCard = isDark ? '#0f172a' : '#ffffff';
    const borderCard = isDark ? '#334155' : '#cbd5e1';
    const textMain = isDark ? '#f8fafc' : '#0f172a';
    const bgHeader = isDark ? '#1e293b' : '#f8fafc';
    const textSub = isDark ? '#94a3b8' : '#64748b';

    const cardWidth = 380;
    const cardHeight = Math.min(360, 48 + this.clips.length * 48 + 40);

    let left = lastMouseX + 8;
    let top = lastMouseY + 8;

    // Viewport clamping so it never overflows screen bounds
    if (left + cardWidth > window.innerWidth - 16) {
      left = Math.max(16, lastMouseX - cardWidth - 8);
    }
    if (top + cardHeight > window.innerHeight - 16) {
      top = Math.max(16, window.innerHeight - cardHeight - 16);
    }

    card.style.cssText = `
      position: fixed;
      left: ${left}px;
      top: ${top}px;
      width: ${cardWidth}px;
      max-width: 90vw;
      background: ${bgCard};
      color: ${textMain};
      border: 1px solid ${borderCard};
      border-radius: 10px;
      box-shadow: 0 20px 40px -8px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.08);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: phpFadeIn 0.12s ease-out;
      z-index: 2147483647;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 8px 12px;
      border-bottom: 1px solid ${borderCard};
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: ${bgHeader};
    `;
    header.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; font-weight:600; font-size:13px; color:${textMain};">
        <span style="display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; border-radius:5px; background:#2563eb; color:#fff; font-size:11px;">📋</span>
        <span>${this.isFr ? 'PHP • 5 Récents' : 'PHP • 5 Recents'}</span>
      </div>
      <div style="font-size:11px; color:${textSub}; display:flex; gap:6px; align-items:center;">
        <kbd style="background:${isDark ? '#0f172a' : '#f1f5f9'}; padding:2px 6px; border-radius:4px; border:1px solid ${borderCard}; font-size:10px; font-family:monospace;">1-5</kbd>
        <span>${this.isFr ? 'copier' : 'copy'} •</span>
        <kbd style="background:${isDark ? '#0f172a' : '#f1f5f9'}; padding:2px 6px; border-radius:4px; border:1px solid ${borderCard}; font-size:10px; font-family:monospace;">Échap</kbd>
      </div>
    `;
    card.appendChild(header);

    // List container
    const list = document.createElement('div');
    list.id = 'php-quick-paste-list';
    list.style.cssText = `
      display: flex;
      flex-direction: column;
      padding: 6px;
      gap: 2px;
      max-height: 380px;
      overflow-y: auto;
    `;

    if (this.clips.length === 0) {
      list.innerHTML = `
        <div style="padding: 24px; text-align: center; color: ${textSub}; font-size: 13px;">
          ${this.isFr ? 'Aucun élément copié pour le moment' : 'No copied items yet'}
        </div>
      `;
    } else {
      this.clips.forEach((clip, index) => {
        const item = document.createElement('div');
        item.className = 'php-qp-item';
        item.dataset.index = String(index);
        item.style.cssText = `
          padding: 8px 10px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          transition: background 0.1s ease;
          background: ${index === 0 ? (isDark ? '#1e293b' : '#f1f5f9') : 'transparent'};
        `;

        const icon = clip.category === 'link' ? '🔗' : clip.category === 'code' ? '💻' : clip.category === 'image' ? '🖼️' : '📝';
        const rawText = clip.category === 'image' ? (clip.ocrText || 'Image capturée') : (clip.text || '');
        const cleanText = rawText.replace(/\s+/g, ' ').trim();

        item.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
            <span style="font-size:11px; font-weight:700; color:#38bdf8; background:${isDark ? '#0f172a' : '#e2e8f0'}; border:1px solid ${borderCard}; border-radius:4px; width:18px; height:18px; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;">${index + 1}</span>
            <span style="font-size:12px; flex-shrink:0;">${icon}</span>
            <span style="font-size:12px; color:${textMain}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1;">${this.escapeHtml(cleanText)}</span>
          </div>
          <span style="font-size:10px; color:${textSub}; flex-shrink:0;">${this.getRelativeTime(clip.timestamp)}</span>
        `;

        item.addEventListener('mouseenter', () => {
          this.setSelectedIndex(index, isDark);
        });

        item.addEventListener('click', () => {
          this.copyAndClose(clip);
        });

        list.appendChild(item);
      });
    }

    card.appendChild(list);

    // Footer
    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 8px 14px;
      border-top: 1px solid ${borderCard};
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: ${bgHeader};
    `;
    footer.innerHTML = `
      <span style="font-size:11px; color:${textSub};">${this.isFr ? '↑↓ Entrée pour coller' : '↑↓ Enter to paste'}</span>
      <button id="php-qp-view-all" style="background:transparent; border:none; color:#38bdf8; font-size:11px; font-weight:600; cursor:pointer; padding:4px 6px; border-radius:4px;">
        ${this.isFr ? 'Voir tout dans PHP ↗' : 'View all in PHP ↗'}
      </button>
    `;
    card.appendChild(footer);

    this.overlay.appendChild(card);
    document.body.appendChild(this.overlay);

    // Click outside to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    // View all button click -> opens full extension directly!
    const viewAllBtn = footer.querySelector('#php-qp-view-all');
    viewAllBtn?.addEventListener('click', async () => {
      this.close();
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          await chrome.runtime.sendMessage({ type: 'OPEN_FULL_EXTENSION' });
        }
      } catch {}
    });

    // Keyboard navigation
    const keyHandler = (e: KeyboardEvent) => {
      if (!this.overlay) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
        return;
      }

      // Keys 1 - 5
      if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (this.clips[idx]) {
          e.preventDefault();
          this.copyAndClose(this.clips[idx]);
          return;
        }
      }

      // Arrow navigation
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.setSelectedIndex((this.selectedIndex + 1) % Math.max(1, this.clips.length), isDark);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.setSelectedIndex((this.selectedIndex - 1 + Math.max(1, this.clips.length)) % Math.max(1, this.clips.length), isDark);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (this.clips[this.selectedIndex]) {
          this.copyAndClose(this.clips[this.selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', keyHandler, true);
    (this.overlay as unknown as { _keyHandler: (e: KeyboardEvent) => void })._keyHandler = keyHandler;
  }

  private setSelectedIndex(index: number, isDark: boolean): void {
    this.selectedIndex = index;
    if (!this.overlay) return;
    const items = this.overlay.querySelectorAll('.php-qp-item') as NodeListOf<HTMLDivElement>;
    items.forEach((item, idx) => {
      item.style.background = idx === index ? (isDark ? '#1e293b' : '#f1f5f9') : 'transparent';
    });
  }

  private async copyAndClose(clip: QuickClip): Promise<void> {
    const textToCopy = clip.category === 'image' ? (clip.ocrText || '') : (clip.text || '');
    if (textToCopy) {
      try {
        await navigator.clipboard.writeText(textToCopy);
      } catch {}
    }

    this.close();
    this.showToast(this.isFr ? '✓ Copié dans le presse-papiers !' : '✓ Copied to clipboard!');
  }

  private showToast(message: string): void {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 2147483647;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.15);
      animation: phpSlideDown 0.2s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2200);
  }

  private getRelativeTime(timestamp: number): string {
    const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (diffSec < 60) return this.isFr ? 'À l\'instant' : 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}j`;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  public close(): void {
    if (this.overlay) {
      if ((this.overlay as unknown as { _keyHandler?: (e: KeyboardEvent) => void })._keyHandler) {
        window.removeEventListener('keydown', (this.overlay as unknown as { _keyHandler: (e: KeyboardEvent) => void })._keyHandler, true);
      }
      this.overlay.remove();
      this.overlay = null;
    }
  }
}

const snipper = new ScreenSnipper();
const quickMenu = new QuickPasteMenu();

let activeCustomShortcuts: {
  snip?: { metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; code?: string; key?: string };
  quickPaste?: { metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; code?: string; key?: string };
} | null = null;

async function loadShortcutsConfig(): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const data = await chrome.storage.local.get('settings');
      if (data.settings?.shortcuts) {
        activeCustomShortcuts = data.settings.shortcuts;
      }
    }
  } catch {}
}

loadShortcutsConfig();

if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) {
      loadShortcutsConfig();
    }
  });
}

function matchesShortcut(e: KeyboardEvent, config?: { metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; code?: string; key?: string }): boolean {
  if (!config) return false;
  const metaMatches = Boolean(config.metaKey) === Boolean(e.metaKey);
  const ctrlMatches = Boolean(config.ctrlKey) === Boolean(e.ctrlKey);
  const altMatches = Boolean(config.altKey) === Boolean(e.altKey);
  const shiftMatches = Boolean(config.shiftKey) === Boolean(e.shiftKey);

  const keyMatches =
    (config.code && e.code === config.code) ||
    (config.key && e.key.toLowerCase() === config.key.toLowerCase());

  return metaMatches && ctrlMatches && altMatches && shiftMatches && Boolean(keyMatches);
}

// Direct in-page Keyboard Shortcuts (Capture Phase)
function handleGlobalKeydown(e: KeyboardEvent): void {
  const isCmdOrCtrl = e.metaKey || e.ctrlKey;
  const isKeyV = e.code === 'KeyV' || e.key === 'v' || e.key === 'V' || e.key === '√';
  const isKeyX = e.code === 'KeyX' || e.key === 'x' || e.key === 'X';
  const isKeyO = e.code === 'KeyO' || e.key === 'o' || e.key === 'O';

  // 1. OCR / Snip Area Shortcut (Custom or Default Cmd/Ctrl+Shift+X or Alt+Shift+X)
  const isCustomSnip = matchesShortcut(e, activeCustomShortcuts?.snip);
  const isDefaultSnip = (isCmdOrCtrl && e.shiftKey && (isKeyX || isKeyO)) || (e.altKey && e.shiftKey && (isKeyX || isKeyO));

  if (isCustomSnip || isDefaultSnip) {
    e.preventDefault();
    e.stopImmediatePropagation();
    quickMenu.close();
    snipper.activate();
    return;
  }

  // 2. Quick Paste (5 Recents) Shortcut (Custom or Option+V, Cmd+Option+V, Cmd+Shift+V, Ctrl+Shift+V, Alt+V)
  const isCustomQuickPaste = matchesShortcut(e, activeCustomShortcuts?.quickPaste);
  const isDefaultQuickPaste =
    (e.altKey && isKeyV) ||
    (e.metaKey && e.altKey && isKeyV) ||
    (isCmdOrCtrl && e.shiftKey && isKeyV);

  if (isCustomQuickPaste || isDefaultQuickPaste) {
    e.preventDefault();
    e.stopImmediatePropagation();
    snipper.close();
    quickMenu.toggle();
    return;
  }
}

window.addEventListener('keydown', handleGlobalKeydown, true);
document.addEventListener('keydown', handleGlobalKeydown, true);

// Listen for trigger message from background / popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ACTIVATE_SNIPPER') {
    quickMenu.close();
    snipper.activate();
    sendResponse({ success: true });
    return true;
  }
  if (message.type === 'TOGGLE_QUICK_PASTE') {
    snipper.close();
    quickMenu.toggle();
    sendResponse({ success: true });
    return true;
  }
});
