import React, { useEffect, useRef } from 'react';
import { applyThemeTokens, type AgentThemeId } from '@/shared/theme/ThemeEngine';

interface QuickPanelShellProps {
    children: React.ReactNode;
    theme: AgentThemeId;
    onThemeChange?: (theme: AgentThemeId) => void;
    onClose: () => void;
}

const THEME_LABELS: Record<AgentThemeId, string> = {
    'warm-editorial': 'Warm',
    'blueprint-architect': 'Blueprint',
    'zen-journal': 'Zen',
    'neo-pop': 'Pop',
    'dark-console': 'Console',
    'swiss-grid': 'Swiss',
    'glass-morphism': 'Glass',
};

export const QuickPanelShell: React.FC<QuickPanelShellProps> = ({ children, theme, onThemeChange, onClose }) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);

    // Position state stored in ref to avoid re-renders
    const posRef = useRef({ x: 0, y: 0 });
    const dragRef = useRef({ active: false, startX: 0, startY: 0, startPosX: 0, startPosY: 0 });

    // Apply theme
    useEffect(() => {
        if (rootRef.current) {
            applyThemeTokens(theme, rootRef.current);
        }
    }, [theme]);

    // Escape key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Load saved position on mount
    useEffect(() => {
        chrome.storage.local.get(['quickPanelPosition']).then((result) => {
            if (result.quickPanelPosition && panelRef.current) {
                const { x, y } = result.quickPanelPosition;
                posRef.current = { x, y };
                panelRef.current.style.transform = `translate(${x}px, ${y}px)`;
            }
        }).catch(() => { });
    }, []);

    // Pointer event handlers using Pointer Capture
    const handlePointerDown = (e: React.PointerEvent) => {
        // Ignore if clicking on interactive elements
        if ((e.target as HTMLElement).closest('button, select, input, a')) return;

        const header = headerRef.current;
        if (!header) return;

        // Capture pointer - this is the key!
        header.setPointerCapture(e.pointerId);

        dragRef.current = {
            active: true,
            startX: e.clientX,
            startY: e.clientY,
            startPosX: posRef.current.x,
            startPosY: posRef.current.y
        };

        if (panelRef.current) {
            panelRef.current.style.transition = 'none';
        }

        e.preventDefault();
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragRef.current.active || !panelRef.current) return;

        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;

        const newX = dragRef.current.startPosX + dx;
        const newY = dragRef.current.startPosY + dy;

        posRef.current = { x: newX, y: newY };
        panelRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!dragRef.current.active) return;

        const header = headerRef.current;
        if (header) {
            header.releasePointerCapture(e.pointerId);
        }

        dragRef.current.active = false;

        if (panelRef.current) {
            panelRef.current.style.transition = '';
        }

        // Save position
        chrome.storage.local.set({ quickPanelPosition: posRef.current }).catch(() => { });
    };

    return (
        <div
            ref={rootRef}
            className="fixed inset-0 flex items-center justify-center p-4 sm:p-6 pointer-events-auto z-[2147483647] bg-black/20 backdrop-blur-[1px] transition-colors duration-200"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                ref={panelRef}
                className="flex flex-col w-full max-w-[760px] h-[min(720px,90vh)] rounded-2xl sm:rounded-3xl overflow-hidden bg-[var(--ac-surface)] backdrop-blur-xl border border-[var(--ac-border)] shadow-[var(--ac-shadow-float)] font-sans text-[var(--ac-text)] antialiased"
            >
                {/* Draggable Header */}
                <div
                    ref={headerRef}
                    className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--ac-border)] bg-[var(--ac-surface)] cursor-grab active:cursor-grabbing select-none touch-none"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                >
                    <div className="flex items-center gap-3 min-w-0 pointer-events-none">
                        <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--ac-accent-subtle)] color-[var(--ac-accent)] text-xl shadow-sm">
                            ✦
                        </div>
                        <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="font-bold text-[13px] leading-none text-[var(--ac-text)]">Agent</span>
                            <span className="text-[11px] leading-none text-[var(--ac-text-muted)] opacity-80">Quick Panel</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-none pointer-events-auto">
                        {onThemeChange && (
                            <select
                                value={theme}
                                onChange={(e) => onThemeChange(e.target.value as AgentThemeId)}
                                className="h-7 pl-2 pr-7 text-[11px] font-medium bg-[var(--ac-surface-muted)] border border-[var(--ac-border)] rounded-md outline-none cursor-pointer hover:bg-[var(--ac-hover-bg)] text-[var(--ac-text)] appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27currentColor%27%20stroke-width=%272%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3e%3cpath%20d=%27M6%209l6%206%206-6%27/%3e%3c/svg%3e')] bg-no-repeat bg-[center_right_6px] bg-[length:10px] [&_option]:bg-[var(--ac-surface)] [&_option]:text-[var(--ac-text)]"
                                aria-label="Select Theme"
                            >
                                {Object.entries(THEME_LABELS).map(([id, label]) => (
                                    <option key={id} value={id}>{label}</option>
                                ))}
                            </select>
                        )}
                        <div className="w-px h-4 bg-[var(--ac-border)] mx-1" />
                        <button
                            onClick={onClose}
                            className="h-7 w-7 flex items-center justify-center rounded-lg border border-[var(--ac-border)] hover:bg-[var(--ac-hover-bg)] text-[var(--ac-text-muted)] hover:text-[var(--ac-text)] transition-colors shadow-sm"
                            aria-label="Close"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-3.5 min-h-0 custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>
    );
};
