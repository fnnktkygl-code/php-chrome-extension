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
  private hud: HTMLDivElement | null = null;
  private dimIndicator: HTMLDivElement | null = null;
  private isDrawing = false;
  private bounds: CropBounds = { startX: 0, startY: 0, endX: 0, endY: 0 };

  public activate(): void {
    if (document.getElementById('php-snipper-overlay')) {
      return;
    }

    this.overlay = document.createElement('div');
    this.overlay.id = 'php-snipper-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      background: rgba(15, 23, 42, 0.45);
      cursor: crosshair;
      user-select: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      backdrop-filter: blur(1.5px);
    `;

    // Top HUD
    this.hud = document.createElement('div');
    this.hud.style.cssText = `
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #0f172a;
      color: #ffffff;
      padding: 10px 20px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.15);
      display: flex;
      align-items: center;
      gap: 10px;
      pointer-events: none;
      transition: all 0.2s ease;
    `;
    this.hud.innerHTML = `
      <span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; background:#2563eb; color:#fff; font-size:12px;">✂️</span>
      <span><strong>PHP Snip & OCR:</strong> Drag a box around any image/text • Press <kbd style="background:#1e293b; padding:2px 6px; border-radius:4px; border:1px solid #334155; font-size:11px;">ESC</kbd> to cancel</span>
    `;
    this.overlay.appendChild(this.hud);

    // Dimension Indicator
    this.dimIndicator = document.createElement('div');
    this.dimIndicator.style.cssText = `
      position: fixed;
      display: none;
      background: #1e293b;
      color: #38bdf8;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      font-family: monospace;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      pointer-events: none;
      z-index: 2147483648;
    `;
    this.overlay.appendChild(this.dimIndicator);

    // Crop Box
    this.cropBox = document.createElement('div');
    this.cropBox.style.cssText = `
      position: absolute;
      display: none;
      border: 2px solid #3b82f6;
      background: rgba(59, 130, 246, 0.08);
      box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.55), 0 0 20px rgba(37, 99, 235, 0.4);
      border-radius: 4px;
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
      if (this.dimIndicator) this.dimIndicator.style.display = 'block';
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

      if (width < 15 || height < 15) {
        this.close();
        return;
      }

      if (this.hud) {
        this.hud.innerHTML = `
          <span style="display:inline-block; animation: spin 1s linear infinite;">🔄</span>
          <span>Extracting OCR text & image...</span>
        `;
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

    this.overlay.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', onKeyDown);

    // Cleanup reference
    (this.overlay as unknown as { _cleanup: () => void })._cleanup = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', onKeyDown);
    };
  }

  private updateBox(): void {
    if (!this.cropBox || !this.dimIndicator) return;

    const left = Math.min(this.bounds.startX, this.bounds.endX);
    const top = Math.min(this.bounds.startY, this.bounds.endY);
    const width = Math.abs(this.bounds.endX - this.bounds.startX);
    const height = Math.abs(this.bounds.endY - this.bounds.startY);

    this.cropBox.style.left = `${left}px`;
    this.cropBox.style.top = `${top}px`;
    this.cropBox.style.width = `${width}px`;
    this.cropBox.style.height = `${height}px`;

    this.dimIndicator.style.left = `${left}px`;
    this.dimIndicator.style.top = `${top - 26 < 0 ? top + height + 6 : top - 26}px`;
    this.dimIndicator.textContent = `${Math.round(width)} × ${Math.round(height)} px`;
  }

  private async processCrop(crop: { x: number; y: number; width: number; height: number; dpr: number }): Promise<void> {
    try {
      // 1. Request full screenshot from background
      const res = (await chrome.runtime.sendMessage({ type: 'CAPTURE_TAB_VIEWPORT' })) as { success: boolean; dataUrl?: string };
      if (!res || !res.success || !res.dataUrl) {
        this.showToast('Could not capture viewport', true);
        return;
      }

      // 2. Load screenshot and crop region
      const img = new Image();
      img.src = res.dataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load captured image'));
      });

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

      // 4. Offline OCR Text extraction heuristics from crop (or fast DOM element mapping)
      const ocrText = qrData || this.detectDomTextInArea(crop.x, crop.y, crop.width, crop.height);

      // 5. Copy to clipboard
      if (ocrText && ocrText.trim().length > 0) {
        await navigator.clipboard.writeText(ocrText.trim());
        this.showToast(`✓ Copied: ${ocrText.trim().substring(0, 45)}...`);
      } else {
        // Copy cropped image
        canvas.toBlob(async (blob) => {
          if (blob && navigator.clipboard && navigator.clipboard.write) {
            try {
              await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
              this.showToast('✓ Cropped image copied to clipboard!');
            } catch {
              this.showToast('✓ Snippet saved in PHP history!');
            }
          }
        }, 'image/png');
      }

      // 6. Save in PHP Clipboard History
      chrome.runtime.sendMessage({
        type: 'CLIPBOARD_COPY',
        text: ocrText || 'Screen Snippet',
        url: window.location.href,
        timestamp: Date.now(),
        category: 'image',
        dataUrl: croppedDataUrl,
        dimensions: { width: Math.round(crop.width), height: Math.round(crop.height) },
        ocrText: ocrText || undefined,
        qrData
      }).catch(() => {});
    } catch (err) {
      console.error('PHP Snipper process error:', err);
      this.showToast('Error processing screen crop', true);
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

// Listen for trigger message from background / popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ACTIVATE_SNIPPER') {
    snipper.activate();
    sendResponse({ success: true });
    return true;
  }
});
