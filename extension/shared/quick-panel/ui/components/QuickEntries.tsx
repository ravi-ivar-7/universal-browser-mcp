import React from 'react';
import { QUICK_PANEL_SCOPES, normalizeQuickPanelScope, type QuickPanelScope } from '../../core/types';

interface QuickEntriesProps {
    scopes?: QuickPanelScope[];
    activeScope: QuickPanelScope | null;
    onSelect: (scope: QuickPanelScope) => void;
}

const DEFAULT_SCOPES: QuickPanelScope[] = ['tabs', 'bookmarks', 'history', 'structure'];

export const QuickEntries: React.FC<QuickEntriesProps> = ({
    scopes = DEFAULT_SCOPES,
    activeScope,
    onSelect,
}) => {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {scopes.map(scope => {
                // Skip 'all' or unknown scopes
                if (scope === 'all' || !(scope in QUICK_PANEL_SCOPES)) return null;

                const def = QUICK_PANEL_SCOPES[scope];
                const isActive = activeScope === normalizeQuickPanelScope(scope);

                return (
                    <button
                        key={scope}
                        type="button"
                        onClick={() => onSelect(scope)}
                        className={`
               flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all duration-200
               ${isActive
                                ? 'bg-[var(--ac-accent-subtle)] border-[var(--ac-accent)] text-[var(--ac-accent)]'
                                : 'bg-[var(--ac-surface-muted)] border-[var(--ac-border)] text-[var(--ac-text-muted)] hover:bg-[var(--ac-hover-bg)] hover:text-[var(--ac-text)]'
                            }
             `}
                        aria-label={`Switch scope to ${def.label}`}
                    >
                        <div className="text-2xl opacity-80">{def.icon}</div>
                        <div className="font-semibold text-xs">{def.label}</div>
                    </button>
                );
            })}
        </div>
    );
};
