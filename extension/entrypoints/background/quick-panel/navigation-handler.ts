import {
    BACKGROUND_MESSAGE_TYPES,
    type QuickPanelOpenUrlMessage,
    type QuickPanelOpenUrlResponse,
} from '@/common/message-types';

/**
 * Initialize listeners for Quick Panel Navigation operations.
 */
export function initQuickPanelNavigationHandler() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === BACKGROUND_MESSAGE_TYPES.QUICK_PANEL_OPEN_URL) {
            handleOpenUrl(message as QuickPanelOpenUrlMessage)
                .then(sendResponse)
                .catch((err) => {
                    console.error('[QuickPanel] Open URL error:', err);
                    sendResponse({ success: false, error: String(err) });
                });
            return true; // Async response
        }
    });
}

/**
 * Handle Open URL request.
 */
async function handleOpenUrl(message: QuickPanelOpenUrlMessage): Promise<QuickPanelOpenUrlResponse> {
    const { url, active = true, newWindow = false } = message.payload;

    if (!url) {
        throw new Error('URL is required');
    }

    // Prepend protocol if missing
    let targetUrl = url;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://') && !targetUrl.startsWith('chrome://') && !targetUrl.startsWith('file://')) {
        targetUrl = 'https://' + targetUrl; // Default to https
    }

    if (newWindow) {
        await chrome.windows.create({ url: targetUrl, focused: active });
    } else {
        await chrome.tabs.create({ url: targetUrl, active: active });
    }

    return { success: true };
}
