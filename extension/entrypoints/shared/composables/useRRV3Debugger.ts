/**
 * @fileoverview RR V3 Debugger Hook (React)
 * @description Debugger state management, wraps all DebuggerCommand operations
 *
 * Responsibilities:
 * - Send all debug commands via rr_v3.debug RPC method
 * - Maintain reactive DebuggerState
 * - Provide consistent error handling and response normalization
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import type {
    DebuggerCommand,
    DebuggerResponse,
    DebuggerState,
} from '@/entrypoints/background/record-replay-v3/domain/debug';
import type { NodeId, RunId } from '@/entrypoints/background/record-replay-v3/domain/ids';
import type { JsonObject, JsonValue } from '@/entrypoints/background/record-replay-v3/domain/json';
import type { RunEvent } from '@/entrypoints/background/record-replay-v3/domain/events';

import { useRRV3Rpc, type UseRRV3Rpc } from './useRRV3Rpc';

// ==================== Types ====================

/** Hook configuration */
export interface UseRRV3DebuggerOptions {
    /** Shared RPC client instance, creates new if not provided */
    rpc?: UseRRV3Rpc;
    /** Current runId resolver for command defaults */
    getRunId?: () => RunId | null;
    /** State update callback */
    onStateChange?: (state: DebuggerState) => void;
    /** Error callback */
    onError?: (error: string) => void;
    /**
     * Auto-refresh DebuggerState when relevant events are received.
     * Only effective when attached to a run.
     * Events: run.paused, run.resumed, node.started
     */
    autoRefreshOnEvents?: boolean;
}

/** Hook return type */
export interface UseRRV3Debugger {
    /** RPC client instance */
    rpc: UseRRV3Rpc;

    // State
    state: DebuggerState | null;
    lastError: string | null;
    busy: boolean;

    // Derived state
    currentRunId: RunId | null;
    isAttached: boolean;
    isPaused: boolean;

    // Connection control
    attach: (runId?: RunId) => Promise<DebuggerResponse>;
    detach: (runId?: RunId) => Promise<DebuggerResponse>;

    // Execution control
    pause: (runId?: RunId) => Promise<DebuggerResponse>;
    resume: (runId?: RunId) => Promise<DebuggerResponse>;
    stepOver: (runId?: RunId) => Promise<DebuggerResponse>;

    // Breakpoint management
    setBreakpoints: (nodeIds: NodeId[], runId?: RunId) => Promise<DebuggerResponse>;
    addBreakpoint: (nodeId: NodeId, runId?: RunId) => Promise<DebuggerResponse>;
    removeBreakpoint: (nodeId: NodeId, runId?: RunId) => Promise<DebuggerResponse>;

    // State query
    getState: (runId?: RunId) => Promise<DebuggerResponse>;

    // Variable operations
    getVar: (name: string, runId?: RunId) => Promise<DebuggerResponse>;
    setVar: (name: string, value: JsonValue, runId?: RunId) => Promise<DebuggerResponse>;
}

// ==================== Helpers ====================

function toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Validate breakpoint structure
 */
function isValidBreakpoint(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) return false;
    const bp = value as Record<string, unknown>;
    return typeof bp.nodeId === 'string' && typeof bp.enabled === 'boolean';
}

/**
 * Validate DebuggerState structure
 */
function isValidDebuggerState(value: unknown): value is DebuggerState {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    return (
        typeof obj.runId === 'string' &&
        (obj.status === 'attached' || obj.status === 'detached') &&
        (obj.execution === 'running' || obj.execution === 'paused') &&
        Array.isArray(obj.breakpoints) &&
        obj.breakpoints.every(isValidBreakpoint)
    );
}

/**
 * Normalize RPC response to DebuggerResponse
 */
function normalizeResponse(raw: JsonValue): DebuggerResponse {
    if (typeof raw !== 'object' || raw === null) {
        return { ok: false, error: 'Invalid response format' };
    }

    const obj = raw as Record<string, unknown>;

    if (obj.ok === true) {
        const responseState = obj.state;
        // Validate state if present
        if (responseState !== undefined && !isValidDebuggerState(responseState)) {
            return { ok: false, error: 'Invalid DebuggerState in response' };
        }
        return {
            ok: true,
            state: responseState as DebuggerState | undefined,
            value: obj.value as JsonValue | undefined,
        };
    }

    if (obj.ok === false) {
        return {
            ok: false,
            error: typeof obj.error === 'string' ? obj.error : 'Unknown error',
        };
    }

    return { ok: false, error: 'Response missing ok field' };
}

// ==================== Hook ====================

/** Events that trigger state refresh */
const STATE_REFRESH_EVENTS = new Set(['run.paused', 'run.resumed', 'node.started']);

/**
 * RR V3 Debugger client (React Hook)
 */
export function useRRV3Debugger(options: UseRRV3DebuggerOptions = {}): UseRRV3Debugger {
    // RPC client (use provided or create new)
    const internalRpc = useRRV3Rpc();
    const rpc = options.rpc ?? internalRpc;

    // State
    const [state, setState] = useState<DebuggerState | null>(null);
    const [lastError, setLastError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    // Refs
    const optionsRef = useRef(options);
    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const refreshScheduledRef = useRef(false);

    // Keep options ref updated
    useEffect(() => {
        optionsRef.current = options;
    }, [options]);

    // Derived state
    const currentRunId = useMemo<RunId | null>(() => {
        // Prefer external resolver
        const fromGetter = optionsRef.current.getRunId?.();
        if (fromGetter) return fromGetter;
        // Fallback to current state
        return state?.runId ?? null;
    }, [state?.runId, options.getRunId]);

    const isAttached = useMemo(() => state?.status === 'attached', [state?.status]);
    const isPaused = useMemo(() => state?.execution === 'paused', [state?.execution]);

    // ==================== Internal Methods ====================

    const setError = useCallback((message: string | null): void => {
        setLastError(message);
        if (message) optionsRef.current.onError?.(message);
    }, []);

    const updateState = useCallback((next?: DebuggerState): void => {
        if (!next) return;
        setState(next);
        optionsRef.current.onStateChange?.(next);
    }, []);

    const resolveRunId = useCallback(
        (explicit?: RunId): RunId | null => {
            if (explicit) return explicit;
            return currentRunId;
        },
        [currentRunId],
    );

    /**
     * Create error response for missing runId
     */
    const missingRunIdError = useCallback(
        (commandType: string): DebuggerResponse => {
            const message = `${commandType} requires runId`;
            setError(message);
            return { ok: false, error: message };
        },
        [setError],
    );

    /**
     * Send debug command
     */
    const send = useCallback(
        async (cmd: DebuggerCommand): Promise<DebuggerResponse> => {
            setBusy(true);
            try {
                const raw = await rpc.request('rr_v3.debug', cmd as unknown as JsonObject);
                const response = normalizeResponse(raw);

                if (response.ok) {
                    setError(null);
                    if (response.state) {
                        updateState(response.state);
                    }
                } else {
                    setError(response.error);
                }

                return response;
            } catch (error) {
                const message = toErrorMessage(error);
                setError(message);
                return { ok: false, error: message };
            } finally {
                setBusy(false);
            }
        },
        [rpc, setError, updateState],
    );

    // ==================== Public Methods ====================

    const attach = useCallback(
        async (runId?: RunId): Promise<DebuggerResponse> => {
            const resolved = resolveRunId(runId);
            if (!resolved) return missingRunIdError('debug.attach');
            return send({ type: 'debug.attach', runId: resolved });
        },
        [resolveRunId, missingRunIdError, send],
    );

    const detach = useCallback(
        async (runId?: RunId): Promise<DebuggerResponse> => {
            const resolved = resolveRunId(runId);
            if (!resolved) return missingRunIdError('debug.detach');
            return send({ type: 'debug.detach', runId: resolved });
        },
        [resolveRunId, missingRunIdError, send],
    );

    const pause = useCallback(
        async (runId?: RunId): Promise<DebuggerResponse> => {
            const resolved = resolveRunId(runId);
            if (!resolved) return missingRunIdError('debug.pause');
            return send({ type: 'debug.pause', runId: resolved });
        },
        [resolveRunId, missingRunIdError, send],
    );

    const resume = useCallback(
        async (runId?: RunId): Promise<DebuggerResponse> => {
            const resolved = resolveRunId(runId);
            if (!resolved) return missingRunIdError('debug.resume');
            return send({ type: 'debug.resume', runId: resolved });
        },
        [resolveRunId, missingRunIdError, send],
    );

    const stepOver = useCallback(
        async (runId?: RunId): Promise<DebuggerResponse> => {
            const resolved = resolveRunId(runId);
            if (!resolved) return missingRunIdError('debug.stepOver');
            return send({ type: 'debug.stepOver', runId: resolved });
        },
        [resolveRunId, missingRunIdError, send],
    );

    const setBreakpoints = useCallback(
        async (nodeIds: NodeId[], runId?: RunId): Promise<DebuggerResponse> => {
            const resolved = resolveRunId(runId);
            if (!resolved) return missingRunIdError('debug.setBreakpoints');
            return send({ type: 'debug.setBreakpoints', runId: resolved, nodeIds });
        },
        [resolveRunId, missingRunIdError, send],
    );

    const addBreakpoint = useCallback(
        async (nodeId: NodeId, runId?: RunId): Promise<DebuggerResponse> => {
            const resolved = resolveRunId(runId);
            if (!resolved) return missingRunIdError('debug.addBreakpoint');
            return send({ type: 'debug.addBreakpoint', runId: resolved, nodeId });
        },
        [resolveRunId, missingRunIdError, send],
    );

    const removeBreakpoint = useCallback(
        async (nodeId: NodeId, runId?: RunId): Promise<DebuggerResponse> => {
            const resolved = resolveRunId(runId);
            if (!resolved) return missingRunIdError('debug.removeBreakpoint');
            return send({ type: 'debug.removeBreakpoint', runId: resolved, nodeId });
        },
        [resolveRunId, missingRunIdError, send],
    );

    const getStateCmd = useCallback(
        async (runId?: RunId): Promise<DebuggerResponse> => {
            const resolved = resolveRunId(runId);
            if (!resolved) return missingRunIdError('debug.getState');
            return send({ type: 'debug.getState', runId: resolved });
        },
        [resolveRunId, missingRunIdError, send],
    );

    const getVar = useCallback(
        async (name: string, runId?: RunId): Promise<DebuggerResponse> => {
            const resolved = resolveRunId(runId);
            if (!resolved) return missingRunIdError('debug.getVar');
            return send({ type: 'debug.getVar', runId: resolved, name });
        },
        [resolveRunId, missingRunIdError, send],
    );

    const setVar = useCallback(
        async (name: string, value: JsonValue, runId?: RunId): Promise<DebuggerResponse> => {
            const resolved = resolveRunId(runId);
            if (!resolved) return missingRunIdError('debug.setVar');
            return send({ type: 'debug.setVar', runId: resolved, name, value });
        },
        [resolveRunId, missingRunIdError, send],
    );

    // ==================== Event Auto-Refresh ====================

    /**
     * Schedule a debounced state refresh
     */
    const scheduleRefresh = useCallback((): void => {
        if (refreshScheduledRef.current) return;
        refreshScheduledRef.current = true;

        // Clear any existing timer
        if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
            refreshTimerRef.current = null;
        }

        // Use microtask for same-tick debouncing
        queueMicrotask(async () => {
            refreshScheduledRef.current = false;
            // Don't update busy state for auto-refresh to avoid UI flicker
            try {
                const resolved = currentRunId;
                if (!resolved || !isAttached) return;
                const raw = await rpc.request('rr_v3.debug', {
                    type: 'debug.getState',
                    runId: resolved,
                } as unknown as JsonObject);
                const response = normalizeResponse(raw);
                if (response.ok && response.state) {
                    updateState(response.state);
                }
            } catch {
                // Ignore errors in auto-refresh
            }
        });
    }, [currentRunId, isAttached, rpc, updateState]);

    /**
     * Handle incoming events for auto-refresh
     */
    const handleEvent = useCallback(
        (event: RunEvent): void => {
            // Only refresh if attached and event is for current run
            if (!isAttached) return;
            if (event.runId !== currentRunId) return;
            if (!STATE_REFRESH_EVENTS.has(event.type)) return;

            scheduleRefresh();
        },
        [isAttached, currentRunId, scheduleRefresh],
    );

    // Setup event listener if autoRefreshOnEvents is enabled
    useEffect(() => {
        if (!options.autoRefreshOnEvents) return;

        const unsubscribe = rpc.onEvent(handleEvent);

        return () => {
            unsubscribe();
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
            }
        };
    }, [options.autoRefreshOnEvents, rpc, handleEvent]);

    return {
        rpc,
        state,
        lastError,
        busy,
        currentRunId,
        isAttached,
        isPaused,
        attach,
        detach,
        pause,
        resume,
        stepOver,
        setBreakpoints,
        addBreakpoint,
        removeBreakpoint,
        getState: getStateCmd,
        getVar,
        setVar,
    };
}
