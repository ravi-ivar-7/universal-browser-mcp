/**
 * @fileoverview Log Overlay Utility
 * @description Helper functions to control the log overlay on web pages.
 *              Can be used from workflows, chat agents, tools, etc.
 * 
 * Usage:
 *   import { logOverlay } from './log-overlay-util';
 *   
 *   await logOverlay.init(tabId);
 *   await logOverlay.success(tabId, 'Step completed');
 *   await logOverlay.error(tabId, 'Something failed');
 *   await logOverlay.info(tabId, 'Processing...');
 *   await logOverlay.done(tabId);
 */

const SCRIPT_PATH = 'inject-scripts/log-overlay.js';

type LogLevel = 'success' | 'error' | 'warning' | 'info' | 'debug';

interface LogOverlayMessage {
    action: 'log_overlay';
    cmd: 'init' | 'show' | 'hide' | 'destroy' | 'clear' | 'append' | 'done';
    text?: string;
    level?: LogLevel;
}

// Track which tabs have the overlay script injected
const injectedTabs = new Set<number>();

/**
 * Inject the log overlay script into a tab if not already injected
 */
async function ensureInjected(tabId: number): Promise<boolean> {
    if (injectedTabs.has(tabId)) return true;

    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            files: [SCRIPT_PATH],
        });
        injectedTabs.add(tabId);

        // Clean up when tab is closed
        const onRemoved = (removedTabId: number) => {
            if (removedTabId === tabId) {
                injectedTabs.delete(tabId);
                chrome.tabs.onRemoved.removeListener(onRemoved);
            }
        };
        chrome.tabs.onRemoved.addListener(onRemoved);

        return true;
    } catch (e) {
        console.warn('[LogOverlay] Failed to inject script:', e);
        return false;
    }
}

/**
 * Send a message to the log overlay on a specific tab
 */
async function sendOverlayMessage(tabId: number, message: Omit<LogOverlayMessage, 'action'>): Promise<boolean> {
    try {
        // Ensure script is injected first
        const injected = await ensureInjected(tabId);
        if (!injected) return false;

        // Send the message
        await chrome.tabs.sendMessage(tabId, {
            action: 'log_overlay',
            ...message,
        });
        return true;
    } catch (e) {
        console.warn('[LogOverlay] Failed to send message:', e);
        return false;
    }
}

/**
 * Get the current active tab ID
 */
async function getActiveTabId(): Promise<number | null> {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        return tabs[0]?.id ?? null;
    } catch {
        return null;
    }
}

/**
 * Log Overlay API
 */
export const logOverlay = {
    /**
     * Initialize and show the overlay on a tab
     * @param tabId - Tab ID (optional, uses active tab if not provided)
     */
    async init(tabId?: number): Promise<boolean> {
        const id = tabId ?? await getActiveTabId();
        if (!id) return false;
        return sendOverlayMessage(id, { cmd: 'init' });
    },

    /**
     * Show the overlay (if hidden)
     */
    async show(tabId?: number): Promise<boolean> {
        const id = tabId ?? await getActiveTabId();
        if (!id) return false;
        return sendOverlayMessage(id, { cmd: 'show' });
    },

    /**
     * Hide the overlay
     */
    async hide(tabId?: number): Promise<boolean> {
        const id = tabId ?? await getActiveTabId();
        if (!id) return false;
        return sendOverlayMessage(id, { cmd: 'hide' });
    },

    /**
     * Destroy the overlay completely
     */
    async destroy(tabId?: number): Promise<boolean> {
        const id = tabId ?? await getActiveTabId();
        if (!id) return false;
        return sendOverlayMessage(id, { cmd: 'destroy' });
    },

    /**
     * Clear all logs
     */
    async clear(tabId?: number): Promise<boolean> {
        const id = tabId ?? await getActiveTabId();
        if (!id) return false;
        return sendOverlayMessage(id, { cmd: 'clear' });
    },

    /**
     * Append a log entry
     */
    async append(tabId: number, text: string, level: LogLevel = 'info'): Promise<boolean> {
        return sendOverlayMessage(tabId, { cmd: 'append', text, level });
    },

    /**
     * Append a success log
     */
    async success(tabId: number, text: string): Promise<boolean> {
        return this.append(tabId, text, 'success');
    },

    /**
     * Append an error log
     */
    async error(tabId: number, text: string): Promise<boolean> {
        return this.append(tabId, text, 'error');
    },

    /**
     * Append a warning log
     */
    async warning(tabId: number, text: string): Promise<boolean> {
        return this.append(tabId, text, 'warning');
    },

    /**
     * Append an info log
     */
    async info(tabId: number, text: string): Promise<boolean> {
        return this.append(tabId, text, 'info');
    },

    /**
     * Append a debug log
     */
    async debug(tabId: number, text: string): Promise<boolean> {
        return this.append(tabId, text, 'debug');
    },

    /**
     * Mark as done/completed
     */
    async done(tabId?: number): Promise<boolean> {
        const id = tabId ?? await getActiveTabId();
        if (!id) return false;
        return sendOverlayMessage(id, { cmd: 'done' });
    },

    /**
     * Log a step execution (convenience method for workflows)
     */
    async step(tabId: number, stepType: string, stepId: string, status: 'start' | 'success' | 'error', error?: string): Promise<boolean> {
        switch (status) {
            case 'start':
                return this.info(tabId, `→ ${stepType} (${stepId})`);
            case 'success':
                return this.success(tabId, `✔ ${stepType} (${stepId})`);
            case 'error':
                return this.error(tabId, `✘ ${stepType} (${stepId})${error ? ` - ${error}` : ''}`);
            default:
                return false;
        }
    },
};

export default logOverlay;
