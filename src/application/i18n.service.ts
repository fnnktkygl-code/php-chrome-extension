export type Locale = 'en' | 'fr';

export interface Translations {
  [key: string]: string;
}

export const TRANSLATIONS: Record<Locale, Translations> = {
  en: {
    // Header
    appTitle: 'PHP - Paste History Past',
    themeToggle: 'Toggle theme',
    clearAll: 'Clear all non-pinned',
    refresh: 'Refresh',
    settings: 'Settings',
    exportBackup: 'Export backup',
    importBackup: 'Import backup',

    // Tabs
    tabAll: 'All',
    tabLinks: 'Links',
    tabCode: 'Code',
    tabImages: 'Images',
    tabPinned: 'Pinned',

    // Search
    searchPlaceholder: 'Search your clips (Ctrl/Cmd + F)...',
    searchResults: '{0} result{1}',

    // Clip Actions
    preview: 'Preview full text',
    delete: 'Delete clip',
    pin: 'Pin clip',
    unpin: 'Unpin clip',
    clickToCopy: 'Click to copy',
    readMore: 'Read more',
    readLess: 'Read less',
    copyImage: 'Copy Image',
    extractOcr: 'Extract Text (OCR)',

    // Clip Meta
    justNow: 'just now',
    minutesAgo: '{0}m ago',
    hoursAgo: '{0}h ago',
    daysAgo: '{0}d ago',
    chars: '{0} chars',
    copiedTimes: 'Copied {0}x',

    // Categories
    categoryLink: 'Link',
    categoryCode: 'Code',
    categoryText: 'Text',
    categoryImage: 'Image',

    // Empty States
    emptyAllTitle: 'No clips yet',
    emptyAllText: 'Copy any text or code (Ctrl+C / Cmd+C) to save it locally & securely.',
    emptyLinksTitle: 'No links found',
    emptyLinksText: 'URLs and links you copy will appear here.',
    emptyCodeTitle: 'No code snippets',
    emptyCodeText: 'SVG, HTML, SQL queries and code snippets will appear here.',
    emptyImagesTitle: 'No images copied',
    emptyImagesText: 'Copy images or screenshots to collect them here.',
    emptyPinnedTitle: 'No pinned clips',
    emptyPinnedText: 'Pin important clips with the pin icon to prevent auto-deletion.',
    emptySearchTitle: 'No matches found',
    emptySearchText: 'Try searching for different keywords.',

    // Modals
    modalTitle: 'Full Preview',
    modalClose: 'Close',

    // Settings Group Titles & Items
    settingsModalTitle: 'Settings',
    groupGeneralTitle: 'GENERAL',
    themeSettingLabel: 'Theme',
    btnThemeDark: '🌙 Dark',
    btnThemeLight: '☀️ Light',
    languageSettingLabel: 'Language',
    btnLangFr: '🇫🇷 FR',
    btnLangEn: '🇬🇧 EN',
    groupQuickMenuTitle: 'QUICK MENU (OPTION + V)',
    quickMenuLimitLabel: 'Clip Capacity',
    quickMenuLimitDesc: 'Floating popup under cursor',
    quickPasteShortcutLabel: 'Menu Shortcut',
    quickPasteShortcutDesc: 'Popup under cursor',
    groupSnipTitle: 'SNIP & OCR',
    snipShortcutLabel: 'Snip Shortcut',
    snipShortcutDesc: 'Capture & extract text',
    groupPrivacyTitle: 'HISTORY & PRIVACY',
    saveUrlLabel: 'Save Source URL',
    saveUrlDesc: 'Associate origin website',
    ignorePasswordsLabel: 'Ignore Passwords',
    ignorePasswordsDesc: 'Skip sensitive password fields',
    maxClipsLabel: 'History Capacity',
    maxAgeLabel: 'Retention Period',
    opt1Day: '24 Hours',
    opt7Days: '7 Days',
    opt30Days: '30 Days',
    optNever: 'Keep Forever',
    groupBackupTitle: 'DATA & BACKUP',
    exportBtnText: 'Export JSON',
    importBtnText: 'Import JSON',
    importSuccess: 'Successfully imported {0} clips!',
    importInvalid: 'Invalid backup file format.',

    // Toast Notifications
    copiedToast: '✓ Copied to clipboard',
    imageCopiedToast: '✓ Image copied to clipboard',
    ocrCopiedToast: '✓ OCR text copied to clipboard',
    deletedToast: 'Clip deleted',
    clearedToast: 'Cleared {0} unpinned clip{1}',

    // Confirmations
    confirmDelete: 'Are you sure you want to delete this clip?',
    confirmClearAll: 'Clear all unpinned clips? Pinned clips will be kept.',

    // Snip & OCR Tool
    snipOcrBtn: 'Snip Area & OCR (Shutter)',
    snipPrompt: 'Drag a box around any image or text to copy • Press ESC to cancel',
    snipSuccessText: '✓ OCR text copied to clipboard!',
    snipSuccessImage: '✓ Cropped image copied to clipboard!',
    snipProcessing: 'Extracting OCR text...',
    snipRestrictedPage: '⚠️ Cannot snip Chrome system pages. Open any regular website (Google, GitHub, etc.) to use Snip & OCR.',
    snipHeaderLabel: 'Snip',

    // Shortcuts & Quick Menu
    shortcutsSectionTitle: 'Keyboard Shortcuts',
    configureShortcutsBtnText: 'Customize in Chrome Extensions',
    pressKeys: 'Press keys...',
    shortcutSaved: '✓ Shortcut saved!',
    shortcutReset: '✓ Shortcut reset to default!',
    quickPasteTitle: 'Recent Clips',
    quickPasteTip: '1-9 or ↑↓ Enter to copy • Type to filter',
    quickPasteViewAll: 'View all in PHP ↗',

    // Language
    language: 'Language',
    languageEnglish: 'English',
    languageFrench: 'Français'
  },

  fr: {
    // Header
    appTitle: 'PHP',
    snipHeaderLabel: 'Cadrer',
    themeToggle: 'Changer le thème',
    clearAll: 'Effacer les non-épinglés',
    refresh: 'Actualiser',
    settings: 'Paramètres',
    exportBackup: 'Exporter la sauvegarde',
    importBackup: 'Importer la sauvegarde',

    // Tabs
    tabAll: 'Tout',
    tabLinks: 'Liens',
    tabCode: 'Code',
    tabImages: 'Images',
    tabPinned: 'Épinglés',

    // Search
    searchPlaceholder: 'Rechercher dans vos clips & OCR (Ctrl/Cmd + F)...',
    searchResults: '{0} résultat{1}',

    // Clip Actions
    preview: 'Aperçu complet',
    delete: 'Supprimer le clip',
    pin: 'Épingler le clip',
    unpin: 'Désépingler le clip',
    clickToCopy: 'Cliquer pour copier',
    readMore: 'Lire plus',
    readLess: 'Lire moins',
    copyImage: "Copier l'image",
    extractOcr: 'Extraire le texte (OCR)',

    // Clip Meta
    justNow: "à l'instant",
    minutesAgo: 'il y a {0}m',
    hoursAgo: 'il y a {0}h',
    daysAgo: 'il y a {0}j',
    chars: '{0} caract.',
    copiedTimes: 'Copié {0}x',

    // Categories
    categoryLink: 'Lien',
    categoryCode: 'Code',
    categoryText: 'Texte',
    categoryImage: 'Image',
    categoryPinned: 'Épinglé',

    // Empty States
    emptyTitle: 'Aucun clip trouvé',
    emptyDesc: 'Copiez du texte ou une image depuis n\'importe quelle page web pour commencer.',
    emptyLinksTitle: 'Aucun lien trouvé',
    emptyLinksText: 'Les URLs et liens copiés apparaîtront ici.',
    emptyCodeTitle: 'Aucun extrait de code',
    emptyCodeText: 'Le code SVG, HTML, SQL et les commandes apparaîtront ici.',
    emptyImagesTitle: 'Aucune image copiée',
    emptyImagesText: 'Copiez des images ou captures pour les retrouver ici.',
    emptyPinnedTitle: 'Aucun clip épinglé',
    emptyPinnedText: 'Épinglez les clips importants pour empêcher leur suppression automatique.',
    emptySearchTitle: 'Aucun résultat trouvé',
    emptySearchText: 'Essayez un autre mot-clé.',

    // Modals
    modalTitle: 'Aperçu complet',
    modalClose: 'Fermer',

    // Settings Group Titles & Items
    settingsModalTitle: 'Paramètres',
    groupGeneralTitle: 'GÉNÉRAL',
    themeSettingLabel: 'Thème',
    btnThemeDark: '🌙 Sombre',
    btnThemeLight: '☀️ Clair',
    languageSettingLabel: 'Langue',
    btnLangFr: '🇫🇷 FR',
    btnLangEn: '🇬🇧 EN',
    groupQuickMenuTitle: 'MENU RAPIDE (OPTION + V)',
    quickMenuLimitLabel: 'Nombre d\'éléments',
    quickMenuLimitDesc: 'Dans le pop-up sous la souris',
    quickPasteShortcutLabel: 'Raccourci Menu',
    quickPasteShortcutDesc: 'Ouvre sous la souris',
    groupSnipTitle: 'CADRAGE & OCR',
    snipShortcutLabel: 'Raccourci Cadrage',
    snipShortcutDesc: 'Capture & extrait le texte',
    groupPrivacyTitle: 'HISTORIQUE & CONFIDENTIALITÉ',
    saveUrlLabel: 'Conserver l\'URL source',
    saveUrlDesc: 'Associe le site web au texte',
    ignorePasswordsLabel: 'Ignorer mots de passe',
    ignorePasswordsDesc: 'Sécurité des champs sensibles',
    maxClipsLabel: 'Capacité d\'historique',
    maxAgeLabel: 'Conservation',
    opt1Day: '24 Heures',
    opt7Days: '7 Jours',
    opt30Days: '30 Jours',
    optNever: 'Toujours',
    groupBackupTitle: 'DONNÉES & SAUVEGARDE',
    exportBtnText: 'Exporter JSON',
    importBtnText: 'Importer JSON',
    importSuccess: '{0} clips importés avec succès !',
    importInvalid: 'Format de fichier de sauvegarde invalide.',

    // Toast Notifications
    copiedToast: '✓ Copié dans le presse-papiers',
    imageCopiedToast: '✓ Image copiée dans le presse-papiers',
    ocrCopiedToast: '✓ Texte OCR copié dans le presse-papiers',
    deletedToast: 'Clip supprimé',
    clearedToast: '{0} clip{1} non-épinglé{1} effacé{1}',

    // Confirmations
    confirmDelete: 'Êtes-vous sûr de vouloir supprimer ce clip ?',
    confirmClearAll: 'Effacer tous les clips non épinglés ? Les épinglés seront conservés.',

    // Snip & OCR Tool
    snipOcrBtn: 'Cadrer & Copier le Texte (OCR)',
    snipPrompt: 'Cadrez la zone d\'image ou de texte à copier • Échap pour annuler',
    snipSuccessText: '✓ Texte OCR copié dans le presse-papiers !',
    snipSuccessImage: '✓ Zone d\'image copiée dans le presse-papiers !',
    snipProcessing: 'Extraction OCR du texte en cours...',
    snipRestrictedPage: '⚠️ Impossible de capturer les pages internes Chrome. Ouvrez un site web (Google, GitHub, etc.) pour utiliser le cadrage.',

    // Shortcuts & Quick Menu
    shortcutsSectionTitle: 'Raccourcis Clavier',
    configureShortcutsBtnText: 'Personnaliser dans Chrome',
    pressKeys: 'Appuyez sur des touches...',
    shortcutSaved: '✓ Raccourci enregistré !',
    shortcutReset: '✓ Raccourci réinitialisé !',
    quickPasteTitle: 'Clips Récents',
    quickPasteTip: '1-9 ou ↑↓ Entrée pour copier • Tapez pour filtrer',
    quickPasteViewAll: 'Voir tout dans PHP ↗',

    // Language
    language: 'Langue',
    languageEnglish: 'English',
    languageFrench: 'Français'
  }
};

export class I18nService {
  private currentLocale: Locale = 'en';

  constructor(initialLocale?: Locale) {
    if (initialLocale) {
      this.currentLocale = initialLocale;
    }
  }

  public setLocale(locale: Locale): void {
    this.currentLocale = locale;
  }

  public getLocale(): Locale {
    return this.currentLocale;
  }

  public detectBrowserLanguage(): Locale {
    if (typeof navigator !== 'undefined') {
      const browserLang = (navigator.language || '').toLowerCase();
      if (browserLang.startsWith('fr')) {
        return 'fr';
      }
    }
    return 'en';
  }

  public t(key: string, ...args: (string | number)[]): string {
    const localeDict = TRANSLATIONS[this.currentLocale] || TRANSLATIONS.en;
    let template = localeDict[key] || TRANSLATIONS.en[key] || key;

    args.forEach((arg, index) => {
      template = template.replace(new RegExp(`\\{${index}\\}`, 'g'), String(arg));
    });

    return template;
  }

  public formatRelativeTime(timestamp: number): string {
    const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (diffSeconds < 60) {
      return this.t('justNow');
    }
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return this.t('minutesAgo', diffMinutes);
    }
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return this.t('hoursAgo', diffHours);
    }
    const diffDays = Math.floor(diffHours / 24);
    return this.t('daysAgo', diffDays);
  }
}
