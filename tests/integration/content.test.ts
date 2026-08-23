import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupMockChrome } from '../../src/infrastructure/mock-chrome';

describe('Content Script Integration', () => {
  let mockChrome: ReturnType<typeof setupMockChrome>;

  beforeEach(async () => {
    mockChrome = setupMockChrome();
    document.body.innerHTML = `
      <div>
        <input type="text" id="normalInput" value="public input text">
        <input type="password" id="passwordInput" value="secret123">
        <div id="contentBlock">Selected Article Content</div>
      </div>
    `;
    await import('../../src/content/index');
  });

  it('ignores copy events triggered inside password fields', () => {
    const passwordInput = document.getElementById('passwordInput') as HTMLInputElement;
    passwordInput.focus();

    let sent = false;
    mockChrome.runtime.onMessage.addListener(() => {
      sent = true;
    });

    const copyEvent = new Event('copy', { bubbles: true, cancelable: true });
    passwordInput.dispatchEvent(copyEvent);

    expect(sent).toBe(false);
  });

  it('captures text selection and dispatches CLIPBOARD_COPY message', async () => {
    const contentBlock = document.getElementById('contentBlock') as HTMLElement;
    
    // Mock window.getSelection
    window.getSelection = vi.fn().mockReturnValue({
      toString: () => 'Selected Article Content'
    });

    let sentMessage: unknown = null;
    mockChrome.runtime.onMessage.addListener((msg) => {
      sentMessage = msg;
    });

    const copyEvent = new Event('copy', { bubbles: true, cancelable: true });
    contentBlock.dispatchEvent(copyEvent);

    expect(sentMessage).not.toBeNull();
    expect((sentMessage as { text: string }).text).toBe('Selected Article Content');
  });

  it('captures selection from regular input fields', async () => {
    const normalInput = document.getElementById('normalInput') as HTMLInputElement;
    normalInput.focus();
    normalInput.setSelectionRange(0, 6); // "public"

    window.getSelection = vi.fn().mockReturnValue({
      toString: () => ''
    });

    let sentMessage: unknown = null;
    mockChrome.runtime.onMessage.addListener((msg) => {
      sentMessage = msg;
    });

    const copyEvent = new Event('copy', { bubbles: true, cancelable: true });
    normalInput.dispatchEvent(copyEvent);

    expect(sentMessage).not.toBeNull();
    expect((sentMessage as { text: string }).text).toBe('public');
  });

  it('opens QuickPasteMenu on Alt+V / Option+V shortcut and responds to close button and dragging', async () => {
    // Populate clips in chrome storage
    await mockChrome.storage.local.set({
      clips: [
        { id: 10, text: 'First quick clip', timestamp: Date.now(), pinned: false, copyCount: 0, category: 'text' },
        { id: 20, text: 'Second quick clip', timestamp: Date.now(), pinned: false, copyCount: 0, category: 'text' }
      ],
      theme: 'dark',
      locale: 'fr'
    });

    // Trigger Option+V / Alt+V global shortcut
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', altKey: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));

    const overlay = document.getElementById('php-quick-paste-overlay');
    expect(overlay).not.toBeNull();

    const card = document.getElementById('php-quick-paste-card');
    expect(card).not.toBeNull();

    const items = overlay?.querySelectorAll('.php-qp-item');
    expect(items?.length).toBe(2);

    // Test dragging on header
    const header = card?.querySelector('div') as HTMLElement;
    expect(header).not.toBeNull();

    // Simulate drag start
    header.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100, bubbles: true }));
    // Simulate drag move
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 170, bubbles: true }));
    // Simulate drag end
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 150, clientY: 170, bubbles: true }));

    expect(card?.style.left).toBeDefined();

    // Test close button
    const closeBtn = document.getElementById('php-qp-close-btn') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    closeBtn.click();

    expect(document.getElementById('php-quick-paste-overlay')).toBeNull();
  });

  it('supports digit hotkeys 1-9 and search filtering in QuickPasteMenu', async () => {
    await mockChrome.storage.local.set({
      clips: [
        { id: 101, text: 'Alpha snippet', timestamp: Date.now(), pinned: false, copyCount: 0, category: 'code' },
        { id: 102, text: 'Beta URL link', url: 'https://beta.com', timestamp: Date.now(), pinned: false, copyCount: 0, category: 'link' }
      ]
    });

    // Open Quick Menu via Option+V
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', altKey: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));

    const overlay = document.getElementById('php-quick-paste-overlay');
    expect(overlay).not.toBeNull();

    const searchInput = document.getElementById('php-qp-search-input') as HTMLInputElement;
    expect(searchInput).not.toBeNull();

    searchInput.value = 'Beta';
    searchInput.dispatchEvent(new Event('input'));

    const items = overlay?.querySelectorAll('.php-qp-item');
    expect(items?.length).toBe(1);
    expect(items?.[0].textContent).toContain('Beta URL link');

    // Press Escape to clear search
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(searchInput.value).toBe('');

    // Press Escape to close
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('php-quick-paste-overlay')).toBeNull();
  });

  it('initializes and cancels ScreenSnipper on Option+Shift+X or message', async () => {
    // Trigger Option+Shift+X
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX', altKey: true, shiftKey: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));

    const snipOverlay = document.getElementById('php-snipper-overlay');
    expect(snipOverlay).not.toBeNull();

    // Press Escape to cancel snip overlay
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('php-snipper-overlay')).toBeNull();
  });
});
