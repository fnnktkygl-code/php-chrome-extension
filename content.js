// content.js - Instant & Robust Multi-Event Clipboard Capture + Shottr-Style Screen Snip & OCR Tool

let lastSelectedText = '';

function isSensitiveElement(el) {
  if (!el) return false;
  if (el.type === 'password' || el.getAttribute('type') === 'password') return true;
  const autocomplete = (el.getAttribute('autocomplete') || '').toLowerCase();
  if (autocomplete.includes('password') || autocomplete.includes('cc-number')) {
    return true;
  }
  if (el.getAttribute('data-sensitive') === 'true') return true;
  return false;
}

function getSelectedText(e) {
  let text = window.getSelection() ? window.getSelection().toString() : '';

  if (!text) {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      if (typeof activeEl.selectionStart === 'number' && typeof activeEl.selectionEnd === 'number') {
        text = activeEl.value.substring(activeEl.selectionStart, activeEl.selectionEnd);
      }
    }
  }

  if (!text && document.activeElement && document.activeElement.isContentEditable) {
    text = window.getSelection() ? window.getSelection().toString() : '';
  }

  if (!text && e && e.clipboardData) {
    try {
      text = e.clipboardData.getData('text/plain') || '';
    } catch {}
  }

  if (!text && lastSelectedText) {
    text = lastSelectedText;
  }

  return text;
}

function sendClipboardMessage(rawText) {
  try {
    const activeEl = document.activeElement;
    if (isSensitiveElement(activeEl)) return;

    const text = (rawText || '').trim();
    if (!text) return;

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      chrome.runtime.sendMessage({
        type: 'CLIPBOARD_COPY',
        text,
        url: window.location.href,
        timestamp: Date.now()
      }).catch(() => {});
    }
  } catch (err) {
    console.debug('PHP: sendClipboardMessage error', err);
  }
}

function handleCopyOrCut(e) {
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
    console.debug('PHP: Copy handler error', err);
  }
}

document.addEventListener('selectionchange', () => {
  try {
    const sel = window.getSelection() ? window.getSelection().toString() : '';
    if (sel && sel.trim().length > 0) {
      lastSelectedText = sel;
    }
  } catch {}
});

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C' || e.key === 'x' || e.key === 'X')) {
    const activeEl = document.activeElement;
    if (!isSensitiveElement(activeEl)) {
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

class ScreenSnipper {
  constructor() {
    this.overlay = null;
    this.cropBox = null;
    this.isDrawing = false;
    this.bounds = { startX: 0, startY: 0, endX: 0, endY: 0 };
  }

  activate() {
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

  attachEvents() {
    const onMouseDown = (e) => {
      this.isDrawing = true;
      this.bounds.startX = e.clientX;
      this.bounds.startY = e.clientY;
      this.bounds.endX = e.clientX;
      this.bounds.endY = e.clientY;
      this.updateBox();
      if (this.cropBox) this.cropBox.style.display = 'block';
    };

    const onMouseMove = (e) => {
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

    const onKeyDown = (e) => {
      if (e.key === 'Escape') this.close();
    };

    const onBlur = () => {
      this.close();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        this.close();
      }
    };

    const onContextMenu = (e) => {
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

    this.overlay._cleanup = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }

  updateBox() {
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

  async processCrop(crop) {
    try {
      if (this.overlay) this.overlay.style.display = 'none';

      const res = await chrome.runtime.sendMessage({ type: 'CAPTURE_TAB_VIEWPORT' });
      if (!res || !res.success || !res.dataUrl) {
        this.showToast('Impossible de capturer l\'écran', true);
        return;
      }

      const img = new Image();
      const loadPromise = new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
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

      let qrData = undefined;
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          const barcodes = await detector.detect(canvas);
          if (barcodes && barcodes.length > 0) {
            qrData = barcodes[0].rawValue;
          }
        } catch {}
      }

      const ocrText = qrData || this.detectDomTextInArea(crop.x, crop.y, crop.width, crop.height);

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
      console.error('PHP Snipper error:', err);
      this.showToast('Erreur lors du traitement de la capture', true);
    }
  }

  detectDomTextInArea(x, y, w, h) {
    try {
      const texts = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent?.trim();
        if (!text || text.length === 0) continue;
        const parent = node.parentElement;
        if (!parent || parent.offsetParent === null) continue;
        const rect = parent.getBoundingClientRect();
        if (
          rect.right >= x &&
          rect.left <= x + w &&
          rect.bottom >= y &&
          rect.top <= y + h
        ) {
          texts.push(text);
        }
      }

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

  showToast(message, isError = false) {
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

  close() {
    if (this.overlay) {
      if (this.overlay._cleanup) this.overlay._cleanup();
      this.overlay.remove();
      this.overlay = null;
    }
  }
}

const snipper = new ScreenSnipper();

// Direct in-page Keyboard Shortcut (Cmd/Ctrl + Shift + X / O or Alt + Shift + X / O)
window.addEventListener('keydown', (e) => {
  const isCmdOrCtrl = e.metaKey || e.ctrlKey;
  const isKeyMatch = e.key === 'x' || e.key === 'X' || e.key === 'o' || e.key === 'O' || e.code === 'KeyX' || e.code === 'KeyO';
  const isAltShift = e.altKey && e.shiftKey && (e.key === 'x' || e.key === 'X' || e.key === 'o' || e.key === 'O');

  if ((isCmdOrCtrl && e.shiftKey && isKeyMatch) || isAltShift) {
    e.preventDefault();
    snipper.activate();
  }
}, true);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ACTIVATE_SNIPPER') {
    snipper.activate();
    sendResponse({ success: true });
    return true;
  }
});
