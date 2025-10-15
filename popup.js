document.addEventListener('DOMContentLoaded', () => {
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
            themeToggle.textContent = '☀️';
        }

        const { clips } = await chrome.storage.local.get('clips');
        state.clips = clips || [];
        
        render();
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
        modalOverlay.addEventListener('click', closeModal);
        modalClose.addEventListener('click', closeModal);
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
            await navigator.clipboard.writeText(clip.text);
            showToast();
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
        if (confirm('Are you sure you want to delete this clip?')) {
            state.clips = state.clips.filter(c => c.id !== clipId);
            await saveClips();
            render();
        }
    }

    async function clearAllUnpinned() {
        if (confirm('Clear all non-pinned clips? This cannot be undone.')) {
            state.clips = state.clips.filter(c => c.pinned);
            await saveClips();
            render();
        }
    }
    
    async function toggleTheme() {
        document.body.classList.toggle('light-mode');
        const isLight = document.body.classList.contains('light-mode');
        themeToggle.textContent = isLight ? '☀️' : '🌙';
        await chrome.storage.local.set({ theme: isLight ? 'light' : 'dark' });
    }

    function showPreview(clipId) {
        const clip = state.clips.find(c => c.id === clipId);
        if (clip) {
            modalText.textContent = clip.text;
            modalOverlay.classList.add('show');
        }
    }

    function closeModal(e) {
        if (e.target === modalOverlay || e.target === modalClose) {
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
            if (!b.pinned && a.pinned) return 1;
            return b.timestamp - a.timestamp;
        });
    }

    function saveClips() {
        return chrome.storage.local.set({ clips: state.clips });
    }
    
    function showToast() {
        const toast = document.getElementById('copiedToast');
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }

    function timeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    }

    function escapeHtml(text) {
        const p = document.createElement('p');
        p.textContent = text;
        return p.innerHTML;
    }

    // --- HTML Generators ---

    function createClipItemHTML(clip) {
        const isLinkClip = isLink(clip.text);
        const colorClass = `color-${clip.id % 10}`;
        const pinnedClass = clip.pinned ? 'pinned' : '';

        return `
        <div class="clip-item ${pinnedClass} ${colorClass}" data-id="${clip.id}" data-action="copy" title="Click to copy">
            <div class="clip-header">
                <div class="clip-category">${isLinkClip ? '🔗 Link' : '📝 Text'}</div>
                <div class="clip-actions">
                    <button class="clip-action-btn preview" data-id="${clip.id}" data-action="preview" title="Preview">👁️</button>
                    <button class="clip-action-btn delete" data-id="${clip.id}" data-action="delete" title="Delete clip">🗑️</button>
                    <button class="clip-action-btn ${pinnedClass}" data-id="${clip.id}" data-action="pin" title="Pin clip">📌</button>
                </div>
            </div>
            <div class="clip-text">${escapeHtml(clip.text)}</div>
            <div class="clip-meta">
                <span>${timeAgo(clip.timestamp)}</span>
                <span>•</span>
                <span>${clip.text.length} chars</span>
            </div>
        </div>`;
    }

    function createEmptyStateHTML() {
        const messages = {
            all: { icon: '📝', title: 'No clips yet', text: 'Copy some text and watch the magic happen.<br>Your clips are saved locally & securely.'},
            links: { icon: '🔗', title: 'No links found', text: 'Links you copy will appear in this tab.' },
            pinned: { icon: '📌', title: 'No pinned clips', text: 'Pin important clips to keep them forever.'},
            search: { icon: '🧐', title: 'No matches found', text: 'Try a different search term.'}
        };

        const key = state.searchTerm ? 'search' : state.filter;
        const msg = messages[key];
        
        return `
        <div class="empty-state">
          <div class="empty-state-icon">${msg.icon}</div>
          <h2>${msg.title}</h2>
          <p>${msg.text}</p>
        </div>`;
    }

    // --- Initialize ---
    initialize();
});

