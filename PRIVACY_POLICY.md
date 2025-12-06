# Privacy Policy for PHP - Paste History Past

**Last Updated:** December 1, 2025

## 1. Introduction
**PHP - Paste History Past** ("the Extension") is an open-source browser extension designed with privacy as its absolute core principle. We believe that your clipboard data is sensitive and personal, and it should never leave your device.

You can audit our source code at any time on GitHub: [https://github.com/aadatech/paste_history_chrome_extension](https://github.com/aadatech/paste_history_chrome_extension)

## 2. Data Collection and Usage

### 2.1. Local Storage Only
All data generated or processed by the Extension is stored **exclusively on your local device** using the Chrome Storage API (`chrome.storage.local`).
*   **Clipboard History**: Your copied text snippets are saved locally to allow you to retrieve them later.
*   **Settings**: Your preferences (theme, language) are saved locally.

### 2.2. No External Transmission
The Extension **does not** transmit, sync, or back up your data to any external servers, cloud services, or third-party analytics platforms.
*   **No Analytics**: We do not track how you use the extension.
*   **No Telemetry**: We do not collect crash reports or usage statistics.
*   **No Network Requests**: The extension functions entirely offline and makes no network requests.

### 2.3. Clipboard Access
The Extension accesses your clipboard (`clipboardRead` permission) solely for the purpose of:
1.  Automatically saving new copies to your history when the extension is open or focused.
2.  Allowing you to manually save clips.

This data is processed instantly on your device and is never shared.

## 3. Data Retention and Control

*   **Automatic Cleanup**: To protect your privacy and save space, unpinned clips are automatically permanently deleted from your local storage after **24 hours**.
*   **User Control**: You have full control. You can manually delete individual clips or "Clear All" data at any time via the Extension's interface.
*   **Uninstallation**: Uninstalling the Extension will permanently remove all data associated with it from your device immediately.

## 4. Permissions Explained

*   `storage`: Required to save your history locally.
*   `clipboardWrite`: Required to copy items from your history back to your clipboard.
*   `clipboardRead`: Required to detect new copies when the extension is open.
*   `alarms`: Required to run the automatic 24-hour cleanup job.
*   `notifications`: Required to alert you if a copied text exceeds the character limit (20,000 chars).

## 5. Contact
If you have any questions about this Privacy Policy, please open an issue on our [GitHub Repository](https://github.com/aadatech/paste_history_chrome_extension).
