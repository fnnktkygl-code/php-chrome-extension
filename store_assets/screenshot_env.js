// screenshot_env.js

const sampleClips = [
    {
        id: 1,
        text: "git commit -m \"feat: initial commit\"",
        timestamp: Date.now() - 1000 * 60 * 2, // 2 mins ago
        pinned: true,
        copyCount: 5
    },
    {
        id: 2,
        text: "https://github.com/fnnktkygl-code/php-chrome-extension",
        timestamp: Date.now() - 1000 * 60 * 15, // 15 mins ago
        pinned: true,
        copyCount: 12
    },
    {
        id: 3,
        text: "npm install react-dom framer-motion",
        timestamp: Date.now() - 1000 * 60 * 45, // 45 mins ago
        pinned: false,
        copyCount: 1
    },
    {
        id: 4,
        text: "Meeting notes:\n- Discuss Q4 roadmap\n- Review PR #45\n- Deploy to staging",
        timestamp: Date.now() - 1000 * 60 * 120, // 2 hours ago
        pinned: false,
        copyCount: 0
    },
    {
        id: 5,
        text: "https://developer.chrome.com/docs/extensions/mv3/intro/",
        timestamp: Date.now() - 1000 * 60 * 60 * 5, // 5 hours ago
        pinned: false,
        copyCount: 3
    },
    {
        id: 6,
        text: "Just wanted to follow up on our conversation yesterday regarding the detailed specs.",
        timestamp: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
        pinned: false,
        copyCount: 0
    }
];

const mockStorage = {
    clips: sampleClips,
    theme: 'dark', // Force Dark Mode
    locale: 'en'
};

window.chrome = {
    storage: {
        local: {
            get: (key) => {
                if (typeof key === 'string') {
                    return Promise.resolve({ [key]: mockStorage[key] });
                }
                // Return all if no key (or list of keys)
                return Promise.resolve(mockStorage);
            },
            set: (obj) => {
                Object.assign(mockStorage, obj);
                return Promise.resolve();
            }
        }
    },
    runtime: {
        sendMessage: () => Promise.resolve()
    }
};

// Mock clipboard
navigator.clipboard = {
    readText: () => Promise.resolve(""),
    writeText: () => Promise.resolve()
};
