import {
    BACKGROUND_MESSAGE_TYPES,
    type QuickPanelBookmarksQueryMessage,
    type QuickPanelBookmarksQueryResponse,
    type QuickPanelBookmark,
} from '@/common/message-types';

/**
 * Initialize listeners for Quick Panel Bookmarks operations.
 */
export function initQuickPanelBookmarksHandler() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === BACKGROUND_MESSAGE_TYPES.QUICK_PANEL_BOOKMARKS_QUERY) {
            handleBookmarksQuery(message as QuickPanelBookmarksQueryMessage)
                .then(sendResponse)
                .catch((err) => {
                    console.error('[QuickPanel] Bookmarks query error:', err);
                    sendResponse({ success: false, error: String(err) });
                });
            return true; // Async response
        }
    });
}

/**
 * Handle bookmarks query.
 */
async function handleBookmarksQuery(
    message: QuickPanelBookmarksQueryMessage,
): Promise<QuickPanelBookmarksQueryResponse> {
    const { query, limit = 500 } = message.payload;
    const q = query?.trim();

    let bookmarks: QuickPanelBookmark[] = [];

    if (q) {
        const results = await chrome.bookmarks.search(q);
        bookmarks = results
            .filter(node => node.url)
            .slice(0, limit)
            .map(mapNodeToBookmark);
    } else {
        // If no query, get the entire tree and flatten it to show "all" bookmarks
        // rather than just "recent" (which is confusing for navigation)
        const tree = await chrome.bookmarks.getTree();
        bookmarks = flattenTree(tree, limit);
    }

    return { success: true, bookmarks };
}

function mapNodeToBookmark(node: chrome.bookmarks.BookmarkTreeNode): QuickPanelBookmark {
    return {
        id: node.id,
        title: node.title,
        url: node.url!,
        dateAdded: node.dateAdded,
    };
}

function flattenTree(nodes: chrome.bookmarks.BookmarkTreeNode[], limit: number): QuickPanelBookmark[] {
    const result: QuickPanelBookmark[] = [];
    const stack = [...nodes];

    // Depth-first traversal (or could do BFS, but DFS is fine for this)
    // We process the stack until empty or limit reached
    while (stack.length > 0 && result.length < limit) {
        const node = stack.shift()!; // Take from front (BFS-ish if we append children to end)

        if (node.url) {
            result.push(mapNodeToBookmark(node));
        }

        if (node.children) {
            // Prepend children to search them next? Or append?
            // For a "natural" folder reading order, we usually want to search children.
            // Let's iterate children and add them to the stack.
            // To maintain order:
            stack.splice(0, 0, ...node.children);
        }
    }

    return result;
}
