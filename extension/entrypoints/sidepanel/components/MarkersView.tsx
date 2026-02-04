import React, { useEffect, useState, useMemo } from 'react';
import ContextLoader from './ContextLoader';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import type { ElementMarker, UpsertMarkerRequest } from '@/common/element-marker-types';

export const MarkersView: React.FC = () => {
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

    // Filter Logic
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

    // Initial Load
    useEffect(() => {
        loadMarkers();
    }, []);

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

    const toggleDomain = (domain: string) => {
        setExpandedDomains(prev => {
            const next = new Set(prev);
            if (next.has(domain)) next.delete(domain);
            else next.add(domain);
            return next;
        });
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
            await new Promise(r => setTimeout(r, 500));
            return newTab.id;
        }

        return null;
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

    return (
        <div className="px-6 py-8 pb-32 font-sans bg-[#f8fafc]">
            <header className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-[24px] font-[900] text-[#0f172a] tracking-tight leading-none mb-1 uppercase">Markers</h1>
                    <p className="text-[12px] font-black text-[#94a3b8] uppercase tracking-widest">Page Interaction Hub</p>
                </div>
                {/* Editor Overlay Logic will be handled by boolean check below, 
                         but for "Add New" button: */}
                {!markerEditorOpen && (
                    <button
                        className="bg-[#2563eb] text-white px-5 py-2.5 rounded-[12px] font-black text-[13px] hover:bg-[#1d4ed8] shadow-lg shadow-blue-100 transition-all active:scale-95 flex items-center gap-2"
                        onClick={() => openMarkerEditor()}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        NEW
                    </button>
                )}
            </header>

            {/* EDITOR OVERLAY */}
            {markerEditorOpen && (
                <div className="fixed inset-0 z-50 bg-[#f8fafc] flex flex-col animate-in slide-in-from-bottom-5 duration-300">
                    <div className="p-6 border-b border-[#f1f5f9] flex items-center justify-between bg-white">
                        <h2 className="text-[18px] font-[900] text-[#0f172a] tracking-tight uppercase">
                            {editingMarkerId ? 'Edit Marker' : 'New Marker'}
                        </h2>
                        <button onClick={closeMarkerEditor} className="p-2 rounded-full hover:bg-[#f1f5f9] text-[#94a3b8] transition-all">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        <form onSubmit={saveMarker} className="space-y-6 max-w-lg mx-auto">
                            <div className="space-y-2">
                                <label className="text-[11px] font-[900] text-[#94a3b8] uppercase tracking-widest pl-1">Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full text-[16px] font-bold p-4 bg-white border border-[#e2e8f0] rounded-[16px] focus:outline-none focus:border-[#3b82f6] focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-[#cbd5e1] text-[#0f172a]"
                                    placeholder="e.g. Submit Button"
                                    value={markerForm.name}
                                    onChange={e => setMarkerForm(prev => ({ ...prev, name: e.target.value }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-[900] text-[#94a3b8] uppercase tracking-widest pl-1">Selector</label>
                                <div className="flex gap-2 mb-2">
                                    {(['css', 'xpath', 'text'] as const).map(type => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setMarkerForm(prev => ({ ...prev, selectorType: type }))}
                                            className={`flex-1 py-2 rounded-[10px] text-[11px] font-black uppercase tracking-wider transition-all border ${markerForm.selectorType === type
                                                ? 'bg-[#eff6ff] text-[#2563eb] border-[#2563eb]'
                                                : 'bg-white text-[#94a3b8] border-[#e2e8f0] hover:border-[#cbd5e1]'
                                                }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                                <textarea
                                    required
                                    rows={3}
                                    className="w-full font-mono text-[13px] font-medium p-4 bg-[#0f172a] text-[#f8fafc] border border-[#334155] rounded-[16px] focus:outline-none focus:border-[#3b82f6] transition-all"
                                    placeholder={markerForm.selectorType === 'xpath' ? '//button[@id="submit"]' : '#submit-btn'}
                                    value={markerForm.selector}
                                    onChange={e => setMarkerForm(prev => ({ ...prev, selector: e.target.value }))}
                                />
                            </div>

                            <div className="space-y-4 pt-2">
                                <label className="flex items-center gap-3 p-4 bg-white border border-[#e2e8f0] rounded-[16px] cursor-pointer hover:border-[#cbd5e1] transition-all group">
                                    <div className={`w-5 h-5 rounded-[6px] border-2 flex items-center justify-center transition-all ${markerForm.listMode ? 'bg-[#2563eb] border-[#2563eb]' : 'border-[#cbd5e1] group-hover:border-[#94a3b8]'
                                        }`}>
                                        {markerForm.listMode && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={!!markerForm.listMode}
                                        onChange={e => setMarkerForm(prev => ({ ...prev, listMode: e.target.checked }))}
                                    />
                                    <div className="flex-1">
                                        <span className="block text-[13px] font-black text-[#0f172a]">Multiple Matches</span>
                                        <span className="block text-[11px] font-bold text-[#94a3b8]">Select all matching elements</span>
                                    </div>
                                </label>
                            </div>

                            <div className="pt-6 flex gap-3">
                                <button
                                    type="button"
                                    onClick={closeMarkerEditor}
                                    className="flex-1 py-4 rounded-[16px] bg-white border border-[#e2e8f0] text-[#64748b] font-black uppercase text-[13px] hover:bg-[#f8fafc] hover:border-[#cbd5e1] transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-4 rounded-[16px] bg-[#2563eb] text-white font-black uppercase text-[13px] shadow-lg shadow-blue-100 hover:bg-[#1d4ed8] active:scale-95 transition-all"
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MARKER LIST */}
            <div className={`space-y-6 ${markerEditorOpen ? 'opacity-0 pointer-events-none' : ''}`}>
                <div className="relative group z-0">
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94a3b8] group-focus-within:text-[#2563eb] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search markers..."
                        className="w-full py-4 pl-12 pr-4 bg-white border border-[#e2e8f0] rounded-[16px] text-[#0f172a] font-bold placeholder:text-[#cbd5e1] focus:outline-none focus:border-[#3b82f6] focus:ring-4 focus:ring-blue-50 transition-all shadow-sm"
                        value={markerSearch}
                        onChange={e => setMarkerSearch(e.target.value)}
                    />
                </div>

                {groupedMarkers.length > 0 ? (
                    <div className="space-y-6">
                        {groupedMarkers.map((group) => (
                            <div key={group.domain} className="animate-in fade-in duration-500">
                                <button
                                    className="w-full flex items-center justify-between group mb-3"
                                    onClick={() => toggleDomain(group.domain)}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1 rounded-[6px] bg-[#f1f5f9] text-[#64748b] transition-transform duration-300 ${expandedDomains.has(group.domain) ? 'rotate-90' : ''}`}>
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                        <h3 className="text-[13px] font-[900] text-[#475569] uppercase tracking-wide group-hover:text-[#0f172a] transition-colors">{group.domain}</h3>
                                    </div>
                                    <span className="text-[10px] font-black bg-[#f1f5f9] text-[#94a3b8] px-2 py-0.5 rounded-full">{group.count}</span>
                                </button>

                                {expandedDomains.has(group.domain) && (
                                    <div className="space-y-4 pl-2">
                                        {group.urls.map(({ url, markers: pageMarkers }) => (
                                            <div key={url} className="relative pl-4 border-l-2 border-[#e2e8f0]">
                                                <div className="mb-2">
                                                    <p className="text-[11px] font-bold text-[#94a3b8] truncate">{url}</p>
                                                </div>
                                                <div className="grid gap-3">
                                                    {pageMarkers.map(marker => (
                                                        <div key={marker.id} className="bg-white p-4 rounded-[20px] border border-[#f1f5f9] shadow-sm hover:shadow-md hover:border-[#e2e8f0] transition-all group/item">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <h4 className="text-[14px] font-[900] text-[#0f172a] tracking-tight">{marker.name}</h4>
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
    );
};
