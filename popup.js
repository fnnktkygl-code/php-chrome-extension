// popup.js - PHP Extension v2.0.0

document.addEventListener('DOMContentLoaded', async () => {
    await i18n.init();

    const state = {
        clips: [],
        filter: 'all',
        searchTerm: '',
        expandedClips: new Set(),
        activePreviewClip: null
    };

    // --- DOM Elements ---
    const clipsContainer = document.getElementById('clipsContainer');
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const searchFeedback = document.getElementById('searchFeedback');
    const clipCountEl = document.getElementById('clipCount');
    const allCountEl = document.getElementById('allCount');
    const linksCountEl = document.getElementById('linksCount');
    const codeCountEl = document.getElementById('codeCount');
    const imagesCountEl = document.getElementById('imagesCount');
    const pinnedCountEl = document.getElementById('pinnedCount');

    const themeToggle = document.getElementById('themeToggle');
    const refreshBtn = document.getElementById('refreshBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const languageToggle = document.getElementById('languageToggle');
    const langIndicator = document.getElementById('langIndicator');

    const previewModal = document.getElementById('previewModal');
    const previewModalTitle = document.getElementById('previewModalTitle');
    const previewContent = document.getElementById('previewContent');
    const previewImageContainer = document.getElementById('previewImageContainer');
    const previewImageEl = document.getElementById('previewImageEl');
    const previewCloseBtn = document.getElementById('previewCloseBtn');
    const previewCopyBtn = document.getElementById('previewCopyBtn');

    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const settingsCloseBtn = document.getElementById('settingsCloseBtn');
    const settingSaveUrl = document.getElementById('settingSaveUrl');
    const settingIgnorePasswords = document.getElementById('settingIgnorePasswords');
    const settingMaxClips = document.getElementById('settingMaxClips');
    const settingMaxAge = document.getElementById('settingMaxAge');

    const exportBackupBtn = document.getElementById('exportBackupBtn');
    const importBackupBtn = document.getElementById('importBackupBtn');
    const importFileInput = document.getElementById('importFileInput');
    const toast = document.getElementById('toastNotification');
    const toastMessage = document.getElementById('toastMessage');

    const CODE_PATTERNS = [
        /<\/?(svg|path|circle|rect|line|polygon|g|html|head|body|div|span|p|a|button|input|form|table|script|style)\b/i,
        /xmlns="http:\/\/www\.w3\.org\/(2000\/svg|1999\/xhtml)"/i,
        /<!DOCTYPE\s+html>/i,
        /^\s*(import\s+|export\s+|const\s+|let\s+|var\s+|function\s+|class\s+|def\s+|<\?php|SELECT\s+|INSERT\s+|docker\s+|git\s+|npm\s+|curl\s+)/im,
        /^\s*([.#@:a-z][\w\-.:#\s,>+~*]*)\s*\{[\s\S]*\}/m,
        /^\s*\{\s*"[\w\-]+"\s*:\s*[\s\S]+\}\s*$/
    ];

    function isUrl(text) {
        if (!text) return false;
        const trimmed = text.trim();
        if (trimmed.includes('\n') || trimmed.includes(' ')) return false;
        try {
            const url = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
            return url.hostname.includes('.') || url.hostname === 'localhost';
        } catch {
            return false;
        }
    }

    function isCode(text) {
        if (!text) return false;
        const trimmed = text.trim();
        return CODE_PATTERNS.some(p => p.test(trimmed));
    }

    function detectCategory(text, dataUrl) {
        if (dataUrl || (text && text.startsWith('data:image/'))) return 'image';
        if (isUrl(text)) return 'link';
        if (isCode(text)) return 'code';
        return 'text';
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function getDomain(url) {
        if (!url) return '';
        try {
            const u = new URL(url.startsWith('http') ? url : `https://${url}`);
            return u.hostname.replace(/^www\./, '');
        } catch {
            return '';
        }
    }

    function formatTime(timestamp) {
        const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
        if (diffSec < 60) return i18n.t('justNow');
        const min = Math.floor(diffSec / 60);
        if (min < 60) return i18n.t('minutesAgo', min);
        const hrs = Math.floor(min / 60);
        if (hrs < 24) return i18n.t('hoursAgo', hrs);
        return i18n.t('daysAgo', Math.floor(hrs / 24));
    }

    function showToast(msg, isError = false) {
        if (!toast || !toastMessage) return;
        toastMessage.textContent = msg;
        toast.classList.toggle('error', isError);
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }

    function updateCounts() {
        const total = state.clips.length;
        const links = state.clips.filter(c => c.category === 'link' || isUrl(c.text)).length;
        const code = state.clips.filter(c => c.category === 'code' || isCode(c.text)).length;
        const images = state.clips.filter(c => c.category === 'image').length;
        const pinned = state.clips.filter(c => c.pinned).length;

        if (clipCountEl) clipCountEl.textContent = total;
        if (allCountEl) allCountEl.textContent = total;
        if (linksCountEl) linksCountEl.textContent = links;
        if (codeCountEl) codeCountEl.textContent = code;
        if (imagesCountEl) imagesCountEl.textContent = images;
        if (pinnedCountEl) pinnedCountEl.textContent = pinned;
    }

    function getFilteredClips() {
        let list = [...state.clips];
        if (state.filter === 'links') list = list.filter(c => c.category === 'link' || isUrl(c.text));
        else if (state.filter === 'code') list = list.filter(c => c.category === 'code' || isCode(c.text));
        else if (state.filter === 'images') list = list.filter(c => c.category === 'image');
        else if (state.filter === 'pinned') list = list.filter(c => c.pinned);

        if (state.searchTerm) {
            const tokens = state.searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
            list = list.filter(c => {
                const txt = (c.text || '').toLowerCase();
                const url = (c.url || '').toLowerCase();
                const ocr = (c.ocrText || '').toLowerCase();
                const qr = (c.qrData || '').toLowerCase();
                return tokens.every(t => txt.includes(t) || url.includes(t) || ocr.includes(t) || qr.includes(t));
            });
        }
        return list;
    }

    function render() {
        const list = getFilteredClips();

        if (state.searchTerm && searchFeedback) {
            searchFeedback.textContent = i18n.t('searchResults', list.length, list.length === 1 ? '' : 's');
            searchFeedback.style.display = 'block';
        } else if (searchFeedback) {
            searchFeedback.style.display = 'none';
        }

        if (list.length === 0) {
            let titleKey = 'emptyAllTitle';
            let textKey = 'emptyAllText';
            if (state.searchTerm) { titleKey = 'emptySearchTitle'; textKey = 'emptySearchText'; }
            else if (state.filter === 'links') { titleKey = 'emptyLinksTitle'; textKey = 'emptyLinksText'; }
            else if (state.filter === 'code') { titleKey = 'emptyCodeTitle'; textKey = 'emptyCodeText'; }
            else if (state.filter === 'images') { titleKey = 'emptyImagesTitle'; textKey = 'emptyImagesText'; }
            else if (state.filter === 'pinned') { titleKey = 'emptyPinnedTitle'; textKey = 'emptyPinnedText'; }

            clipsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="8" height="4" x="8" y="2" rx="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path></svg>
                    </div>
                    <h3 class="empty-state-title">${i18n.t(titleKey)}</h3>
                    <p class="empty-state-desc">${i18n.t(textKey)}</p>
                </div>
            `;
            return;
        }

        clipsContainer.innerHTML = list.map(clip => {
            const isPinned = clip.pinned;
            const isImage = clip.category === 'image' && Boolean(clip.dataUrl);
            const isSnippet = clip.category === 'code' || isCode(clip.text);
            const domain = getDomain(clip.url);
            const categoryClass = `category-${clip.category || detectCategory(clip.text, clip.dataUrl)}`;
            const categoryLabel = i18n.t(`category${(clip.category || 'text').charAt(0).toUpperCase() + (clip.category || 'text').slice(1)}`);
            const escaped = escapeHtml(clip.text);

            return `
                <article class="clip-card ${isPinned ? 'pinned' : ''} ${isSnippet ? 'is-code' : ''} ${isImage ? 'is-image' : ''}" data-id="${clip.id}">
                    <div class="clip-header">
                        <div class="clip-category-pills">
                            <span class="clip-category-pill ${categoryClass}">${categoryLabel}</span>
                            ${clip.qrData ? `<span class="clip-category-pill category-qr">QR</span>` : ''}
                        </div>
                        <div class="clip-actions">
                            ${isImage ? `
                                <button class="card-action-btn action-copy-image" data-action="copy-image" data-id="${clip.id}" title="${i18n.t('copyImage')}">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg>
                                </button>
                                <button class="card-action-btn action-ocr" data-action="ocr" data-id="${clip.id}" title="${i18n.t('extractOcr')}">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                                </button>
                            ` : ''}
                            <button class="card-action-btn action-preview" data-action="preview" data-id="${clip.id}" title="${i18n.t('preview')}">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            </button>
                            <button class="card-action-btn action-pin ${isPinned ? 'is-pinned' : ''}" data-action="pin" data-id="${clip.id}" title="${isPinned ? i18n.t('unpin') : i18n.t('pin')}">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="${isPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>
                            </button>
                            <button class="card-action-btn danger-btn action-delete" data-action="delete" data-id="${clip.id}" title="${i18n.t('delete')}">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    </div>

                    ${isImage ? `
                        <div class="clip-image-preview-wrapper">
                            <img class="clip-thumbnail" src="${clip.dataUrl}" alt="Clip Image" loading="lazy">
                        </div>
                        ${clip.ocrText ? `<div class="clip-ocr-preview">📝 ${escapeHtml(clip.ocrText.substring(0, 90))}</div>` : ''}
                        ${clip.qrData ? `<div class="clip-ocr-preview">🔗 ${escapeHtml(clip.qrData)}</div>` : ''}
                    ` : `
                        <div class="clip-content ${isSnippet ? 'code-snippet' : ''}">${escaped}</div>
                    `}

                    <div class="clip-footer">
                        <div class="clip-meta-left">
                            <span>${formatTime(clip.timestamp)}</span>
                            <span class="clip-meta-dot">•</span>
                            <span>${isImage && clip.dimensions ? `${clip.dimensions.width}×${clip.dimensions.height}` : i18n.t('chars', (clip.text || '').length)}</span>
                            ${clip.copyCount > 0 ? `<span class="clip-meta-dot">•</span><span class="copy-counter">${i18n.t('copiedTimes', clip.copyCount)}</span>` : ''}
                        </div>
                        ${domain ? `
                            <div class="clip-source-badge" title="${escapeHtml(clip.url)}">
                                <img class="clip-favicon" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32" alt="" onerror="this.style.display='none'">
                                <span>${escapeHtml(domain)}</span>
                            </div>
                        ` : ''}
                    </div>
                </article>
            `;
        }).join('');

        attachListeners();
    }

    function attachListeners() {
        clipsContainer.querySelectorAll('.clip-card').forEach(card => {
            const id = Number(card.getAttribute('data-id'));
            card.addEventListener('click', e => {
                if (e.target.closest('.card-action-btn')) return;
                const clip = state.clips.find(c => c.id === id);
                if (clip && clip.category === 'image' && clip.dataUrl) {
                    copyImageClip(id, card);
                } else {
                    copyTextClip(id, card);
                }
            });
        });

        clipsContainer.querySelectorAll('.card-action-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const action = btn.getAttribute('data-action');
                const id = Number(btn.getAttribute('data-id'));

                if (action === 'preview') openPreview(id);
                else if (action === 'pin') togglePin(id);
                else if (action === 'delete') deleteClip(id);
                else if (action === 'copy-image') copyImageClip(id);
                else if (action === 'ocr') extractOcr(id);
            });
        });
    }

    async function copyTextClip(id, cardEl) {
        const clip = state.clips.find(c => c.id === id);
        if (!clip) return;
        await navigator.clipboard.writeText(clip.text);
        if (cardEl) {
            cardEl.classList.add('copying');
            setTimeout(() => cardEl.classList.remove('copying'), 400);
        }
        showToast(i18n.t('copiedToast'));
        clip.copyCount = (clip.copyCount || 0) + 1;
        clip.lastCopied = Date.now();
        await chrome.storage.local.set({ clips: state.clips });
    }

    async function copyImageClip(id, cardEl) {
        const clip = state.clips.find(c => c.id === id);
        if (!clip || !clip.dataUrl) return;
        try {
            const res = await fetch(clip.dataUrl);
            const blob = await res.blob();
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
            if (cardEl) {
                cardEl.classList.add('copying');
                setTimeout(() => cardEl.classList.remove('copying'), 400);
            }
            showToast(i18n.t('imageCopiedToast'));
            clip.copyCount = (clip.copyCount || 0) + 1;
            clip.lastCopied = Date.now();
            await chrome.storage.local.set({ clips: state.clips });
        } catch {
            await navigator.clipboard.writeText(clip.dataUrl);
            showToast(i18n.t('copiedToast'));
        }
    }

    async function extractOcr(id) {
        const clip = state.clips.find(c => c.id === id);
        if (!clip) return;
        if (clip.qrData) {
            await navigator.clipboard.writeText(clip.qrData);
            showToast(`✓ ${clip.qrData}`);
            return;
        }
        if (clip.ocrText) {
            await navigator.clipboard.writeText(clip.ocrText);
            showToast(i18n.t('ocrCopiedToast'));
            return;
        }
        showToast(i18n.t('extractOcr'));
    }

    async function togglePin(id) {
        const clip = state.clips.find(c => c.id === id);
        if (!clip) return;
        clip.pinned = !clip.pinned;
        state.clips.sort((a, b) => (a.pinned === b.pinned ? b.timestamp - a.timestamp : a.pinned ? -1 : 1));
        await chrome.storage.local.set({ clips: state.clips });
        updateCounts();
        render();
    }

    async function deleteClip(id) {
        if (confirm(i18n.t('confirmDelete'))) {
            state.clips = state.clips.filter(c => c.id !== id);
            await chrome.storage.local.set({ clips: state.clips });
            updateCounts();
            render();
            showToast(i18n.t('deletedToast'));
        }
    }

    async function clearAll() {
        const unpinned = state.clips.filter(c => !c.pinned);
        if (unpinned.length === 0) return;
        if (confirm(i18n.t('confirmClearAll'))) {
            state.clips = state.clips.filter(c => c.pinned);
            await chrome.storage.local.set({ clips: state.clips });
            updateCounts();
            render();
            showToast(i18n.t('clearedToast', unpinned.length, unpinned.length === 1 ? '' : 's'));
        }
    }

    function openPreview(id) {
        const clip = state.clips.find(c => c.id === id);
        if (!clip) return;
        state.activePreviewClip = clip;
        if (clip.category === 'image' && clip.dataUrl) {
            previewImageEl.src = clip.dataUrl;
            previewImageContainer.style.display = 'block';
            previewContent.textContent = clip.ocrText || clip.qrData || `Image: ${clip.dimensions?.width || ''}×${clip.dimensions?.height || ''}`;
        } else {
            previewImageContainer.style.display = 'none';
            previewContent.textContent = clip.text;
        }
        previewModal.classList.add('open', 'show');
    }

    function closePreview() {
        previewModal.classList.remove('open', 'show');
        state.activePreviewClip = null;
    }

    function updateLanguageUI() {
        const loc = i18n.locale;
        if (langIndicator) langIndicator.textContent = loc.toUpperCase();
        if (languageToggle) languageToggle.title = `${i18n.t('language')}: ${loc.toUpperCase()}`;

        document.getElementById('appTitle').textContent = i18n.t('appTitle');
        document.getElementById('tabAllLabel').textContent = i18n.t('tabAll');
        document.getElementById('tabLinksLabel').textContent = i18n.t('tabLinks');
        document.getElementById('tabCodeLabel').textContent = i18n.t('tabCode');
        document.getElementById('tabImagesLabel').textContent = i18n.t('tabImages');
        document.getElementById('tabPinnedLabel').textContent = i18n.t('tabPinned');

        searchInput.placeholder = i18n.t('searchPlaceholder');
        refreshBtn.title = i18n.t('refresh');
        clearAllBtn.title = i18n.t('clearAll');
        settingsBtn.title = i18n.t('settings');
    }

    // --- Init ---
    const { theme } = await chrome.storage.local.get('theme');
    if (theme === 'light') document.body.classList.add('light-mode');

    document.querySelectorAll('.segment-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.filter = btn.getAttribute('data-tab');
            render();
        });
    });

    searchInput?.addEventListener('input', e => {
        state.searchTerm = e.target.value;
        if (clearSearchBtn) clearSearchBtn.style.display = state.searchTerm ? 'flex' : 'none';
        render();
    });

    clearSearchBtn?.addEventListener('click', () => {
        searchInput.value = '';
        state.searchTerm = '';
        clearSearchBtn.style.display = 'none';
        render();
    });

    themeToggle?.addEventListener('click', async () => {
        const isLight = document.body.classList.toggle('light-mode');
        await chrome.storage.local.set({ theme: isLight ? 'light' : 'dark' });
    });

    languageToggle?.addEventListener('click', async () => {
        await i18n.toggleLocale();
        updateLanguageUI();
        render();
    });

    refreshBtn?.addEventListener('click', async () => {
        const { clips } = await chrome.storage.local.get('clips');
        state.clips = clips || [];
        updateCounts();
        render();
    });

    clearAllBtn?.addEventListener('click', clearAll);
    previewCloseBtn?.addEventListener('click', closePreview);
    previewCopyBtn?.addEventListener('click', () => {
        if (state.activePreviewClip) {
            if (state.activePreviewClip.category === 'image') copyImageClip(state.activePreviewClip.id);
            else copyTextClip(state.activePreviewClip.id);
        }
    });

    settingsBtn?.addEventListener('click', () => settingsModal.classList.add('open', 'show'));
    settingsCloseBtn?.addEventListener('click', () => settingsModal.classList.remove('open', 'show'));

    exportBackupBtn?.addEventListener('click', async () => {
        const { clips, settings } = await chrome.storage.local.get(['clips', 'settings']);
        const backup = { app: 'PHP - Paste History Past', version: '2.0.0', exportedAt: Date.now(), clips: clips || [], settings };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `php-clipboard-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
    });

    importBackupBtn?.addEventListener('click', () => importFileInput.click());
    importFileInput?.addEventListener('change', e => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async evt => {
            try {
                const data = JSON.parse(evt.target.result);
                if (data && Array.isArray(data.clips)) {
                    state.clips = data.clips;
                    await chrome.storage.local.set({ clips: state.clips });
                    updateCounts();
                    render();
                    showToast(i18n.t('importSuccess', data.clips.length));
                    settingsModal.classList.remove('open', 'show');
                }
            } catch {
                showToast(i18n.t('importInvalid'), true);
            }
        };
        reader.readAsText(file);
    });

    // Check system clipboard upon open
    try {
        if (navigator.clipboard && navigator.clipboard.readText) {
            const text = await navigator.clipboard.readText();
            if (text && text.trim().length > 0) {
                const category = detectCategory(text);
                const { clips } = await chrome.storage.local.get('clips');
                let current = clips || [];
                const trimmed = text.trim();
                const existing = current.findIndex(c => c.text === trimmed);
                if (existing === -1) {
                    current.unshift({
                        id: Date.now(),
                        text: trimmed,
                        url: '',
                        timestamp: Date.now(),
                        pinned: false,
                        copyCount: 0,
                        lastCopied: null,
                        category
                    });
                    await chrome.storage.local.set({ clips: current });
                }
            }
        }
    } catch {}

    const { clips } = await chrome.storage.local.get('clips');
    state.clips = clips || [];
    updateLanguageUI();
    updateCounts();
    render();
});