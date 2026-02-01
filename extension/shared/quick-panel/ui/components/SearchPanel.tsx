import React, { useState, useEffect, useMemo } from 'react';
import { SearchInput } from './SearchInput';
import { QuickEntries } from './QuickEntries';
import {
    type QuickPanelScope,
    type SearchResult,
    type QuickPanelState,
    QUICK_PANEL_SCOPES
} from '../../core/types';
import { SearchEngine } from '../../core/search-engine';
import {
    createTabsProvider,
    createBookmarksProvider,
    createHistoryProvider,
    createPageStructureProvider
} from '../../providers';

interface SearchPanelProps {
    onSwitchToChat: (initialQuery?: string) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ onSwitchToChat }) => {
    const [scope, setScope] = useState<QuickPanelScope>('all');
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [resultLimit, setResultLimit] = useState(100);
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const scrollSnapshotRef = React.useRef<number | null>(null);

    // Initialize search engine
    const searchEngine = useMemo(() => {
        const engine = new SearchEngine({
            perProviderLimit: 500,
            totalLimit: 1000 // Allow large buffer for sorting
        });
        engine.registerProvider(createTabsProvider());
        engine.registerProvider(createBookmarksProvider());
        engine.registerProvider(createHistoryProvider());
        engine.registerProvider(createPageStructureProvider());
        return engine;
    }, []);

    // Restore scroll position after results update if we captured a snapshot (Load More)
    React.useLayoutEffect(() => {
        if (scrollSnapshotRef.current !== null && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollSnapshotRef.current;
            scrollSnapshotRef.current = null;
        }
    }, [results]);

    useEffect(() => {
        const performSearch = async () => {
            if (!query.trim() && scope === 'all') {
                setResults([]);
                return;
            }

            setIsLoading(true);
            try {
                const response = await searchEngine.search({
                    scope,
                    query,
                    limit: resultLimit
                });

                // Stable update: If loading more (limit > 100), try to preserve existing item references
                // to prevent re-rendering/flickering of the top list.
                setResults(prevResults => {
                    if (resultLimit > 100 && prevResults.length > 0) {
                        // We assume the new search includes the old items at the top.
                        // We take the existing items (to keep refs stable) and append only the new tail.
                        // Use a Map or check IDs to be safe? 
                        // For simplicity/speed in this context, we'll assume stable sort order regarding prefixes.
                        // But let's be slightly safer: only keep prefix if IDs match.

                        const newResults = response.results;
                        // Find where the new list diverges or extends
                        if (newResults.length > prevResults.length) {
                            const tail = newResults.slice(prevResults.length);
                            return [...prevResults, ...tail];
                        }
                        return newResults; // If count didn't increase or logic fails, fallback to replacement
                    }
                    return response.results;
                });

                // Reset selection to top ONLY on new searches (limit reset),
                // effectively keeping current scroll/selection when loading more.
                if (resultLimit === 100) {
                    setSelectedIndex(0);
                    // Clear any stale snapshot
                    scrollSnapshotRef.current = null;
                }
            } catch (e) {
                console.error('Search failed', e);
            } finally {
                setIsLoading(false);
            }
        };

        const timeout = setTimeout(performSearch, 150);
        return () => clearTimeout(timeout);
    }, [scope, query, searchEngine, resultLimit]);

    const handleSelectResult = (result: SearchResult) => {
        const provider = searchEngine.getProvider(result.provider);
        if (provider) {
            const actions = provider.getActions(result);
            if (actions.length > 0) {
                actions[0].execute({ result });
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--ac-surface)]">
            <div className="mb-6">
                <SearchInput
                    scope={scope}
                    query={query}
                    onChange={(s, q) => {
                        if (s !== scope || q !== query) {
                            setResultLimit(100); // Reset limit on new search
                            setSelectedIndex(0); // Reset selection immediately
                            scrollSnapshotRef.current = null; // Don't restore scroll on new search
                            if (scrollContainerRef.current) {
                                scrollContainerRef.current.scrollTop = 0; // Force scroll to top
                            }
                        }
                        setScope(s);
                        setQuery(q);
                    }}
                />
            </div>

            {!query && scope === 'all' ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-full max-w-2xl px-4 py-8">
                        <div className="text-center mb-8">
                            <h2 className="text-xl font-bold text-[var(--ac-text)] mb-2">How can I help you today?</h2>
                            <p className="text-[var(--ac-text-muted)] text-sm">Search your browser or start a chat with the AI agent.</p>
                        </div>

                        <QuickEntries
                            activeScope={null}
                            onSelect={(s) => setScope(s)}
                        />

                        <div className="mt-10 p-4 rounded-2xl bg-[var(--ac-accent-subtle)] border border-[var(--ac-accent)] flex items-center justify-between group cursor-pointer"
                            onClick={() => onSwitchToChat()}>
                            <div className="flex items-center gap-3">
                                <div className="text-2xl text-[var(--ac-accent)] group-hover:scale-110 transition-transform">✦</div>
                                <div>
                                    <div className="font-bold text-sm text-[var(--ac-text)]">Chat with Agent</div>
                                    <div className="text-xs text-[var(--ac-text-muted)]">Ask questions, analyze pages, or automate tasks.</div>
                                </div>
                            </div>
                            <div className="text-[var(--ac-accent)] opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-auto custom-scrollbar pr-1 -mx-1 [overflow-anchor:none]"
                >
                    {isLoading && results.length === 0 ? (
                        <div className="flex items-center justify-center py-20 animate-pulse text-[var(--ac-text-muted)]">
                            Searching...
                        </div>
                    ) : results.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-[var(--ac-text-muted)]">
                            <div className="text-3xl mb-3 opacity-30">∅</div>
                            <p>No results found for "{query}"</p>
                            <button
                                onClick={() => onSwitchToChat(query)}
                                className="mt-4 px-4 py-2 rounded-lg bg-[var(--ac-accent)] text-[var(--ac-accent-contrast)] text-sm font-semibold hover:opacity-90 transition-opacity"
                            >
                                Ask AI instead
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-1 pb-4">
                            {results.map((result, idx) => (
                                <div
                                    key={result.provider + result.id}
                                    onClick={() => handleSelectResult(result)}
                                    className={`
                    flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all
                    ${idx === selectedIndex ? 'bg-[var(--ac-hover-bg)] ring-1 ring-[var(--ac-accent)]' : 'hover:bg-[var(--ac-hover-bg)]'}
                  `}
                                >
                                    <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--ac-surface-muted)] text-xl border border-[var(--ac-border)]">
                                        {typeof result.icon === 'string' ? result.icon : '📄'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-sm truncate text-[var(--ac-text)]">{result.title}</div>
                                        {result.subtitle && <div className="text-[11px] text-[var(--ac-text-muted)] truncate">{result.subtitle}</div>}
                                    </div>
                                    <div className="text-[10px] uppercase tracking-wider font-bold text-[var(--ac-text-subtle)] bg-black/5 px-2 py-0.5 rounded opacity-50">
                                        {result.provider}
                                    </div>
                                </div>
                            ))}

                            {/* Load More Button */}
                            {results.length >= resultLimit && (
                                <button
                                    className="w-full py-3 mt-2 text-xs font-semibold text-[var(--ac-accent)] bg-[var(--ac-accent-subtle)] hover:bg-[var(--ac-hover-bg)] rounded-xl transition-colors opacity-80 hover:opacity-100"
                                    onClick={() => {
                                        if (scrollContainerRef.current) {
                                            scrollSnapshotRef.current = scrollContainerRef.current.scrollTop;
                                        }
                                        setResultLimit(prev => prev + 100);
                                    }}
                                    disabled={isLoading}
                                >
                                    {isLoading ? 'Loading...' : 'Load +100 More Results'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Footer for Structure Scope */}
            {scope === 'structure' && (
                <div className="px-3 py-2 border-t border-[var(--ac-border)] bg-[var(--ac-surface-muted)] text-[10px] text-[var(--ac-text-muted)] flex justify-between items-center flex-none">
                    <span>Active Page Elements (Headings, Links, Inputs, Buttons)</span>
                    <span className="opacity-60">Use arrow keys to navigate</span>
                </div>
            )}
        </div>
    );
};
