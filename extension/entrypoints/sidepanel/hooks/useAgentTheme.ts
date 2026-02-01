/**
 * Hook for managing AgentChat theme.
 * Handles theme persistence and application.
 */
import { useState, useEffect, useCallback } from 'react';
import { getThemeTokens, applyThemeTokens as applyTokensFromEngine, type ThemeTokens, type AgentThemeId } from '@/shared/theme/ThemeEngine';

// Re-export for backwards compatibility
export type { AgentThemeId } from '@/shared/theme/ThemeEngine';

/** Storage key for persisting theme preference */
const STORAGE_KEY_THEME = 'agentTheme';

/** Default theme when none is set */
const DEFAULT_THEME: AgentThemeId = 'warm-editorial';

/** Valid theme IDs for validation */
const VALID_THEMES: AgentThemeId[] = [
    'warm-editorial',
    'blueprint-architect',
    'zen-journal',
    'neo-pop',
    'dark-console',
    'swiss-grid',
    'glass-morphism',
];

/** Theme display names for UI */
export const THEME_LABELS: Record<AgentThemeId, string> = {
    'warm-editorial': 'Editorial',
    'blueprint-architect': 'Blueprint',
    'zen-journal': 'Zen',
    'neo-pop': 'Neo-Pop',
    'dark-console': 'Console',
    'swiss-grid': 'Swiss',
    'glass-morphism': 'Glass',
};

export interface UseAgentTheme {
    /** Current theme ID */
    theme: AgentThemeId;
    /** Whether theme has been loaded from storage */
    ready: boolean;
    /** Set and persist a new theme */
    setTheme: (id: AgentThemeId) => Promise<void>;
    /** Load theme from storage (call on mount) */
    initTheme: () => Promise<void>;
    /** Apply theme to a DOM element */
    applyTo: (el: HTMLElement) => void;
    /** Get the preloaded theme from document (set by main.ts) */
    getPreloadedTheme: () => AgentThemeId;
}

/**
 * Check if a string is a valid theme ID
 */
function isValidTheme(value: unknown): value is AgentThemeId {
    return typeof value === 'string' && VALID_THEMES.includes(value as AgentThemeId);
}

/**
 * Get theme from document element (preloaded by main.ts)
 */
function getThemeFromDocument(): AgentThemeId {
    if (typeof document === 'undefined') return DEFAULT_THEME;
    const value = document.documentElement.dataset.agentTheme;
    return isValidTheme(value) ? value : DEFAULT_THEME;
}

// Using shared theme engine (imported at top)

/**
 * Apply theme tokens as CSS variables to an element (defaults to documentElement)
 */
export function applyThemeTokens(themeId: AgentThemeId, target: HTMLElement = document.documentElement): void {
    const tokens = getThemeTokens(themeId);
    const prefix = '--ac-';

    // Map keys to CSS variable names
    const mapping: Record<keyof ThemeTokens, string> = {
        bg: 'bg',
        surface: 'surface',
        surfaceMuted: 'surface-muted',
        surfaceInset: 'surface-inset',
        text: 'text',
        textMuted: 'text-muted',
        textSubtle: 'text-subtle',
        textInverse: 'text-inverse',
        border: 'border',
        borderStrong: 'border-strong',
        accent: 'accent',
        accentHover: 'accent-hover',
        accentSubtle: 'accent-subtle',
        accentContrast: 'accent-contrast',
        hoverBg: 'hover-bg',
        hoverBgSubtle: 'hover-bg-subtle',
        shadowCard: 'shadow-card',
        shadowFloat: 'shadow-float',
        focusRing: 'focus-ring',
        radiusCard: 'radius-card',
        radiusInner: 'radius-inner',
        radiusButton: 'radius-button',
        link: 'link',
        danger: 'danger',
        success: 'success',
        warning: 'warning',
        fontSans: 'font-sans',
        fontSerif: 'font-serif',
        fontMono: 'font-mono',
        fontGrotesk: 'font-grotesk',
        motionFast: 'motion-fast',
        motionNormal: 'motion-normal',
        borderWidth: 'border-width',
        borderWidthStrong: 'border-width-strong',
        scrollbarSize: 'scrollbar-size',
        scrollbarThumb: 'scrollbar-thumb',
        scrollbarThumbHover: 'scrollbar-thumb-hover',
        timelineLine: 'timeline-line',
        timelineNode: 'timeline-node',
        timelineNodeActive: 'timeline-node-active',
        timelineNodePulseShadow: 'timeline-node-pulse-shadow',
        timelineNodeTool: 'timeline-node-tool',
        chipBg: 'chip-bg',
        chipText: 'chip-text',
        codeBg: 'code-bg',
        codeBorder: 'code-border',
        codeText: 'code-text',
        accentGlow: 'accent-glow',
        error: 'error',
        diffDelBg: 'diff-del-bg',
        diffDelBorder: 'diff-del-border',
    };

    // Apply each token
    Object.entries(mapping).forEach(([key, varName]) => {
        const value = tokens[key as keyof ThemeTokens];
        if (value) {
            target.style.setProperty(`${prefix}${varName}`, value);
        }
    });

    // Also set semantic font variables
    target.style.setProperty('--ac-font-body', tokens.fontSans);
    target.style.setProperty('--ac-font-heading', tokens.fontSerif);
    target.style.setProperty('--ac-font-code', tokens.fontMono);
}

/**
 * Hook for managing AgentChat theme
 */
export function useAgentTheme(): UseAgentTheme {
    // Initialize with preloaded theme (or default)
    const [theme, setThemeState] = useState<AgentThemeId>(getThemeFromDocument());
    const [ready, setReady] = useState(false);

    /**
     * Load theme from chrome.storage.local
     */
    const initTheme = useCallback(async (): Promise<void> => {
        try {
            const result = await chrome.storage.local.get(STORAGE_KEY_THEME);
            const stored = result[STORAGE_KEY_THEME];

            if (isValidTheme(stored)) {
                setThemeState(stored);
                applyThemeTokens(stored);
            } else {
                const docTheme = getThemeFromDocument();
                setThemeState(docTheme);
                applyThemeTokens(docTheme);
            }
        } catch (error) {
            console.error('[useAgentTheme] Failed to load theme:', error);
            const docTheme = getThemeFromDocument();
            setThemeState(docTheme);
            applyThemeTokens(docTheme);
        } finally {
            setReady(true);
        }
    }, []);

    /**
     * Set and persist a new theme
     */
    const setTheme = useCallback(async (id: AgentThemeId): Promise<void> => {
        if (!isValidTheme(id)) {
            console.warn('[useAgentTheme] Invalid theme ID:', id);
            return;
        }

        // Update immediately for responsive UI
        setThemeState(id);

        // Also update document element for consistency
        document.documentElement.dataset.agentTheme = id;
        applyThemeTokens(id);

        // Persist to storage
        try {
            await chrome.storage.local.set({ [STORAGE_KEY_THEME]: id });
        } catch (error) {
            console.error('[useAgentTheme] Failed to save theme:', error);
        }
    }, []);

    /**
     * Apply theme to a DOM element
     */
    const applyTo = useCallback((el: HTMLElement): void => {
        el.dataset.agentTheme = theme;
        applyThemeTokens(theme, el);
    }, [theme]);

    /**
     * Get the preloaded theme from document
     */
    const getPreloadedTheme = useCallback((): AgentThemeId => {
        return getThemeFromDocument();
    }, []);

    return {
        theme,
        ready,
        setTheme,
        initTheme,
        applyTo,
        getPreloadedTheme,
    };
}

/**
 * Preload theme before React mounts (call in main.ts)
 * This prevents theme flashing on page load.
 */
export async function preloadAgentTheme(): Promise<AgentThemeId> {
    let themeId: AgentThemeId = DEFAULT_THEME;

    try {
        const result = await chrome.storage.local.get(STORAGE_KEY_THEME);
        const stored = result[STORAGE_KEY_THEME];

        if (isValidTheme(stored)) {
            themeId = stored;
        }
    } catch (error) {
        console.error('[preloadAgentTheme] Failed to load theme:', error);
    }

    // Set on document element for immediate application
    if (typeof document !== 'undefined') {
        document.documentElement.dataset.agentTheme = themeId;
        applyThemeTokens(themeId);
    }

    return themeId;
}
