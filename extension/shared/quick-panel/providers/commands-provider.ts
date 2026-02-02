import type { Action, SearchProvider, SearchProviderContext, SearchResult } from '../core/types';
import { openUrl } from './helpers';

export interface CommandSearchResultData {
    id: string;
    action: () => void | Promise<void>;
}

export function createCommandsProvider(): SearchProvider<CommandSearchResultData> {
    const id = 'commands';
    const name = 'Commands';
    const icon = '\u003E'; // >

    const STATIC_COMMANDS = [
        {
            id: 'cmd.new-tab',
            title: 'New Tab',
            description: 'Open a new browser tab',
            action: async () => openUrl('chrome://newtab', true),
        },
        {
            id: 'cmd.settings',
            title: 'Settings',
            description: 'Open extension settings',
            action: async () => {
                // Assuming there is an options page
                if (chrome.runtime.openOptionsPage) {
                    chrome.runtime.openOptionsPage();
                } else {
                    openUrl(chrome.runtime.getURL('options.html'), true);
                }
            },
        },
        {
            id: 'cmd.history',
            title: 'Clear History',
            description: 'Open Chrome clear browsing data',
            action: async () => openUrl('chrome://settings/clearBrowserData', true),
        },
        {
            id: 'cmd.extensions',
            title: 'Manage Extensions',
            description: 'Open Chrome extensions page',
            action: async () => openUrl('chrome://extensions', true),
        },
        {
            id: 'cmd.downloads',
            title: 'Downloads',
            description: 'Open Chrome downloads',
            action: async () => openUrl('chrome://downloads', true),
        }
    ];

    async function search(ctx: SearchProviderContext): Promise<SearchResult<CommandSearchResultData>[]> {
        const q = ctx.query.text.toLowerCase();

        // Simple filter
        const matches = STATIC_COMMANDS.filter(cmd =>
            cmd.title.toLowerCase().includes(q) ||
            cmd.description.toLowerCase().includes(q)
        );

        return matches.map(cmd => ({
            id: cmd.id,
            provider: id,
            title: cmd.title,
            subtitle: cmd.description,
            icon,
            data: {
                id: cmd.id,
                action: cmd.action,
            },
            score: 1.5, // High priority if matched
        }));
    }

    function getActions(item: SearchResult<CommandSearchResultData>): Action<CommandSearchResultData>[] {
        return [
            {
                id: 'command.execute',
                title: 'Run',
                hotkeyHint: 'Enter',
                execute: async () => {
                    await item.data.action();
                },
            },
        ];
    }

    return {
        id,
        name,
        icon,
        scopes: ['all'],
        includeInAll: true, // Include commands in 'all' scope
        priority: 100,
        maxResults: 500, // Provider cap; UI requests 100 initially then loads more
        supportsEmptyQuery: true,
        search,
        getActions,
    };
}
