// i18n.js - Localization

const translations = {
    en: {
        appTitle: "PHP - Paste History Past",
        themeToggle: "Toggle theme",
        clearAll: "Clear all non-pinned",
        refresh: "Refresh",
        settings: "Settings",
        exportBackup: "Export backup",
        importBackup: "Import backup",

        // Tabs
        tabAll: "All",
        tabLinks: "Links",
        tabCode: "Code",
        tabImages: "Images",
        tabPinned: "Pinned",

        // Search
        searchPlaceholder: "Search your clips & OCR (Ctrl/Cmd + F)...",
        searchResults: "{0} result{1}",

        // Clip Actions
        preview: "Preview full text",
        delete: "Delete clip",
        pin: "Pin clip",
        unpin: "Unpin clip",
        clickToCopy: "Click to copy",
        readMore: "Read more",
        readLess: "Read less",
        copyImage: "Copy Image",
        extractOcr: "Extract Text (OCR)",

        // Categories
        categoryLink: "Link",
        categoryCode: "Code",
        categoryText: "Text",
        categoryImage: "Image",

        // Modals
        modalTitle: "Full Preview",
        modalClose: "Close",
        settingsTitle: "Extension Settings",
        saveUrlLabel: "Save source website URL",
        maxClipsLabel: "Maximum clips in history",
        maxAgeLabel: "Clip retention period",
        ignorePasswordsLabel: "Ignore sensitive fields & passwords",
        expiry1Day: "24 Hours",
        expiry7Days: "7 Days",
        expiry30Days: "30 Days",
        expiryNever: "Never (Keep forever)",

        // Backup
        backupSectionTitle: "Backup & Restore",
        exportBtnText: "Export History (JSON)",
        importBtnText: "Import History (JSON)",
        importSuccess: "Successfully imported {0} clips!",
        importInvalid: "Invalid backup file format.",

        // Toasts
        copiedToast: "✓ Copied to clipboard",
        imageCopiedToast: "✓ Image copied to clipboard",
        ocrCopiedToast: "✓ OCR text copied to clipboard",
        deletedToast: "Clip deleted",
        clearedToast: "Cleared {0} unpinned clip{1}",

        // Confirmations
        confirmDelete: "Are you sure you want to delete this clip?",
        confirmClearAll: "Clear all unpinned clips? Pinned clips will be kept.",

        // Snip & OCR Tool
        snipOcrBtn: "Snip Area & OCR (Shutter)",
        snipPrompt: "Drag a box around any image or text to copy • Press ESC to cancel",
        snipSuccessText: "✓ OCR text copied to clipboard!",
        snipSuccessImage: "✓ Cropped image copied to clipboard!",
        snipProcessing: "Extracting OCR text...",

        // Language
        language: "Language",
        languageEnglish: "English",
        languageFrench: "Français"
    },
    fr: {
        appTitle: "PHP - Historique de Collage",
        themeToggle: "Changer le thème",
        clearAll: "Effacer les non-épinglés",
        refresh: "Actualiser",
        settings: "Paramètres",
        exportBackup: "Exporter la sauvegarde",
        importBackup: "Importer la sauvegarde",

        // Tabs
        tabAll: "Tout",
        tabLinks: "Liens",
        tabCode: "Code",
        tabImages: "Images",
        tabPinned: "Épinglés",

        // Search
        searchPlaceholder: "Rechercher dans vos clips & OCR (Ctrl/Cmd + F)...",
        searchResults: "{0} résultat{1}",

        // Clip Actions
        preview: "Aperçu complet",
        delete: "Supprimer le clip",
        pin: "Épingler le clip",
        unpin: "Désépingler le clip",
        clickToCopy: "Cliquer pour copier",
        readMore: "Lire plus",
        readLess: "Lire moins",
        copyImage: "Copier l'image",
        extractOcr: "Extraire le texte (OCR)",

        // Categories
        categoryLink: "Lien",
        categoryCode: "Code",
        categoryText: "Texte",
        categoryImage: "Image",

        // Modals
        modalTitle: "Aperçu complet",
        modalClose: "Fermer",
        settingsTitle: "Paramètres",
        saveUrlLabel: "Enregistrer l'URL source du site",
        maxClipsLabel: "Limite max d'éléments",
        maxAgeLabel: "Durée de conservation",
        ignorePasswordsLabel: "Ignorer les mots de passe et champs sensibles",
        expiry1Day: "24 Heures",
        expiry7Days: "7 Jours",
        expiry30Days: "30 Jours",
        expiryNever: "Jamais (Garder pour toujours)",

        // Backup
        backupSectionTitle: "Sauvegarde & Restauration",
        exportBtnText: "Exporter l’historique (JSON)",
        importBtnText: "Importer l’historique (JSON)",
        importSuccess: "{0} clips importés avec succès !",
        importInvalid: "Format de fichier de sauvegarde invalide.",

        // Toasts
        copiedToast: "✓ Copié dans le presse-papiers",
        imageCopiedToast: "✓ Image copiée dans le presse-papiers",
        ocrCopiedToast: "✓ Texte OCR copié dans le presse-papiers",
        deletedToast: "Clip supprimé",
        clearedToast: "{0} clip{1} non-épinglé{1} effacé{1}",

        // Confirmations
        confirmDelete: "Êtes-vous sûr de vouloir supprimer ce clip ?",
        confirmClearAll: "Effacer tous les clips non épinglés ? Les épinglés seront conservés.",

        // Snip & OCR Tool
        snipOcrBtn: "Cadrer & Copier le Texte (OCR)",
        snipPrompt: "Cadrez la zone d'image ou de texte à copier • Échap pour annuler",
        snipSuccessText: "✓ Texte OCR copié dans le presse-papiers !",
        snipSuccessImage: "✓ Zone d'image copiée dans le presse-papiers !",
        snipProcessing: "Extraction OCR du texte en cours...",

        // Language
        language: "Langue",
        languageEnglish: "English",
        languageFrench: "Français"
    }
};

class I18n {
    constructor() {
        this.locale = 'en';
    }

    async init() {
        const { locale } = await chrome.storage.local.get('locale');
        if (locale) {
            this.locale = locale;
        } else {
            const browserLang = navigator.language || 'en';
            this.locale = browserLang.startsWith('fr') ? 'fr' : 'en';
            await chrome.storage.local.set({ locale: this.locale });
        }
    }

    t(key, ...args) {
        let text = (translations[this.locale] && translations[this.locale][key]) || 
                   (translations.en && translations.en[key]) || 
                   key;
        
        args.forEach((arg, index) => {
            text = text.replace(new RegExp(`\\{${index}\\}`, 'g'), arg);
        });

        return text;
    }

    async toggleLocale() {
        this.locale = this.locale === 'en' ? 'fr' : 'en';
        await chrome.storage.local.set({ locale: this.locale });
        return this.locale;
    }
}

const i18n = new I18n();