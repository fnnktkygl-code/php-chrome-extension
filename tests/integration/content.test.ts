import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupMockChrome } from '../../src/infrastructure/mock-chrome';

describe('Content Script Integration', () => {
  let mockChrome: ReturnType<typeof setupMockChrome>;

  beforeEach(async () => {
    mockChrome = setupMockChrome();
    document.body.innerHTML = `
      <div>
        <input type="text" id="normalInput" value="public text">
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
});
