import React, { useState, useRef } from 'react';
import { useFloatingDrag } from '../hooks/useFloatingDrag';

type TabType = 'element-markers' | 'agent-chat';

const BUTTON_SIZE = 48;
const CLAMP_MARGIN = 16;

interface SidepanelNavigatorProps {
    activeTab: TabType;
    onChange: (tab: TabType) => void;
}

export const SidepanelNavigator: React.FC<SidepanelNavigatorProps> = ({ activeTab, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const { positionStyle, isDragging, resetToDefault } = useFloatingDrag(triggerRef as any, wrapperRef as any, {
        clampMargin: CLAMP_MARGIN,
        clickThresholdMs: 150,
        moveThresholdPx: 5,
        getDefaultPosition: () => ({
            left: window.innerWidth - BUTTON_SIZE - CLAMP_MARGIN,
            top: window.innerHeight - BUTTON_SIZE - CLAMP_MARGIN,
        }),
    });

    const handleTriggerClick = () => {
        if (!isDragging) {
            setIsOpen(!isOpen);
        }
    };

    const closeMenu = () => setIsOpen(false);

    const selectTab = (tab: TabType, e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(tab);
        closeMenu();
    };

    const handleReset = (e: React.MouseEvent) => {
        e.stopPropagation();
        resetToDefault();
    };

    return (
        <div
            ref={wrapperRef}
            className={`fixed z-[200] ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} transition-transform active:scale-95`}
            style={positionStyle}
        >
            {/* Trigger button */}
            <button
                ref={triggerRef}
                className={`w-12 h-12 rounded-[16px] flex items-center justify-center shadow-xl transition-all ${isOpen
                        ? 'bg-[#0f172a] text-white rotate-90 scale-110'
                        : 'bg-white text-[#0f172a] hover:bg-[#f8fafc] border border-[#e2e8f0]'
                    }`}
                onClick={handleTriggerClick}
                onDoubleClick={handleReset}
                title="Switch Page (Drag to move, Double click to reset)"
            >
                {isOpen ? (
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                )}
            </button>

            {/* Floating Menu Overlay */}
            {isOpen && (
                <>
                    <div className="fixed inset-0 bg-[#0f172a]/20 backdrop-blur-[2px] z-[-1]" onClick={closeMenu} />
                    <div
                        className="absolute bottom-16 right-0 bg-white rounded-[24px] shadow-2xl border border-[#f1f5f9] p-2 min-w-[220px] animate-in fade-in slide-in-from-bottom-4 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-4 py-3 mb-1">
                            <h3 className="text-[11px] font-[900] text-[#94a3b8] uppercase tracking-widest">Navigation</h3>
                        </div>

                        <div className="flex flex-col gap-1">
                            <button
                                className={`flex items-center gap-3 p-3 rounded-[16px] transition-all text-left ${activeTab === 'agent-chat'
                                        ? 'bg-[#eff6ff] text-[#2563eb]'
                                        : 'hover:bg-[#f8fafc] text-[#64748b] hover:text-[#0f172a]'
                                    }`}
                                onClick={(e) => selectTab('agent-chat', e)}
                            >
                                <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${activeTab === 'agent-chat' ? 'bg-[#2563eb] text-white shadow-md shadow-blue-100' : 'bg-[#f1f5f9]'}`}>
                                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <div className="text-[14px] font-[900] truncate tracking-tight">AI Assistant</div>
                                    <div className="text-[11px] font-medium opacity-60 truncate">Agent Chat & Tasks</div>
                                </div>
                                {activeTab === 'agent-chat' && (
                                    <div className="w-5 h-5 bg-[#2563eb] rounded-full flex items-center justify-center text-white shrink-0 shadow-sm shadow-blue-200">
                                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                )}
                            </button>

                            <button
                                className={`flex items-center gap-3 p-3 rounded-[16px] transition-all text-left ${activeTab === 'element-markers'
                                        ? 'bg-[#eff6ff] text-[#2563eb]'
                                        : 'hover:bg-[#f8fafc] text-[#64748b] hover:text-[#0f172a]'
                                    }`}
                                onClick={(e) => selectTab('element-markers', e)}
                            >
                                <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${activeTab === 'element-markers' ? 'bg-[#2563eb] text-white shadow-md shadow-blue-100' : 'bg-[#f1f5f9]'}`}>
                                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <div className="text-[14px] font-[900] truncate tracking-tight">Element Markers</div>
                                    <div className="text-[11px] font-medium opacity-60 truncate">Manage Page Markers</div>
                                </div>
                                {activeTab === 'element-markers' && (
                                    <div className="w-5 h-5 bg-[#2563eb] rounded-full flex items-center justify-center text-white shrink-0 shadow-sm shadow-blue-200">
                                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
