// popup.js - UPDATED VERSION WITH i18n

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize i18n first
    await i18n.init();
    
    const state = {
        clips: [],
        filter: 'all',
        searchTerm: ''
    };

    // --- DOM Elements ---
    const clipsContainer = document.getElementById('clipsContainer');
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearch');
    const clipCountEl = document.getElementById('clipCount');
    const themeToggle = document.getElementById('themeToggle');
    const clearAllBtn = document.getElementById('clearAll');
    const languageToggle = document.getElementById('languageToggle');
    const tabs = document.querySelector('.tabs');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalText = document.getElementById('modalText');
    const modalClose = document.getElementById('modalClose');

    // --- Main Logic ---

    async function initialize() {
        setupEventListeners();
        const { theme } = await chrome.storage.local.get('theme');
        if (theme === 'light') {
            document.body.classList.add('light-mode');
        }
        updateThemeIcon();
        updateLanguageIcon();

        const { clips } = await chrome.storage.local.get('clips');
        state.clips = clips || [];
        
        updateUIText();
        render();
    }

    function updateUIText() {
        // Update header
        document.querySelector('h1').textContent = i18n.t('appTitle');
        themeToggle.title = i18n.t('themeToggle');
        clearAllBtn.title = i18n.t('clearAll');
        languageToggle.title = i18n.t('language');
        
        // Update tabs
        document.querySelectorAll('.tab').forEach(tab => {
            const tabKey = tab.dataset.tab;
            tab.textContent = i18n.t(`tab${tabKey.charAt(0).toUpperCase() + tabKey.slice(1)}`);
        });
        
        // Update search placeholder
        searchInput.placeholder = i18n.t('searchPlaceholder');
        
        // Update modal title
        document.querySelector('.modal-title').textContent = i18n.t('modalTitle');
    }

    function render() {
        const filteredClips = getFilteredClips();
        clipCountEl.textContent = `${state.clips.length}`;

        if (filteredClips.length === 0) {
            clipsContainer.innerHTML = createEmptyStateHTML();
        } else {
            clipsContainer.innerHTML = filteredClips.map(createClipItemHTML).join('');
        }
    }

    // --- Event Handling (Delegation) ---

    function setupEventListeners() {
        clipsContainer.addEventListener('click', handleClipAction);
        
        searchInput.addEventListener('input', handleSearch);
        clearSearchBtn.addEventListener('click', clearSearch);
        tabs.addEventListener('click', handleTabChange);
        clearAllBtn.addEventListener('click', clearAllUnpinned);
        themeToggle.addEventListener('click', toggleTheme);
        languageToggle.addEventListener('click', toggleLanguage);
        modalOverlay.addEventListener('click', closeModal);
        modalClose.addEventListener('click', closeModal);
        
        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboard);
    }

    function handleKeyboard(e) {
        // ESC to close modal
        if (e.key === 'Escape' && modalOverlay.classList.contains('show')) {
            closeModal(e);
        }
    }

    function handleClipAction(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const { action, id } = target.dataset;
        const clipId = parseInt(id);

        switch (action) {
            case 'copy':
                copyToClipboard(clipId);
                break;
            case 'pin':
                togglePin(clipId);
                break;
            case 'preview':
                showPreview(clipId);
                break;
            case 'delete':
                deleteClip(clipId);
                break;
        }
    }

    function handleSearch(e) {
        state.searchTerm = e.target.value.toLowerCase();
        clearSearchBtn.style.display = state.searchTerm ? 'flex' : 'none';
        render();
    }

    function clearSearch() {
        searchInput.value = '';
        state.searchTerm = '';
        clearSearchBtn.style.display = 'none';
        render();
    }
    
    function handleTabChange(e) {
        const tab = e.target.closest('.tab');
        if (tab && !tab.classList.contains('active')) {
            document.querySelector('.tab.active').classList.remove('active');
            tab.classList.add('active');
            state.filter = tab.dataset.tab;
            render();
        }
    }

    // --- Actions ---

    async function copyToClipboard(clipId) {
        const clip = state.clips.find(c => c.id === clipId);
        if (clip) {
            try {
                await navigator.clipboard.writeText(clip.text);
                showToast();
                
                // Update copy count
                clip.copyCount = (clip.copyCount || 0) + 1;
                clip.lastCopied = Date.now();
                await saveClips();
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        }
    }

    async function togglePin(clipId) {
        const clip = state.clips.find(c => c.id === clipId);
        if (clip) {
            clip.pinned = !clip.pinned;
            sortClips();
            await saveClips();
            render();
        }
    }
    
    async function deleteClip(clipId) {
        if (confirm(i18n.t('confirmDelete'))) {
            state.clips = state.clips.filter(c => c.id !== clipId);
            await saveClips();
            render();
        }
    }

    async function clearAllUnpinned() {
        if (confirm(i18n.t('confirmClearAll'))) {
            state.clips = state.clips.filter(c => c.pinned);
            await saveClips();
            render();
        }
    }
    
    async function toggleTheme() {
        document.body.classList.toggle('light-mode');
        const isLight = document.body.classList.contains('light-mode');
        updateThemeIcon();
        await chrome.storage.local.set({ theme: isLight ? 'light' : 'dark' });
    }

    function updateThemeIcon() {
        const isLight = document.body.classList.contains('light-mode');
        themeToggle.textContent = isLight ? '☀️' : '🌙';
    }

    async function toggleLanguage() {
        const currentLocale = i18n.getCurrentLocale();
        const newLocale = currentLocale === 'en' ? 'fr' : 'en';
        await i18n.setLocale(newLocale);
        updateLanguageIcon();
        updateUIText();
        render();
    }

    function updateLanguageIcon() {
        const locale = i18n.getCurrentLocale();
        languageToggle.textContent = locale === 'en' ? '🇬🇧' : '🇫🇷';
        languageToggle.title = i18n.t('language') + ': ' + i18n.t(locale === 'en' ? 'languageEnglish' : 'languageFrench');
    }

    function showPreview(clipId) {
        const clip = state.clips.find(c => c.id === clipId);
        if (clip) {
            modalText.textContent = clip.text;
            modalOverlay.classList.add('show');
            document.querySelector('.modal-title').textContent = i18n.t('modalTitle');
        }
    }

    function closeModal(e) {
        if (e.target === modalOverlay || e.target === modalClose || e.key === 'Escape') {
            modalOverlay.classList.remove('show');
        }
    }

    // --- Helpers ---

    function isLink(text) {
        const urlPattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
        '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
        return !!urlPattern.test(text);
    }

    function getFilteredClips() {
        let clips = [...state.clips];
        
        if (state.filter === 'links') {
            clips = clips.filter(c => isLink(c.text));
        } else if (state.filter === 'pinned') {
            clips = clips.filter(c => c.pinned);
        }

        if (state.searchTerm) {
            clips = clips.filter(c => c.text.toLowerCase().includes(state.searchTerm));
        }
        
        return clips;
    }

    function sortClips() {
        state.clips.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return b.timestamp - a.timestamp;
        });
    }

    function saveClips() {
        return chrome.storage.local.set({ clips: state.clips });
    }
    
    function showToast() {
        const toast = document.getElementById('copiedToast');
        toast.innerHTML = `<span>${i18n.t('copiedToast')}</span>`;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }

    function timeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return i18n.t('justNow');
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return i18n.t('minutesAgo', minutes);
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return i18n.t('hoursAgo', hours);
        return i18n.t('daysAgo', Math.floor(hours / 24));
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // --- HTML Generators ---

    function createClipItemHTML(clip) {
        const isLinkClip = isLink(clip.text);
        const colorClass = `color-${clip.id % 10}`;
        const pinnedClass = clip.pinned ? 'pinned' : '';
        const pinTitle = clip.pinned ? i18n.t('unpin') : i18n.t('pin');

        return `
        <div class="clip-item ${pinnedClass} ${colorClass}" data-id="${clip.id}" data-action="copy" title="${i18n.t('clickToCopy')}">
            <div class="clip-header">
                <div class="clip-category">${isLinkClip ? i18n.t('categoryLink') : i18n.t('categoryText')}</div>
                <div class="clip-actions">
                    <button class="clip-action-btn preview" data-id="${clip.id}" data-action="preview" title="${i18n.t('preview')}">👁️</button>
                    <button class="clip-action-btn delete" data-id="${clip.id}" data-action="delete" title="${i18n.t('delete')}">🗑️</button>
                    <button class="clip-action-btn ${pinnedClass}" data-id="${clip.id}" data-action="pin" title="${pinTitle}">📌</button>
                </div>
            </div>
            <div class="clip-text">${escapeHtml(clip.text)}</div>
            <div class="clip-meta">
                <span>${timeAgo(clip.timestamp)}</span>
                <span>•</span>
                <span>${i18n.t('chars', clip.text.length)}</span>
                ${clip.copyCount ? `<span>•</span><span class="copy-count">📋 ${clip.copyCount}</span>` : ''}
            </div>
        </div>`;
    }

    function createEmptyStateHTML() {
        const messages = {
            all: { icon: '📋', titleKey: 'emptyAllTitle', textKey: 'emptyAllText'},
            links: { icon: '🔗', titleKey: 'emptyLinksTitle', textKey: 'emptyLinksText' },
            pinned: { icon: '📌', titleKey: 'emptyPinnedTitle', textKey: 'emptyPinnedText'},
            search: { icon: '🔍', titleKey: 'emptySearchTitle', textKey: 'emptySearchText'}
        };

        const key = state.searchTerm ? 'search' : state.filter;
        const msg = messages[key];
        
        return `
        <div class="empty-state">
          <div class="empty-state-icon">${msg.icon}</div>
          <h2>${i18n.t(msg.titleKey)}</h2>
          <p>${i18n.t(msg.textKey)}</p>
        </div>`;
    }

    // --- Initialize ---
    initialize();
});