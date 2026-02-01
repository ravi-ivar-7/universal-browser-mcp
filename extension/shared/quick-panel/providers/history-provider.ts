import {
    BACKGROUND_MESSAGE_TYPES,
    type QuickPanelHistoryQueryResponse,
} from '@/common/message-types';
import type { Action, SearchProvider, SearchProviderContext, SearchResult } from '../core/types';
import { openUrl } from './helpers';

export interface HistorySearchResultData {
    id: string;
    url: string;
    title?: string;
    lastVisitTime?: number;
    visitCount?: number;
}

export function createHistoryProvider(): SearchProvider<HistorySearchResultData> {
    const id = 'history';
    const name = 'History';
    const icon = '\uD83D\uDD52'; // 🕒

    async function search(ctx: SearchProviderContext): Promise<SearchResult<HistorySearchResultData>[]> {
        if (ctx.signal.aborted) return [];

        // History API usually requires a query. If empty, we can just search for space or pass empty string (handled in background)
        const resp = (await chrome.runtime.sendMessage({
            type: BACKGROUND_MESSAGE_TYPES.QUICK_PANEL_HISTORY_QUERY,
            payload: { query: ctx.query.text, limit: ctx.limit },
        })) as QuickPanelHistoryQueryResponse;

        if (ctx.signal.aborted) return [];
        if (!resp || !resp.success) {
            console.error('History search failed:', (resp as any)?.error);
            return [];
        }

        return resp.history.map((h) => ({
            id: h.id,
            provider: id,
            title: h.title || h.url || 'Untitled',
            subtitle: h.url,
            icon,
            data: {
                id: h.id,
                url: h.url || '',
                title: h.title,
                lastVisitTime: h.lastVisitTime,
                visitCount: h.visitCount,
            },
            score: 0.8, // Slightly lower priority than tabs/bookmarks
        }));
    }

    function getActions(item: SearchResult<HistorySearchResultData>): Action<HistorySearchResultData>[] {
        return [
            {
                id: 'history.open',
                title: 'Open',
                hotkeyHint: 'Enter',
                execute: async () => {
                    await openUrl(item.data.url, true);
                },
            },
            {
                id: 'history.open-background',
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
        scopes: ['history'],
        includeInAll: true,
        priority: 30, // Lower than bookmarks
        maxResults: 500, // Provider cap; UI requests 100 initially then loads more
        supportsEmptyQuery: true,
        search,
        getActions,
    };
}
