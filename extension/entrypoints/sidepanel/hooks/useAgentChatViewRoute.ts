/**
 * Hook for managing AgentChat view routing.
 *
 * Handles navigation between 'sessions' (list) and 'chat' (conversation) views
 * without requiring react-router. Supports URL parameters for deep linking.
 */
import { useState, useCallback, useMemo } from 'react';

// =============================================================================
// Types
// =============================================================================

/** Available view modes */
export type AgentChatView = 'sessions' | 'chat';

/** Route state */
export interface AgentChatRouteState {
    view: AgentChatView;
    sessionId: string | null;
}

/** Options for useAgentChatViewRoute */
export interface UseAgentChatViewRouteOptions {
    /**
     * Callback when route changes.
     * Called after internal state is updated.
     */
    onRouteChange?: (state: AgentChatRouteState) => void;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_VIEW: AgentChatView = 'sessions';
const URL_PARAM_VIEW = 'view';
const URL_PARAM_SESSION_ID = 'sessionId';

// =============================================================================
// Helpers
// =============================================================================

/**
 * Parse view from URL parameter.
 * Returns default if invalid.
 */
function parseView(value: string | null): AgentChatView {
    if (value === 'sessions' || value === 'chat') {
        return value;
    }
    return DEFAULT_VIEW;
}

/**
 * Update URL parameters without page reload.
 * Preserves existing parameters (like `tab`).
 */
function updateUrlParams(view: AgentChatView, sessionId: string | null): void {
    try {
        const url = new URL(window.location.href);

        // Update view param
        if (view === DEFAULT_VIEW) {
            url.searchParams.delete(URL_PARAM_VIEW);
        } else {
            url.searchParams.set(URL_PARAM_VIEW, view);
        }

        // Update sessionId param
        if (sessionId) {
            url.searchParams.set(URL_PARAM_SESSION_ID, sessionId);
        } else {
            url.searchParams.delete(URL_PARAM_SESSION_ID);
        }

        // Update URL without reload
        window.history.replaceState({}, '', url.toString());
    } catch {
        // Ignore URL update errors (e.g., in non-browser environment)
    }
}

// =============================================================================
// Hook
// =============================================================================

export function useAgentChatViewRoute(options: UseAgentChatViewRouteOptions = {}) {
    // ==========================================================================
    // State
    // ==========================================================================

    const [currentView, setCurrentView] = useState<AgentChatView>(DEFAULT_VIEW);
    const [currentSessionId, setCurrentSessionIdState] = useState<string | null>(null);

    // ==========================================================================
    // Computed
    // ==========================================================================

    /** Whether currently showing sessions list */
    const isSessionsView = currentView === 'sessions';

    /** Whether currently showing chat conversation */
    const isChatView = currentView === 'chat';

    /** Current route state */
    const routeState = useMemo<AgentChatRouteState>(() => ({
        view: currentView,
        sessionId: currentSessionId,
    }), [currentView, currentSessionId]);

    // ==========================================================================
    // Actions
    // ==========================================================================

    /**
     * Navigate to sessions list view.
     * Clears sessionId from URL.
     */
    const goToSessions = useCallback((): void => {
        setCurrentView('sessions');
        // Don't clear sessionId internally - it's used to highlight selected session
        updateUrlParams('sessions', null);
        options.onRouteChange?.({ view: 'sessions', sessionId: currentSessionId });
    }, [currentSessionId, options]);

    /**
     * Navigate to chat view for a specific session.
     * @param sessionId - Session ID to open
     */
    const goToChat = useCallback((sessionId: string): void => {
        if (!sessionId) {
            console.warn('[useAgentChatViewRoute] goToChat called without sessionId');
            return;
        }

        setCurrentView('chat');
        setCurrentSessionIdState(sessionId);
        updateUrlParams('chat', sessionId);
        options.onRouteChange?.({ view: 'chat', sessionId });
    }, [options]);

    /**
     * Initialize route from URL parameters.
     * Should be called on mount.
     * @returns Initial route state
     */
    const initFromUrl = useCallback((): AgentChatRouteState => {
        try {
            const params = new URLSearchParams(window.location.search);
            const viewParam = params.get(URL_PARAM_VIEW);
            const sessionIdParam = params.get(URL_PARAM_SESSION_ID);

            const view = parseView(viewParam);
            const sessionId = sessionIdParam?.trim() || null;

            // If view=chat but no sessionId, fall back to sessions
            if (view === 'chat' && !sessionId) {
                setCurrentView('sessions');
                setCurrentSessionIdState(null);
            } else {
                setCurrentView(view);
                setCurrentSessionIdState(sessionId);
            }

            return {
                view: (view === 'chat' && !sessionId) ? 'sessions' : view,
                sessionId: (view === 'chat' && !sessionId) ? null : sessionId
            };
        } catch {
            // Use defaults on error
            setCurrentView(DEFAULT_VIEW);
            setCurrentSessionIdState(null);
            return { view: DEFAULT_VIEW, sessionId: null };
        }
    }, []);

    /**
     * Update session ID without changing view.
     * Updates URL based on current view and sessionId:
     * - In chat view: always update URL with sessionId
     * - In sessions view with null sessionId: clear sessionId from URL (cleanup)
     */
    const setSessionId = useCallback((sessionId: string | null): void => {
        setCurrentSessionIdState(sessionId);

        // Using ref/callback logic here is tricky because we need currentView. 
        // Since useCallback deps include currentView, this function recreates on view change.
        // This is expected.

        // HOWEVER, we need to be careful. In the original Vue code `currentView.value` was accessed directly.
        // Here we use the state variable.
        // To ensure we have the absolute latest state if called in rapid succession with view changes,
        // we should ideally use functional updates, but currentView doesn't change here.

        // Note: We need to access the LATEST currentView. If `setSessionId` is called inside a closure
        // where `currentView` is stale, logic might be wrong.
        // But since we put currentView in dependency array, the function updates.

        if (currentView === 'chat') {
            // In chat view, always sync URL with current sessionId
            updateUrlParams('chat', sessionId);
        } else if (sessionId === null) {
            // In sessions view, clear any stale sessionId from URL
            updateUrlParams('sessions', null);
        }
    }, [currentView]);

    return {
        // State
        currentView,
        currentSessionId,

        // Computed
        isSessionsView,
        isChatView,
        routeState,

        // Actions
        goToSessions,
        goToChat,
        initFromUrl,
        setSessionId,
    };
}

export type UseAgentChatViewRoute = ReturnType<typeof useAgentChatViewRoute>;
