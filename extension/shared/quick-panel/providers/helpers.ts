import {
    BACKGROUND_MESSAGE_TYPES,
    type QuickPanelOpenUrlResponse,
} from '@/common/message-types';

/**
 * Open a URL via the background script.
 */
export async function openUrl(url: string, active: boolean = true, newWindow: boolean = false): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        throw new Error('chrome.runtime.sendMessage is not available');
    }

    const resp = (await chrome.runtime.sendMessage({
        type: BACKGROUND_MESSAGE_TYPES.QUICK_PANEL_OPEN_URL,
        payload: { url, active, newWindow },
    })) as QuickPanelOpenUrlResponse;

    if (!resp || resp.success !== true) {
        const err = (resp as { error?: unknown })?.error;
        throw new Error(typeof err === 'string' ? err : 'Failed to open URL');
    }
}
