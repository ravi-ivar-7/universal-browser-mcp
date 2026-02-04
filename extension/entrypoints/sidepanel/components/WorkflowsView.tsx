import React, { useEffect, useState, useCallback } from 'react';
import { topoOrder, EDGE_LABELS } from 'chrome-mcp-shared';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import type { Flow } from '@/entrypoints/background/record-replay/domain/flow';
import type { RunEvent } from '@/entrypoints/background/record-replay/domain/events';
import { useRRRpc } from '@/entrypoints/shared/composables';

interface WorkflowsViewProps {
    isActive: boolean;
}

export const WorkflowsView: React.FC<WorkflowsViewProps> = ({ isActive }) => {
    const rpc = useRRRpc({ autoConnect: true });

    // Workflows logic
    const [flows, setFlows] = useState<Flow[]>([]);
    const [isFlowsLoading, setIsFlowsLoading] = useState(false);
    const [activeRunIds, setActiveRunIds] = useState<Record<string, string>>({});
    const [expandingFlows, setExpandingFlows] = useState<Record<string, boolean>>({});
    const [flowPaused, setFlowPaused] = useState<Record<string, boolean>>({});
    const [flowLogs, setFlowLogs] = useState<Record<string, RunEvent[]>>({});

    const {
        request: rpcRequest,
        subscribe: rpcSubscribe,
        unsubscribe: rpcUnsubscribe,
        onEvent: rpcOnEvent,
        connected: rpcConnected
    } = rpc;

    const loadFlows = useCallback(async () => {
        setIsFlowsLoading(true);
        try {
            const flows: any = await rpcRequest('rr.listFlows');
            setFlows(flows || []);
        } catch (e) {
            console.error('[Sidepanel] Failed to load flows:', e);
        } finally {
            setIsFlowsLoading(false);
        }
    }, [rpcRequest]);

    const handleDeleteFlow = async (flow: Flow) => {
        if (!confirm(`Are you sure you want to delete workflow "${flow.name || 'Untitled'}"?`)) return;
        try {
            await rpcRequest('rr.deleteFlow', { flowId: flow.id });
            loadFlows();
        } catch (e) {
            console.error('Failed to delete flow:', e);
        }
    };

    const handleRunFlow = async (flowId: string) => {
        try {
            setFlowLogs(prev => ({ ...prev, [flowId]: [] }));
            setExpandingFlows(prev => ({ ...prev, [flowId]: true }));
            setFlowPaused(prev => ({ ...prev, [flowId]: false }));

            const res: any = await rpcRequest('rr.enqueueRun', { flowId });
            if (res?.runId) {
                setActiveRunIds(prev => ({ ...prev, [flowId]: res.runId }));
            }
        } catch (e) {
            console.error('Failed to run flow:', e);
        }
    };

    const handleStopRun = async (flowId: string) => {
        const runId = activeRunIds[flowId];
        if (!runId) return;
        try {
            await rpcRequest('rr.cancelRun', { runId });
        } catch (e) {
            console.error('Failed to stop run:', e);
        }
    };

    const handlePauseRun = async (flowId: string) => {
        const runId = activeRunIds[flowId];
        if (!runId) return;
        try {
            await rpcRequest('rr.pauseRun', { runId });
            setFlowPaused(prev => ({ ...prev, [flowId]: true }));
        } catch (e) {
            console.error('Failed to pause run:', e);
        }
    };

    const handleResumeRun = async (flowId: string) => {
        const runId = activeRunIds[flowId];
        if (!runId) return;
        try {
            await rpcRequest('rr.resumeRun', { runId });
            setFlowPaused(prev => ({ ...prev, [flowId]: false }));
        } catch (e) {
            console.error('Failed to resume run:', e);
        }
    };

    useEffect(() => {
        if (isActive) {
            loadFlows();
        }
    }, [isActive, loadFlows]);

    // RPC effect handles real-time events and state sync
    useEffect(() => {
        if (rpcConnected) {
            // Subscribe to all runs to power the live feed across all workflows
            rpcSubscribe(null).catch(() => { });
        }
    }, [rpcConnected, rpcSubscribe]);

    useEffect(() => {
        const unsubscribe = rpcOnEvent(async (event: RunEvent) => {
            // Determine flowId: either from the event itself or from our local mapping
            let fId = (event as any).flowId || '';

            if (!fId) {
                for (const [flowId, runId] of Object.entries(activeRunIds)) {
                    if (runId === event.runId) {
                        fId = flowId;
                        break;
                    }
                }
            }

            if (!fId) return;

            // Update mapping if needed
            if (!activeRunIds[fId]) {
                setActiveRunIds(prev => ({ ...prev, [fId]: event.runId }));
            }

            setFlowLogs(prev => ({
                ...prev,
                [fId]: [...(prev[fId] || []), event]
            }));

            // Sync state for started runs
            if (event.type === 'run.started') {
                setExpandingFlows(prev => ({ ...prev, [fId]: true }));
                setFlowPaused(prev => ({ ...prev, [fId]: false }));
            }
        });

        return () => unsubscribe();
    }, [rpcOnEvent, activeRunIds]);

    useEffect(() => {
        const listener = (message: any) => {
            if (message.type === BACKGROUND_MESSAGE_TYPES.RR_FLOWS_CHANGED) {
                loadFlows();
            }
        };
        chrome.runtime.onMessage.addListener(listener);
        return () => chrome.runtime.onMessage.removeListener(listener);
    }, [loadFlows]);

    // Initial sync of active runs via RPC
    useEffect(() => {
        if (!rpcConnected) return;

        const syncActiveRuns = async () => {
            try {
                const activeRuns: any = await rpcRequest('rr.listQueue', { status: 'running' });
                // Also get paused ones
                const pausedRuns: any = await rpcRequest('rr.listQueue', { status: 'paused' });

                const allActive = [...(activeRuns || []), ...(pausedRuns || [])];
                const runIds: Record<string, string> = {};
                const expanded: Record<string, boolean> = {};
                const paused: Record<string, boolean> = {};

                allActive.forEach((r: any) => {
                    runIds[r.flowId] = r.id;
                    expanded[r.flowId] = true;
                    paused[r.flowId] = r.status === 'paused';
                });

                setActiveRunIds(runIds);
                setExpandingFlows(expanded);
                setFlowPaused(paused);
            } catch (e) {
                console.error('Failed to sync active runs:', e);
            }
        };

        syncActiveRuns();
    }, [rpcConnected, rpcRequest]);


    return (
        <div className="px-6 py-8 pb-32">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-[24px] font-[900] text-[#0f172a] tracking-tight leading-none mb-1 uppercase">Workflows</h1>
                    <p className="text-[12px] font-bold text-[#94a3b8] uppercase tracking-tight opacity-70">Record & Replay</p>
                </div>
                {flows.length > 0 && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={async () => {
                                try {
                                    const res: any = await chrome.runtime.sendMessage({
                                        type: BACKGROUND_MESSAGE_TYPES.RR_START_RECORDING,
                                        meta: { name: 'New Recording' },
                                    });
                                    if (res?.success) window.close();
                                } catch (e) { }
                            }}
                            className="px-4 py-2.5 rounded-[12px] bg-[#f59e0b] text-white font-black text-[12px] uppercase tracking-tight shadow-md shadow-[#fef3c7] hover:bg-[#d97706] transition-all flex items-center gap-2"
                        >
                            <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                            New Recording
                        </button>
                        <button
                            onClick={loadFlows}
                            disabled={isFlowsLoading}
                            className="p-2.5 rounded-[12px] bg-white border border-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] hover:border-[#cbd5e1] transition-all shadow-sm disabled:opacity-50"
                        >
                            <svg className={`w-4 h-4 ${isFlowsLoading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>

            {flows.length > 0 ? (
                <div className="space-y-4">
                    {flows.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()).map(flow => {
                        const isActive = !!activeRunIds[flow.id];
                        const currentLogs = flowLogs[flow.id] || [];
                        const isCompleted = currentLogs.some(e => e.type === 'run.succeeded');
                        const isFailed = currentLogs.some(e => e.type === 'run.failed' || e.type === 'run.canceled');

                        return (
                            <div key={flow.id} className={`group bg-white rounded-[24px] border ${isActive ? 'border-[#f59e0b] shadow-xl shadow-amber-50' : 'border-[#f1f5f9]'} p-5 hover:shadow-lg transition-all duration-300 overflow-hidden`}>
                                <div className="flex items-start justify-between">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-[16px] font-[900] text-[#0f172a] mb-1 truncate tracking-tight">{flow.name || 'Untitled Recording'}</h3>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                            <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full border ${isActive ? 'bg-[#f59e0b] text-white border-[#f59e0b]' : 'bg-[#fffbeb] text-[#f59e0b] border-[#fef3c7]'}`}>
                                                {isActive ? (isFailed ? 'Failed' : isCompleted ? 'Completed' : 'Running') : `${flow.nodes?.length || 0} Steps`}
                                            </span>
                                            <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-tighter">
                                                {new Date(flow.updatedAt || 0).toLocaleDateString()}
                                            </span>
                                            {flow.meta?.domain && (
                                                <span className="text-[10px] font-bold text-[#64748b] truncate max-w-[120px] opacity-60">
                                                    {flow.meta.domain}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 translate-x-2 group-hover:translate-x-0 transition-all">
                                        {isActive && !isCompleted && !isFailed ? (
                                            <div className="flex items-center gap-1.5">
                                                {flowPaused[flow.id] ? (
                                                    <button
                                                        className="w-9 h-9 flex items-center justify-center rounded-[12px] bg-emerald-500 text-white hover:bg-emerald-600 transition-all"
                                                        onClick={(e) => { e.stopPropagation(); handleResumeRun(flow.id); }}
                                                        title="Resume Workflow"
                                                    >
                                                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                                            <path d="M8 5v14l11-7z" />
                                                        </svg>
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="w-9 h-9 flex items-center justify-center rounded-[12px] bg-amber-500 text-white hover:bg-amber-600 transition-all"
                                                        onClick={(e) => { e.stopPropagation(); handlePauseRun(flow.id); }}
                                                        title="Pause Workflow"
                                                    >
                                                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                                            <rect x="7" y="6" width="3" height="12" />
                                                            <rect x="14" y="6" width="3" height="12" />
                                                        </svg>
                                                    </button>
                                                )}
                                                <button
                                                    className="w-9 h-9 flex items-center justify-center rounded-[12px] bg-[#ef4444] text-white hover:bg-[#dc2626] transition-all"
                                                    onClick={(e) => { e.stopPropagation(); handleStopRun(flow.id); }}
                                                    title="Stop Workflow"
                                                >
                                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                                        <rect x="6" y="6" width="12" height="12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    className="w-9 h-9 flex items-center justify-center rounded-[12px] bg-[#f59e0b] text-white hover:bg-[#d97706] transition-all shadow-md shadow-[#fef3c7]"
                                                    onClick={(e) => { e.stopPropagation(); handleRunFlow(flow.id); }}
                                                    title="Run Workflow"
                                                >
                                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                                        <path d="M8 5v14l11-7z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    className="w-9 h-9 flex items-center justify-center rounded-[12px] bg-white border border-[#fee2e2] text-[#ef4444] hover:bg-[#fef2f2] hover:border-[#fecaca] transition-all"
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteFlow(flow); }}
                                                    title="Delete Workflow"
                                                >
                                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {(isActive || expandingFlows[flow.id]) && (
                                    <div className="mt-6 border-t border-slate-100 pt-6 animate-in slide-in-from-top-4 duration-500">

                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-[11px] font-[900] text-[#64748b] uppercase tracking-widest">Live Execution Feed</h4>
                                                {flowPaused[flow.id] && (
                                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 text-[9px] font-black uppercase animate-pulse">
                                                        <div className="w-1 h-1 rounded-full bg-amber-600" />
                                                        Paused
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => setExpandingFlows(prev => ({ ...prev, [flow.id]: false }))}
                                                className="text-[10px] font-bold text-[#94a3b8] hover:text-[#0f172a] transition-all uppercase tracking-tight"
                                            >
                                                Clear
                                            </button>
                                        </div>

                                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 ac-scroll">
                                            {(() => {
                                                const defaultEdges = (flow.edges || []).filter(e => !e.label || e.label === EDGE_LABELS.DEFAULT);
                                                const orderedNodes = topoOrder((flow.nodes || []) as any, defaultEdges as any);
                                                const execNodes = (orderedNodes as any[]).filter(n => n.kind !== 'trigger');

                                                return execNodes.map((node, idx) => {
                                                    const nodeEvents = currentLogs.filter(e => (e as any).nodeId === node.id);
                                                    const startEvent = nodeEvents.find(e => e.type === 'node.started');
                                                    const successEvent = nodeEvents.find(e => e.type === 'node.succeeded');
                                                    const failEvent = nodeEvents.find(e => e.type === 'node.failed');
                                                    const screenshotEvent = nodeEvents.find(e => e.type === 'artifact.screenshot') as any;

                                                    const status = failEvent ? 'failed' : successEvent ? 'success' : startEvent ? 'running' : 'pending';

                                                    const isCurrent = !isCompleted && !isFailed && status === 'running';
                                                    const isPaused = isCurrent && flowPaused[flow.id];

                                                    let message = 'Pending';
                                                    if (status === 'running') message = 'Executing...';
                                                    if (status === 'success') message = 'Finished step';
                                                    if (status === 'failed') message = (failEvent as any).error?.message || 'Failed step';

                                                    return (
                                                        <div key={node.id} className="flex gap-4">
                                                            <div className="flex flex-col items-center">
                                                                <div className="relative">
                                                                    {(isCurrent || status === 'running') && (
                                                                        <div className={`absolute -left-1.5 top-1.5 w-3 h-3 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-[#3b82f6]'} opacity-20 animate-ping`} />
                                                                    )}
                                                                    <div className={`relative z-10 w-2 h-2 rounded-full border-2 ${status === 'success' ? 'bg-[#22c55e] border-[#22c55e]' :
                                                                        status === 'failed' ? 'bg-[#ef4444] border-[#ef4444]' :
                                                                            isPaused ? 'bg-amber-500 border-amber-500' :
                                                                                (isCurrent || status === 'running') ? 'bg-[#3b82f6] border-[#3b82f6]' :
                                                                                    'bg-white border-[#e2e8f0]'
                                                                        }`} />
                                                                </div>
                                                                {idx < execNodes.length - 1 && <div className="w-[2px] flex-1 bg-slate-100 my-1" />}
                                                            </div>
                                                            <div className="flex-1 pb-4">
                                                                <div className="flex items-center justify-between mb-0.5">
                                                                    <span className={`text-[11px] font-black uppercase tracking-tight ${status === 'running' ? 'text-blue-600' : 'text-slate-700'}`}>
                                                                        {node.kind}
                                                                    </span>
                                                                    {status !== 'pending' && (
                                                                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${status === 'success' ? 'bg-emerald-50 text-emerald-600' :
                                                                            status === 'failed' ? 'bg-red-50 text-red-600' :
                                                                                'bg-slate-50 text-slate-500'
                                                                            }`}>
                                                                            {status}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className={`text-[12px] font-bold leading-tight ${status === 'running' ? 'text-slate-800' : 'text-slate-500'}`}>
                                                                    {message}
                                                                </p>
                                                                {screenshotEvent?.data && (
                                                                    <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden shadow-sm max-w-[140px]">
                                                                        <img src={`data:image/png;base64,${screenshotEvent.data}`} alt="Result" className="w-full h-auto" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-white rounded-[32px] border border-[#f1f5f9] p-8 shadow-sm text-center">
                    <div className="w-16 h-16 bg-[#fffbeb] rounded-[20px] flex items-center justify-center mx-auto mb-6">
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#f59e0b" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <h3 className="text-[18px] font-[900] text-[#0f172a] mb-2 tracking-tight">No Workflows Recorded</h3>
                    <p className="text-[14px] font-bold text-[#94a3b8] leading-relaxed mb-8">
                        Automate browser tasks by recording your actions. Recorded workflows will appear here.
                    </p>
                    <button
                        className="bg-[#f59e0b] text-white px-8 py-3.5 rounded-[18px] font-black text-[14px] shadow-lg shadow-amber-100 hover:bg-[#d97706] active:scale-95 transition-all flex items-center gap-3 uppercase tracking-tight mx-auto"
                        onClick={async () => {
                            try {
                                const res: any = await chrome.runtime.sendMessage({
                                    type: BACKGROUND_MESSAGE_TYPES.RR_START_RECORDING,
                                    meta: { name: 'New Recording' },
                                });
                                if (res?.success) {
                                    window.close();
                                }
                            } catch (e) {
                                console.error('Failed to start recording:', e);
                            }
                        }}
                    >
                        <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0">
                            <div className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                        </div>
                        Start my first recording
                    </button>
                </div>
            )}
        </div>
    );
};
