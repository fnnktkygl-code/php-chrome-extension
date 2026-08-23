import { describe, it, expect, beforeEach } from 'vitest';
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
        <button id="languageToggle">🇬🇧</button>
        <button id="themeToggle">🌙</button>
        <button id="settingsBtn">⚙️</button>
        <button id="refreshBtn">🔄</button>
        <button id="clearAllBtn">🗑️</button>
      </div>
      <nav class="tabs">
        <button class="tab-btn active" data-tab="all">
          <span id="tabAllLabel">All</span>
          <span id="allCount">0</span>
        </button>
        <button class="tab-btn" data-tab="links">
          <span id="tabLinksLabel">Links</span>
          <span id="linksCount">0</span>
        </button>
        <button class="tab-btn" data-tab="code">
          <span id="tabCodeLabel">Code</span>
          <span id="codeCount">0</span>
        </button>
        <button class="tab-btn" data-tab="pinned">
          <span id="tabPinnedLabel">Pinned</span>
          <span id="pinnedCount">0</span>
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
      <pre id="previewContent"></pre>
      <button id="previewCopyBtn">Copy</button>
      <button id="previewCloseBtn">✕</button>
    </div>

    <!-- Settings Modal -->
    <div id="settingsModal" class="modal-backdrop">
      <h2 id="settingsModalTitle">Settings</h2>
      <button id="settingsCloseBtn">✕</button>
      <input type="checkbox" id="settingSaveUrl" checked>
      <input type="checkbox" id="settingIgnorePasswords" checked>
      <select id="settingMaxClips"><option value="50">50</option></select>
      <select id="settingMaxAge"><option value="86400000">1d</option></select>
      <label id="saveUrlLabel">Save URL</label>
      <label id="ignorePasswordsLabel">Ignore Passwords</label>
      <label id="maxClipsLabel">Max Clips</label>
      <label id="maxAgeLabel">Max Age</label>
      <span id="opt1Day">1d</span>
      <span id="opt7Days">7d</span>
      <span id="opt30Days">30d</span>
      <span id="optNever">Never</span>
      <span id="backupSectionTitle">Backup</span>
      <button id="exportBackupBtn">Export</button>
      <span id="exportBtnText">Export</span>
      <button id="importBackupBtn">Import</button>
      <span id="importBtnText">Import</span>
      <input type="file" id="importFileInput">
    </div>

    <div id="toastNotification"><span id="toastMessage"></span></div>
  </div>
`;

describe('PopupController UI', () => {
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
        url: '',
        timestamp: now - 1000,
        pinned: true,
        copyCount: 0,
        lastCopied: null,
        category: 'code'
      }
    ]);

    controller = new PopupController(storage, i18n);
    await controller.init();
  });

  it('renders clips and updates counters', () => {
    const clips = document.querySelectorAll('.clip-card');
    expect(clips).toHaveLength(2);

    expect(document.getElementById('clipCount')?.textContent).toBe('2');
    expect(document.getElementById('allCount')?.textContent).toBe('2');
    expect(document.getElementById('linksCount')?.textContent).toBe('1');
    expect(document.getElementById('codeCount')?.textContent).toBe('1');
    expect(document.getElementById('pinnedCount')?.textContent).toBe('1');
  });

  it('toggles theme when theme button is clicked', async () => {
    await controller.toggleTheme();
    expect(document.body.classList.contains('light-mode')).toBe(true);
    expect(await storage.getTheme()).toBe('light');

    await controller.toggleTheme();
    expect(document.body.classList.contains('light-mode')).toBe(false);
    expect(await storage.getTheme()).toBe('dark');
  });

  it('toggles language when language button is clicked', async () => {
    await controller.toggleLanguage();
    expect(i18n.getLocale()).toBe('fr');
    expect(document.getElementById('tabAllLabel')?.textContent).toBe('Tout');

    await controller.toggleLanguage();
    expect(i18n.getLocale()).toBe('en');
    expect(document.getElementById('tabAllLabel')?.textContent).toBe('All');
  });

  it('filters clips on tab click', () => {
    const linksTab = document.querySelector('[data-tab="links"]') as HTMLButtonElement;
    linksTab.click();

    const visibleCards = document.querySelectorAll('.clip-card');
    expect(visibleCards).toHaveLength(1);
    expect(visibleCards[0].textContent).toContain('vitest.dev');
  });

  it('opens and closes settings modal', async () => {
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeBtn = document.getElementById('settingsCloseBtn');

    settingsBtn?.click();
    await new Promise((r) => setTimeout(r, 20));
    expect(settingsModal?.classList.contains('show')).toBe(true);

    closeBtn?.click();
    expect(settingsModal?.classList.contains('show')).toBe(false);
  });
});
