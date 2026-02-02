/**
 * @fileoverview RR V3 Port-RPC Client Hook (React)
 * @description RPC client for UI components to connect with Background Service Worker
 *
 * This hook is shared between Sidepanel, Builder, and other UI entrypoints.
 *
 * Responsibilities:
 * - Connect to background via chrome.runtime.Port
 * - Provide request/response RPC calls (with timeout and cancellation)
 * - Support event stream subscription
 * - Auto-reconnect with exponential backoff
 *
 * Design considerations:
 * - MV3 service worker may be terminated due to idle, causing Port disconnect
 * - Implement idempotent reconnection and subscription recovery
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import type { JsonObject, JsonValue } from '@/entrypoints/background/record-replay-v3/domain/json';
import type { RunEvent } from '@/entrypoints/background/record-replay-v3/domain/events';
import type { RunId } from '@/entrypoints/background/record-replay-v3/domain/ids';
import {
    RR_V3_PORT_NAME,
    createRpcRequest,
    isRpcEvent,
    isRpcResponse,
    type RpcMethod,
} from '@/entrypoints/background/record-replay-v3/engine/transport/rpc';

// ==================== Types ====================

/** RPC request options */
export interface RpcRequestOptions {
    /** Timeout in milliseconds, 0 means no timeout */
    timeoutMs?: number;
    /** Abort signal for cancellation */
    signal?: AbortSignal;
}

/** Hook configuration */
export interface UseRRV3RpcOptions {
    /** Default request timeout (ms) */
    requestTimeoutMs?: number;
    /** Maximum reconnect attempts */
    maxReconnectAttempts?: number;
    /** Base delay for reconnection (ms) */
    baseReconnectDelayMs?: number;
    /** Auto-connect on initialization */
    autoConnect?: boolean;
    /** Connection state change callback */
    onConnectionChange?: (connected: boolean) => void;
    /** Error callback */
    onError?: (error: string) => void;
}

/** Event listener function */
type EventListener = (event: RunEvent) => void;

/** Pending request entry */
interface PendingRequest {
    method: RpcMethod;
    resolve: (value: JsonValue) => void;
    reject: (error: Error) => void;
    timeoutId: ReturnType<typeof setTimeout> | null;
    /** AbortSignal reference for cleanup */
    signal?: AbortSignal;
    /** Abort handler for cleanup */
    abortHandler?: () => void;
}

/** Hook return type */
export interface UseRRV3Rpc {
    // Connection state
    connected: boolean;
    connecting: boolean;
    reconnecting: boolean;
    reconnectAttempts: number;
    lastError: string | null;
    isReady: boolean;

    // Diagnostics
    pendingCount: number;
    subscribedRunIds: Array<RunId | null>;

    // Connection lifecycle
    connect: () => Promise<boolean>;
    disconnect: (reason?: string) => void;
    ensureConnected: () => Promise<boolean>;

    // RPC calls
    request: <T extends JsonValue = JsonValue>(
        method: RpcMethod,
        params?: JsonObject,
        options?: RpcRequestOptions,
    ) => Promise<T>;

    // Event subscription
    subscribe: (runId?: RunId | null) => Promise<boolean>;
    unsubscribe: (runId?: RunId | null) => Promise<boolean>;
    onEvent: (listener: EventListener) => () => void;
}

// ==================== Helpers ====================

function toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function isRunEvent(value: unknown): value is RunEvent {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    return (
        typeof obj.runId === 'string' &&
        typeof obj.type === 'string' &&
        typeof obj.seq === 'number' &&
        typeof obj.ts === 'number'
    );
}

// ==================== Hook ====================

/**
 * RR V3 Port-RPC client (React Hook)
 */
export function useRRV3Rpc(options: UseRRV3RpcOptions = {}): UseRRV3Rpc {
    // Configuration
    const DEFAULT_TIMEOUT_MS = options.requestTimeoutMs ?? 12_000;
    const MAX_RECONNECT_ATTEMPTS = options.maxReconnectAttempts ?? 8;
    const BASE_RECONNECT_DELAY_MS = options.baseReconnectDelayMs ?? 500;

    // Reactive state
    const [connected, setConnectedState] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [reconnecting, setReconnecting] = useState(false);
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const [lastError, setLastError] = useState<string | null>(null);
    const [pendingCount, setPendingCount] = useState(0);
    const [subscribedRunIds, setSubscribedRunIds] = useState<Array<RunId | null>>([]);

    // Refs for mutable state
    const portRef = useRef<chrome.runtime.Port | null>(null);
    const pendingRequestsRef = useRef(new Map<string, PendingRequest>());
    const eventListenersRef = useRef(new Set<EventListener>());
    const desiredSubscriptionsRef = useRef(new Set<RunId | null>());
    const connectPromiseRef = useRef<Promise<boolean> | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const manualDisconnectRef = useRef(false);
    const optionsRef = useRef(options);

    // Keep options ref updated
    useEffect(() => {
        optionsRef.current = options;
    }, [options]);

    // Computed
    const isReady = useMemo(() => connected && portRef.current !== null, [connected]);

    // ==================== Internal Methods ====================

    const setError = useCallback((message: string | null): void => {
        setLastError(message);
        if (message) optionsRef.current.onError?.(message);
    }, []);

    const setConnected = useCallback((next: boolean): void => {
        setConnectedState((prev) => {
            if (prev !== next) {
                optionsRef.current.onConnectionChange?.(next);
            }
            return next;
        });
    }, []);

    const syncSubscriptionsSnapshot = useCallback((): void => {
        const arr = Array.from(desiredSubscriptionsRef.current.values());
        arr.sort((a, b) => {
            if (a === null && b === null) return 0;
            if (a === null) return -1;
            if (b === null) return 1;
            return String(a).localeCompare(String(b));
        });
        setSubscribedRunIds(arr);
    }, []);

    const cleanupPendingRequest = useCallback((entry: PendingRequest): void => {
        if (entry.timeoutId) {
            clearTimeout(entry.timeoutId);
            entry.timeoutId = null;
        }
        if (entry.signal && entry.abortHandler) {
            try {
                entry.signal.removeEventListener('abort', entry.abortHandler);
            } catch {
                // Ignore - signal may be invalid
            }
        }
    }, []);

    const rejectAllPending = useCallback(
        (reason: string): void => {
            const error = new Error(reason);
            for (const [requestId, entry] of pendingRequestsRef.current) {
                cleanupPendingRequest(entry);
                entry.reject(error);
                pendingRequestsRef.current.delete(requestId);
            }
            setPendingCount(0);
        },
        [cleanupPendingRequest],
    );

    // Forward declarations for mutual recursion
    const connectRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false));
    const requestRef = useRef<UseRRV3Rpc['request']>(async () => {
        throw new Error('Not initialized');
    });

    const rehydrateSubscriptions = useCallback(async (): Promise<void> => {
        if (!isReady || desiredSubscriptionsRef.current.size === 0) return;

        for (const runId of desiredSubscriptionsRef.current) {
            try {
                const params: JsonObject = runId === null ? {} : { runId };
                await requestRef.current('rr_v3.subscribe', params).catch(() => {
                    // Best-effort, ignore errors
                });
            } catch {
                // Ignore
            }
        }
    }, [isReady]);

    const scheduleReconnect = useCallback((): void => {
        if (manualDisconnectRef.current || reconnectTimerRef.current) return;

        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            setReconnecting(false);
            setError('RR V3 RPC: max reconnect attempts reached');
            return;
        }

        setReconnecting(true);
        const delay = BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts);

        reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            setReconnectAttempts((prev) => prev + 1);
            void connectRef.current().then((ok) => {
                if (!ok) scheduleReconnect();
            });
        }, delay);
    }, [reconnectAttempts, MAX_RECONNECT_ATTEMPTS, BASE_RECONNECT_DELAY_MS, setError]);

    // ==================== Port Handlers ====================

    const handlePortDisconnect = useCallback((): void => {
        const disconnectReason = chrome.runtime.lastError?.message;
        const reason = disconnectReason
            ? `RR V3 RPC disconnected: ${disconnectReason}`
            : 'RR V3 RPC disconnected';

        portRef.current = null;
        setConnected(false);
        setConnecting(false);
        rejectAllPending(reason);

        if (!manualDisconnectRef.current) {
            setError(reason);
            scheduleReconnect();
        }
    }, [setConnected, rejectAllPending, setError, scheduleReconnect]);

    const handlePortMessage = useCallback(
        (msg: unknown): void => {
            // Handle RPC response
            if (isRpcResponse(msg)) {
                const entry = pendingRequestsRef.current.get(msg.requestId);
                if (!entry) return;

                pendingRequestsRef.current.delete(msg.requestId);
                setPendingCount(pendingRequestsRef.current.size);

                cleanupPendingRequest(entry);

                if (msg.ok) {
                    entry.resolve(msg.result as JsonValue);
                } else {
                    entry.reject(new Error(msg.error || `RPC error: ${entry.method}`));
                }
                return;
            }

            // Handle event push
            if (isRpcEvent(msg)) {
                const event = msg.event;
                if (!isRunEvent(event)) return;

                for (const listener of eventListenersRef.current) {
                    try {
                        listener(event);
                    } catch (e) {
                        console.error('[useRRV3Rpc] Event listener error:', e);
                    }
                }
            }
        },
        [cleanupPendingRequest],
    );

    // ==================== Public Methods ====================

    const connect = useCallback(async (): Promise<boolean> => {
        if (isReady) return true;
        if (connectPromiseRef.current) return connectPromiseRef.current;

        connectPromiseRef.current = (async () => {
            manualDisconnectRef.current = false;
            setConnecting(true);
            setError(null);

            try {
                if (typeof chrome === 'undefined' || !chrome.runtime?.connect) {
                    setError('chrome.runtime.connect not available');
                    return false;
                }

                const p = chrome.runtime.connect({ name: RR_V3_PORT_NAME });
                portRef.current = p;

                setReconnectAttempts(0);
                setReconnecting(false);
                if (reconnectTimerRef.current) {
                    clearTimeout(reconnectTimerRef.current);
                    reconnectTimerRef.current = null;
                }

                p.onMessage.addListener(handlePortMessage);
                p.onDisconnect.addListener(handlePortDisconnect);

                setConnected(true);

                void rehydrateSubscriptions();

                return true;
            } catch (error) {
                setError(`Connection failed: ${toErrorMessage(error)}`);
                return false;
            } finally {
                setConnecting(false);
                connectPromiseRef.current = null;
            }
        })();

        return connectPromiseRef.current;
    }, [isReady, setError, handlePortMessage, handlePortDisconnect, setConnected, rehydrateSubscriptions]);

    // Update ref
    connectRef.current = connect;

    const disconnect = useCallback(
        (reason?: string): void => {
            manualDisconnectRef.current = true;

            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            setReconnecting(false);

            const p = portRef.current;
            portRef.current = null;
            setConnected(false);
            setConnecting(false);

            rejectAllPending(reason || 'RR V3 RPC: client disconnected');

            if (p) {
                try {
                    p.onMessage.removeListener(handlePortMessage);
                    p.onDisconnect.removeListener(handlePortDisconnect);
                    p.disconnect();
                } catch {
                    // Ignore
                }
            }
        },
        [setConnected, rejectAllPending, handlePortMessage, handlePortDisconnect],
    );

    const ensureConnected = useCallback(async (): Promise<boolean> => {
        if (isReady) return true;
        return connect();
    }, [isReady, connect]);

    const request = useCallback(
        async <T extends JsonValue = JsonValue>(
            method: RpcMethod,
            params?: JsonObject,
            reqOptions: RpcRequestOptions = {},
        ): Promise<T> => {
            const ready = await ensureConnected();
            const p = portRef.current;

            if (!ready || !p) {
                throw new Error('RR V3 RPC: not connected');
            }

            const timeoutMs = reqOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS;
            const { signal } = reqOptions;

            if (signal?.aborted) {
                throw new Error('RPC request already aborted');
            }

            const req = createRpcRequest(method, params);

            return new Promise<T>((resolve, reject) => {
                const entry: PendingRequest = {
                    method,
                    resolve: resolve as (value: JsonValue) => void,
                    reject,
                    timeoutId: null,
                    signal,
                };

                const complete = (fn: () => void) => {
                    pendingRequestsRef.current.delete(req.requestId);
                    setPendingCount(pendingRequestsRef.current.size);
                    cleanupPendingRequest(entry);
                    fn();
                };

                if (timeoutMs > 0) {
                    entry.timeoutId = setTimeout(() => {
                        complete(() => reject(new Error(`RPC timeout (${timeoutMs}ms): ${method}`)));
                    }, timeoutMs);
                }

                if (signal) {
                    const onAbort = () => {
                        complete(() => reject(new Error('RPC request aborted')));
                    };
                    entry.abortHandler = onAbort;
                    signal.addEventListener('abort', onAbort, { once: true });
                }

                pendingRequestsRef.current.set(req.requestId, entry);
                setPendingCount(pendingRequestsRef.current.size);

                try {
                    p.postMessage(req);
                } catch (e) {
                    complete(() => reject(new Error(`Failed to send RPC request: ${toErrorMessage(e)}`)));
                }
            });
        },
        [ensureConnected, DEFAULT_TIMEOUT_MS, cleanupPendingRequest],
    );

    // Update ref
    requestRef.current = request;

    const subscribe = useCallback(
        async (runId: RunId | null = null): Promise<boolean> => {
            desiredSubscriptionsRef.current.add(runId);
            syncSubscriptionsSnapshot();

            try {
                const params: JsonObject = runId === null ? {} : { runId };
                await request('rr_v3.subscribe', params);
                return true;
            } catch (error) {
                setError(toErrorMessage(error));
                return false;
            }
        },
        [request, syncSubscriptionsSnapshot, setError],
    );

    const unsubscribe = useCallback(
        async (runId: RunId | null = null): Promise<boolean> => {
            desiredSubscriptionsRef.current.delete(runId);
            syncSubscriptionsSnapshot();

            try {
                const params: JsonObject = runId === null ? {} : { runId };
                await request('rr_v3.unsubscribe', params);
                return true;
            } catch (error) {
                setError(toErrorMessage(error));
                return false;
            }
        },
        [request, syncSubscriptionsSnapshot, setError],
    );

    const onEvent = useCallback((listener: EventListener): (() => void) => {
        eventListenersRef.current.add(listener);
        return () => eventListenersRef.current.delete(listener);
    }, []);

    // ==================== Lifecycle ====================

    useEffect(() => {
        if (options.autoConnect) {
            void ensureConnected();
        }

        return () => {
            disconnect('Component unmounted');
        };
    }, [options.autoConnect, ensureConnected, disconnect]);

    return {
        connected,
        connecting,
        reconnecting,
        reconnectAttempts,
        lastError,
        isReady,
        pendingCount,
        subscribedRunIds,
        connect,
        disconnect,
        ensureConnected,
        request,
        subscribe,
        unsubscribe,
        onEvent,
    };
}
