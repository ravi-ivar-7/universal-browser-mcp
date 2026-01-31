import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { NativeMessageType } from 'chrome-mcp-shared';
import { SidepanelNavigator } from './components/SidepanelNavigator';
import { useAgentTheme, preloadAgentTheme } from './hooks/useAgentTheme';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import type { ElementMarker, UpsertMarkerRequest } from '@/common/element-marker-types';

import { AgentChat } from './components/AgentChat';

// Import styles (only keeping tailwind if we are doing inline-only)
import '../styles/tailwind.css';

// Preload theme before mounting
preloadAgentTheme();

// Ensure native connection
void chrome.runtime.sendMessage({ type: NativeMessageType.ENSURE_NATIVE }).catch(() => { });

function App() {
    const { theme: currentTheme, initTheme } = useAgentTheme();
    const [activeTab, setActiveTab] = useState<'element-markers' | 'agent-chat'>('agent-chat');

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

    // Initialize
    useEffect(() => {
        initTheme();
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab');
        if (tabParam === 'element-markers') {
            setActiveTab('element-markers');
        } else if (tabParam === 'agent-chat') {
            setActiveTab('agent-chat');
        }
    }, [initTheme]);

    // Handle Tab Change
    const handleTabChange = useCallback((tab: 'element-markers' | 'agent-chat') => {
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

    const validateMarker = async (marker: ElementMarker) => {
        try {
            const res: any = await chrome.runtime.sendMessage({
                type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_VALIDATE,
                selector: marker.selector,
                selectorType: marker.selectorType || 'css',
                action: 'hover',
                listMode: !!marker.listMode,
            } as any);

            if (res?.tool?.ok !== false) {
                await highlightInTab(marker);
            }
        } catch (e) {
            console.error('Failed to validate marker:', e);
        }
    };

    const highlightInTab = async (marker: ElementMarker) => {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tabId = tabs[0]?.id;
            if (!tabId) return;

            await chrome.tabs.sendMessage(tabId, {
                action: 'element_marker_highlight',
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
                            <div className="w-20 h-20 bg-white rounded-[24px] shadow-sm flex items-center justify-center text-4xl mb-6 border border-[#f1f5f9]">
                                {markers.length > 0 ? '🔍' : '📍'}
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
const root = document.getElementById('app');
if (root) {
    createRoot(root).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}

export default App;
