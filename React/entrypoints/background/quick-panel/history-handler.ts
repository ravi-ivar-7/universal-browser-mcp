import {
    BACKGROUND_MESSAGE_TYPES,
    type QuickPanelHistoryQueryMessage,
    type QuickPanelHistoryQueryResponse,
    type QuickPanelHistoryItem,
} from '@/common/message-types';

/**
 * Initialize listeners for Quick Panel History operations.
 */
export function initQuickPanelHistoryHandler() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === BACKGROUND_MESSAGE_TYPES.QUICK_PANEL_HISTORY_QUERY) {
            handleHistoryQuery(message as QuickPanelHistoryQueryMessage)
                .then(sendResponse)
                .catch((err) => {
                    console.error('[QuickPanel] History query error:', err);
                    sendResponse({ success: false, error: String(err) });
                });
            return true; // Async response
        }
    });
}

/**
 * Handle history query.
 */
async function handleHistoryQuery(
    message: QuickPanelHistoryQueryMessage,
): Promise<QuickPanelHistoryQueryResponse> {
    const { query, limit = 500, startTime } = message.payload;

    // Default to 90 days ago if no startTime provided, to ensure we get a good chunk of history
    // startTime: 0 should work for all time, but safe fallback is good.
    const lookback = startTime ?? (Date.now() - 90 * 24 * 60 * 60 * 1000);

    const results = await chrome.history.search({
        text: query || '', // Empty string returns all history
        maxResults: limit,
        startTime: lookback,
    });

    const history: QuickPanelHistoryItem[] = results.map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        lastVisitTime: item.lastVisitTime,
        visitCount: item.visitCount,
    }));

    return { success: true, history };
}
