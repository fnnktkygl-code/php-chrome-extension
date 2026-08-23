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

const snipper = new ScreenSnipper();

// Direct in-page Keyboard Shortcut (Cmd/Ctrl + Shift + X / O or Alt + Shift + X / O)
window.addEventListener('keydown', (e: KeyboardEvent) => {
  const isCmdOrCtrl = e.metaKey || e.ctrlKey;
  const isKeyMatch = e.key === 'x' || e.key === 'X' || e.key === 'o' || e.key === 'O' || e.code === 'KeyX' || e.code === 'KeyO';
  const isAltShift = e.altKey && e.shiftKey && (e.key === 'x' || e.key === 'X' || e.key === 'o' || e.key === 'O');

  if ((isCmdOrCtrl && e.shiftKey && isKeyMatch) || isAltShift) {
    e.preventDefault();
    snipper.activate();
  }
}, true);

// Listen for trigger message from background / popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ACTIVATE_SNIPPER') {
    snipper.activate();
    sendResponse({ success: true });
    return true;
  }
});
