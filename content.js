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
    this.hud = null;
    this.dimIndicator = null;
    this.isDrawing = false;
    this.bounds = { startX: 0, startY: 0, endX: 0, endY: 0 };
  }

    // 0. Remove any old lingering overlay
    const oldOverlay = document.getElementById('php-snipper-overlay');
    if (oldOverlay) oldOverlay.remove();

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
      padding: 8px 16px 8px 20px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.15);
      display: flex;
      align-items: center;
      gap: 12px;
      pointer-events: auto;
      z-index: 2147483648;
      transition: all 0.2s ease;
      cursor: default;
    `;
    this.hud.innerHTML = `
      <span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; background:#2563eb; color:#fff; font-size:12px;">✂️</span>
      <span><strong>PHP Snip & OCR:</strong> Cadrez la zone • <kbd style="background:#1e293b; padding:2px 6px; border-radius:4px; border:1px solid #334155; font-size:11px;">Échap</kbd> pour quitter</span>
      <button id="php-snipper-close-btn" style="background:#334155; color:#f8fafc; border:none; border-radius:50%; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; font-size:12px; font-weight:bold; margin-left:4px;" title="Fermer (Échap)">✕</button>
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

  attachEvents() {
    const closeBtn = this.overlay.querySelector('#php-snipper-close-btn');
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });

    const onMouseDown = (e) => {
      if ((e.target)?.closest?.('#php-snipper-close-btn')) return;
      this.isDrawing = true;
      this.bounds.startX = e.clientX;
      this.bounds.startY = e.clientY;
      this.bounds.endX = e.clientX;
      this.bounds.endY = e.clientY;
      this.updateBox();
      if (this.cropBox) this.cropBox.style.display = 'block';
      if (this.dimIndicator) this.dimIndicator.style.display = 'block';
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

      if (width < 15 || height < 15) {
        this.close();
        return;
      }

      if (this.hud) {
        this.hud.innerHTML = `
          <span style="display:inline-block; animation: spin 1s linear infinite;">🔄</span>
          <span>Extraction OCR en cours...</span>
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

  async processCrop(crop) {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'CAPTURE_TAB_VIEWPORT' });
      if (!res || !res.success || !res.dataUrl) {
        this.showToast('Could not capture viewport', true);
        return;
      }

      const img = new Image();
      img.src = res.dataUrl;
      await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
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
        await navigator.clipboard.writeText(ocrText.trim());
        this.showToast(`✓ Copied: ${ocrText.trim().substring(0, 45)}...`);
      } else {
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
      console.error('PHP Snipper error:', err);
      this.showToast('Error processing crop', true);
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

// Direct in-page Keyboard Shortcut (Shottr-style: Cmd/Ctrl + Shift + 2 / é)
window.addEventListener('keydown', (e) => {
  const isCmdOrCtrl = e.metaKey || e.ctrlKey;
  const isDigit2 = e.code === 'Digit2' || e.key === '2' || e.key === 'é' || e.key === '"';
  const isAltShiftS = e.altKey && e.shiftKey && (e.key === 's' || e.key === 'S');

  if ((isCmdOrCtrl && e.shiftKey && isDigit2) || isAltShiftS) {
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
