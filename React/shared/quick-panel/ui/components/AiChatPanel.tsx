import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { AgentMessage, RealtimeEvent, AgentUsageStats } from 'chrome-mcp-shared';
import type { QuickPanelAgentBridge } from '../../core/agent-bridge';
import { MessageItem } from './MessageItem';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';

interface AiChatPanelProps {
    agentBridge: QuickPanelAgentBridge;
    initialQuery?: string;
    onBack?: () => void;
}

export const AiChatPanel: React.FC<AiChatPanelProps> = ({ agentBridge, initialQuery, onBack }) => {
    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const [inputText, setInputText] = useState(initialQuery || '');
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
    const [projects, setProjects] = useState<any[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [selectedSessionId, setSelectedSessionId] = useState<string>('');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Scroll to bottom
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Load projects on mount
    useEffect(() => {
        const loadProjects = async () => {
            try {
                const res = await chrome.runtime.sendMessage({ type: BACKGROUND_MESSAGE_TYPES.QUICK_PANEL_LIST_PROJECTS });
                if (res?.success) setProjects(res.projects);
            } catch (e) {
                console.error('Failed to load projects', e);
            }
        };
        loadProjects();
    }, []);

    // Load sessions when project changes
    useEffect(() => {
        if (!selectedProjectId) return;
        const loadSessions = async () => {
            try {
                const res = await chrome.runtime.sendMessage({
                    type: BACKGROUND_MESSAGE_TYPES.QUICK_PANEL_LIST_SESSIONS,
                    payload: { projectId: selectedProjectId }
                });
                if (res?.success) {
                    setSessions(res.sessions);
                    if (res.sessions.length > 0 && !selectedSessionId) {
                        const firstSessId = res.sessions[0].id;
                        setSelectedSessionId(firstSessId);
                        loadHistory(firstSessId);
                    }
                }
            } catch (e) {
                console.error('Failed to load sessions', e);
            }
        };
        loadSessions();
    }, [selectedProjectId]);

    const loadHistory = async (sessionId: string) => {
        const res = await agentBridge.getHistory(sessionId);
        if (res.success) {
            setMessages(res.messages);
        }
    };

    const handleSendMessage = async () => {
        if (!inputText.trim() || isLoading) return;

        const text = inputText.trim();
        setInputText('');
        setIsLoading(true);

        const res = await agentBridge.sendToAI({
            instruction: text,
            sessionId: selectedSessionId || undefined,
            projectId: selectedProjectId || undefined,
        });

        if (res.success) {
            setCurrentRequestId(res.requestId);
            // Optimistic user message (or wait for event)
            // For now we rely on the stream events to populate messages

            const unsubscribe = agentBridge.onRequestEvent(res.requestId, (event: RealtimeEvent) => {
                if (event.type === 'message') {
                    const msg = event.data as AgentMessage;
                    setMessages(prev => {
                        const idx = prev.findIndex(m => m.id === msg.id);
                        if (idx >= 0) {
                            const next = [...prev];
                            next[idx] = msg;
                            return next;
                        }
                        return [...prev, msg];
                    });
                    if (msg.role === 'assistant') setIsStreaming(!msg.isFinal);
                } else if (event.type === 'status') {
                    if (event.data.status === 'completed' || event.data.status === 'error' || event.data.status === 'cancelled') {
                        setIsLoading(false);
                        setIsStreaming(false);
                        setCurrentRequestId(null);
                        unsubscribe();
                    }
                }
            });
        } else {
            setIsLoading(false);
            alert(`Error: ${res.error}`);
        }
    };

    const handleStop = async () => {
        if (currentRequestId) {
            await agentBridge.cancelRequest(currentRequestId, selectedSessionId);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--ac-surface)] overflow-hidden">
            {/* Header / Navigation - Sticky Top */}
            <div className="flex-none pt-1 pb-3 px-1 border-b border-[var(--ac-border)] bg-[var(--ac-surface)] z-10">
                <div className="flex items-center gap-3 mb-3">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="h-8 px-2 flex items-center gap-1.5 rounded-lg hover:bg-[var(--ac-hover-bg)] text-[var(--ac-text-subtle)] hover:text-[var(--ac-text)] transition-colors text-xs font-medium"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                            Back
                        </button>
                    )}
                    <div className="h-4 w-px bg-[var(--ac-border)] mx-1" />
                    <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--ac-text-subtle)] opacity-70">
                            {isStreaming ? 'Agent is thinking...' : 'AI Chat Session'}
                        </div>
                    </div>
                </div>

                {/* Context Selectors */}
                <div className="flex gap-2">
                    <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="flex-1 appearance-none bg-[var(--ac-surface-muted)] border border-[var(--ac-border)] rounded-lg px-3 py-1.5 text-[11px] text-[var(--ac-text)] cursor-pointer outline-none hover:bg-[var(--ac-hover-bg)] transition-colors bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27currentColor%27%20stroke-width=%272%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3e%3cpath%20d=%27M6%209l6%206%206-6%27/%3e%3c/svg%3e')] bg-no-repeat bg-[center_right_8px] bg-[length:12px] [&_option]:bg-[var(--ac-surface)] [&_option]:text-[var(--ac-text)]"
                    >
                        <option value="" disabled>Select Project...</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select
                        value={selectedSessionId}
                        onChange={(e) => {
                            setSelectedSessionId(e.target.value);
                            if (e.target.value) loadHistory(e.target.value);
                            else setMessages([]);
                        }}
                        className="flex-1 appearance-none bg-[var(--ac-surface-muted)] border border-[var(--ac-border)] rounded-lg px-3 py-1.5 text-[11px] text-[var(--ac-text)] cursor-pointer outline-none hover:bg-[var(--ac-hover-bg)] transition-colors bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27currentColor%27%20stroke-width=%272%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3e%3cpath%20d=%27M6%209l6%206%206-6%27/%3e%3c/svg%3e')] bg-no-repeat bg-[center_right_8px] bg-[length:12px] [&_option]:bg-[var(--ac-surface)] [&_option]:text-[var(--ac-text)]"
                    >
                        <option value="">New Session</option>
                        {sessions.map(s => <option key={s.id} value={s.id}>{s.preview || s.name || s.id.slice(0, 8)}</option>)}
                    </select>
                </div>
            </div>

            {/* Messages - Scrollable Area */}
            <div className="flex-1 overflow-y-auto px-1 py-4 space-y-4 custom-scrollbar min-h-0">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-[var(--ac-text-muted)] h-full">
                        <div className="text-3xl opacity-40 mb-3">✦</div>
                        <p className="text-sm">Ask about this page. Streaming replies appear here.</p>
                    </div>
                ) : (
                    messages.map(m => <MessageItem key={m.id} message={m} />)
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area - Sticky Bottom */}
            <div className="flex-none pt-3 pb-1 border-t border-[var(--ac-border)] bg-[var(--ac-surface)] z-10">
                <div className="flex flex-col gap-2.5">
                    <textarea
                        ref={textareaRef}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                        placeholder="Ask the agent..."
                        rows={1}
                        className="w-full min-h-[42px] max-h-[160px] p-3 rounded-xl bg-[var(--ac-surface-muted)] border border-[var(--ac-border)] text-[13px] text-[var(--ac-text)] outline-none focus:border-[var(--ac-accent)] resize-none transition-colors shadow-sm"
                    />

                    <div className="flex items-center justify-between px-1">
                        <div className="flex gap-3 text-[10px] text-[var(--ac-text-subtle)]">
                            <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 rounded border border-[var(--ac-border)] bg-[var(--ac-surface-muted)] font-mono">Enter</kbd> Send</span>
                            <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 rounded border border-[var(--ac-border)] bg-[var(--ac-surface-muted)] font-mono">Shift+Enter</kbd> New line</span>
                        </div>

                        {isLoading ? (
                            <button
                                onClick={handleStop}
                                className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--ac-danger)] text-white shadow-sm hover:opacity-90 transition-opacity"
                                aria-label="Stop"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <rect x="6" y="6" width="12" height="12" rx="1" />
                                </svg>
                            </button>
                        ) : (
                            <button
                                onClick={handleSendMessage}
                                disabled={!inputText.trim()}
                                className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--ac-accent)] text-[var(--ac-accent-contrast)] shadow-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label="Send"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
