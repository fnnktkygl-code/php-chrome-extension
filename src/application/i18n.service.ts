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

    // Clip Meta
    justNow: 'just now',
    minutesAgo: '{0}m ago',
    hoursAgo: '{0}h ago',
    daysAgo: '{0}d ago',
    chars: '{0} chars',
    copiedTimes: 'Copied {0}x',

    // Categories
    categoryLink: '🔗 Link',
    categoryCode: '💻 Code',
    categoryText: '📝 Text',

    // Empty States
    emptyAllTitle: 'No clips yet',
    emptyAllText: 'Copy any text (Ctrl+C / Cmd+C) to save it locally & securely.',
    emptyLinksTitle: 'No links found',
    emptyLinksText: 'URLs and links you copy will appear here.',
    emptyCodeTitle: 'No code snippets',
    emptyCodeText: 'Commands, SQL queries and code snippets will appear here.',
    emptyPinnedTitle: 'No pinned clips',
    emptyPinnedText: 'Pin important clips with the pin icon to prevent auto-deletion.',
    emptySearchTitle: 'No matches found',
    emptySearchText: 'Try searching for different keywords.',

    // Modals
    modalTitle: 'Full Preview',
    modalClose: 'Close',
    settingsTitle: 'Extension Settings',
    saveUrlLabel: 'Save source website URL',
    maxClipsLabel: 'Maximum clips in history',
    maxAgeLabel: 'Clip retention period',
    ignorePasswordsLabel: 'Ignore sensitive fields & passwords',
    expiry1Day: '24 Hours',
    expiry7Days: '7 Days',
    expiry30Days: '30 Days',
    expiryNever: 'Never (Keep forever)',

    // Backup & Data
    backupSectionTitle: 'Backup & Restore',
    exportBtnText: 'Export History (JSON)',
    importBtnText: 'Import History (JSON)',
    importSuccess: 'Successfully imported {0} clips!',
    importInvalid: 'Invalid backup file format.',

    // Toast Notifications
    copiedToast: '✓ Copied to clipboard',
    deletedToast: 'Clip deleted',
    clearedToast: 'Cleared {0} unpinned clip{1}',

    // Confirmations
    confirmDelete: 'Are you sure you want to delete this clip?',
    confirmClearAll: 'Clear all unpinned clips? Pinned clips will be kept.',

    // Language
    language: 'Language',
    languageEnglish: 'English',
    languageFrench: 'Français'
  },

  fr: {
    // Header
    appTitle: 'PHP - Historique de Collage',
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
    tabPinned: 'Épinglés',

    // Search
    searchPlaceholder: 'Rechercher dans vos clips (Ctrl/Cmd + F)...',
    searchResults: '{0} résultat{1}',

    // Clip Actions
    preview: 'Aperçu complet',
    delete: 'Supprimer le clip',
    pin: 'Épingler le clip',
    unpin: 'Désépingler le clip',
    clickToCopy: 'Cliquer pour copier',
    readMore: 'Lire plus',
    readLess: 'Lire moins',

    // Clip Meta
    justNow: "à l'instant",
    minutesAgo: 'il y a {0}m',
    hoursAgo: 'il y a {0}h',
    daysAgo: 'il y a {0}j',
    chars: '{0} caract.',
    copiedTimes: 'Copié {0}x',

    // Categories
    categoryLink: '🔗 Lien',
    categoryCode: '💻 Code',
    categoryText: '📝 Texte',

    // Empty States
    emptyAllTitle: 'Aucun clip pour le moment',
    emptyAllText: 'Copiez du texte (Ctrl+C / Cmd+C) pour le sauvegarder localement.',
    emptyLinksTitle: 'Aucun lien trouvé',
    emptyLinksText: 'Les URLs et liens copiés apparaîtront ici.',
    emptyCodeTitle: 'Aucun extrait de code',
    emptyCodeText: 'Les commandes, requêtes SQL et codes copiés apparaîtront ici.',
    emptyPinnedTitle: 'Aucun clip épinglé',
    emptyPinnedText: 'Épinglez les clips importants pour empêcher leur suppression automatique.',
    emptySearchTitle: 'Aucun résultat trouvé',
    emptySearchText: 'Essayez un autre mot-clé.',

    // Modals
    modalTitle: 'Aperçu complet',
    modalClose: 'Fermer',
    settingsTitle: 'Paramètres',
    saveUrlLabel: "Enregistrer l'URL source du site",
    maxClipsLabel: "Limite max d'éléments",
    maxAgeLabel: 'Durée de conservation',
    ignorePasswordsLabel: 'Ignorer les mots de passe et champs sensibles',
    expiry1Day: '24 Heures',
    expiry7Days: '7 Jours',
    expiry30Days: '30 Jours',
    expiryNever: 'Jamais (Garder pour toujours)',

    // Backup & Data
    backupSectionTitle: 'Sauvegarde & Restauration',
    exportBtnText: 'Exporter l’historique (JSON)',
    importBtnText: 'Importer l’historique (JSON)',
    importSuccess: '{0} clips importés avec succès !',
    importInvalid: 'Format de fichier de sauvegarde invalide.',

    // Toast Notifications
    copiedToast: '✓ Copié dans le presse-papiers',
    deletedToast: 'Clip supprimé',
    clearedToast: '{0} clip{1} non-épinglé{1} effacé{1}',

    // Confirmations
    confirmDelete: 'Êtes-vous sûr de vouloir supprimer ce clip ?',
    confirmClearAll: 'Effacer tous les clips non épinglés ? Les épinglés seront conservés.',

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
