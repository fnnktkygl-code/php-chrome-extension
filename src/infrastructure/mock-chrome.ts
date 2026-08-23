/**
 * Comprehensive Chrome Extension API Mock for testing and headless environments.
 */

export class MockChromeStorageArea {
  private data: Record<string, unknown> = {};

  public async get(keys: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>> {
    if (keys === null) {
      return { ...this.data };
    }
    if (typeof keys === 'string') {
      return { [keys]: this.data[keys] };
    }
    if (Array.isArray(keys)) {
      const res: Record<string, unknown> = {};
      for (const k of keys) {
        if (this.data[k] !== undefined) {
          res[k] = this.data[k];
        }
      }
      return res;
    }
    const res: Record<string, unknown> = {};
    for (const [k, defaultVal] of Object.entries(keys)) {
      res[k] = this.data[k] !== undefined ? this.data[k] : defaultVal;
    }
    return res;
  }

  public async set(items: Record<string, unknown>): Promise<void> {
    this.data = { ...this.data, ...items };
  }

  public async remove(keys: string | string[]): Promise<void> {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const k of list) {
      delete this.data[k];
    }
  }

  public async clear(): Promise<void> {
    this.data = {};
  }
}

export function setupMockChrome() {
  const localStorage = new MockChromeStorageArea();
  const listeners: Array<(message: unknown, sender: unknown, sendResponse: (res: unknown) => void) => boolean | void> = [];
  const alarmListeners: Array<(alarm: { name: string }) => void> = [];
  const installedListeners: Array<() => void> = [];
  const startupListeners: Array<() => void> = [];

  let badgeText = '';
  let badgeColor = '';

  const mockChrome = {
    storage: {
      local: localStorage
    },
    runtime: {
      onMessage: {
        addListener(fn: (message: unknown, sender: unknown, sendResponse: (res: unknown) => void) => boolean | void) {
          listeners.push(fn);
        },
        removeListener(fn: (message: unknown, sender: unknown, sendResponse: (res: unknown) => void) => boolean | void) {
          const idx = listeners.indexOf(fn);
          if (idx !== -1) listeners.splice(idx, 1);
        },
        _listeners: listeners
      },
      onInstalled: {
        addListener(fn: () => void) {
          installedListeners.push(fn);
        },
        _listeners: installedListeners
      },
      onStartup: {
        addListener(fn: () => void) {
          startupListeners.push(fn);
        },
        _listeners: startupListeners
      },
      sendMessage: async (message: unknown) => {
        let finalResponse: unknown = undefined;

        for (const listener of listeners) {
          await new Promise<void>((resolve) => {
            let isAsync = false;
            const sendResponse = (resVal: unknown) => {
              finalResponse = resVal;
              resolve();
            };

            const result = listener(message, {}, sendResponse);
            if (result === true) {
              isAsync = true;
            }

            if (!isAsync) {
              resolve();
            }
          });
        }
        return finalResponse;
      },
      getURL: (path: string) => `chrome-extension://mock-id/${path}`
    },
    action: {
      setBadgeText: async ({ text }: { text: string }) => {
        badgeText = text;
      },
      setBadgeBackgroundColor: async ({ color }: { color: string }) => {
        badgeColor = color;
      },
      _getBadgeText: () => badgeText,
      _getBadgeColor: () => badgeColor
    },
    alarms: {
      create: (_name: string, _info: unknown) => {},
      onAlarm: {
        addListener(fn: (alarm: { name: string }) => void) {
          alarmListeners.push(fn);
        },
        _listeners: alarmListeners
      }
    },
    notifications: {
      create: (_options: unknown) => {}
    }
  };

  (globalThis as unknown as { chrome: typeof mockChrome }).chrome = mockChrome;
  return mockChrome;
}
