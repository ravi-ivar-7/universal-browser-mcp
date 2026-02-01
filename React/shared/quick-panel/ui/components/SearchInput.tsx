import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    DEFAULT_SCOPE,
    QUICK_PANEL_SCOPES,
    normalizeQuickPanelScope,
    parseScopePrefixedQuery,
    type QuickPanelScope,
} from '../../core/types';

interface SearchInputProps {
    scope: QuickPanelScope;
    query: string;
    placeholder?: string;
    onChange: (scope: QuickPanelScope, query: string) => void;
    onClear?: () => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({
    scope,
    query,
    placeholder = 'Search\u2026',
    onChange,
    onClear,
}) => {
    const [isComposing, setIsComposing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const availableScopes: QuickPanelScope[] = [
        'all',
        'tabs',
        'bookmarks',
        'history',
        'structure',
    ];

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        onChange(scope, val);
    };

    const handleClear = () => {
        onChange(scope, '');
        onClear?.();
        inputRef.current?.focus();
    };

    const scopeDef = QUICK_PANEL_SCOPES[scope];

    return (
        <div className="w-full flex items-center gap-2.5 min-w-0">
            <div className="w-8.5 h-8.5 flex items-center justify-center rounded-lg bg-[var(--ac-accent-subtle)] color-[var(--ac-accent)] text-2xl flex-none">
                ✦
            </div>

            <div className="relative flex-none">
                {/* Visual Presentation */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--ac-border)] bg-[var(--ac-surface-muted)] rounded-full text-[var(--ac-text)] text-xs whitespace-nowrap pointer-events-none transition-colors group-hover:bg-[var(--ac-hover-bg)] focus-within:border-[var(--ac-accent)]">
                    <span>{scopeDef.icon}</span>
                    <span className="font-medium">{scopeDef.label}</span>
                    <span className="opacity-40 text-[9px] -mr-1">▼</span>
                </div>

                {/* Invisible Select */}
                <select
                    value={scope}
                    onChange={(e) => {
                        onChange(e.target.value as QuickPanelScope, query);
                        inputRef.current?.focus();
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
                    aria-label="Select Search Scope"
                >
                    {availableScopes.map(s => {
                        const def = QUICK_PANEL_SCOPES[s];
                        return (
                            <option key={s} value={s} className="bg-[var(--ac-surface)] text-[var(--ac-text)]">
                                {def.label}
                            </option>
                        );
                    })}
                </select>
            </div>

            <div className="relative flex-1 min-w-0">
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={() => setIsComposing(false)}
                    placeholder={placeholder}
                    autoComplete="off"
                    spellCheck="false"
                    className="w-full h-9.5 pl-3 pr-9 rounded-xl bg-[var(--ac-surface-muted)] border border-[var(--ac-border)] text-sm text-[var(--ac-text)] outline-none focus:border-[var(--ac-accent)] transition-colors"
                />
                {query && (
                    <button
                        onClick={handleClear}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-lg text-[var(--ac-text-subtle)] hover:text-[var(--ac-text)] outline-none"
                        aria-label="Clear"
                    >
                        ×
                    </button>
                )}
            </div>
        </div>
    );
};
