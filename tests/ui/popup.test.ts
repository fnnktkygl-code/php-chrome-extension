import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupMockChrome } from '../../src/infrastructure/mock-chrome';
import { PopupController } from '../../src/popup/index';
import { StorageService } from '../../src/application/storage.service';
import { I18nService } from '../../src/application/i18n.service';

const POPUP_HTML = `
  <div class="app-container">
    <header class="header">
      <div class="header-top">
        <h1 id="appTitle">PHP</h1>
        <span id="clipCount">0</span>
        <button id="snipOcrBtn" title="Snip"><span id="snipHeaderLabel">Snip</span></button>
        <button id="settingsBtn" title="Settings">⚙️</button>
        <button id="refreshBtn" title="Refresh">🔄</button>
        <button id="clearAllBtn" title="Clear">🗑️</button>
        <span id="langIndicator">EN</span>
      </div>
      <nav class="segmented-control" role="tablist">
        <button class="segment-btn active" data-tab="all">
          <span id="tabAllLabel">All</span>
          <span class="segment-count" id="allCount">0</span>
        </button>
        <button class="segment-btn" data-tab="links">
          <span id="tabLinksLabel">Links</span>
          <span class="segment-count" id="linksCount">0</span>
        </button>
        <button class="segment-btn" data-tab="code">
          <span id="tabCodeLabel">Code</span>
          <span class="segment-count" id="codeCount">0</span>
        </button>
        <button class="segment-btn" data-tab="images">
          <span id="tabImagesLabel">Images</span>
          <span class="segment-count" id="imagesCount">0</span>
        </button>
        <button class="segment-btn" data-tab="pinned">
          <span id="tabPinnedLabel">Pinned</span>
          <span class="segment-count" id="pinnedCount">0</span>
        </button>
      </nav>
      <div class="search-container">
        <input type="text" id="searchInput" placeholder="Search...">
        <button id="clearSearchBtn">✕</button>
        <div id="searchFeedback"></div>
      </div>
    </header>
    <main id="clipsContainer"></main>

    <!-- Preview Modal -->
    <div id="previewModal" class="modal-backdrop">
      <h2 id="previewModalTitle">Preview</h2>
      <div id="previewImageContainer" style="display:none;"><img id="previewImageEl" src="" /></div>
      <pre id="previewContent"></pre>
      <button id="previewCopyBtn">Copy</button>
      <button id="previewCloseBtn">✕</button>
    </div>

    <!-- Settings View (Apple Grouped Inset) -->
    <div class="settings-view" id="settingsModal">
      <h2 id="settingsModalTitle">Paramètres</h2>
      <button id="settingsCloseBtn">✕</button>
      
      <span id="groupGeneralTitle">GÉNÉRAL</span>
      <span id="themeSettingLabel">Thème</span>
      <div id="themeSegmented">
        <button type="button" class="seg-pill-btn active" data-theme-val="dark" id="btnThemeDark">🌙 Dark</button>
        <button type="button" class="seg-pill-btn" data-theme-val="light" id="btnThemeLight">☀️ Light</button>
      </div>

      <span id="languageSettingLabel">Langue</span>
      <div id="langSegmented">
        <button type="button" class="seg-pill-btn active" data-lang-val="fr" id="btnLangFr">🇫🇷 FR</button>
        <button type="button" class="seg-pill-btn" data-lang-val="en" id="btnLangEn">🇬🇧 EN</button>
      </div>

      <span id="groupQuickMenuTitle">MENU RAPIDE</span>
      <span id="quickMenuLimitLabel">Nombre d'éléments</span>
      <span id="quickMenuLimitDesc">Dans le pop-up</span>
      <div id="quickLimitSegmented">
        <button type="button" class="seg-pill-btn" data-limit="5">5</button>
        <button type="button" class="seg-pill-btn" data-limit="10">10</button>
        <button type="button" class="seg-pill-btn active" data-limit="20">20</button>
      </div>

      <span id="quickPasteShortcutLabel">Raccourci Menu</span>
      <span id="quickPasteShortcutDesc">Ouvre sous la souris</span>
      <button id="recordQuickPasteBtn"><span id="quickPasteShortcutDisplay">Option + V</span></button>
      <button id="resetQuickPasteBtn">↺</button>

      <span id="groupSnipTitle">CADRAGE & OCR</span>
      <span id="snipShortcutLabel">Raccourci Cadrage</span>
      <span id="snipShortcutDesc">Capture et extraction</span>
      <button id="recordSnipBtn"><span id="snipShortcutDisplay">⌘ + Shift + X</span></button>
      <button id="resetSnipBtn">↺</button>

      <span id="groupPrivacyTitle">HISTORIQUE & CONFIDENTIALITÉ</span>
      <label id="saveUrlLabel" for="settingSaveUrl">Conserver l'URL</label>
      <span id="saveUrlDesc">Description URL</span>
      <input type="checkbox" id="settingSaveUrl" checked>
      
      <label id="ignorePasswordsLabel" for="settingIgnorePasswords">Ignorer mots de passe</label>
      <span id="ignorePasswordsDesc">Description passwords</span>
      <input type="checkbox" id="settingIgnorePasswords" checked>

      <span id="maxClipsLabel">Capacité d'historique</span>
      <select id="settingMaxClips"><option value="50" selected>50</option><option value="100">100</option></select>

      <span id="maxAgeLabel">Conservation</span>
      <select id="settingMaxAge">
        <option value="86400000" id="opt1Day">24h</option>
        <option value="604800000" id="opt7Days">7d</option>
        <option value="2592000000" id="opt30Days">30d</option>
        <option value="0" id="optNever">Never</option>
      </select>

      <span id="groupBackupTitle">DONNÉES & SAUVEGARDE</span>
      <button id="exportBackupBtn"><span id="exportBtnText">Export</span></button>
      <button id="importBackupBtn"><span id="importBtnText">Import</span></button>
      <input type="file" id="importFileInput">
    </div>

    <div id="toastNotification"><span id="toastMessage"></span></div>
  </div>
`;

describe('PopupController UI Exhaustive Suite', () => {
  let storage: StorageService;
  let i18n: I18nService;
  let controller: PopupController;

  beforeEach(async () => {
    setupMockChrome();
    document.body.innerHTML = POPUP_HTML;
    storage = new StorageService();
    i18n = new I18nService('en');

    const now = Date.now();
    await storage.setClips([
      {
        id: 1,
        text: 'https://vitest.dev',
        url: 'https://vitest.dev',
        timestamp: now - 2000,
        pinned: false,
        copyCount: 1,
        lastCopied: null,
        category: 'link'
      },
      {
        id: 2,
        text: 'const add = (a, b) => a + b;',
        url: 'https://github.com',
        timestamp: now - 1000,
        pinned: true,
        copyCount: 2,
        lastCopied: null,
        category: 'code'
      },
      {
        id: 3,
        text: 'Scanned OCR Text from screenshot',
        url: '',
        timestamp: now - 500,
        pinned: false,
        copyCount: 0,
        lastCopied: null,
        category: 'image',
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        ocrText: 'Scanned OCR Text from screenshot'
      }
    ]);

    controller = new PopupController(storage, i18n);
    await controller.init();
  });

  it('renders all categories of clips and sets correct tab badges', () => {
    const clips = document.querySelectorAll('.clip-card');
    expect(clips).toHaveLength(3);

    expect(document.getElementById('clipCount')?.textContent).toBe('3');
    expect(document.getElementById('allCount')?.textContent).toBe('3');
    expect(document.getElementById('linksCount')?.textContent).toBe('1');
    expect(document.getElementById('codeCount')?.textContent).toBe('1');
    expect(document.getElementById('imagesCount')?.textContent).toBe('1');
    expect(document.getElementById('pinnedCount')?.textContent).toBe('1');
  });

  it('filters clips on tab click (All, Links, Code, Images, Pinned)', () => {
    const linksTab = document.querySelector('[data-tab="links"]') as HTMLButtonElement;
    linksTab.click();
    let cards = document.querySelectorAll('.clip-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('vitest.dev');

    const codeTab = document.querySelector('[data-tab="code"]') as HTMLButtonElement;
    codeTab.click();
    cards = document.querySelectorAll('.clip-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('const add');

    const imagesTab = document.querySelector('[data-tab="images"]') as HTMLButtonElement;
    imagesTab.click();
    cards = document.querySelectorAll('.clip-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('Scanned OCR Text');

    const pinnedTab = document.querySelector('[data-tab="pinned"]') as HTMLButtonElement;
    pinnedTab.click();
    cards = document.querySelectorAll('.clip-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('const add');
  });

  it('filters clips in real-time via search input and resets on clear button', async () => {
    const searchInput = document.getElementById('searchInput') as HTMLInputElement;
    const clearSearchBtn = document.getElementById('clearSearchBtn') as HTMLButtonElement;

    searchInput.value = 'screenshot';
    searchInput.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 200)); // Account for 150ms search debounce

    let cards = document.querySelectorAll('.clip-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('Scanned OCR Text');

    clearSearchBtn.click();
    expect(searchInput.value).toBe('');
    cards = document.querySelectorAll('.clip-card');
    expect(cards).toHaveLength(3);
  });

  it('switches themes via Theme Segmented Pill buttons', async () => {
    const lightPill = document.getElementById('btnThemeLight') as HTMLButtonElement;
    const darkPill = document.getElementById('btnThemeDark') as HTMLButtonElement;

    lightPill.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(document.body.classList.contains('light-mode')).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(await storage.getTheme()).toBe('light');

    darkPill.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(document.body.classList.contains('light-mode')).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(await storage.getTheme()).toBe('dark');
  });

  it('switches locales via Language Segmented Pill buttons', async () => {
    const frPill = document.getElementById('btnLangFr') as HTMLButtonElement;
    const enPill = document.getElementById('btnLangEn') as HTMLButtonElement;

    frPill.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(i18n.getLocale()).toBe('fr');
    expect(await storage.getLocale()).toBe('fr');
    expect(document.getElementById('tabAllLabel')?.textContent).toBe('Tout');

    enPill.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(i18n.getLocale()).toBe('en');
    expect(await storage.getLocale()).toBe('en');
    expect(document.getElementById('tabAllLabel')?.textContent).toBe('All');
  });

  it('updates Quick Menu Limit via QuickLimit Segmented Pill buttons', async () => {
    const limit5Btn = document.querySelector('#quickLimitSegmented [data-limit="5"]') as HTMLButtonElement;
    limit5Btn.click();
    await new Promise((r) => setTimeout(r, 10));

    const settings = await storage.getSettings();
    expect(settings.quickMenuLimit).toBe(5);
  });

  it('records and resets custom keyboard shortcuts in settings', async () => {
    const recordSnipBtn = document.getElementById('recordSnipBtn') as HTMLButtonElement;
    const resetSnipBtn = document.getElementById('resetSnipBtn') as HTMLButtonElement;

    recordSnipBtn.click();
    expect(recordSnipBtn.classList.contains('recording')).toBe(true);

    // Simulate keydown event with Meta + KeyK
    const keyEvent = new KeyboardEvent('keydown', {
      key: 'k',
      code: 'KeyK',
      metaKey: true,
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(keyEvent);
    await new Promise((r) => setTimeout(r, 10));

    let settings = await storage.getSettings();
    expect(settings.shortcuts?.snip?.code).toBe('KeyK');
    expect(settings.shortcuts?.snip?.metaKey).toBe(true);

    // Reset shortcut
    resetSnipBtn.click();
    await new Promise((r) => setTimeout(r, 10));
    settings = await storage.getSettings();
    expect(settings.shortcuts?.snip?.code).toBe('KeyX');
  });

  it('opens and closes reader preview modal', async () => {
    const previewBtn = document.querySelector('.action-preview') as HTMLButtonElement;
    const previewModal = document.getElementById('previewModal');
    const previewCloseBtn = document.getElementById('previewCloseBtn');

    previewBtn?.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(previewModal?.classList.contains('show')).toBe(true);

    previewCloseBtn?.click();
    expect(previewModal?.classList.contains('show')).toBe(false);
  });

  it('pins and unpins a clip on pin button click', async () => {
    const pinBtnForClip2 = document.querySelector('[data-action="pin"][data-id="2"]') as HTMLButtonElement;
    expect(pinBtnForClip2).toBeDefined();

    // Click pin button on clip 2 (currently pinned: true -> should become pinned: false)
    pinBtnForClip2.click();
    await new Promise((r) => setTimeout(r, 50));

    let clips = await storage.getClips();
    let clip2 = clips.find((c) => c.id === 2);
    expect(clip2?.pinned).toBe(false);

    // Call togglePin directly on clip 1 to pin it
    await controller.togglePin(1);
    clips = await storage.getClips();
    const clip1 = clips.find((c) => c.id === 1);
    expect(clip1?.pinned).toBe(true);
  });

  it('exports and validates JSON history backup', async () => {
    const exportBtn = document.getElementById('exportBackupBtn') as HTMLButtonElement;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    exportBtn.click();
    await new Promise((r) => setTimeout(r, 10));

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('imports valid JSON history backup file', async () => {
    const importFileInput = document.getElementById('importFileInput') as HTMLInputElement;
    const mockBackup = {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      clips: [
        {
          id: 100,
          text: 'Imported clip text',
          url: 'https://example.com',
          timestamp: Date.now(),
          pinned: false,
          copyCount: 1,
          category: 'text'
        }
      ]
    };

    const blob = new Blob([JSON.stringify(mockBackup)], { type: 'application/json' });
    const file = new File([blob], 'backup.json', { type: 'application/json' });

    Object.defineProperty(importFileInput, 'files', {
      value: [file],
      writable: true
    });

    importFileInput.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 20));

    const clips = await storage.getClips();
    expect(clips.some((c) => c.text === 'Imported clip text')).toBe(true);
  });
});
