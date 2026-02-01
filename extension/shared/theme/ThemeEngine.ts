export type AgentThemeId =
    | 'warm-editorial'
    | 'blueprint-architect'
    | 'zen-journal'
    | 'neo-pop'
    | 'dark-console'
    | 'swiss-grid'
    | 'glass-morphism';

export interface ThemeTokens {
    bg: string;
    surface: string;
    surfaceMuted: string;
    surfaceInset: string;
    text: string;
    textMuted: string;
    textSubtle: string;
    textInverse: string;
    border: string;
    borderStrong: string;
    accent: string;
    accentHover: string;
    accentSubtle: string;
    accentContrast: string;
    accentGlow: string;
    hoverBg: string;
    hoverBgSubtle: string;
    shadowCard: string;
    shadowFloat: string;
    focusRing: string;
    radiusCard: string;
    radiusInner: string;
    radiusButton: string;
    link: string;
    danger: string;
    success: string;
    warning: string;
    error: string;
    fontSans: string;
    fontSerif: string;
    fontMono: string;
    fontGrotesk: string;
    motionFast: string;
    motionNormal: string;
    borderWidth: string;
    borderWidthStrong: string;
    scrollbarSize: string;
    scrollbarThumb: string;
    scrollbarThumbHover: string;
    // Timeline
    timelineLine: string;
    timelineNode: string;
    timelineNodeActive: string;
    timelineNodePulseShadow: string;
    timelineNodeTool: string;
    // Chips & Code
    chipBg: string;
    chipText: string;
    codeBg: string;
    codeBorder: string;
    codeText: string;
    // Component Specific
    diffDelBg: string;
    diffDelBorder: string;
}

const COMMON_FONTS = {
    sans: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "'Newsreader', ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif",
    mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    grotesk: "'Space Grotesk', ui-sans-serif, system-ui, -apple-system, sans-serif",
};

const COMMON_GEOMETRY = {
    borderWidth: '1px',
    borderWidthStrong: '2px',
    radiusCard: '12px',
    radiusInner: '8px',
    radiusButton: '8px',
    scrollbarSize: '4px',
    motionFast: '120ms',
    motionNormal: '180ms',
};

const COMMON_STATUS = {
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    error: '#ef4444',
};

function createTheme(base: Omit<ThemeTokens, 'timelineLine' | 'timelineNode' | 'timelineNodeActive' | 'timelineNodePulseShadow' | 'timelineNodeTool' | 'chipBg' | 'chipText' | 'codeBg' | 'codeBorder' | 'codeText' | 'diffDelBg' | 'diffDelBorder' | 'fontSans' | 'fontSerif' | 'fontMono' | 'fontGrotesk' | 'motionFast' | 'motionNormal' | 'borderWidth' | 'borderWidthStrong' | 'radiusCard' | 'radiusInner' | 'radiusButton' | 'scrollbarSize' | 'success' | 'warning' | 'danger' | 'error' | 'accentGlow'>, overrides?: Partial<ThemeTokens>): ThemeTokens {
    return {
        ...COMMON_FONTS,
        ...COMMON_GEOMETRY,
        ...COMMON_STATUS,
        ...base,
        accentGlow: base.accentSubtle,
        timelineLine: base.border,
        timelineNode: base.borderStrong,
        timelineNodeActive: base.accent,
        timelineNodePulseShadow: `0 0 0 2px ${base.accentSubtle}, 0 0 12px ${base.accentSubtle}`,
        timelineNodeTool: base.textSubtle,
        chipBg: base.surfaceMuted,
        chipText: base.textMuted,
        codeBg: base.surfaceMuted,
        codeBorder: base.border,
        codeText: base.text,
        diffDelBg: 'rgba(239, 68, 68, 0.1)',
        diffDelBorder: 'rgba(239, 68, 68, 0.2)',
        ...overrides,
    } as ThemeTokens;
}

export const THEME_TOKENS: Record<AgentThemeId, ThemeTokens> = {
    'warm-editorial': createTheme({
        bg: '#fdfcf8',
        surface: '#ffffff',
        surfaceMuted: '#f2f0eb',
        surfaceInset: '#f2f0eb',
        text: '#1a1a1a',
        textMuted: '#6e6e6e',
        textSubtle: '#a8a29e',
        textInverse: '#ffffff',
        border: '#e7e5e4',
        borderStrong: '#d6d3d1',
        accent: '#d97757',
        accentHover: '#c4664a',
        accentSubtle: 'rgba(217, 119, 87, 0.12)',
        accentContrast: '#ffffff',
        hoverBg: '#f5f5f4',
        hoverBgSubtle: '#fafaf9',
        shadowCard: '0 1px 3px rgba(0, 0, 0, 0.08)',
        shadowFloat: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        focusRing: 'rgba(214, 211, 209, 0.9)',
        link: '#d97757',
        scrollbarThumb: '#e5e5e5',
        scrollbarThumbHover: '#d4d4d4',
    }),
    'blueprint-architect': createTheme({
        bg: '#f7fbff',
        surface: 'rgba(255, 255, 255, 0.92)',
        surfaceMuted: 'rgba(239, 246, 255, 0.9)',
        surfaceInset: 'rgba(239, 246, 255, 0.9)',
        text: '#0b1220',
        textMuted: '#1f2a44',
        textSubtle: '#475569',
        textInverse: '#ffffff',
        border: 'rgba(37, 99, 235, 0.25)',
        borderStrong: 'rgba(37, 99, 235, 0.45)',
        accent: '#2563eb',
        accentHover: '#1d4ed8',
        accentSubtle: 'rgba(37, 99, 235, 0.12)',
        accentContrast: '#ffffff',
        hoverBg: 'rgba(37, 99, 235, 0.08)',
        hoverBgSubtle: 'rgba(37, 99, 235, 0.05)',
        shadowCard: '0 1px 3px rgba(2, 6, 23, 0.12)',
        shadowFloat: '0 10px 28px -10px rgba(2, 6, 23, 0.22)',
        focusRing: 'rgba(37, 99, 235, 0.4)',
        link: '#2563eb',
        scrollbarThumb: 'rgba(37, 99, 235, 0.2)',
        scrollbarThumbHover: 'rgba(37, 99, 235, 0.35)',
    }, {
        fontSans: COMMON_FONTS.grotesk,
        fontSerif: COMMON_FONTS.grotesk,
    }),
    'zen-journal': createTheme({
        bg: '#fafaf9',
        surface: 'rgba(255, 255, 255, 0.92)',
        surfaceMuted: 'rgba(245, 245, 244, 0.92)',
        surfaceInset: 'rgba(245, 245, 244, 0.92)',
        text: '#1c1917',
        textMuted: '#44403c',
        textSubtle: '#78716c',
        textInverse: '#ffffff',
        border: '#e7e5e4',
        borderStrong: '#d6d3d1',
        accent: '#57534e',
        accentHover: '#44403c',
        accentSubtle: 'rgba(87, 83, 78, 0.12)',
        accentContrast: '#ffffff',
        hoverBg: 'rgba(120, 113, 108, 0.08)',
        hoverBgSubtle: 'rgba(120, 113, 108, 0.05)',
        shadowCard: '0 1px 3px rgba(0, 0, 0, 0.06)',
        shadowFloat: '0 14px 34px -18px rgba(0, 0, 0, 0.18)',
        focusRing: 'rgba(87, 83, 78, 0.35)',
        link: '#57534e',
        scrollbarThumb: 'rgba(120, 113, 108, 0.15)',
        scrollbarThumbHover: 'rgba(120, 113, 108, 0.25)',
    }, {
        fontSans: COMMON_FONTS.serif,
        fontSerif: COMMON_FONTS.serif,
    }),
    'neo-pop': createTheme({
        bg: '#fff7ed',
        surface: '#ffffff',
        surfaceMuted: '#ffedd5',
        surfaceInset: '#ffffff',
        text: '#111827',
        textMuted: '#374151',
        textSubtle: '#6b7280',
        textInverse: '#ffffff',
        border: '#111827',
        borderStrong: '#111827',
        accent: '#ff3d7f',
        accentHover: '#ff1f6a',
        accentSubtle: 'rgba(255, 61, 127, 0.14)',
        accentContrast: '#ffffff',
        hoverBg: 'rgba(17, 24, 39, 0.06)',
        hoverBgSubtle: 'rgba(17, 24, 39, 0.04)',
        shadowCard: '6px 6px 0 0 #111827',
        shadowFloat: '8px 8px 0 0 #111827',
        focusRing: 'rgba(17, 24, 39, 0.35)',
        link: '#22d3ee',
        scrollbarThumb: 'rgba(17, 24, 39, 0.25)',
        scrollbarThumbHover: 'rgba(17, 24, 39, 0.4)',
    }, {
        borderWidth: '4px',
        borderWidthStrong: '4px',
        radiusCard: '0px',
        radiusInner: '0px',
        radiusButton: '0px',
    }),
    'dark-console': createTheme({
        bg: '#0f1117',
        surface: '#0f1117',
        surfaceMuted: '#0a0c10',
        surfaceInset: '#1a1d26',
        text: '#e5e7eb',
        textMuted: '#9ca3af',
        textSubtle: '#6b7280',
        textInverse: '#0a0c10',
        border: '#1f2937',
        borderStrong: '#374151',
        accent: '#c084fc',
        accentHover: '#d8b4fe',
        accentSubtle: 'rgba(192, 132, 252, 0.14)',
        accentContrast: '#0a0c10',
        hoverBg: 'rgba(255, 255, 255, 0.06)',
        hoverBgSubtle: 'rgba(255, 255, 255, 0.04)',
        shadowCard: 'none',
        shadowFloat: 'none',
        focusRing: 'rgba(192, 132, 252, 0.35)',
        link: '#60a5fa',
        scrollbarThumb: 'rgba(255, 255, 255, 0.12)',
        scrollbarThumbHover: 'rgba(255, 255, 255, 0.22)',
    }, {
        fontSans: COMMON_FONTS.mono,
        fontSerif: COMMON_FONTS.mono,
    }),
    'swiss-grid': createTheme({
        bg: '#ffffff',
        surface: '#ffffff',
        surfaceMuted: '#f3f4f6',
        surfaceInset: '#ffffff',
        text: '#000000',
        textMuted: '#374151',
        textSubtle: '#6b7280',
        textInverse: '#ffffff',
        border: '#000000',
        borderStrong: '#000000',
        accent: '#000000',
        accentHover: '#111827',
        accentSubtle: 'rgba(0, 0, 0, 0.06)',
        accentContrast: '#ffffff',
        hoverBg: '#f3f4f6',
        hoverBgSubtle: '#f9fafb',
        shadowCard: '4px 4px 0 0 rgba(0, 0, 0, 1)',
        shadowFloat: '4px 4px 0 0 rgba(0, 0, 0, 1)',
        focusRing: 'rgba(0, 0, 0, 0.5)',
        link: '#000000',
        scrollbarThumb: 'rgba(0, 0, 0, 0.25)',
        scrollbarThumbHover: 'rgba(0, 0, 0, 0.4)',
    }, {
        fontSans: COMMON_FONTS.grotesk,
        fontSerif: COMMON_FONTS.grotesk,
        borderWidth: '2px',
        borderWidthStrong: '2px',
        radiusCard: '0px',
        radiusInner: '0px',
        radiusButton: '0px',
    }),
    'glass-morphism': createTheme({
        bg: 'rgba(20, 20, 25, 0.65)', // High transparency dark bg
        surface: 'rgba(30, 30, 35, 0.4)', // Very sheer surface
        surfaceMuted: 'rgba(255, 255, 255, 0.05)',
        surfaceInset: 'rgba(0, 0, 0, 0.2)',
        text: '#ffffff',
        textMuted: 'rgba(255, 255, 255, 0.7)',
        textSubtle: 'rgba(255, 255, 255, 0.5)',
        textInverse: '#000000',
        border: 'rgba(255, 255, 255, 0.1)',
        borderStrong: 'rgba(255, 255, 255, 0.2)',
        accent: '#38bdf8', // Sky blue
        accentHover: '#7dd3fc',
        accentSubtle: 'rgba(56, 189, 248, 0.15)',
        accentContrast: '#000000',
        hoverBg: 'rgba(255, 255, 255, 0.1)',
        hoverBgSubtle: 'rgba(255, 255, 255, 0.05)',
        shadowCard: '0 8px 32px 0 rgba(0, 0, 0, 0.36)', // Soft deep shadow
        shadowFloat: '0 8px 32px 0 rgba(0, 0, 0, 0.36)',
        focusRing: 'rgba(56, 189, 248, 0.5)',
        link: '#38bdf8',
        scrollbarThumb: 'rgba(255, 255, 255, 0.2)',
        scrollbarThumbHover: 'rgba(255, 255, 255, 0.35)',
    }, {
        fontSans: COMMON_FONTS.sans,
        fontSerif: COMMON_FONTS.sans, // Clean sans for glass
        radiusCard: '16px', // Rounded for modern feel
    }),
};

export function getThemeTokens(themeId: AgentThemeId): ThemeTokens {
    return THEME_TOKENS[themeId] || THEME_TOKENS['warm-editorial'];
}

export function applyThemeTokens(themeId: AgentThemeId, target: HTMLElement): void {
    const tokens = getThemeTokens(themeId);
    const prefix = '--ac-';

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
        accentGlow: 'accent-glow',
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
        error: 'error',
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
        diffDelBg: 'diff-del-bg',
        diffDelBorder: 'diff-del-border',
    };

    Object.entries(mapping).forEach(([key, varName]) => {
        const value = tokens[key as keyof ThemeTokens];
        if (value) {
            target.style.setProperty(`${prefix}${varName}`, value);
        }
    });

    // Semantic font variables
    target.style.setProperty('--ac-font-body', tokens.fontSans);
    target.style.setProperty('--ac-font-heading', tokens.fontSerif);
    target.style.setProperty('--ac-font-code', tokens.fontMono);
}
