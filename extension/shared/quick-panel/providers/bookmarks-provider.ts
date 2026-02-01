import {
    BACKGROUND_MESSAGE_TYPES,
    type QuickPanelBookmarksQueryResponse,
    type QuickPanelBookmark,
} from '@/common/message-types';
import type { Action, SearchProvider, SearchProviderContext, SearchResult } from '../core/types';
import { openUrl } from './helpers';

export interface BookmarksSearchResultData {
    id: string;
    url: string;
    title: string;
    folder?: string;
    dateAdded?: number;
}

export function createBookmarksProvider(): SearchProvider<BookmarksSearchResultData> {
    const id = 'bookmarks';
    const name = 'Bookmarks';
    const icon = '\u2B50'; // ⭐

    async function search(ctx: SearchProviderContext): Promise<SearchResult<BookmarksSearchResultData>[]> {
        if (ctx.signal.aborted) return [];

        const resp = (await chrome.runtime.sendMessage({
            type: BACKGROUND_MESSAGE_TYPES.QUICK_PANEL_BOOKMARKS_QUERY,
            payload: { query: ctx.query.text, limit: ctx.limit },
        })) as QuickPanelBookmarksQueryResponse;

        if (ctx.signal.aborted) return [];
        if (!resp || !resp.success) {
            console.error('Bookmarks search failed:', (resp as any)?.error);
            return [];
        }

        return resp.bookmarks.map((b) => ({
            id: b.id,
            provider: id,
            title: b.title || b.url,
            subtitle: b.url,
            icon,
            data: {
                id: b.id,
                url: b.url,
                title: b.title,
                folder: b.folder,
                dateAdded: b.dateAdded,
            },
            score: 1, // Let the search engine re-rank if needed, or rely on API ranking
        }));
    }

    function getActions(item: SearchResult<BookmarksSearchResultData>): Action<BookmarksSearchResultData>[] {
        return [
            {
                id: 'bookmarks.open',
                title: 'Open',
                hotkeyHint: 'Enter',
                execute: async () => {
                    await openUrl(item.data.url, true);
                },
            },
            {
                id: 'bookmarks.open-background',
                title: 'Open in background',
                hotkeyHint: 'Ctrl+Enter',
                execute: async () => {
                    await openUrl(item.data.url, false);
                },
            },
        ];
    }

    return {
        id,
        name,
        icon,
        scopes: ['bookmarks'],
        includeInAll: true,
        priority: 40,
        maxResults: 500, // Provider cap; UI requests 100 initially then loads more
        supportsEmptyQuery: true,
        search,
        getActions,
    };
}
