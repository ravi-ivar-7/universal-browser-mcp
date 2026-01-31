import { AgentThemeId } from '../hooks/useAgentTheme';

export interface ThemeTokens {
    bg: string;
    surface: string;
    surfaceMuted: string;
    text: string;
    textMuted: string;
    textSubtle: string;
    border: string;
    borderStrong: string;
    accent: string;
    accentContrast: string;
    hoverBg: string;
    shadowFloat: string;
    radiusInner: string;
    radiusButton: string;
    link: string;
    danger: string;
    fontSans: string;
    fontMono: string;
}

export const THEME_TOKENS: Record<AgentThemeId, ThemeTokens> = {
    'warm-editorial': {
        bg: '#fdfcf8',
        surface: '#ffffff',
        surfaceMuted: '#f2f0eb',
        text: '#1a1a1a',
        textMuted: '#6e6e6e',
        textSubtle: '#a8a29e',
        border: '#e7e5e4',
        borderStrong: '#d6d3d1',
        accent: '#d97757',
        accentContrast: '#ffffff',
        hoverBg: '#f5f5f4',
        shadowFloat: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        radiusInner: '8px',
        radiusButton: '8px',
        link: '#d97757',
        danger: '#ef4444',
        fontSans: "'Inter', sans-serif",
        fontMono: "'JetBrains Mono', monospace",
    },
    'blueprint-architect': {
        bg: '#f7fbff',
        surface: 'rgba(255, 255, 255, 0.92)',
        surfaceMuted: 'rgba(239, 246, 255, 0.9)',
        text: '#0b1220',
        textMuted: '#1f2a44',
        textSubtle: '#475569',
        border: 'rgba(37, 99, 235, 0.25)',
        borderStrong: 'rgba(37, 99, 235, 0.45)',
        accent: '#2563eb',
        accentContrast: '#ffffff',
        hoverBg: 'rgba(37, 99, 235, 0.08)',
        shadowFloat: '0 10px 28px -10px rgba(2, 6, 23, 0.22)',
        radiusInner: '8px',
        radiusButton: '8px',
        link: '#2563eb',
        danger: '#ef4444',
        fontSans: "'Space Grotesk', sans-serif",
        fontMono: "'JetBrains Mono', monospace",
    },
    'zen-journal': {
        bg: '#fafaf9',
        surface: 'rgba(255, 255, 255, 0.92)',
        surfaceMuted: 'rgba(245, 245, 244, 0.92)',
        text: '#1c1917',
        textMuted: '#44403c',
        textSubtle: '#78716c',
        border: '#e7e5e4',
        borderStrong: '#d6d3d1',
        accent: '#57534e',
        accentContrast: '#ffffff',
        hoverBg: 'rgba(120, 113, 108, 0.08)',
        shadowFloat: '0 14px 34px -18px rgba(0, 0, 0, 0.18)',
        radiusInner: '8px',
        radiusButton: '8px',
        link: '#57534e',
        danger: '#dc2626',
        fontSans: "'Inter', sans-serif",
        fontMono: "'JetBrains Mono', monospace",
    },
    'neo-pop': {
        bg: '#fff7ed',
        surface: '#ffffff',
        surfaceMuted: '#ffedd5',
        text: '#111827',
        textMuted: '#374151',
        textSubtle: '#6b7280',
        border: '#111827',
        borderStrong: '#111827',
        accent: '#ff3d7f',
        accentContrast: '#ffffff',
        hoverBg: 'rgba(17, 24, 39, 0.06)',
        shadowFloat: '8px 8px 0 0 #111827',
        radiusInner: '0px',
        radiusButton: '0px',
        link: '#22d3ee',
        danger: '#ef4444',
        fontSans: "'Inter', sans-serif",
        fontMono: "'JetBrains Mono', monospace",
    },
    'dark-console': {
        bg: '#0f1117',
        surface: '#0f1117',
        surfaceMuted: '#0a0c10',
        text: '#e5e7eb',
        textMuted: '#9ca3af',
        textSubtle: '#6b7280',
        border: '#1f2937',
        borderStrong: '#374151',
        accent: '#c084fc',
        accentContrast: '#0a0c10',
        hoverBg: 'rgba(255, 255, 255, 0.06)',
        shadowFloat: 'none',
        radiusInner: '8px',
        radiusButton: '8px',
        link: '#60a5fa',
        danger: '#f87171',
        fontSans: "'JetBrains Mono', monospace",
        fontMono: "'JetBrains Mono', monospace",
    },
    'swiss-grid': {
        bg: '#ffffff',
        surface: '#ffffff',
        surfaceMuted: '#f3f4f6',
        text: '#000000',
        textMuted: '#374151',
        textSubtle: '#6b7280',
        border: '#000000',
        borderStrong: '#000000',
        accent: '#000000',
        accentContrast: '#ffffff',
        hoverBg: '#f3f4f6',
        shadowFloat: '4px 4px 0 0 rgba(0, 0, 0, 1)',
        radiusInner: '0px',
        radiusButton: '0px',
        link: '#000000',
        danger: '#ef4444',
        fontSans: "'Space Grotesk', sans-serif",
        fontMono: "'JetBrains Mono', monospace",
    },
};

export function getThemeTokens(themeId: AgentThemeId): ThemeTokens {
    return THEME_TOKENS[themeId] || THEME_TOKENS['warm-editorial'];
}
