import { ClipboardService } from '../application/clipboard.service';
import { I18nService } from '../application/i18n.service';
import { ImageService } from '../application/image.service';
import { SearchService } from '../application/search.service';
import { SecurityService } from '../application/security.service';
import { StorageService } from '../application/storage.service';
import { Clip, FilterMode, Settings } from '../domain/types';

export class PopupController {
  private storage: StorageService;
  private i18n: I18nService;
  private clips: Clip[] = [];
  private filter: FilterMode = 'all';
  private searchQuery: string = '';
  private expandedClipIds: Set<number> = new Set();
  private activePreviewClip: Clip | null = null;

  constructor(storage?: StorageService, i18n?: I18nService) {
    this.storage = storage || new StorageService();
    this.i18n = i18n || new I18nService();
  }

  public async init(): Promise<void> {
    // 1. Parallel batch fetch for instant zero-latency popup hydration
    const [clips, theme, locale] = await Promise.all([
      this.storage.getClips(),
      this.storage.getTheme(),
      this.storage.getLocale()
    ]);

    this.clips = clips;
    this.i18n.setLocale(locale);

    if (theme === 'light') {
      document.body.classList.add('light-mode');
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.body.classList.remove('light-mode');
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    this.bindEvents();
    this.updateLanguageUI();
    this.updateThemeUI();
    this.updateCounters();
    this.render();

    // 2. Asynchronous non-blocking background OS pasteboard synchronization
    setTimeout(() => {
      this.checkSystemClipboard()
        .then(() => this.loadClips())
        .catch(() => {});
    }, 15);
  }

  private bindEvents(): void {
    const searchInput = document.getElementById('searchInput') as HTMLInputElement;
    const clearSearchBtn = document.getElementById('clearSearchBtn') as HTMLButtonElement;
    const tabs = document.querySelectorAll('.segment-btn, .tab-btn');
    const themeToggle = document.getElementById('themeToggle');
    const languageToggle = document.getElementById('languageToggle');
    const refreshBtn = document.getElementById('refreshBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');

    const previewCloseBtn = document.getElementById('previewCloseBtn');
    const previewCopyBtn = document.getElementById('previewCopyBtn');
    const previewModal = document.getElementById('previewModal');

    const settingsBtn = document.getElementById('settingsBtn');
    const settingsCloseBtn = document.getElementById('settingsCloseBtn');
    const settingsModal = document.getElementById('settingsModal');

    const settingSaveUrl = document.getElementById('settingSaveUrl');
    const settingIgnorePasswords = document.getElementById('settingIgnorePasswords');
    const settingMaxClips = document.getElementById('settingMaxClips');
    const settingMaxAge = document.getElementById('settingMaxAge');

    const exportBackupBtn = document.getElementById('exportBackupBtn');
    const importBackupBtn = document.getElementById('importBackupBtn');
    const importFileInput = document.getElementById('importFileInput') as HTMLInputElement;

    // Search
    let debounceTimer: ReturnType<typeof setTimeout>;
    searchInput?.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.searchQuery = (e.target as HTMLInputElement).value;
        if (clearSearchBtn) {
          clearSearchBtn.style.display = this.searchQuery ? 'flex' : 'none';
        }
        this.render();
      }, 150);
    });

    clearSearchBtn?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      this.searchQuery = '';
      if (clearSearchBtn) clearSearchBtn.style.display = 'none';
      this.render();
    });

    // Tab Navigation
    tabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest('.segment-btn, .tab-btn') as HTMLButtonElement;
        if (!btn) return;
        const targetTab = btn.getAttribute('data-tab') as FilterMode;
        if (targetTab && targetTab !== this.filter) {
          tabs.forEach((t) => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
          });
          btn.classList.add('active');
          btn.setAttribute('aria-selected', 'true');
          this.filter = targetTab;
          this.render();
        }
      });
    });

    // Actions
    themeToggle?.addEventListener('click', () => this.toggleTheme());
    languageToggle?.addEventListener('click', () => this.toggleLanguage());
    refreshBtn?.addEventListener('click', () => this.refreshClips());
    clearAllBtn?.addEventListener('click', () => this.clearAllClips());

    const snipOcrBtn = document.getElementById('snipOcrBtn');
    snipOcrBtn?.addEventListener('click', async () => {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const activeTab = tabs[0];
          if (activeTab && activeTab.url) {
            const isRestricted =
              activeTab.url.startsWith('chrome://') ||
              activeTab.url.startsWith('edge://') ||
              activeTab.url.startsWith('about:') ||
              activeTab.url.startsWith('chrome-extension://') ||
              activeTab.url.includes('chromewebstore.google.com');

            if (isRestricted) {
              this.showToast(this.i18n.t('snipRestrictedPage'), true);
              return;
            }

            if (activeTab.id) {
              if (chrome.scripting) {
                await chrome.scripting
                  .executeScript({
                    target: { tabId: activeTab.id },
                    files: ['content.js']
                  })
                  .catch(() => {});
              }
              await chrome.tabs.sendMessage(activeTab.id, { type: 'ACTIVATE_SNIPPER' }).catch(() => {});
            }
          }
        } catch (err) {
          console.warn('Snip trigger error:', err);
        }
      }

      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          await chrome.runtime.sendMessage({ type: 'START_SNIP_OCR' });
        } catch {}
      }

      setTimeout(() => {
        window.close();
      }, 50);
    });

    // Modals
    previewCloseBtn?.addEventListener('click', () => this.closePreviewModal());
    previewCopyBtn?.addEventListener('click', () => {
      if (this.activePreviewClip) {
        if (this.activePreviewClip.category === 'image' && this.activePreviewClip.dataUrl) {
          this.copyImage(this.activePreviewClip.id);
        } else {
          this.copyClip(this.activePreviewClip.id);
        }
      }
    });
    previewModal?.addEventListener('click', (e) => {
      if (e.target === previewModal) this.closePreviewModal();
    });

    settingsBtn?.addEventListener('click', () => this.openSettingsModal());
    settingsCloseBtn?.addEventListener('click', () => this.closeSettingsModal());
    settingsModal?.addEventListener('click', (e) => {
      if (e.target === settingsModal) this.closeSettingsModal();
    });

    // Settings save
    settingSaveUrl?.addEventListener('change', () => this.saveSettings());
    settingIgnorePasswords?.addEventListener('change', () => this.saveSettings());
    settingMaxClips?.addEventListener('change', () => this.saveSettings());
    settingMaxAge?.addEventListener('change', () => this.saveSettings());

    // Backup
    exportBackupBtn?.addEventListener('click', () => this.exportBackup());
    importBackupBtn?.addEventListener('click', () => importFileInput?.click());
    importFileInput?.addEventListener('change', (e) => this.handleImportFile(e));

    // Global Shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closePreviewModal();
        this.closeSettingsModal();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInput?.focus();
      }
    });
  }

  public async loadClips(): Promise<void> {
    this.clips = await this.storage.getClips();
    this.updateCounters();
    this.render();
  }

  private async checkSystemClipboard(): Promise<void> {
    try {
      // 1. Try reading rich image clipboard
      if (navigator.clipboard && navigator.clipboard.read) {
        try {
          const items = await navigator.clipboard.read();
          for (const item of items) {
            const imageType = item.types.find((t) => t.startsWith('image/'));
            if (imageType) {
              const blob = await item.getType(imageType);
              const processed = await ImageService.processImageBlob(blob);
              const clipboardService = new ClipboardService(this.storage);
              await clipboardService.handleCopy({
                text: processed.qrData || 'Image Clip',
                url: '',
                timestamp: Date.now(),
                category: 'image',
                dataUrl: processed.dataUrl,
                dimensions: processed.dimensions,
                qrData: processed.qrData
              });
              return;
            }
          }
        } catch {
          // Fall back to text read
        }
      }

      // 2. Read standard text clipboard
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim().length > 0) {
          const clipboardService = new ClipboardService(this.storage);
          await clipboardService.handleCopy({
            text: text.trim(),
            url: '',
            timestamp: Date.now()
          });
        }
      }
    } catch {
      // Ignore background clipboard access restrictions
    }
  }

  private updateCounters(): void {
    const total = this.clips.length;
    const links = this.clips.filter((c) => c.category === 'link' || SearchService.isUrl(c.text)).length;
    const code = this.clips.filter((c) => c.category === 'code').length;
    const images = this.clips.filter((c) => c.category === 'image').length;
    const pinned = this.clips.filter((c) => c.pinned).length;

    const clipCount = document.getElementById('clipCount');
    const allCount = document.getElementById('allCount');
    const linksCount = document.getElementById('linksCount');
    const codeCount = document.getElementById('codeCount');
    const imagesCount = document.getElementById('imagesCount');
    const pinnedCount = document.getElementById('pinnedCount');

    if (clipCount) clipCount.textContent = String(total);
    if (allCount) allCount.textContent = String(total);
    if (linksCount) linksCount.textContent = String(links);
    if (codeCount) codeCount.textContent = String(code);
    if (imagesCount) imagesCount.textContent = String(images);
    if (pinnedCount) pinnedCount.textContent = String(pinned);
  }

  public render(): void {
    const clipsContainer = document.getElementById('clipsContainer');
    const searchFeedback = document.getElementById('searchFeedback');
    if (!clipsContainer) return;

    const filtered = SearchService.filterClips(this.clips, this.filter, this.searchQuery);

    // Search feedback
    if (this.searchQuery.trim() && searchFeedback) {
      const count = filtered.length;
      const plural = count === 1 ? '' : 's';
      searchFeedback.textContent = this.i18n.t('searchResults', count, plural);
      searchFeedback.style.display = 'block';
    } else if (searchFeedback) {
      searchFeedback.style.display = 'none';
    }

    if (filtered.length === 0) {
      clipsContainer.innerHTML = this.getEmptyStateHtml();
      return;
    }

    clipsContainer.innerHTML = filtered.map((clip) => this.renderClipCard(clip)).join('');
    this.attachCardEvents();
  }

  private renderClipCard(clip: Clip): string {
    const isPinned = clip.pinned;
    const isExpanded = this.expandedClipIds.has(clip.id);
    const isImage = clip.category === 'image' && Boolean(clip.dataUrl);
    const domain = SearchService.extractDomain(clip.url);
    const categoryClass = `category-${clip.category}`;
    const categoryLabel =
      clip.category === 'link'
        ? this.i18n.t('categoryLink')
        : clip.category === 'code'
        ? this.i18n.t('categoryCode')
        : clip.category === 'image'
        ? this.i18n.t('categoryImage')
        : this.i18n.t('categoryText');

    const escaped = SecurityService.escapeHtml(clip.text);
    const highlighted = this.searchQuery
      ? SearchService.highlightMatches(escaped, this.searchQuery)
      : escaped;

    const needsExpand = clip.text.length > 220;
    const isCode = clip.category === 'code';

    return `
      <article
        class="clip-card ${isPinned ? 'pinned' : ''} ${isCode ? 'is-code' : ''} ${isImage ? 'is-image' : ''}"
        data-id="${clip.id}"
        tabindex="0"
        role="button"
        aria-label="${SecurityService.escapeHtml(clip.text.substring(0, 40))}"
      >
        <div class="clip-header clip-card-header">
          <div class="clip-category-pills">
            <span class="clip-category-pill clip-category-tag ${categoryClass}">${categoryLabel}</span>
            ${clip.qrData ? `<span class="clip-category-pill category-qr" title="${SecurityService.escapeHtml(clip.qrData)}">QR</span>` : ''}
          </div>
          <div class="clip-actions clip-card-actions">
            ${
              isImage
                ? `<button class="card-action-btn clip-action-btn action-copy-image" data-action="copy-image" data-id="${clip.id}" title="${this.i18n.t('copyImage')}" aria-label="Copy image">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
                      <circle cx="9" cy="9" r="2"></circle>
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
                    </svg>
                  </button>
                  <button class="card-action-btn clip-action-btn action-ocr" data-action="ocr" data-id="${clip.id}" title="${this.i18n.t('extractOcr')}" aria-label="Extract OCR">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                  </button>`
                : ''
            }
            <button class="card-action-btn clip-action-btn action-preview" data-action="preview" data-id="${clip.id}" title="${this.i18n.t('preview')}" aria-label="Preview">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <button class="card-action-btn clip-action-btn action-pin ${isPinned ? 'is-pinned pinned' : ''}" data-action="pin" data-id="${clip.id}" title="${isPinned ? this.i18n.t('unpin') : this.i18n.t('pin')}" aria-label="Pin">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="${isPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="17" x2="12" y2="22"></line>
                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
              </svg>
            </button>
            <button class="card-action-btn clip-action-btn danger-btn danger action-delete" data-action="delete" data-id="${clip.id}" title="${this.i18n.t('delete')}" aria-label="Delete">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>

        ${
          isImage
            ? `<div class="clip-image-preview-wrapper">
                 <img class="clip-thumbnail" src="${clip.dataUrl}" alt="Clip Image" loading="lazy">
               </div>
               ${clip.ocrText ? `<div class="clip-ocr-preview">📝 ${SecurityService.escapeHtml(clip.ocrText.substring(0, 90))}</div>` : ''}
               ${clip.qrData ? `<div class="clip-ocr-preview">🔗 ${SecurityService.escapeHtml(clip.qrData)}</div>` : ''}`
            : `<div class="clip-content clip-text-content ${isCode ? 'code-snippet' : ''} ${isExpanded ? 'expanded' : ''}">
                 ${highlighted}
               </div>`
        }

        ${
          needsExpand && !isImage
            ? `<button class="expand-toggle-btn" data-id="${clip.id}" title="${this.i18n.t('preview')}">
                 <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                   <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                   <circle cx="12" cy="12" r="3"></circle>
                 </svg>
                 <span>${this.i18n.t('readMore')}</span>
               </button>`
            : ''
        }

        <div class="clip-footer">
          <div class="clip-meta-left">
            <span>${this.i18n.formatRelativeTime(clip.timestamp)}</span>
            <span class="clip-meta-dot">•</span>
            <span>${isImage && clip.dimensions ? `${clip.dimensions.width}×${clip.dimensions.height}` : this.i18n.t('chars', clip.text.length)}</span>
            ${clip.copyCount > 0 ? `<span class="clip-meta-dot">•</span><span class="copy-counter">${this.i18n.t('copiedTimes', clip.copyCount)}</span>` : ''}
          </div>

          ${
            domain
              ? `
            <div class="clip-source-badge" title="${SecurityService.escapeHtml(clip.url)}">
              <img class="clip-favicon" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32" alt="" onerror="this.style.display='none'">
              <span>${SecurityService.escapeHtml(domain)}</span>
            </div>`
              : ''
          }
        </div>
      </article>
    `;
  }

  private attachCardEvents(): void {
    const clipsContainer = document.getElementById('clipsContainer');
    if (!clipsContainer) return;

    const cards = clipsContainer.querySelectorAll('.clip-card');
    cards.forEach((card) => {
      const clipId = Number(card.getAttribute('data-id'));

      card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.card-action-btn, .clip-action-btn') || target.closest('.expand-toggle-btn')) {
          return;
        }
        const clip = this.clips.find((c) => c.id === clipId);
        if (clip && clip.category === 'image' && clip.dataUrl) {
          this.copyImage(clipId, card as HTMLElement);
        } else {
          this.copyClip(clipId, card as HTMLElement);
        }
      });

      card.addEventListener('keydown', (e: Event) => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
          keyEvent.preventDefault();
          const clip = this.clips.find((c) => c.id === clipId);
          if (clip && clip.category === 'image' && clip.dataUrl) {
            this.copyImage(clipId, card as HTMLElement);
          } else {
            this.copyClip(clipId, card as HTMLElement);
          }
        }
      });
    });

    clipsContainer.querySelectorAll('.expand-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.getAttribute('data-id'));
        this.openPreviewModal(id);
      });
    });

    clipsContainer.querySelectorAll('.card-action-btn, .clip-action-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        const id = Number(btn.getAttribute('data-id'));

        if (action === 'preview') {
          this.openPreviewModal(id);
        } else if (action === 'pin') {
          this.togglePin(id);
        } else if (action === 'delete') {
          this.deleteClip(id);
        } else if (action === 'copy-image') {
          this.copyImage(id);
        } else if (action === 'ocr') {
          this.extractOcr(id);
        }
      });
    });
  }

  public async copyClip(id: number, cardEl?: HTMLElement): Promise<void> {
    const clip = this.clips.find((c) => c.id === id);
    if (!clip) return;

    try {
      await navigator.clipboard.writeText(clip.text);

      if (cardEl) {
        cardEl.classList.add('copying');
        setTimeout(() => cardEl.classList.remove('copying'), 400);
      }

      this.showToast(this.i18n.t('copiedToast'));

      clip.copyCount = (clip.copyCount || 0) + 1;
      clip.lastCopied = Date.now();
      await this.storage.setClips(this.clips);
    } catch {
      this.showToast('Failed to copy', true);
    }
  }

  public async copyImage(id: number, cardEl?: HTMLElement): Promise<void> {
    const clip = this.clips.find((c) => c.id === id);
    if (!clip || !clip.dataUrl) return;

    try {
      const success = await ImageService.copyImageToClipboard(clip.dataUrl);
      if (success) {
        if (cardEl) {
          cardEl.classList.add('copying');
          setTimeout(() => cardEl.classList.remove('copying'), 400);
        }
        this.showToast(this.i18n.t('imageCopiedToast'));
        clip.copyCount = (clip.copyCount || 0) + 1;
        clip.lastCopied = Date.now();
        await this.storage.setClips(this.clips);
      } else {
        // Fallback: copy dataUrl as text
        await navigator.clipboard.writeText(clip.dataUrl);
        this.showToast(this.i18n.t('copiedToast'));
      }
    } catch {
      this.showToast('Failed to copy image', true);
    }
  }

  public async extractOcr(id: number): Promise<void> {
    const clip = this.clips.find((c) => c.id === id);
    if (!clip) return;

    if (clip.qrData) {
      await navigator.clipboard.writeText(clip.qrData);
      this.showToast(`✓ ${clip.qrData}`);
      return;
    }

    if (clip.ocrText) {
      await navigator.clipboard.writeText(clip.ocrText);
      this.showToast(this.i18n.t('ocrCopiedToast'));
      return;
    }

    this.showToast(this.i18n.t('extractOcr'));
  }

  public async togglePin(id: number): Promise<void> {
    const clip = this.clips.find((c) => c.id === id);
    if (!clip) return;

    clip.pinned = !clip.pinned;
    this.clips.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.timestamp - a.timestamp;
    });

    await this.storage.setClips(this.clips);
    this.updateCounters();
    this.render();
  }

  public async deleteClip(id: number): Promise<void> {
    if (confirm(this.i18n.t('confirmDelete'))) {
      this.clips = this.clips.filter((c) => c.id !== id);
      await this.storage.setClips(this.clips);
      this.updateCounters();
      this.render();
      this.showToast(this.i18n.t('deletedToast'));
    }
  }

  public async clearAllClips(): Promise<void> {
    const unpinnedCount = this.clips.filter((c) => !c.pinned).length;
    if (unpinnedCount === 0) return;

    if (confirm(this.i18n.t('confirmClearAll'))) {
      this.clips = this.clips.filter((c) => c.pinned);
      await this.storage.setClips(this.clips);
      this.updateCounters();
      this.render();
      this.showToast(this.i18n.t('clearedToast', unpinnedCount, unpinnedCount === 1 ? '' : 's'));
    }
  }

  public async refreshClips(): Promise<void> {
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn?.classList.add('spinning');
    await this.loadClips();
    setTimeout(() => {
      refreshBtn?.classList.remove('spinning');
    }, 400);
  }

  public async toggleTheme(): Promise<void> {
    const isLight = document.body.classList.toggle('light-mode');
    document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
    await this.storage.setTheme(isLight ? 'light' : 'dark');
    this.updateThemeUI();
  }

  private updateThemeUI(): void {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.title = this.i18n.t('themeToggle');
    }
  }

  public async toggleLanguage(): Promise<void> {
    const current = this.i18n.getLocale();
    const next = current === 'en' ? 'fr' : 'en';
    this.i18n.setLocale(next);
    await this.storage.setLocale(next);
    this.updateLanguageUI();
    this.render();
  }

  private updateLanguageUI(): void {
    const locale = this.i18n.getLocale();
    const langIndicator = document.getElementById('langIndicator');
    const languageToggle = document.getElementById('languageToggle');
    const appTitle = document.getElementById('appTitle');
    const tabAllLabel = document.getElementById('tabAllLabel');
    const tabLinksLabel = document.getElementById('tabLinksLabel');
    const tabCodeLabel = document.getElementById('tabCodeLabel');
    const tabImagesLabel = document.getElementById('tabImagesLabel');
    const tabPinnedLabel = document.getElementById('tabPinnedLabel');
    const searchInput = document.getElementById('searchInput') as HTMLInputElement;
    const refreshBtn = document.getElementById('refreshBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const settingsBtn = document.getElementById('settingsBtn');

    const previewModalTitle = document.getElementById('previewModalTitle');
    const settingsModalTitle = document.getElementById('settingsModalTitle');
    const saveUrlLabel = document.getElementById('saveUrlLabel');
    const ignorePasswordsLabel = document.getElementById('ignorePasswordsLabel');
    const maxClipsLabel = document.getElementById('maxClipsLabel');
    const maxAgeLabel = document.getElementById('maxAgeLabel');
    const opt1Day = document.getElementById('opt1Day');
    const opt7Days = document.getElementById('opt7Days');
    const opt30Days = document.getElementById('opt30Days');
    const optNever = document.getElementById('optNever');

    const backupSectionTitle = document.getElementById('backupSectionTitle');
    const exportBtnText = document.getElementById('exportBtnText');
    const importBtnText = document.getElementById('importBtnText');

    if (langIndicator) {
      langIndicator.textContent = locale.toUpperCase();
    }
    if (languageToggle) {
      languageToggle.title = `${this.i18n.t('language')}: ${locale.toUpperCase()}`;
    }

    if (appTitle) appTitle.textContent = this.i18n.t('appTitle');
    if (tabAllLabel) tabAllLabel.textContent = this.i18n.t('tabAll');
    if (tabLinksLabel) tabLinksLabel.textContent = this.i18n.t('tabLinks');
    if (tabCodeLabel) tabCodeLabel.textContent = this.i18n.t('tabCode');
    if (tabImagesLabel) tabImagesLabel.textContent = this.i18n.t('tabImages');
    if (tabPinnedLabel) tabPinnedLabel.textContent = this.i18n.t('tabPinned');
    if (searchInput) searchInput.placeholder = this.i18n.t('searchPlaceholder');
    if (refreshBtn) refreshBtn.title = this.i18n.t('refresh');
    if (clearAllBtn) clearAllBtn.title = this.i18n.t('clearAll');
    const snipOcrBtn = document.getElementById('snipOcrBtn');
    if (snipOcrBtn) snipOcrBtn.title = this.i18n.t('snipOcrBtn');
    if (settingsBtn) settingsBtn.title = this.i18n.t('settings');

    // Modals
    if (previewModalTitle) previewModalTitle.textContent = this.i18n.t('modalTitle');
    if (settingsModalTitle) settingsModalTitle.textContent = this.i18n.t('settingsTitle');
    if (saveUrlLabel) saveUrlLabel.textContent = this.i18n.t('saveUrlLabel');
    if (ignorePasswordsLabel) ignorePasswordsLabel.textContent = this.i18n.t('ignorePasswordsLabel');
    if (maxClipsLabel) maxClipsLabel.textContent = this.i18n.t('maxClipsLabel');
    if (maxAgeLabel) maxAgeLabel.textContent = this.i18n.t('maxAgeLabel');
    if (opt1Day) opt1Day.textContent = this.i18n.t('expiry1Day');
    if (opt7Days) opt7Days.textContent = this.i18n.t('expiry7Days');
    if (opt30Days) opt30Days.textContent = this.i18n.t('expiry30Days');
    if (optNever) optNever.textContent = this.i18n.t('expiryNever');

    if (backupSectionTitle) backupSectionTitle.textContent = this.i18n.t('backupSectionTitle');
    if (exportBtnText) exportBtnText.textContent = this.i18n.t('exportBtnText');
    if (importBtnText) importBtnText.textContent = this.i18n.t('importBtnText');
  }

  private openPreviewModal(id: number): void {
    const clip = this.clips.find((c) => c.id === id);
    if (!clip) return;
    this.activePreviewClip = clip;
    const previewContent = document.getElementById('previewContent');
    const previewImageContainer = document.getElementById('previewImageContainer');
    const previewImageEl = document.getElementById('previewImageEl') as HTMLImageElement;
    const previewModal = document.getElementById('previewModal');

    if (clip.category === 'image' && clip.dataUrl) {
      if (previewImageContainer && previewImageEl) {
        previewImageEl.src = clip.dataUrl;
        previewImageContainer.style.display = 'block';
      }
      if (previewContent) {
        previewContent.textContent = clip.ocrText || clip.qrData || `Image: ${clip.dimensions?.width || ''}×${clip.dimensions?.height || ''}`;
      }
    } else {
      if (previewImageContainer) previewImageContainer.style.display = 'none';
      if (previewContent) previewContent.textContent = clip.text;
    }

    previewModal?.classList.add('open');
    previewModal?.classList.add('show');
  }

  private closePreviewModal(): void {
    const previewModal = document.getElementById('previewModal');
    previewModal?.classList.remove('open');
    previewModal?.classList.remove('show');
    this.activePreviewClip = null;
  }

  private async openSettingsModal(): Promise<void> {
    const settings = await this.storage.getSettings();
    const settingSaveUrl = document.getElementById('settingSaveUrl') as HTMLInputElement;
    const settingIgnorePasswords = document.getElementById('settingIgnorePasswords') as HTMLInputElement;
    const settingMaxClips = document.getElementById('settingMaxClips') as HTMLSelectElement;
    const settingMaxAge = document.getElementById('settingMaxAge') as HTMLSelectElement;
    const settingsModal = document.getElementById('settingsModal');

    if (settingSaveUrl) settingSaveUrl.checked = settings.saveUrl;
    if (settingIgnorePasswords) settingIgnorePasswords.checked = settings.ignorePasswords;
    if (settingMaxClips) settingMaxClips.value = String(settings.maxClips);
    if (settingMaxAge) settingMaxAge.value = String(settings.maxAgeMs);
    settingsModal?.classList.add('open');
    settingsModal?.classList.add('show');
  }

  private closeSettingsModal(): void {
    const settingsModal = document.getElementById('settingsModal');
    settingsModal?.classList.remove('open');
    settingsModal?.classList.remove('show');
  }

  private async saveSettings(): Promise<void> {
    const settingSaveUrl = document.getElementById('settingSaveUrl') as HTMLInputElement;
    const settingIgnorePasswords = document.getElementById('settingIgnorePasswords') as HTMLInputElement;
    const settingMaxClips = document.getElementById('settingMaxClips') as HTMLSelectElement;
    const settingMaxAge = document.getElementById('settingMaxAge') as HTMLSelectElement;

    const newSettings: Settings = {
      saveUrl: settingSaveUrl ? settingSaveUrl.checked : true,
      ignorePasswords: settingIgnorePasswords ? settingIgnorePasswords.checked : true,
      maxClips: settingMaxClips ? Number(settingMaxClips.value) : 50,
      maxAgeMs: settingMaxAge ? Number(settingMaxAge.value) : 86400000,
      theme: document.body.classList.contains('light-mode') ? 'light' : 'dark',
      locale: this.i18n.getLocale()
    };
    await this.storage.setSettings(newSettings);

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        await chrome.runtime.sendMessage({ type: 'SETTINGS_CHANGED' });
      } catch {
        // Background message handler optional
      }
    }

    await this.loadClips();
  }

  private async exportBackup(): Promise<void> {
    const backupData = await this.storage.exportBackup();
    const jsonString = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `php-clipboard-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  private async handleImportFile(e: Event): Promise<void> {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        const result = await this.storage.importBackup(parsed);
        this.showToast(this.i18n.t('importSuccess', result.count));
        this.closeSettingsModal();
        await this.loadClips();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : this.i18n.t('importInvalid');
        this.showToast(msg, true);
      } finally {
        target.value = '';
      }
    };
    reader.readAsText(file);
  }

  private showToast(message: string, isError = false): void {
    const toast = document.getElementById('toastNotification');
    const toastMessage = document.getElementById('toastMessage');
    if (!toast || !toastMessage) return;
    toastMessage.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }

  private getEmptyStateHtml(): string {
    let titleKey = 'emptyAllTitle';
    let textKey = 'emptyAllText';
    let iconSvg = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path></svg>`;

    if (this.searchQuery) {
      titleKey = 'emptySearchTitle';
      textKey = 'emptySearchText';
      iconSvg = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>`;
    } else if (this.filter === 'links') {
      titleKey = 'emptyLinksTitle';
      textKey = 'emptyLinksText';
      iconSvg = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
    } else if (this.filter === 'code') {
      titleKey = 'emptyCodeTitle';
      textKey = 'emptyCodeText';
      iconSvg = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`;
    } else if (this.filter === 'images') {
      titleKey = 'emptyImagesTitle';
      textKey = 'emptyImagesText';
      iconSvg = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg>`;
    } else if (this.filter === 'pinned') {
      titleKey = 'emptyPinnedTitle';
      textKey = 'emptyPinnedText';
      iconSvg = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>`;
    }

    return `
      <div class="empty-state">
        <div class="empty-state-icon">${iconSvg}</div>
        <h3 class="empty-state-title">${this.i18n.t(titleKey)}</h3>
        <p class="empty-state-desc">${this.i18n.t(textKey)}</p>
      </div>
    `;
  }
}

// Auto-boot if running in browser
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const controller = new PopupController();
    controller.init();
  });
}
