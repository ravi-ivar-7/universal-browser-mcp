import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { NativeMessageType, topoOrder, EDGE_LABELS } from 'chrome-mcp-shared';
import { SidepanelNavigator } from './components/SidepanelNavigator';
import { useAgentTheme, preloadAgentTheme } from './hooks/useAgentTheme';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import type { ElementMarker, UpsertMarkerRequest } from '@/common/element-marker-types';
import type { Flow } from '@/entrypoints/background/record-replay/domain/flow';

import { AgentChat } from './components/AgentChat';
import ContextLoader from './components/ContextLoader';
import { useRRRpc } from '@/entrypoints/shared/composables';
import type { RunEvent } from '@/entrypoints/background/record-replay/domain/events';

// Import styles (only keeping tailwind if we are doing inline-only)
import '../styles/tailwind.css';

// Preload theme before mounting
preloadAgentTheme();

// Ensure native connection
void chrome.runtime.sendMessage({ type: NativeMessageType.ENSURE_NATIVE }).catch(() => { });

function App() {
    const { theme: currentTheme, initTheme } = useAgentTheme();
    const rpc = useRRRpc({ autoConnect: true });
    const [activeTab, setActiveTab] = useState<'element-markers' | 'agent-chat' | 'workflows'>('agent-chat');

    // Element markers state
    const [currentPageUrl, setCurrentPageUrl] = useState('');
    const [markers, setMarkers] = useState<ElementMarker[]>([]);
    const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
    const initialFormState: UpsertMarkerRequest = {
        url: '',
        name: '',
        selector: '',
        selectorType: 'css',
        matchType: 'prefix',
    };
    const [markerForm, setMarkerForm] = useState<UpsertMarkerRequest>(initialFormState);
    const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
    const [markerSearch, setMarkerSearch] = useState('');
    const [markerEditorOpen, setMarkerEditorOpen] = useState(false);

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
        if (activeTab === 'workflows') {
            loadFlows();
        }
    }, [activeTab, loadFlows]);

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
            // Removed RR_REPLAY_EVENT listener - now powered by RPC Event Stream
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

    // Initialize
    useEffect(() => {
        initTheme();

        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab');
        if (tabParam === 'element-markers') {
            setActiveTab('element-markers');
        } else if (tabParam === 'agent-chat') {
            setActiveTab('agent-chat');
        } else if (tabParam === 'workflows') {
            setActiveTab('workflows');
        }
    }, [initTheme]);

    // Handle Tab Change
    const handleTabChange = useCallback((tab: 'element-markers' | 'agent-chat' | 'workflows') => {
        setActiveTab(tab);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        history.replaceState(null, '', url.toString());
    }, []);

    // Load markers when entering markers tab
    useEffect(() => {
        if (activeTab === 'element-markers') {
            loadMarkers();
        }
    }, [activeTab]);

    const loadMarkers = async () => {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];
            const url = String(tab?.url || '');
            setCurrentPageUrl(url);

            if (!editingMarkerId) {
                setMarkerForm(prev => ({ ...prev, url }));
            }

            const res: any = await chrome.runtime.sendMessage({
                type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_LIST_ALL,
            });

            if (res?.success) {
                setMarkers(res.markers || []);
            }
        } catch (e) {
            console.error('Failed to load markers:', e);
        }
    };

    // Filtering Logic
    const filteredMarkers = useMemo(() => {
        const query = markerSearch.trim().toLowerCase();
        if (!query) return markers;
        return markers.filter((m) => {
            const name = (m.name || '').toLowerCase();
            const selector = (m.selector || '').toLowerCase();
            const url = (m.url || '').toLowerCase();
            return name.includes(query) || selector.includes(query) || url.includes(query);
        });
    }, [markers, markerSearch]);

    // Grouping Logic
    const groupedMarkers = useMemo(() => {
        const groups = new Map<string, Map<string, ElementMarker[]>>();

        for (const marker of filteredMarkers) {
            const domain = marker.host || '(Local File)';
            const fullUrl = marker.url || '(Unknown URL)';

            if (!groups.has(domain)) groups.set(domain, new Map());

            const domainGroup = groups.get(domain)!;
            if (!domainGroup.has(fullUrl)) domainGroup.set(fullUrl, []);

            domainGroup.get(fullUrl)!.push(marker);
        }

        return Array.from(groups.entries())
            .map(([domain, urlMap]) => ({
                domain,
                count: Array.from(urlMap.values()).reduce((sum, arr) => sum + arr.length, 0),
                urls: Array.from(urlMap.entries())
                    .map(([url, markers]) => ({ url, markers }))
                    .sort((a, b) => a.url.localeCompare(b.url)),
            }))
            .sort((a, b) => a.domain.localeCompare(b.domain));
    }, [filteredMarkers]);

    // Expand domains on search
    useEffect(() => {
        if (!markerSearch.trim()) return;
        const domainsToExpand = new Set<string>();
        for (const group of groupedMarkers) {
            domainsToExpand.add(group.domain);
        }
        setExpandedDomains(domainsToExpand);
    }, [markerSearch, groupedMarkers]);

    const toggleDomain = (domain: string) => {
        setExpandedDomains(prev => {
            const next = new Set(prev);
            if (next.has(domain)) next.delete(domain);
            else next.add(domain);
            return next;
        });
    };

    // Form handling
    const openMarkerEditor = (marker?: ElementMarker) => {
        if (marker) {
            setEditingMarkerId(marker.id);
            setMarkerForm({
                url: marker.url,
                name: marker.name,
                selector: marker.selector,
                selectorType: marker.selectorType || 'css',
                listMode: marker.listMode,
                matchType: marker.matchType || 'prefix',
                action: marker.action,
            });
        } else {
            resetForm();
        }
        setMarkerEditorOpen(true);
    };

    const closeMarkerEditor = () => {
        setMarkerEditorOpen(false);
        resetForm();
    };

    const resetForm = () => {
        setMarkerForm({
            url: currentPageUrl,
            name: '',
            selector: '',
            selectorType: 'css',
            matchType: 'prefix',
        });
        setEditingMarkerId(null);
    };

    const saveMarker = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (!markerForm.selector) return;

            const isEditing = !!editingMarkerId;
            const formToSend = { ...markerForm };
            if (!isEditing) {
                formToSend.url = currentPageUrl;
            }

            let res: any;
            if (isEditing) {
                const existingMarker = markers.find((m) => m.id === editingMarkerId);
                if (existingMarker) {
                    const updatedMarker: ElementMarker = {
                        ...existingMarker,
                        ...formToSend,
                        id: editingMarkerId!,
                    };
                    res = await chrome.runtime.sendMessage({
                        type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_UPDATE,
                        marker: updatedMarker,
                    });
                }
            } else {
                res = await chrome.runtime.sendMessage({
                    type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_SAVE,
                    marker: { ...formToSend },
                });
            }

            if (res?.success) {
                closeMarkerEditor();
                await loadMarkers();
            }
        } catch (err) {
            console.error('Failed to save marker:', err);
        }
    };

    const deleteMarker = async (marker: ElementMarker) => {
        try {
            const confirmed = confirm(`Are you sure you want to delete marker "${marker.name}"?`);
            if (!confirmed) return;

            const res: any = await chrome.runtime.sendMessage({
                type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_DELETE,
                id: marker.id,
            });

            if (res?.success) {
                await loadMarkers();
            }
        } catch (e) {
            console.error('Failed to delete marker:', e);
        }
    };

    const ensureTabForMarker = async (marker: ElementMarker): Promise<number | null> => {
        if (!marker.url) return null;

        const tabs = await chrome.tabs.query({});
        // Try exact match or match ignoring trailing slash
        let targetTab = tabs.find(t => {
            const tUrl = (t.url || '').replace(/\/$/, '');
            const mUrl = marker.url.replace(/\/$/, '');
            return tUrl === mUrl;
        });

        if (!targetTab) {
            // Try domain match if exact URL fails (fallback to first tab of same domain)
            // matching domain + path roughly
            targetTab = tabs.find(t => (t.url || '').includes(marker.url) || marker.url.includes(t.url || '____'));
        }

        if (targetTab?.id) {
            await chrome.tabs.update(targetTab.id, { active: true });
            if (targetTab.windowId) {
                await chrome.windows.update(targetTab.windowId, { focused: true });
            }
            // Give a moment for focus and potential render catch-up
            await new Promise(r => setTimeout(r, 500));
            return targetTab.id;
        }

        // Open new tab
        const newTab = await chrome.tabs.create({ url: marker.url, active: true });
        if (newTab.id) {
            // Wait for load
            await new Promise<void>(resolve => {
                const listener = (tid: number, change: any) => {
                    if (tid === newTab.id && change.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        resolve();
                    }
                };
                chrome.tabs.onUpdated.addListener(listener);
                // 10s timeout
                setTimeout(() => {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }, 10000);
            });
            // Extra buffer after complete
            await new Promise(r => setTimeout(r, 500));
            return newTab.id;
        }

        return null;
    };

    const validateMarker = async (marker: ElementMarker) => {
        try {
            const ensuredTabId = await ensureTabForMarker(marker);

            const res: any = await chrome.runtime.sendMessage({
                type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_VALIDATE,
                selector: marker.selector,
                selectorType: marker.selectorType || 'css',
                action: 'hover',
                listMode: !!marker.listMode,
            } as any);

            if (res?.tool?.ok !== false && ensuredTabId) {
                await highlightInTab(marker, ensuredTabId);
            }
        } catch (e) {
            console.error('Failed to validate marker:', e);
        }
    };

    const highlightInTab = async (marker: ElementMarker, targetTabId?: number) => {
        try {
            let tabId = targetTabId;
            if (!tabId) {
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                tabId = tabs[0]?.id;
            }
            if (!tabId) return;

            await chrome.runtime.sendMessage({
                type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_HIGHLIGHT,
                tabId,
                selector: marker.selector,
                selectorType: marker.selectorType || 'css',
                listMode: !!marker.listMode,
            });
        } catch (e) { }
    };

    return (
        <div className="h-full w-full bg-[#fdfcf8] relative overflow-hidden font-sans" data-agent-theme={currentTheme}>
            <SidepanelNavigator activeTab={activeTab} onChange={handleTabChange} />

            {/* Agent Chat Tab */}
            <div className={`h-full ${activeTab === 'agent-chat' ? 'block' : 'hidden'}`}>
                <AgentChat />
            </div>

            {/* Workflows Tab */}
            <div className={`h-full overflow-y-auto ${activeTab === 'workflows' ? 'block' : 'hidden'} bg-[#f8fafc]`}>
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
            </div>

            {/* Element Markers Tab */}
            <div className={`h-full overflow-y-auto ${activeTab === 'element-markers' ? 'block' : 'hidden'} bg-[#f8fafc]`}>
                <div className="px-6 py-8 pb-32">
                    <header className="mb-8 flex justify-between items-end">
                        <div>
                            <h1 className="text-[24px] font-[900] text-[#0f172a] tracking-tight leading-none mb-1 uppercase">Markers</h1>
                            <p className="text-[12px] font-black text-[#94a3b8] uppercase tracking-widest">Page Interaction Hub</p>
                        </div>
                        <button
                            className="bg-[#2563eb] text-white px-5 py-2.5 rounded-[12px] font-black text-[13px] hover:bg-[#1d4ed8] shadow-lg shadow-blue-100 transition-all active:scale-95 flex items-center gap-2"
                            onClick={() => openMarkerEditor()}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            Add New
                        </button>
                    </header>

                    <div className="mb-8 relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-[#2563eb]">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            value={markerSearch}
                            onChange={(e) => setMarkerSearch(e.target.value)}
                            className="w-full bg-white border-2 border-[#f1f5f9] rounded-[20px] pl-11 pr-12 py-3.5 text-[14px] font-bold text-[#1e293b] outline-none focus:border-[#3b82f6] focus:ring-4 focus:ring-blue-50 transition-all shadow-sm"
                            placeholder="Search names, selectors, or domains..."
                            type="text"
                        />
                        {markerSearch && (
                            <button
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#ef4444] transition-colors"
                                onClick={() => setMarkerSearch('')}
                            >
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Modal */}
                    {markerEditorOpen && (
                        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 animate-in fade-in duration-200">
                            <div className="absolute inset-0 bg-[#0f172a]/40 backdrop-blur-md" onClick={closeMarkerEditor} />
                            <div className="bg-white rounded-[32px] shadow-2xl relative z-10 w-full max-w-sm overflow-hidden border border-[#f1f5f9] animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                                <div className="px-8 py-6 bg-[#f8fafc] border-b border-[#f1f5f9] flex justify-between items-center">
                                    <h3 className="text-[18px] font-[900] text-[#0f172a] uppercase tracking-tight">{editingMarkerId ? 'Edit Marker' : 'Add Marker'}</h3>
                                    <button onClick={closeMarkerEditor} className="p-1 hover:bg-white rounded-full text-[#94a3b8] hover:text-[#0f172a] transition-all">
                                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <form onSubmit={saveMarker} className="p-8 space-y-5">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-black text-[#94a3b8] uppercase tracking-widest px-1">Label Name</label>
                                        <input
                                            value={markerForm.name}
                                            onChange={(e) => setMarkerForm(prev => ({ ...prev, name: e.target.value }))}
                                            className="w-full bg-[#f8fafc] border-2 border-transparent rounded-[14px] px-4 py-3 text-[14px] font-bold text-[#1e293b] outline-none focus:bg-white focus:border-[#3b82f6] transition-all"
                                            placeholder="e.g. Primary Login Button"
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-black text-[#94a3b8] uppercase tracking-widest px-1">Engine</label>
                                            <select
                                                value={markerForm.selectorType}
                                                onChange={e => setMarkerForm(prev => ({ ...prev, selectorType: e.target.value as any }))}
                                                className="w-full bg-[#f8fafc] border-2 border-transparent rounded-[14px] px-4 py-3 text-[13px] font-bold text-[#1e293b] outline-none focus:bg-white focus:border-[#3b82f6] transition-all appearance-none"
                                            >
                                                <option value="css">CSS</option>
                                                <option value="xpath">XPath</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-black text-[#94a3b8] uppercase tracking-widest px-1">Scope</label>
                                            <select
                                                value={markerForm.matchType}
                                                onChange={e => setMarkerForm(prev => ({ ...prev, matchType: e.target.value as any }))}
                                                className="w-full bg-[#f8fafc] border-2 border-transparent rounded-[14px] px-4 py-3 text-[13px] font-bold text-[#1e293b] outline-none focus:bg-white focus:border-[#3b82f6] transition-all appearance-none"
                                            >
                                                <option value="prefix">Prefix</option>
                                                <option value="exact">Exact</option>
                                                <option value="host">Host</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-black text-[#94a3b8] uppercase tracking-widest px-1">Target Selector</label>
                                        <textarea
                                            value={markerForm.selector}
                                            onChange={e => setMarkerForm(prev => ({ ...prev, selector: e.target.value }))}
                                            className="w-full bg-[#f8fafc] border-2 border-transparent rounded-[14px] px-4 py-3 text-[13px] font-mono font-bold text-[#1e293b] outline-none focus:bg-white focus:border-[#3b82f6] transition-all min-h-[100px]"
                                            placeholder="Enter CSS or XPath query..."
                                            required
                                        ></textarea>
                                    </div>
                                    <div className="pt-4 flex gap-3">
                                        <button type="button" className="flex-1 py-3.5 rounded-[14px] text-[13px] font-black text-[#64748b] hover:bg-[#f8fafc] transition-all" onClick={closeMarkerEditor}>Cancel</button>
                                        <button type="submit" className="flex-1 py-3.5 bg-[#2563eb] text-white rounded-[14px] text-[13px] font-black shadow-lg shadow-blue-100 hover:bg-[#1d4ed8] active:scale-95 transition-all">{editingMarkerId ? 'Update' : 'Save Marker'}</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* List */}
                    {filteredMarkers.length > 0 ? (
                        <div className="space-y-8">
                            <div className="flex items-center gap-3 px-1">
                                <span className="text-[11px] font-black text-[#64748b] uppercase tracking-widest">
                                    {markerSearch ? `Matches: ${filteredMarkers.length}` : `Summary: ${markers.length} Items / ${groupedMarkers.length} Domains`}
                                </span>
                                <div className="flex-1 h-[1px] bg-[#e2e8f0] opacity-50" />
                            </div>

                            <div className="space-y-12">
                                {groupedMarkers.map(domainGroup => (
                                    <div key={domainGroup.domain} className="group/domain">
                                        <div
                                            className="flex items-center gap-4 mb-4 cursor-pointer group-hover/domain:translate-x-1 transition-transform"
                                            onClick={() => toggleDomain(domainGroup.domain)}
                                        >
                                            <div className="w-8 h-8 rounded-[10px] bg-white border-2 border-[#f1f5f9] flex items-center justify-center text-[#94a3b8] shadow-sm">
                                                <svg className={`w-4 h-4 transition-transform duration-300 ${expandedDomains.has(domainGroup.domain) ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                            <h3 className="text-[17px] font-[900] text-[#0f172a] tracking-tight">{domainGroup.domain}</h3>
                                            <span className="text-[10px] font-black text-[#94a3b8] bg-white px-2 py-0.5 rounded-full border border-[#f1f5f9] uppercase tracking-tighter">{domainGroup.count}</span>
                                        </div>

                                        {expandedDomains.has(domainGroup.domain) && (
                                            <div className="ml-4 pl-8 border-l-2 border-[#f1f5f9] space-y-8 mt-2 animate-in slide-in-from-left-2 duration-300">
                                                {domainGroup.urls.map(urlGroup => (
                                                    <div key={urlGroup.url} className="space-y-4">
                                                        <div className="flex items-center gap-2 text-[#64748b]">
                                                            <div className="w-2 h-2 rounded-full bg-[#cbd5e1]" />
                                                            <span className="text-[12px] font-bold truncate opacity-70">{urlGroup.url}</span>
                                                        </div>
                                                        <div className="space-y-3">
                                                            {urlGroup.markers.map(marker => (
                                                                <div key={marker.id} className="bg-white p-5 rounded-[24px] border border-transparent hover:border-[#3b82f6] shadow-sm hover:shadow-md transition-all group/item">
                                                                    <div className="flex justify-between items-start mb-4">
                                                                        <span className="text-[15px] font-[900] text-[#0f172a] group-hover/item:text-[#2563eb] transition-colors">{marker.name}</span>
                                                                        <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                                            <button
                                                                                className="p-1.5 hover:bg-[#eff6ff] rounded-[8px] text-[#64748b] hover:text-[#2563eb] transition-all"
                                                                                onClick={() => validateMarker(marker)}
                                                                                title="Test Highlight"
                                                                            >
                                                                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                                </svg>
                                                                            </button>
                                                                            <button
                                                                                className="p-1.5 hover:bg-[#f8fafc] rounded-[8px] text-[#64748b] hover:text-[#0f172a] transition-all"
                                                                                onClick={() => openMarkerEditor(marker)}
                                                                                title="Edit"
                                                                            >
                                                                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                                </svg>
                                                                            </button>
                                                                            <button
                                                                                className="p-1.5 hover:bg-[#fef2f2] rounded-[8px] text-[#94a3b8] hover:text-[#ef4444] transition-all"
                                                                                onClick={() => deleteMarker(marker)}
                                                                                title="Delete"
                                                                            >
                                                                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                                </svg>
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    <div className="bg-[#f8fafc] p-3 rounded-[12px] mb-3 border border-[#f1f5f9]">
                                                                        <code className="text-[11px] font-mono font-bold text-[#64748b] break-all line-clamp-2" title={marker.selector}>
                                                                            {marker.selector}
                                                                        </code>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <span className="text-[9px] font-black text-[#2563eb] bg-[#eff6ff] px-2 py-0.5 rounded-md uppercase tracking-wider">{marker.selectorType || 'CSS'}</span>
                                                                        <span className="text-[10px] font-black text-[#94a3b8] bg-[#f8fafc] px-2 py-0.5 rounded-md border border-[#f1f5f9] uppercase tracking-tighter">{marker.matchType}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="py-20 flex flex-col items-center text-center">
                            <div className="flex flex-col items-center gap-4">
                                <ContextLoader className="w-40 h-40" showRotation={false} showScanLine={false} />
                            </div>
                            <h3 className="text-[18px] font-[900] text-[#0f172a] mb-2 tracking-tight">
                                {markers.length > 0 ? 'No results found' : 'No markers yet'}
                            </h3>
                            <p className="text-[13px] font-bold text-[#94a3b8] max-w-[200px] leading-relaxed mb-8 uppercase tracking-tighter">
                                {markers.length > 0 ? 'Try a different search query' : 'Markers help the AI identify specific elements on this page'}
                            </p>
                            {markers.length > 0 ? (
                                <button className="bg-[#2563eb] text-white px-6 py-2.5 rounded-full font-black text-[12px] uppercase shadow-lg shadow-blue-100 transition-all active:scale-95" onClick={() => setMarkerSearch('')}>
                                    Clear Search
                                </button>
                            ) : (
                                <button className="bg-[#2563eb] text-white px-8 py-3 rounded-[16px] font-black text-[13px] uppercase shadow-lg shadow-blue-100 transition-all active:scale-95 flex items-center gap-2" onClick={() => openMarkerEditor()}>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                    Initialize First Marker
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Mount function
const container = document.getElementById('app');
if (container) {
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}

export default App;
