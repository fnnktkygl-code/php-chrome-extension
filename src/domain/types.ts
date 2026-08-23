/**
 * Core Domain Types for PHP - Paste History Past
 */

export type ClipCategory = 'text' | 'link' | 'code' | 'image';

export interface Clip {
  id: number;
  text: string;
  url: string;
  timestamp: number;
  pinned: boolean;
  copyCount: number;
  lastCopied: number | null;
  category: ClipCategory;
  dataUrl?: string;
  dimensions?: { width: number; height: number };
  ocrText?: string;
  qrData?: string;
}

export interface ShortcutConfig {
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  code: string;
  key: string;
  display: string;
}

export interface Settings {
  saveUrl: boolean;
  maxClips: number;
  maxAgeMs: number; // 0 = never expire
  theme: 'dark' | 'light';
  locale: 'en' | 'fr';
  ignorePasswords: boolean;
  shortcuts?: {
    snip?: ShortcutConfig;
    quickPaste?: ShortcutConfig;
  };
}

export type FilterMode = 'all' | 'links' | 'code' | 'images' | 'pinned';

export interface ExportData {
  app: 'PHP - Paste History Past';
  version: string;
  exportedAt: number;
  clips: Clip[];
  settings?: Settings;
}

export type RuntimeMessage =
  | {
      type: 'CLIPBOARD_COPY';
      text: string;
      url: string;
      timestamp: number;
      category?: ClipCategory;
      dataUrl?: string;
      dimensions?: { width: number; height: number };
      ocrText?: string;
      qrData?: string;
    }
  | {
      type: 'SETTINGS_CHANGED';
    }
  | {
      type: 'GET_CLIPS';
    }
  | {
      type: 'DELETE_CLIP';
      id: number;
    }
  | {
      type: 'TOGGLE_PIN';
      id: number;
    }
  | {
      type: 'CLEAR_CLIPS';
    }
  | {
      type: 'EXPORT_BACKUP';
    }
  | {
      type: 'IMPORT_BACKUP';
      data: ExportData;
    }
  | {
      type: 'START_SNIP_OCR';
    }
  | {
      type: 'CAPTURE_TAB_VIEWPORT';
    }
  | {
      type: 'ACTIVATE_SNIPPER';
    };

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  saveUrl: true,
  maxClips: 50,
  maxAgeMs: 24 * 60 * 60 * 1000, // 24 hours
  theme: 'dark',
  locale: 'en',
  ignorePasswords: true
};

export const MAX_CLIP_LENGTH = 20000;
