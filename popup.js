// popup.js - ENHANCED VERSION WITH UX/UI IMPROVEMENTS

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize i18n first
    await i18n.init();

    const state = {
        clips: [],
        filter: 'all',
        searchTerm: '',
        focusedIndex: -1,
        expandedClips: new Set()
    };

    // --- DOM Elements ---
    const clipsContainer = document.getElementById('clipsContainer');
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearch');
    const searchResults = document.getElementById('searchResults');
    const clipCountEl = document.getElementById('clipCount');
    const allCountEl = document.getElementById('allCount');
    const linksCountEl = document.getElementById('linksCount');
    const pinnedCountEl = document.getElementById('pinnedCount');
    const themeToggle = document.getElementById('themeToggle');
    const refreshBtn = document.getElementById('refreshBtn');
    const clearAllBtn = document.getElementById('clearAll');
    const languageToggle = document.getElementById('languageToggle');
    const tabs = document.querySelector('.tabs');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalText = document.getElementById('modalText');
    const modalClose = document.getElementById('modalClose');

    // --- Utility Functions ---

    function debounce(fn, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn(...args), delay);
        };
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function isLink(text) {
        // Improved regex for better link detection
        const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?(\?.*)?$/i;
        return urlPattern.test(text.trim());
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

    function getFilteredClips() {
        let clips = [...state.clips];

        if (state.filter === 'links') {
            clips = clips.filter(c => isLink(c.text));
        } else if (state.filter === 'pinned') {
            clips = clips.filter(c => c.pinned);
        }

        if (state.searchTerm) {
            clips = clips.filter(c =>
                c.text.toLowerCase().includes(state.searchTerm) ||
                (c.url && c.url.toLowerCase().includes(state.searchTerm))
            );
        }

        return clips;
    }

    function updateCounts() {
        const allClips = state.clips;
        const linkClips = allClips.filter(c => isLink(c.text));
        const pinnedClips = allClips.filter(c => c.pinned);

        clipCountEl.textContent = allClips.length;
        allCountEl.textContent = allClips.length;
        linksCountEl.textContent = linkClips.length;
        pinnedCountEl.textContent = pinnedClips.length;
    }

    function sortClips() {
        state.clips.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return b.timestamp - a.timestamp;
        });
    }

    async function saveClips() {
        await chrome.storage.local.set({ clips: state.clips });
    }

    // --- Main Logic ---

    async function initialize() {
        setupEventListeners();

        const { theme } = await chrome.storage.local.get('theme');
        if (theme === 'light') {
            document.body.classList.add('light-mode');
        }
        updateThemeIcon();
        updateLanguageIcon();

        await checkSystemClipboard();
        await loadClips();

        // Also check when window regains focus (e.g. switching back from another window)
        window.addEventListener('focus', checkSystemClipboard);
    }

    async function checkSystemClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            if (text && text.trim().length > 0) {
                // Send to background to process (deduplication logic is there)
                await chrome.runtime.sendMessage({
                    type: 'CLIPBOARD_COPY',
                    text: text,
                    url: '', // No URL for system/omnibox copies
                    timestamp: Date.now()
                });
            }
        } catch (err) {
            // Ignore clipboard read errors (e.g. if not focused)
        }
    }

    async function loadClips() {
        const { clips } = await chrome.storage.local.get('clips');
        state.clips = clips || [];
        updateUIText();
        updateCounts();
        render();
    }

    function updateUIText() {
        // Update header
        document.querySelector('h1').textContent = i18n.t('appTitle');
        themeToggle.title = i18n.t('themeToggle');
        refreshBtn.title = i18n.t('refresh') || 'Refresh';
        clearAllBtn.title = i18n.t('clearAll');
        languageToggle.title = i18n.t('language');

        // Update tabs
        document.querySelectorAll('.tab').forEach(tab => {
            const tabKey = tab.dataset.tab;
            const textSpan = tab.querySelector('.tab-text');
            if (textSpan) {
                textSpan.textContent = i18n.t(`tab${tabKey.charAt(0).toUpperCase() + tabKey.slice(1)}`);
            }
        });

        // Update search placeholder
        searchInput.placeholder = i18n.t('searchPlaceholder');

        // Update modal title
        document.querySelector('.modal-title').textContent = i18n.t('modalTitle');
    }

    function render() {
        const filteredClips = getFilteredClips();

        // Update search results count
        if (state.searchTerm) {
            searchResults.textContent = `${filteredClips.length} ${filteredClips.length === 1 ? 'result' : 'results'}`;
            searchResults.classList.add('show');
        } else {
            searchResults.classList.remove('show');
        }

        if (filteredClips.length === 0) {
            clipsContainer.innerHTML = createEmptyStateHTML();
        } else {
            clipsContainer.innerHTML = filteredClips.map((clip, index) =>
                createClipItemHTML(clip, index)
            ).join('');

            // Re-attach event listeners after render
            attachClipEventListeners();
        }

        state.focusedIndex = -1;
    }

    // --- Event Handling ---

    function setupEventListeners() {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
        clearSearchBtn.addEventListener('click', clearSearch);
        tabs.addEventListener('click', handleTabChange);
        clearAllBtn.addEventListener('click', clearAllUnpinned);
        themeToggle.addEventListener('click', toggleTheme);
        refreshBtn.addEventListener('click', handleRefresh);
        languageToggle.addEventListener('click', toggleLanguage);
        modalOverlay.addEventListener('click', closeModal);
        modalClose.addEventListener('click', closeModal);

        // Keyboard shortcuts
        document.addEventListener('keydown', handleGlobalKeyboard);
    }

    async function handleRefresh() {
        refreshBtn.classList.add('spinning');
        await loadClips();
        setTimeout(() => refreshBtn.classList.remove('spinning'), 500);
    }

    function attachClipEventListeners() {
        const clipItems = document.querySelectorAll('.clip-item');

        clipItems.forEach((clipEl, index) => {
            // Click to copy
            clipEl.addEventListener('click', (e) => {
                if (!e.target.closest('.clip-action-btn') && !e.target.closest('.expand-text-btn')) {
                    const clipId = parseInt(clipEl.dataset.id);
                    copyToClipboard(clipId, clipEl);
                }
            });

            // Keyboard navigation for clips
            clipEl.addEventListener('keydown', (e) => handleClipKeyboard(e, index, clipItems.length));
        });

        // Action buttons
        document.querySelectorAll('.clip-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const clipId = parseInt(btn.dataset.id);
                handleClipAction(action, clipId);
            });
        });

        // Expand buttons
        document.querySelectorAll('.expand-text-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const clipId = parseInt(btn.dataset.id);
                toggleExpand(clipId, btn);
            });
        });
    }

    function handleGlobalKeyboard(e) {
        // ESC to close modal
        if (e.key === 'Escape' && modalOverlay.classList.contains('show')) {
            closeModal(e);
        }

        // Focus search with Ctrl/Cmd + F
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            searchInput.focus();
        }
    }

    function handleClipKeyboard(e, index, totalClips) {
        const clipItems = Array.from(document.querySelectorAll('.clip-item'));

        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            clipItems[index].click();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (index < totalClips - 1) {
                clipItems[index + 1].focus();
                state.focusedIndex = index + 1;
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (index > 0) {
                clipItems[index - 1].focus();
                state.focusedIndex = index - 1;
            }
        }
    }

    function handleSearch(e) {
        state.searchTerm = e.target.value.toLowerCase();
        const hasValue = state.searchTerm.length > 0;
        clearSearchBtn.classList.toggle('show', hasValue);
        render();
    }

    function clearSearch() {
        searchInput.value = '';
        state.searchTerm = '';
        clearSearchBtn.classList.remove('show');
        searchResults.classList.remove('show');
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

    function handleClipAction(action, clipId) {
        switch (action) {
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

    // --- Actions ---

    async function copyToClipboard(clipId, clipEl) {
        const clip = state.clips.find(c => c.id === clipId);
        if (!clip) return;

        try {
            await navigator.clipboard.writeText(clip.text);

            // Visual feedback
            if (clipEl) {
                clipEl.classList.add('copying');
                setTimeout(() => clipEl.classList.remove('copying'), 400);
            }

            showToast('success', i18n.t('copiedToast'));

            // Update copy count
            clip.copyCount = (clip.copyCount || 0) + 1;
            clip.lastCopied = Date.now();
            await saveClips();

            // Update just the meta info without full re-render
            updateClipMeta(clipId);
        } catch (err) {
            console.error('Failed to copy:', err);
            showToast('error', 'Failed to copy. Please try again.');
        }
    }

    function updateClipMeta(clipId) {
        const clip = state.clips.find(c => c.id === clipId);
        if (!clip) return;

        const clipEl = document.querySelector(`[data-id="${clipId}"]`);
        if (!clipEl) return;

        const metaEl = clipEl.querySelector('.clip-meta');
        if (metaEl) {
            metaEl.innerHTML = createClipMetaHTML(clip);
        }
    }

    async function togglePin(clipId) {
        const clip = state.clips.find(c => c.id === clipId);
        if (clip) {
            clip.pinned = !clip.pinned;
            sortClips();
            await saveClips();
            updateCounts();
            render();
        }
    }

    async function deleteClip(clipId) {
        if (confirm(i18n.t('confirmDelete'))) {
            state.clips = state.clips.filter(c => c.id !== clipId);
            await saveClips();
            updateCounts();
            render();
        }
    }

    async function clearAllUnpinned() {
        const unpinnedCount = state.clips.filter(c => !c.pinned).length;
        if (unpinnedCount === 0) {
            showToast('info', 'No clips to clear');
            return;
        }

        if (confirm(i18n.t('confirmClearAll'))) {
            state.clips = state.clips.filter(c => c.pinned);
            await saveClips();
            updateCounts();
            render();
            showToast('success', `Cleared ${unpinnedCount} clip${unpinnedCount === 1 ? '' : 's'}`);
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

    function toggleExpand(clipId, btnEl) {
        const clipTextEl = document.querySelector(`[data-clip-text="${clipId}"]`);
        if (!clipTextEl) return;

        if (state.expandedClips.has(clipId)) {
            state.expandedClips.delete(clipId);
            clipTextEl.classList.remove('expanded');
            btnEl.textContent = i18n.t('readMore') || 'Read more';
        } else {
            state.expandedClips.add(clipId);
            clipTextEl.classList.add('expanded');
            btnEl.textContent = i18n.t('readLess') || 'Read less';
        }
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

    function showToast(type = 'success', message) {
        const toast = document.getElementById('copiedToast');
        toast.textContent = message;
        toast.className = 'copied-toast';
        if (type === 'error') {
            toast.classList.add('error');
        }
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }

    // --- HTML Generators ---

    function createClipMetaHTML(clip) {
        return `
            <span>${timeAgo(clip.timestamp)}</span>
            <span>•</span>
            <span>${i18n.t('chars', clip.text.length)}</span>
            ${clip.copyCount ? `<span>•</span><span class="copy-count">📋 ${clip.copyCount}</span>` : ''}
        `;
    }

    function createClipItemHTML(clip, index) {
        const isLinkClip = isLink(clip.text);
        const colorClass = `color-${clip.id % 10}`;
        const pinnedClass = clip.pinned ? 'pinned' : '';
        const pinTitle = clip.pinned ? i18n.t('unpin') : i18n.t('pin');
        const isExpanded = state.expandedClips.has(clip.id);
        const expandedClass = isExpanded ? 'expanded' : '';
        const needsExpand = clip.text.length > 250;

        return `
        <div 
            class="clip-item ${pinnedClass} ${colorClass}" 
            data-id="${clip.id}" 
            tabindex="0" 
            role="listitem"
            aria-label="${escapeHtml(i18n.t('clickToCopy') + ': ' + clip.text.substring(0, 50))}..."
        >
            <div class="clip-header">
                <div class="clip-category">${isLinkClip ? i18n.t('categoryLink') : i18n.t('categoryText')}</div>
                <div class="clip-actions">
                    <button 
                        class="clip-action-btn preview" 
                        data-id="${clip.id}" 
                        data-action="preview" 
                        title="${i18n.t('preview')}"
                        aria-label="${i18n.t('preview')}"
                    >👁️</button>
                    <button 
                        class="clip-action-btn delete" 
                        data-id="${clip.id}" 
                        data-action="delete" 
                        title="${i18n.t('delete')}"
                        aria-label="${i18n.t('delete')}"
                    >🗑️</button>
                    <button 
                        class="clip-action-btn ${pinnedClass}" 
                        data-id="${clip.id}" 
                        data-action="pin" 
                        title="${pinTitle}"
                        aria-label="${pinTitle}"
                    >📌</button>
                </div>
            </div>
            <div class="clip-text ${expandedClass}" data-clip-text="${clip.id}">${escapeHtml(clip.text)}</div>
            ${needsExpand ? `
                <button class="expand-text-btn" data-id="${clip.id}">
                    ${isExpanded ? (i18n.t('readLess') || 'Read less') : (i18n.t('readMore') || 'Read more')}
                </button>
            ` : ''}
            <div class="clip-meta">
                ${createClipMetaHTML(clip)}
            </div>
        </div>`;
    }

    function createEmptyStateHTML() {
        const messages = {
            all: { icon: '📋', titleKey: 'emptyAllTitle', textKey: 'emptyAllText' },
            links: { icon: '🔗', titleKey: 'emptyLinksTitle', textKey: 'emptyLinksText' },
            pinned: { icon: '📌', titleKey: 'emptyPinnedTitle', textKey: 'emptyPinnedText' },
            search: { icon: '🔍', titleKey: 'emptySearchTitle', textKey: 'emptySearchText' }
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