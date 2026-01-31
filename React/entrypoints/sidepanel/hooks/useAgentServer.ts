import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { NativeMessageType, type AgentEngineInfo, type RealtimeEvent } from 'chrome-mcp-shared';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';

interface ServerStatus {
    isRunning: boolean;
    port?: number;
    lastUpdated: number;
}

export interface UseAgentServerOptions {
    /**
     * Get the session ID for SSE routing.
     * Must be provided by caller (typically DB session ID).
     */
    getSessionId?: () => string | null;
    onMessage?: (event: RealtimeEvent) => void;
    onError?: (error: string) => void;
}

export function useAgentServer(options: UseAgentServerOptions = {}) {
    // State
    const [serverPort, setServerPort] = useState<number | null>(null);
    const [nativeConnected, setNativeConnected] = useState(false);
    const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [engines, setEngines] = useState<AgentEngineInfo[]>([]);

    // Refs for non-render state
    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const currentStreamSessionIdRef = useRef<string | null>(null);
    const serverPortRef = useRef<number | null>(null); // To access inside SSE callbacks if needed

    // Sync ref
    useEffect(() => {
        serverPortRef.current = serverPort;
    }, [serverPort]);

    const MAX_RECONNECT_ATTEMPTS = 5;
    const BASE_RECONNECT_DELAY = 1000;

    // Computed
    const isServerReady = useMemo(() => {
        return nativeConnected && serverStatus && serverStatus.isRunning && serverPort !== null;
    }, [nativeConnected, serverStatus, serverPort]);

    const isServerReadyRef = useRef(isServerReady);
    useEffect(() => { isServerReadyRef.current = isServerReady; }, [isServerReady]);

    // Check native host connection using existing message type
    const checkNativeHost = useCallback(async (): Promise<boolean> => {
        try {
            const response = await chrome.runtime.sendMessage({
                type: NativeMessageType.PING_NATIVE,
            });
            const connected = response?.connected ?? false;
            setNativeConnected(connected);
            return connected;
        } catch (error) {
            console.error('Failed to check native host:', error);
            setNativeConnected(false);
            return false;
        }
    }, []);

    /**
     * Start native host connection.
     * @param forceConnect - If true, use CONNECT_NATIVE (re-enables auto-connect).
     *                       If false, use ENSURE_NATIVE (respects current auto-connect setting).
     */
    const startNativeHost = useCallback(async (forceConnect = false): Promise<boolean> => {
        try {
            const response = await chrome.runtime.sendMessage({
                type: forceConnect ? NativeMessageType.CONNECT_NATIVE : NativeMessageType.ENSURE_NATIVE,
            });
            // Handle both response formats: { connected: boolean } and { success: boolean }
            const connected =
                typeof response?.connected === 'boolean'
                    ? response.connected
                    : (response?.success ?? false);

            setNativeConnected(connected);
            return connected;
        } catch (error) {
            console.error('Failed to start native host:', error);
            setNativeConnected(false);
            return false;
        }
    }, []);

    // Get server status using existing message type
    const getServerStatus = useCallback(async (): Promise<ServerStatus | null> => {
        try {
            const response = await chrome.runtime.sendMessage({
                type: BACKGROUND_MESSAGE_TYPES.GET_SERVER_STATUS,
            });
            if (response?.serverStatus) {
                setServerStatus(response.serverStatus);
                if (response.serverStatus.port) {
                    setServerPort(response.serverStatus.port);
                }
                // Also update native connected status from response
                if (typeof response.connected === 'boolean') {
                    setNativeConnected(response.connected);
                }
                return response.serverStatus;
            }
            return null;
        } catch (error) {
            console.error('Failed to get server status:', error);
            return null;
        }
    }, []);

    // Fetch available engines
    const fetchEngines = useCallback(async (): Promise<void> => {
        if (!serverPortRef.current) return;
        try {
            const url = `http://127.0.0.1:${serverPortRef.current}/agent/engines`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setEngines(data.engines || []);
            }
        } catch (error) {
            console.error('Failed to fetch engines:', error);
        }
    }, []);

    interface EnsureNativeServerOptions {
        /** If true, use CONNECT_NATIVE to re-enable auto-connect */
        forceConnect?: boolean;
    }

    // Ensure native server is ready
    const ensureNativeServer = useCallback(async (opts: EnsureNativeServerOptions = {}): Promise<boolean> => {
        const { forceConnect = false } = opts;
        setConnecting(true);
        try {
            // Step 1: Check native host connection
            let connected = await checkNativeHost();
            if (!connected) {
                // Try to start native host
                connected = await startNativeHost(forceConnect);
                if (!connected) {
                    console.error('Failed to connect to native host');
                    return false;
                }
                // Wait for connection to stabilize
                await new Promise((resolve) => setTimeout(resolve, 500));
            }

            // Step 2: Get server status
            const status = await getServerStatus();
            if (!status?.isRunning || !status.port) {
                console.error('Server not running or port not available', status);
                return false;
            }

            // Step 3: Fetch engines
            await fetchEngines();

            return true;
        } finally {
            setConnecting(false);
        }
    }, [checkNativeHost, startNativeHost, getServerStatus, fetchEngines]);

    // Check if SSE is connected
    const isEventSourceConnected = useCallback((): boolean => {
        return eventSourceRef.current !== null && eventSourceRef.current.readyState === EventSource.OPEN;
    }, []);

    const closeEventSource = useCallback((): void => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        currentStreamSessionIdRef.current = null;
    }, []);

    // Open SSE connection (skip if already connected to same session)
    const openEventSource = useCallback((): void => {
        const targetSessionId = options.getSessionId?.()?.trim() ?? '';
        const port = serverPortRef.current;

        if (!port || !targetSessionId) return;

        // Skip if already connected to the same session
        if (isEventSourceConnected() && currentStreamSessionIdRef.current === targetSessionId) {
            console.log('[AgentServer] SSE already connected to session, skipping reconnect');
            return;
        }

        // Close existing connection before subscribing to a new session
        closeEventSource();

        currentStreamSessionIdRef.current = targetSessionId;
        const url = `http://127.0.0.1:${port}/agent/chat/${encodeURIComponent(targetSessionId)}/stream`;

        const es = new EventSource(url);
        eventSourceRef.current = es;

        es.onopen = () => {
            console.log('[AgentServer] SSE connection opened');
            reconnectAttemptsRef.current = 0;
        };

        es.onmessage = (event) => {
            try {
                const parsed = JSON.parse(event.data) as RealtimeEvent;
                options.onMessage?.(parsed);
            } catch (err) {
                console.error('[AgentServer] Failed to parse SSE message:', err);
            }
        };

        es.onerror = (error) => {
            console.error('[AgentServer] SSE error:', error);
            es.close();
            eventSourceRef.current = null;

            // Attempt reconnection with exponential backoff
            if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
                reconnectAttemptsRef.current++;
                console.log(`[AgentServer] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
                setTimeout(() => {
                    if (isServerReadyRef.current) {
                        openEventSource();
                    }
                }, delay);
            } else {
                options.onError?.('SSE connection failed after multiple attempts');
            }
        };
    }, [options, isEventSourceConnected, closeEventSource]); // Dependencies are supposedly stable

    // Reconnect to server (explicit user action, re-enables auto-connect)
    const reconnect = useCallback(async (): Promise<void> => {
        closeEventSource();
        reconnectAttemptsRef.current = 0;
        // Explicit user reconnect: force connect to re-enable auto-connect in background
        await ensureNativeServer({ forceConnect: true });

        if (serverPortRef.current) {
            openEventSource();
        }
    }, [closeEventSource, ensureNativeServer, openEventSource]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            closeEventSource();
        };
    }, [closeEventSource]);

    return {
        serverPort,
        nativeConnected,
        serverStatus, // isRunning, etc
        isServerReady,
        engines,
        connecting,

        // Expose initialize alias for consistency
        initialize: () => ensureNativeServer(),
        ensureNativeServer,
        reconnect,
        openEventSource,
        fetchEngines
    };
}
