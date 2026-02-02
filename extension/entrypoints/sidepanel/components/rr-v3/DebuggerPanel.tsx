/**
 * @fileoverview RR V3 Debugger Panel (React)
 * @description Debug panel for stepping through flow execution
 */

import React, { useEffect, useCallback, useMemo, useRef } from 'react';

import type { DebuggerState } from '@/entrypoints/background/record-replay-v3/domain/debug';
import type { PauseReason } from '@/entrypoints/background/record-replay-v3/domain/events';
import type { RunId } from '@/entrypoints/background/record-replay-v3/domain/ids';

import { useRRV3Rpc, useRRV3Debugger } from '@/entrypoints/shared/composables';

// ==================== Types ====================

interface DebuggerPanelProps {
    runId: RunId;
}

// ==================== Helpers ====================

function formatPauseReason(reason: PauseReason | undefined): string {
    if (!reason) return '—';
    switch (reason.kind) {
        case 'breakpoint':
            return `Breakpoint at ${reason.nodeId}`;
        case 'step':
            return `Step at ${reason.nodeId}`;
        case 'command':
            return 'Manual pause';
        case 'policy':
            return `Policy: ${reason.reason} at ${reason.nodeId}`;
        default:
            return '—';
    }
}

// ==================== Component ====================

export function DebuggerPanel({ runId }: DebuggerPanelProps): React.ReactElement {
    // Normalize runId
    const normalizedRunId = useMemo<RunId>(() => String(runId ?? '').trim() as RunId, [runId]);
    const hasRunId = useMemo(() => normalizedRunId.length > 0, [normalizedRunId]);

    // Hooks
    const rpc = useRRV3Rpc({ autoConnect: true });
    const debuggerClient = useRRV3Debugger({
        rpc,
        getRunId: () => (hasRunId ? normalizedRunId : null),
        autoRefreshOnEvents: true,
    });

    // Track current subscribed runId for cleanup
    const currentSubscribedRunIdRef = useRef<RunId | null>(null);
    const attachTokenRef = useRef(0);
    const prevRunIdRef = useRef<string | null>(null);

    // Computed values
    const debuggerState = debuggerClient.state;
    const breakpoints = useMemo(() => debuggerState?.breakpoints ?? [], [debuggerState?.breakpoints]);
    const runIdDisplay = useMemo(() => (hasRunId ? normalizedRunId : '—'), [hasRunId, normalizedRunId]);
    const errorText = debuggerClient.lastError || rpc.lastError;
    const pauseReasonDisplay = useMemo(
        () => formatPauseReason(debuggerState?.pauseReason),
        [debuggerState?.pauseReason],
    );

    const connectionText = useMemo(() => {
        if (rpc.connected) return 'Connected';
        if (rpc.connecting) return 'Connecting…';
        if (rpc.reconnecting) return `Reconnecting (attempt ${rpc.reconnectAttempts})…`;
        return 'Disconnected';
    }, [rpc.connected, rpc.connecting, rpc.reconnecting, rpc.reconnectAttempts]);

    const connectionDotClass = useMemo(() => {
        if (rpc.connected) return 'bg-emerald-500';
        if (rpc.connecting || rpc.reconnecting) return 'bg-amber-500';
        return 'bg-slate-400';
    }, [rpc.connected, rpc.connecting, rpc.reconnecting]);

    // Button state
    const isConnected = rpc.connected;
    const canAttach = isConnected && hasRunId && !debuggerClient.busy && !debuggerClient.isAttached;
    const canDetach = isConnected && hasRunId && !debuggerClient.busy && debuggerClient.isAttached;
    const canPause =
        isConnected && hasRunId && !debuggerClient.busy && debuggerClient.isAttached && !debuggerClient.isPaused;
    const canResume =
        isConnected && hasRunId && !debuggerClient.busy && debuggerClient.isAttached && debuggerClient.isPaused;
    const canStepOver =
        isConnected && hasRunId && !debuggerClient.busy && debuggerClient.isAttached && debuggerClient.isPaused;

    // ==================== Handlers ====================

    const handleReconnect = useCallback(async (): Promise<void> => {
        rpc.disconnect('Manual reconnect');
        const connected = await rpc.connect();
        if (!connected) return;

        if (hasRunId) {
            await rpc.subscribe(normalizedRunId);
            await debuggerClient.attach();
        }
    }, [rpc, hasRunId, normalizedRunId, debuggerClient]);

    const handleAttach = useCallback(async (): Promise<void> => {
        const response = await debuggerClient.attach();
        if (response.ok && hasRunId) {
            await rpc.subscribe(normalizedRunId);
        }
    }, [debuggerClient, hasRunId, rpc, normalizedRunId]);

    const handleDetach = useCallback(async (): Promise<void> => {
        if (hasRunId) {
            await rpc.unsubscribe(normalizedRunId);
        }
        await debuggerClient.detach();
    }, [hasRunId, rpc, normalizedRunId, debuggerClient]);

    const handlePause = useCallback(async (): Promise<void> => {
        await debuggerClient.pause();
    }, [debuggerClient]);

    const handleResume = useCallback(async (): Promise<void> => {
        await debuggerClient.resume();
    }, [debuggerClient]);

    const handleStepOver = useCallback(async (): Promise<void> => {
        await debuggerClient.stepOver();
    }, [debuggerClient]);

    // ==================== Auto-attach ====================

    useEffect(() => {
        const nextId = String(normalizedRunId ?? '').trim();
        if (!nextId) return;

        const token = ++attachTokenRef.current;

        const handleSubscription = async () => {
            // Cleanup previous subscription and detach
            const prevId = prevRunIdRef.current;
            if (prevId && prevId !== nextId) {
                if (currentSubscribedRunIdRef.current === prevId) {
                    await rpc.unsubscribe(prevId as RunId);
                    currentSubscribedRunIdRef.current = null;
                }
                await debuggerClient.detach(prevId as RunId);
                if (token !== attachTokenRef.current) return; // Cancelled
            }

            prevRunIdRef.current = nextId;

            // Attach and subscribe to new run
            const response = await debuggerClient.attach(nextId as RunId);
            if (token !== attachTokenRef.current) return; // Cancelled

            if (response.ok) {
                await rpc.subscribe(nextId as RunId);
                currentSubscribedRunIdRef.current = nextId as RunId;
            }
        };

        handleSubscription();
    }, [normalizedRunId, rpc, debuggerClient]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (currentSubscribedRunIdRef.current) {
                rpc.unsubscribe(currentSubscribedRunIdRef.current);
            }
        };
    }, [rpc]);

    // ==================== Render ====================

    return (
        <div className="px-4 py-4 space-y-3">
            {/* Connection Status */}
            <div className="bg-white rounded-lg border border-slate-200 p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-slate-700 min-w-0">
                    <span className={`inline-flex h-2 w-2 rounded-full shrink-0 ${connectionDotClass}`} />
                    <span className="font-semibold shrink-0">RR V3 Debugger</span>
                    <span className="text-slate-400 shrink-0">·</span>
                    <span className="text-slate-600 truncate">{connectionText}</span>
                </div>

                <button
                    className="shrink-0 inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium transition border bg-white text-slate-700 border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={rpc.connecting || rpc.reconnecting}
                    onClick={handleReconnect}
                >
                    {rpc.connecting || rpc.reconnecting ? 'Reconnecting…' : 'Reconnect'}
                </button>
            </div>

            {/* Debugger State */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="text-slate-800 font-semibold">State</div>
                    <div className="text-xs text-slate-400">
                        {debuggerClient.busy ? (
                            <span>Working…</span>
                        ) : rpc.pendingCount > 0 ? (
                            <span>Pending: {rpc.pendingCount}</span>
                        ) : null}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="text-slate-500">runId</div>
                    <div className="font-mono text-xs text-slate-800 break-all">{runIdDisplay}</div>

                    <div className="text-slate-500">status</div>
                    <div className="text-slate-800">
                        <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${debuggerState?.status === 'attached'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                        >
                            {debuggerState?.status ?? '—'}
                        </span>
                    </div>

                    <div className="text-slate-500">execution</div>
                    <div className="text-slate-800">
                        <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${debuggerState?.execution === 'paused'
                                    ? 'bg-amber-50 text-amber-700'
                                    : debuggerState?.execution === 'running'
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'bg-slate-100 text-slate-600'
                                }`}
                        >
                            {debuggerState?.execution ?? '—'}
                        </span>
                    </div>

                    <div className="text-slate-500">currentNodeId</div>
                    <div className="font-mono text-xs text-slate-800 break-all">
                        {debuggerState?.currentNodeId ?? '—'}
                    </div>

                    <div className="text-slate-500">pauseReason</div>
                    <div className="text-xs text-slate-800">{pauseReasonDisplay}</div>
                </div>

                {/* Control Buttons */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                    <button
                        className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition border ${canAttach
                                ? 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600'
                                : 'bg-white text-slate-400 border-slate-200 cursor-not-allowed'
                            }`}
                        disabled={!canAttach}
                        onClick={handleAttach}
                    >
                        Attach
                    </button>
                    <button
                        className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition border ${canDetach
                                ? 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                                : 'bg-white text-slate-400 border-slate-200 cursor-not-allowed'
                            }`}
                        disabled={!canDetach}
                        onClick={handleDetach}
                    >
                        Detach
                    </button>
                    <button
                        className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition border ${canPause
                                ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
                                : 'bg-white text-slate-400 border-slate-200 cursor-not-allowed'
                            }`}
                        disabled={!canPause}
                        onClick={handlePause}
                    >
                        Pause
                    </button>
                    <button
                        className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition border ${canResume
                                ? 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600'
                                : 'bg-white text-slate-400 border-slate-200 cursor-not-allowed'
                            }`}
                        disabled={!canResume}
                        onClick={handleResume}
                    >
                        Resume
                    </button>
                    <button
                        className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition border ${canStepOver
                                ? 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                                : 'bg-white text-slate-400 border-slate-200 cursor-not-allowed'
                            }`}
                        disabled={!canStepOver}
                        onClick={handleStepOver}
                    >
                        Step Over
                    </button>
                </div>

                {/* Error Display */}
                {errorText && (
                    <div className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{errorText}</div>
                )}
            </div>

            {/* Breakpoints */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="text-slate-800 font-semibold">Breakpoints</div>
                    <div className="text-xs text-slate-400">{breakpoints.length} total</div>
                </div>

                {breakpoints.length === 0 ? (
                    <div className="text-sm text-slate-500">No breakpoints set.</div>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {breakpoints.map((bp) => (
                            <li key={bp.nodeId} className="py-2 flex items-start justify-between">
                                <div className="min-w-0">
                                    <div className="font-mono text-xs text-slate-800 break-all">{bp.nodeId}</div>
                                </div>
                                <span
                                    className={`ml-3 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap ${bp.enabled
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : 'bg-slate-50 text-slate-600 border-slate-200'
                                        }`}
                                >
                                    {bp.enabled ? 'enabled' : 'disabled'}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
