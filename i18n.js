// i18n.js - Enhanced Internationalization system

const translations = {
  en: {
    // Header
    appTitle: "PHP - Paste History Past",
    themeToggle: "Toggle theme",
    clearAll: "Clear all",
    
    // Tabs
    tabAll: "All",
    tabLinks: "Links",
    tabPinned: "Pinned",
    
    // Search
    searchPlaceholder: "Search your clips...",
    
    // Clip Actions
    preview: "Preview",
    delete: "Delete clip",
    pin: "Pin clip",
    unpin: "Unpin clip",
    clickToCopy: "Click to copy",
    readMore: "Read more",
    readLess: "Read less",
    
    // Clip Meta
    justNow: "just now",
    minutesAgo: "{0}m ago",
    hoursAgo: "{0}h ago",
    daysAgo: "{0}d ago",
    chars: "{0} chars",
    
    // Categories
    categoryLink: "🔗 Link",
    categoryText: "📝 Text",
    
    // Empty States
    emptyAllTitle: "No clips yet",
    emptyAllText: "Copy some text and watch the magic happen.<br>Your clips are saved locally & securely.",
    emptyLinksTitle: "No links found",
    emptyLinksText: "Links you copy will appear in this tab.",
    emptyPinnedTitle: "No pinned clips",
    emptyPinnedText: "Pin important clips to keep them forever.",
    emptySearchTitle: "No matches found",
    emptySearchText: "Try a different search term.",
    
    // Modal
    modalTitle: "Full Preview",
    
    // Toast
    copiedToast: "✓ Copied to clipboard",
    
    // Confirmations
    confirmDelete: "Are you sure you want to delete this clip?",
    confirmClearAll: "Clear all non-pinned clips? This cannot be undone.",
    
    // Language
    language: "Language",
    languageEnglish: "English",
    languageFrench: "Français",
    
    // Settings
    settingsTitle: "Settings",
    saveUrlLabel: "Save source URL",
    maxClipsLabel: "Max clips limit",
    maxAgeLabel: "Clip retention period",
    expiry1Day: "1 Day",
    expiry7Days: "7 Days",
    expiry30Days: "30 Days",
    expiryNever: "Never"
  },
  
  fr: {
    // Header
    appTitle: "PHP - Historique de Collage",
    themeToggle: "Changer le thème",
    clearAll: "Tout effacer",
    
    // Tabs
    tabAll: "Tout",
    tabLinks: "Liens",
    tabPinned: "Épinglés",
    
    // Search
    searchPlaceholder: "Rechercher dans vos clips...",
    
    // Clip Actions
    preview: "Aperçu",
    delete: "Supprimer le clip",
    pin: "Épingler le clip",
    unpin: "Désépingler le clip",
    clickToCopy: "Cliquer pour copier",
    readMore: "Lire plus",
    readLess: "Lire moins",
    
    // Clip Meta
    justNow: "à l'instant",
    minutesAgo: "il y a {0}m",
    hoursAgo: "il y a {0}h",
    daysAgo: "il y a {0}j",
    chars: "{0} caract.",
    
    // Categories
    categoryLink: "🔗 Lien",
    categoryText: "📝 Texte",
    
    // Empty States
    emptyAllTitle: "Aucun clip pour le moment",
    emptyAllText: "Copiez du texte et regardez la magie opérer.<br>Vos clips sont sauvegardés localement et en toute sécurité.",
    emptyLinksTitle: "Aucun lien trouvé",
    emptyLinksText: "Les liens que vous copiez apparaîtront dans cet onglet.",
    emptyPinnedTitle: "Aucun clip épinglé",
    emptyPinnedText: "Épinglez les clips importants pour les garder pour toujours.",
    emptySearchTitle: "Aucun résultat",
    emptySearchText: "Essayez un autre terme de recherche.",
    
    // Modal
    modalTitle: "Aperçu complet",
    
    // Toast
    copiedToast: "✓ Copié dans le presse-papiers",
    
    // Confirmations
    confirmDelete: "Êtes-vous sûr de vouloir supprimer ce clip ?",
    confirmClearAll: "Effacer tous les clips non épinglés ? Cette action est irréversible.",
    
    // Language
    language: "Langue",
    languageEnglish: "English",
    languageFrench: "Français",
    
    // Settings
    settingsTitle: "Paramètres",
    saveUrlLabel: "Enregistrer l'URL source",
    maxClipsLabel: "Limite max de clips",
    maxAgeLabel: "Durée de conservation",
    expiry1Day: "1 jour",
    expiry7Days: "7 jours",
    expiry30Days: "30 jours",
    expiryNever: "Jamais"
  }
};

class I18n {
  constructor() {
    this.currentLocale = 'en';
    this.translations = translations;
  }

  async init() {
    const { locale } = await chrome.storage.local.get('locale');
    this.currentLocale = locale || this.detectBrowserLanguage();
    await chrome.storage.local.set({ locale: this.currentLocale });
  }

  detectBrowserLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;
    return browserLang.startsWith('fr') ? 'fr' : 'en';
  }

  async setLocale(locale) {
    this.currentLocale = locale;
    await chrome.storage.local.set({ locale });
  }

  t(key, ...args) {
    let text = this.translations[this.currentLocale]?.[key] || this.translations.en[key] || key;
    
    // Replace placeholders {0}, {1}, etc.
    args.forEach((arg, index) => {
      text = text.replace(`{${index}}`, arg);
    });
    
    return text;
  }

  getCurrentLocale() {
    return this.currentLocale;
  }
}

// Export for use in popup.js
const i18n = new I18n();