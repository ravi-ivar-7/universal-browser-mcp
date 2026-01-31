import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { AgentSession, AgentProject, AgentUsageStats, CodexReasoningEffort, AgentAttachment, AgentManagementInfo } from 'chrome-mcp-shared';
import type { AgentThemeId } from '../../hooks';
import { getModelsForCli, getDefaultModelForCli, getCodexReasoningEfforts } from '@/common/agent-models';
import { AgentServerPortContext } from '../AgentChat';

// =============================================================================
// Helper Components & Types
// =============================================================================

export type RequestState = 'idle' | 'starting' | 'ready' | 'running' | 'error';

function formatTokens(count: number): string {
    if (count >= 1_000_000) return (count / 1_000_000).toFixed(1) + 'M';
    if (count >= 1_000) return (count / 1_000).toFixed(1) + 'k';
    return count.toString();
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

// =============================================================================
// AgentChatShell
// =============================================================================

export const AgentChatShell: React.FC<{
    header: React.ReactNode;
    content: React.ReactNode;
    composer: React.ReactNode;
    errorMessage?: string | null;
    onErrorDismiss?: () => void;
    usage?: AgentUsageStats | null;
    footerLabel?: string;
    isDragOver?: boolean;
    onDragOver?: (e: React.DragEvent) => void;
    onDragLeave?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
}> = ({ header, content, composer, errorMessage, onErrorDismiss, usage, footerLabel, isDragOver, onDragOver, onDragLeave, onDrop }) => {
    const contentRef = useRef<HTMLElement>(null);
    const contentSlotRef = useRef<HTMLDivElement>(null);
    const composerRef = useRef<HTMLElement>(null);
    const [composerHeight, setComposerHeight] = useState(140);

    const isUserScrolledUp = useRef(false);
    const scrollScheduled = useRef(false);
    const SCROLL_THRESHOLD = 150;

    const isNearBottom = useCallback((el: HTMLElement) => {
        const { scrollTop, scrollHeight, clientHeight } = el;
        return scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD;
    }, []);

    const handleScroll = useCallback(() => {
        if (!contentRef.current) return;
        isUserScrolledUp.current = !isNearBottom(contentRef.current);
    }, [isNearBottom]);

    const maybeAutoScroll = useCallback(() => {
        if (scrollScheduled.current || isUserScrolledUp.current || !contentRef.current) {
            return;
        }
        scrollScheduled.current = true;
        requestAnimationFrame(() => {
            scrollScheduled.current = false;
            if (!isUserScrolledUp.current && contentRef.current) {
                contentRef.current.scrollTo({
                    top: contentRef.current.scrollHeight,
                    behavior: 'auto',
                });
            }
        });
    }, []);

    useEffect(() => {
        const composerEl = composerRef.current;
        if (composerEl) {
            const observer = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    setComposerHeight(entry.contentRect.height + 20);
                }
                maybeAutoScroll();
            });
            observer.observe(composerEl);
            return () => observer.disconnect();
        }
    }, [maybeAutoScroll]);

    useEffect(() => {
        const contentSlotEl = contentSlotRef.current;
        if (contentSlotEl) {
            const observer = new ResizeObserver(() => maybeAutoScroll());
            observer.observe(contentSlotEl);
            return () => observer.disconnect();
        }
    }, [maybeAutoScroll]);

    return (
        <div className="h-full flex flex-col overflow-hidden relative ac-scroll-container">
            {/* Header */}
            <header
                className="flex-none px-5 py-3 flex items-center justify-between z-20"
                style={{
                    backgroundColor: 'var(--ac-header-bg)',
                    borderBottom: 'var(--ac-border-width) solid var(--ac-header-border)',
                    backdropFilter: 'blur(12px)',
                }}
            >
                {header}
            </header>

            {/* Content Area */}
            <main
                ref={contentRef}
                className="flex-1 overflow-y-auto ac-scroll relative"
                onScroll={handleScroll}
                style={{
                    paddingBottom: composerHeight + 'px',
                    backgroundColor: 'var(--ac-bg)',
                }}
            >
                <div ref={contentSlotRef} className="min-h-full">
                    {content}
                </div>
            </main>

            {/* Footer / Composer Container with Gradient Mask */}
            <footer
                ref={composerRef}
                className="flex-none px-3 pb-4 pt-4 absolute bottom-0 left-0 right-0 z-10"
                style={{
                    background: `linear-gradient(to top, var(--ac-bg) 0%, var(--ac-bg) 80%, transparent 100%)`,
                }}
            >
                {/* Error Banner */}
                {errorMessage && (
                    <div
                        className="mb-3 px-4 py-2 text-xs rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
                        style={{
                            backgroundColor: 'var(--ac-diff-del-bg)',
                            color: 'var(--ac-danger)',
                            border: 'var(--ac-border-width) solid var(--ac-diff-del-border)',
                            borderRadius: 'var(--ac-radius-inner)',
                        }}
                    >
                        <div className="min-w-0 flex-1 whitespace-pre-wrap break-all ac-scroll overflow-y-auto max-h-[30vh]">
                            {errorMessage}
                        </div>
                        <button
                            type="button"
                            className="p-1 flex-shrink-0 ac-btn hover:opacity-70 transition-opacity"
                            style={{ color: 'var(--ac-danger)', borderRadius: 'var(--ac-radius-button)' }}
                            onClick={onErrorDismiss}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}

                {composer}

                {/* Usage Stats & Footer Label */}
                <div
                    className="text-[10px] text-center mt-3 font-semibold tracking-wider flex items-center justify-center gap-2 opacity-60"
                    style={{ color: 'var(--ac-text-subtle)' }}
                >
                    {usage && (
                        <>
                            <span title={`In: ${usage.inputTokens.toLocaleString()}, Out: ${usage.outputTokens.toLocaleString()}`}>
                                {formatTokens(usage.inputTokens + usage.outputTokens)} TOKENS
                            </span>
                            <span className="opacity-30">/</span>
                            <span>${usage.totalCostUsd.toFixed(4)}</span>
                            <span className="opacity-30">/</span>
                        </>
                    )}
                    <span className="uppercase">{footerLabel || 'Agent Preview'}</span>
                </div>
            </footer>

            {/* Drag & Drop Visual Overlay */}
            {isDragOver && (
                <div className="absolute inset-4 z-30 flex items-center justify-center rounded-2xl pointer-events-none"
                    style={{ backgroundColor: 'var(--ac-accent)', opacity: 0.15, border: '2px dashed var(--ac-accent)' }}>
                    <div className="px-6 py-3 rounded-full bg-white shadow-xl flex items-center gap-2 scale-110">
                        <svg className="w-5 h-5 text-[var(--ac-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M16 8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <span className="text-sm font-bold text-[var(--ac-text)]">Drop files to attach</span>
                    </div>
                </div>
            )}
        </div>
    );
};

// =============================================================================
// AgentTopBar
// =============================================================================

export const AgentTopBar: React.FC<{
    projectLabel: string;
    sessionLabel: string;
    connectionState: 'ready' | 'connecting' | 'disconnected';
    showBackButton?: boolean;
    brandLabel?: string;
    onToggleProjectMenu: () => void;
    onToggleSessionMenu: () => void;
    onToggleSettingsMenu: () => void;
    onToggleOpenProjectMenu: () => void;
    onBack?: () => void;
}> = ({
    projectLabel,
    sessionLabel,
    connectionState,
    showBackButton,
    brandLabel,
    onToggleProjectMenu,
    onToggleSessionMenu,
    onToggleSettingsMenu,
    onToggleOpenProjectMenu,
    onBack,
}) => {
        const connectionColor = {
            ready: 'var(--ac-success)',
            connecting: 'var(--ac-warning)',
            disconnected: 'var(--ac-text-subtle)',
        }[connectionState];

        return (
            <div className="flex items-center justify-between w-full h-full">
                <div className="flex items-center gap-2 overflow-hidden -ml-1">
                    {showBackButton && (
                        <button
                            className="flex items-center justify-center w-8 h-8 flex-shrink-0 ac-btn"
                            style={{ color: 'var(--ac-text-muted)', borderRadius: 'var(--ac-radius-button)' }}
                            title="Back to sessions"
                            onClick={onBack}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    )}

                    <h1 className="text-lg font-medium tracking-tight flex-shrink-0"
                        style={{ fontFamily: 'var(--ac-font-heading)', color: 'var(--ac-text)' }}>
                        {brandLabel || 'Agent'}
                    </h1>

                    <div className="h-4 w-[1px] flex-shrink-0" style={{ backgroundColor: 'var(--ac-border-strong)' }} />

                    <button
                        className="flex items-center gap-1.5 text-xs px-2 py-1 truncate group ac-btn"
                        style={{ fontFamily: 'var(--ac-font-mono)', color: 'var(--ac-text-muted)', borderRadius: 'var(--ac-radius-button)' }}
                        onClick={onToggleProjectMenu}
                    >
                        <span className="truncate">{projectLabel}</span>
                        <svg className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    <div className="h-3 w-[1px] flex-shrink-0" style={{ backgroundColor: 'var(--ac-border)' }} />

                    <button
                        className="flex items-center gap-1.5 text-xs px-2 py-1 truncate group ac-btn"
                        style={{ fontFamily: 'var(--ac-font-mono)', color: 'var(--ac-text-subtle)', borderRadius: 'var(--ac-radius-button)' }}
                        onClick={onToggleSessionMenu}
                    >
                        <span className="truncate">{sessionLabel}</span>
                        <svg className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <span
                            className="w-2 h-2 rounded-full"
                            style={{
                                backgroundColor: connectionColor,
                                boxShadow: connectionState === 'ready' ? `0 0 8px ${connectionColor}` : 'none',
                            }}
                        />
                    </div>

                    <button
                        className="p-1 ac-btn"
                        style={{ color: 'var(--ac-text-subtle)', borderRadius: 'var(--ac-radius-button)' }}
                        title="Open project in VS Code or Terminal"
                        onClick={onToggleOpenProjectMenu}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            <path d="M12 11v6M9 14h6" />
                        </svg>
                    </button>

                    <button
                        className="p-1 ac-btn"
                        style={{ color: 'var(--ac-text-subtle)', borderRadius: 'var(--ac-radius-button)' }}
                        onClick={onToggleSettingsMenu}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    </button>
                </div>
            </div>
        );
    };

// =============================================================================
// AgentComposer
// =============================================================================

export interface ComposerAttachment extends AgentAttachment {
    id: string;
    previewUrl?: string;
}

export const AgentComposer: React.FC<{
    value: string;
    onUpdate: (val: string) => void;
    onSubmit: () => void;
    onCancel: () => void;
    attachments: ComposerAttachment[];
    attachmentError?: string | null;
    onRemoveAttachment: (id: string) => void;
    onAttach: () => void;
    onPaste: (e: React.ClipboardEvent) => void;
    requestState: RequestState;
    canSend: boolean;
    sending: boolean;
    cancelling: boolean;
    placeholder?: string;
    engineName: string;
    selectedModel: string;
    availableModels: { id: string; name: string }[];
    onModelChange: (modelId: string) => void;
    reasoningEffort?: CodexReasoningEffort;
    availableReasoningEfforts?: readonly CodexReasoningEffort[];
    onReasoningEffortChange?: (effort: CodexReasoningEffort) => void;
    onReset?: () => void;
    onOpenSettings?: () => void;
}> = ({
    value,
    onUpdate,
    onSubmit,
    onCancel,
    attachments,
    attachmentError,
    onRemoveAttachment,
    onAttach,
    onPaste,
    requestState,
    canSend,
    sending,
    cancelling,
    placeholder,
    engineName,
    selectedModel,
    availableModels,
    onModelChange,
    reasoningEffort,
    availableReasoningEfforts,
    onReasoningEffortChange,
    onReset,
    onOpenSettings,
}) => {
        const textareaRef = useRef<HTMLTextAreaElement>(null);
        const isRequestActive = requestState === 'starting' || requestState === 'ready' || requestState === 'running';

        const statusText = useMemo(() => {
            if (sending) return 'Sending...';
            if (cancelling) return 'Stopping...';
            switch (requestState) {
                case 'starting': return 'Starting...';
                case 'ready': return 'Preparing...';
                case 'running': return 'Working...';
                default: return 'Ready';
            }
        }, [sending, cancelling, requestState]);

        const statusColor = (sending || isRequestActive) ? 'var(--ac-accent)' : 'var(--ac-text-subtle)';

        const primaryActionButtonStyle = useMemo(() => {
            const base = { borderRadius: 'var(--ac-radius-button)', border: 'var(--ac-border-width) solid transparent' };
            if (isRequestActive) {
                return {
                    ...base,
                    backgroundColor: 'var(--ac-diff-del-bg)',
                    color: 'var(--ac-danger)',
                    border: 'var(--ac-border-width) solid var(--ac-diff-del-border)',
                    opacity: cancelling ? 0.6 : 1,
                };
            }
            return {
                ...base,
                backgroundColor: canSend ? 'var(--ac-accent)' : 'var(--ac-surface-muted)',
                color: canSend ? 'var(--ac-accent-contrast)' : 'var(--ac-text-subtle)',
            };
        }, [isRequestActive, canSend, cancelling]);

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!isRequestActive && canSend && !sending) onSubmit();
            }
        };

        return (
            <div className="relative">
                {/* Image Previews */}
                {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2 px-1">
                        {attachments.map((a) => (
                            <div key={a.id} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-[var(--ac-border)] bg-[var(--ac-surface-muted)]">
                                {a.previewUrl ? (
                                    <img src={a.previewUrl} alt={a.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[var(--ac-text-subtle)]">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    </div>
                                )}
                                <button
                                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center bg-[var(--ac-error)] text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => onRemoveAttachment(a.id)}
                                >
                                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {attachmentError && <div className="px-1 mb-1 text-xs" style={{ color: 'var(--ac-error)' }}>{attachmentError}</div>}

                <div
                    className="flex flex-col"
                    style={{
                        backgroundColor: 'var(--ac-surface)',
                        backdropFilter: 'blur(16px)',
                        borderRadius: 'var(--ac-radius-card)',
                        border: 'var(--ac-border-width) solid var(--ac-border)',
                        boxShadow: 'var(--ac-shadow-float)',
                    }}
                >
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => onUpdate(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={onPaste}
                        className="w-full bg-transparent border-none focus:ring-0 focus:outline-none resize-none p-3 text-sm ac-scroll"
                        style={{
                            minHeight: '50px',
                            maxHeight: '200px',
                            fontFamily: 'var(--ac-font-body)',
                            color: 'var(--ac-text)',
                        }}
                        placeholder={placeholder || "Ask Agent to write code..."}
                        rows={1}
                    />

                    <div className="flex items-end justify-between px-2 pb-2 gap-2">
                        <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
                            <button
                                className="p-1.5 ac-btn"
                                style={{ color: 'var(--ac-text-subtle)', borderRadius: 'var(--ac-radius-button)' }}
                                onClick={onAttach}
                                title="Attach image"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </button>

                            {availableModels.length > 0 && (
                                <div className="relative">
                                    <select
                                        value={selectedModel}
                                        onChange={(e) => onModelChange(e.target.value)}
                                        className="py-0.5 text-[10px] border-none bg-transparent cursor-pointer appearance-none pr-4 pl-1.5"
                                        style={{ color: 'var(--ac-text-muted)', fontFamily: 'var(--ac-font-mono)' }}
                                    >
                                        {availableModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                    <svg className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: 'var(--ac-text-subtle)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </div>
                            )}

                            {engineName === 'codex' && availableReasoningEfforts && (
                                <select
                                    value={reasoningEffort}
                                    onChange={(e) => onReasoningEffortChange?.(e.target.value as CodexReasoningEffort)}
                                    className="px-1.5 py-0.5 text-[10px] border-none bg-transparent cursor-pointer"
                                    style={{ color: 'var(--ac-text-muted)', fontFamily: 'var(--ac-font-mono)' }}
                                >
                                    {availableReasoningEfforts.map(e => <option key={e} value={e}>{e}</option>)}
                                </select>
                            )}

                            <button
                                className="p-1 ac-btn"
                                style={{ color: 'var(--ac-text-subtle)', borderRadius: 'var(--ac-radius-button)' }}
                                onClick={() => { if (confirm('Reset this conversation?')) onReset?.() }}
                                title="Reset conversation"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </button>

                            <button
                                className="p-1 ac-btn"
                                style={{ color: 'var(--ac-text-subtle)', borderRadius: 'var(--ac-radius-button)' }}
                                onClick={onOpenSettings}
                                title="Session settings"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </button>

                            {statusText !== 'Ready' && (
                                <div className="text-[11px] ml-1 flex items-center gap-1 whitespace-nowrap" style={{ color: statusColor }}>
                                    {(sending || isRequestActive) && <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-[var(--ac-accent)]" />}
                                    {statusText}
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            className="p-1 transition-colors cursor-pointer"
                            style={primaryActionButtonStyle}
                            onClick={isRequestActive ? onCancel : onSubmit}
                            disabled={isRequestActive ? cancelling : !canSend}
                        >
                            {isRequestActive ? (
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                            ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M5 10l7-7m0 0l7 7m-7-7v18" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

// =============================================================================
// AgentConversation
// =============================================================================

const formatToolDetails = (details: string | any) => {
    if (!details) return '';
    try {
        const text = typeof details === 'string' ? details : JSON.stringify(details);
        const obj = JSON.parse(text);
        return JSON.stringify(obj, null, 2);
    } catch {
        return typeof details === 'string' ? details : JSON.stringify(details, null, 2);
    }
};

const TimelineUserPromptStep: React.FC<{ item: any }> = ({ item }) => {
    const hasText = (item.text || '').trim().length > 0;
    return (
        <div className="py-1 space-y-3">
            {hasText && (
                <div
                    className="text-sm leading-relaxed"
                    style={{ color: 'var(--ac-text)', fontFamily: 'var(--ac-font-body)' }}
                >
                    <div className="whitespace-pre-wrap font-medium">{item.text}</div>
                </div>
            )}
            {item.attachments?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                    {item.attachments.map((a: any, i: number) => (
                        <div key={i} className="w-16 h-16 rounded-xl border border-[var(--ac-border)] bg-[var(--ac-surface-muted)] overflow-hidden shadow-sm group/thumb cursor-pointer hover:shadow-md transition-shadow">
                            {a.previewUrl ? (
                                <img src={a.previewUrl} className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center opacity-30">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const TimelineNarrativeStep: React.FC<{ item: any }> = ({ item }) => {
    return (
        <div className="py-1 min-h-[1.5rem] relative">
            <div
                className="text-sm leading-relaxed"
                style={{ color: 'var(--ac-text)', fontFamily: 'var(--ac-font-body)' }}
            >
                <div className="whitespace-pre-wrap">{item.text ?? ''}</div>
            </div>
            {item.isStreaming && (
                <span className="inline-block w-1.5 h-4 ml-0.5 align-middle bg-[var(--ac-accent)] ac-pulse" />
            )}
        </div>
    );
};

const TimelineToolCallStep: React.FC<{ item: any }> = ({ item }) => {
    const tool = item.tool;
    const labelColor = tool.kind === 'edit' ? 'var(--ac-accent)' : 'var(--ac-text-subtle)';
    const subtitle = tool.kind === 'run' ? tool.command : (tool.filePath || tool.searchPath);
    const title = tool.title;

    return (
        <div className="flex flex-col gap-1 py-1">
            <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-bold text-[var(--ac-chip-text)] shrink-0" style={{ fontFamily: 'var(--ac-font-mono)' }}>
                    Calling tool:
                </span>
                <code
                    className="text-[11px] font-bold px-1.5 py-0.5 truncate bg-[var(--ac-chip-bg)] text-[var(--ac-chip-text)] rounded shadow-sm border border-[var(--ac-border)]/50 shrink-0"
                    style={{ fontFamily: 'var(--ac-font-mono)' }}
                >
                    {tool.label}
                </code>
                {item.isStreaming && <span className="flex gap-0.5 shrink-0 ml-1"><span className="w-1 h-1 rounded-full bg-current animate-bounce" /><span className="w-1 h-1 rounded-full bg-current animate-bounce delay-75" /><span className="w-1 h-1 rounded-full bg-current animate-bounce delay-150" /></span>}
            </div>

            {title && title !== tool.label && title !== 'Calling tool' && (
                <div className="text-[10px] opacity-60 truncate font-mono select-all" title={title} style={{ color: 'var(--ac-text-subtle)' }}>
                    {title}
                </div>
            )}

            {subtitle && subtitle !== tool.label && (
                <div className="text-[10px] opacity-60 truncate font-mono select-all" title={subtitle} style={{ color: 'var(--ac-text-subtle)' }}>
                    {tool.kind === 'run' && '$ '}
                    {subtitle}
                </div>
            )}
        </div>
    );
};

const TimelineToolResultCardStep: React.FC<{ item: any }> = ({ item }) => {
    const tool = item.tool;
    const [expanded, setExpanded] = useState(false);
    const labelColor = item.isError ? 'var(--ac-danger)' : (tool.kind === 'edit' ? 'var(--ac-accent)' : 'var(--ac-success)');
    const prettyDetails = formatToolDetails(tool.details);
    const showCard = !!prettyDetails || (tool.files && tool.files.length > 0);

    return (
        <div className="flex flex-col gap-2 py-1">
            <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-bold text-[var(--ac-chip-text)] shrink-0" style={{ fontFamily: 'var(--ac-font-mono)' }}>
                    Tool Output:
                </span>
                <span
                    className="text-[10px] font-black uppercase tracking-[0.15em] shrink-0 truncate max-w-[120px]"
                    style={{ color: labelColor }}
                >
                    {tool.label}
                </span>

                {item.isError && <span className="text-[10px] px-1 bg-red-50 text-red-600 rounded font-bold border border-red-100 uppercase tracking-tighter shrink-0">Failure</span>}
            </div>

            {showCard && (
                <div
                    className={`rounded-lg border-[var(--ac-border-width)] border-[var(--ac-code-border)] shadow-sm overflow-hidden bg-[var(--ac-code-bg)] ${expanded ? '' : 'max-h-[300px]'} relative transition-all duration-300 w-full`}
                >
                    {tool.files && tool.files.length > 0 ? (
                        <div className="flex flex-col">
                            {tool.files.slice(0, expanded ? undefined : 6).map((f: string, i: number) => (
                                <div key={i} className="px-3 py-1.5 text-[11px] font-mono border-b border-[var(--ac-border)]/50 last:border-0 hover:bg-black/5 break-all">
                                    {f}
                                </div>
                            ))}
                            {!expanded && tool.files.length > 6 && (
                                <div className="px-3 py-1 text-[10px] bg-[var(--ac-surface-muted)] text-[var(--ac-text-subtle)] font-bold text-center italic">
                                    + {tool.files.length - 6} more files
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="px-3 py-2 text-[11px] font-mono leading-relaxed whitespace-pre ac-scroll overflow-x-auto text-[var(--ac-code-text)]">
                            {prettyDetails}
                        </div>
                    )}

                    {(prettyDetails?.split('\n').length > 15 || (tool.files && tool.files.length > 6)) && (
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="w-full py-1 text-[10px] font-black uppercase tracking-widest bg-[var(--ac-surface-muted)] hover:bg-[var(--ac-border)] transition-colors border-t border-[var(--ac-border)]/50 sticky bottom-0"
                        >
                            {expanded ? 'Collapse' : 'Expand Details'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

const TimelineStatusStep: React.FC<{ item: any; hideIcon?: boolean }> = ({ item, hideIcon }) => {
    return (
        <div className="text-[11px] py-1 flex items-center gap-3 opacity-60 font-semibold uppercase tracking-widest" style={{ color: 'var(--ac-text-subtle)' }}>
            {!hideIcon && <div className="w-1.5 h-1.5 rounded-full bg-[var(--ac-timeline-node)]" />}
            <span>{item.text}</span>
        </div>
    );
};

const AgentTimelineItem: React.FC<{ item: any; isLast?: boolean }> = ({ item, isLast }) => {
    const isStreaming = (item.kind === 'assistant_text' || item.kind === 'tool_use') ? item.isStreaming :
        (item.kind === 'status') ? (item.status === 'running' || item.status === 'starting') : false;
    const showLoadingIcon = item.kind === 'status' && (item.status === 'running' || item.status === 'starting');

    // Exact alignment offsets from original design
    const nodeTopOffset = (item.kind === 'user_prompt' || item.kind === 'assistant_text') ? '10px' :
        (item.kind === 'tool_use' || item.kind === 'tool_result') ? '8px' : '4px';

    const nodeColor = isStreaming ? 'var(--ac-timeline-node-active)' :
        item.kind === 'tool_result' ? (item.isError ? 'var(--ac-danger)' : 'var(--ac-success)') :
            item.kind === 'tool_use' ? 'var(--ac-timeline-node-tool)' : 'var(--ac-timeline-node)';

    return (
        <div className="relative group/step min-h-[1rem]">
            {showLoadingIcon ? (
                <svg className="absolute loading-scribble z-10" style={{ left: '-25px', top: nodeTopOffset, width: '16px', height: '16px' }} viewBox="0 0 100 100" fill="none">
                    <path d="M50 50 C50 48, 52 46, 54 46 C58 46, 60 50, 60 54 C60 60, 54 64, 48 64 C40 64, 36 56, 36 48 C36 38, 44 32, 54 32 C66 32, 74 42, 74 54 C74 68, 62 78, 48 78 C32 78, 22 64, 22 48 C22 30, 36 18, 54 18 C74 18, 88 34, 88 54 C88 76, 72 92, 50 92" stroke="var(--ac-accent, #D97757)" strokeWidth="8" strokeLinecap="round" />
                </svg>
            ) : (
                <span
                    className={`absolute w-2 h-2 rounded-full transition-all duration-300 z-10 ${isStreaming ? 'ac-pulse scale-125' : ''}`}
                    style={{ left: '-21px', top: nodeTopOffset, backgroundColor: nodeColor, boxShadow: isStreaming ? 'var(--ac-timeline-node-pulse-shadow)' : 'none' }}
                />
            )}

            {item.kind === 'user_prompt' && <TimelineUserPromptStep item={item} />}
            {item.kind === 'assistant_text' && <TimelineNarrativeStep item={item} />}
            {item.kind === 'tool_use' && <TimelineToolCallStep item={item} />}
            {item.kind === 'tool_result' && <TimelineToolResultCardStep item={item} />}
            {item.kind === 'status' && <TimelineStatusStep item={item} hideIcon={showLoadingIcon} />}
        </div>
    );
};

const AgentTimeline: React.FC<{ items: any[] }> = ({ items }) => {
    return (
        <div className="relative pl-6 ml-2 space-y-4">
            {/* The continuous vertical line */}
            <div className="absolute left-[12px] top-4 bottom-4 w-px bg-[var(--ac-timeline-line, #e7e5e4)] opacity-60" />

            {items.map((item, index) => (
                <AgentTimelineItem
                    key={item.id}
                    item={item}
                    isLast={index === items.length - 1}
                />
            ))}
        </div>
    );
};

const AgentRequestThread: React.FC<{ thread: any }> = ({ thread }) => {
    const serverPort = React.useContext(AgentServerPortContext);

    const getAttachmentSrc = (a: any) => {
        if (a.previewUrl) return a.previewUrl;
        if (a.dataBase64 && a.mimeType) return `data:${a.mimeType};base64,${a.dataBase64}`;
        if (a.urlPath && serverPort) {
            const path = a.urlPath.startsWith('/') ? a.urlPath : `/${a.urlPath}`;
            return `http://127.0.0.1:${serverPort}${path}`;
        }
        return null;
    };

    return (
        <div className="group animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="mb-6">
                <div className="flex justify-between items-baseline gap-4">
                    <h2 className="text-xl font-bold tracking-tight leading-tight" style={{ color: 'var(--ac-text)', fontFamily: 'var(--ac-font-heading)' }}>
                        {thread.title}
                    </h2>
                </div>
                {thread.attachments?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                        {thread.attachments.map((a: any, i: number) => {
                            const src = getAttachmentSrc(a);
                            return (
                                <div key={i} className="w-20 h-20 rounded-xl border-2 border-[var(--ac-border)] bg-[var(--ac-surface-muted)] overflow-hidden shadow-sm">
                                    {src && <img src={src} className="w-full h-full object-cover" />}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <AgentTimeline items={thread.items} />
        </div>
    );
};

export const AgentConversation: React.FC<{ threads: any[] }> = ({ threads }) => {
    return (
        <div className="px-6 py-8 space-y-16 max-w-[900px] mx-auto">
            {threads.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center justify-center animate-in zoom-in-95 duration-700">
                    <div className="w-24 h-24 mb-8 relative">
                        <div className="absolute inset-0 rounded-[40px] bg-[var(--ac-accent)] opacity-5 animate-pulse" />
                        <svg className="w-full h-full text-[var(--ac-accent)] opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                            <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                    </div>
                    <p className="text-3xl font-bold italic tracking-tighter" style={{ color: 'var(--ac-text-subtle)', fontFamily: 'var(--ac-font-heading)' }}>
                        How can I help you today?
                    </p>
                    <p className="mt-4 text-sm font-medium opacity-40 uppercase tracking-[0.3em]">Ready for your instructions</p>
                </div>
            ) : (
                threads.map((thread) => (
                    <AgentRequestThread key={thread.id} thread={thread} />
                ))
            )}
        </div>
    );
};

// =============================================================================
// AgentSessionsView
// =============================================================================

export const AgentSessionsView: React.FC<{
    sessions: AgentSession[];
    selectedSessionId: string | null;
    isLoading: boolean;
    isCreating: boolean;
    error: string | null;
    runningSessionIds: Set<string>;
    projectsMap: Map<string, AgentProject>;
    onSessionSelect: (id: string) => void;
    onSessionNew: () => void;
    onSessionDelete: (id: string) => void;
    onSessionRename: (id: string, name: string) => void;
    onSessionOpenProject: (id: string) => void;
    onRefresh?: () => void;
}> = ({ sessions, selectedSessionId, isLoading, isCreating, error, runningSessionIds, projectsMap, onSessionSelect, onSessionNew, onSessionDelete, onSessionRename, onSessionOpenProject, onRefresh }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredSessions = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        let list = [...sessions];
        if (query) {
            list = list.filter(s => {
                const searchFields = [s.name || '', s.preview || '', s.model || '', s.engineName || ''].join(' ').toLowerCase();
                return searchFields.includes(query);
            });
        }
        return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }, [sessions, searchQuery]);

    return (
        <div className="h-full flex flex-col bg-[var(--ac-surface)]">
            <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--ac-border)] flex items-center gap-2 bg-[var(--ac-surface)]">
                <div className="flex-1 relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ac-text-subtle)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search sessions..."
                        className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--ac-surface-muted)] border border-[var(--ac-border)] rounded-[var(--ac-radius-button)] text-[var(--ac-text)] outline-none"
                    />
                </div>
                {onRefresh && (
                    <button
                        onClick={onRefresh}
                        className="flex-shrink-0 p-2 text-[var(--ac-text-subtle)] hover:text-[var(--ac-text)] hover:bg-[var(--ac-surface-muted)] rounded-[var(--ac-radius-button)]"
                        title="Refresh"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                )}
                <button
                    className="flex-shrink-0 px-3 py-2 text-sm font-medium bg-[var(--ac-accent)] text-[var(--ac-accent-contrast)] rounded-[var(--ac-radius-button)] disabled:opacity-50"
                    disabled={isCreating}
                    onClick={onSessionNew}
                >
                    {isCreating ? 'Creating...' : <span className="flex items-center gap-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 4v16m8-8H4" /></svg> New</span>}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto ac-scroll">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-[var(--ac-text-muted)] space-y-4">
                        <div className="w-8 h-8 relative">
                            <div className="absolute inset-0 border-2 border-[var(--ac-border)] rounded-full"></div>
                            <div className="absolute inset-0 border-2 border-[var(--ac-accent)] rounded-full border-t-transparent animate-spin"></div>
                        </div>
                        <div className="text-xs tracking-wider uppercase opacity-60">Loading sessions...</div>
                    </div>
                ) : filteredSessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <div className="w-16 h-16 rounded-3xl bg-[var(--ac-surface-muted)] flex items-center justify-center mb-4 text-[var(--ac-text-subtle)] border border-[var(--ac-border)]">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <div className="text-sm font-medium mb-1 text-[var(--ac-text)]">
                            {searchQuery ? 'No matching sessions' : 'No sessions yet'}
                        </div>
                        <p className="text-xs text-[var(--ac-text-subtle)] max-w-[200px] mb-6">
                            {searchQuery ? 'Try a different search query or engine filter.' : 'Create your first session to start chatting with the agent.'}
                        </p>
                        {onRefresh && filteredSessions.length === 0 && (
                            <button
                                onClick={onRefresh}
                                className="mb-6 px-4 py-2 text-xs font-medium text-[var(--ac-link)] hover:bg-[var(--ac-hover-bg)] rounded-[var(--ac-radius-button)] border border-[var(--ac-border)] transition-colors"
                            >
                                Refresh List
                            </button>
                        )}
                        {!searchQuery && (
                            <button
                                onClick={onSessionNew}
                                className="px-5 py-2.5 text-sm font-bold bg-[var(--ac-accent)] text-[var(--ac-accent-contrast)] rounded-[var(--ac-radius-button)] shadow-lg shadow-[var(--ac-accent-glow)] transition-all active:scale-95"
                            >
                                Start New Session
                            </button>
                        )}
                    </div>
                ) : (
                    filteredSessions.map(session => (
                        <AgentSessionListItem
                            key={session.id}
                            session={session}
                            projectPath={projectsMap.get(session.projectId)?.rootPath}
                            selected={selectedSessionId === session.id}
                            isRunning={runningSessionIds.has(session.id)}
                            onSelect={onSessionSelect}
                            onRename={onSessionRename}
                            onDelete={onSessionDelete}
                            onOpenProject={onSessionOpenProject}
                        />
                    ))
                )}
            </div>
            {error && <div className="px-4 py-2 text-xs text-[var(--ac-danger)] bg-[var(--ac-surface-muted)]">{error}</div>}
        </div>
    );
};

const AgentSessionListItem: React.FC<{
    session: AgentSession;
    selected: boolean;
    isRunning: boolean;
    projectPath?: string;
    onSelect: (id: string) => void;
    onRename: (id: string, name: string) => void;
    onDelete: (id: string) => void;
    onOpenProject: (id: string) => void;
}> = ({ session, selected, isRunning, projectPath, onSelect, onRename, onDelete, onOpenProject }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editingName, setEditingName] = useState(session.name || '');
    const inputRef = useRef<HTMLInputElement>(null);

    const engineAbbrev = (session.engineName || '').slice(0, 2).toUpperCase() || 'AI';
    const engineColor = {
        claude: '#c87941', codex: '#10a37f', cursor: '#8b5cf6', qwen: '#6366f1', glm: '#ef4444', gemini: '#4285f4'
    }[session.engineName] || '#6b7280';

    const displayPath = useMemo(() => {
        if (!projectPath) return '';
        return projectPath.replace(/^\/Users\/[^/]+/, '~').replace(/^\/home\/[^/]+/, '~');
    }, [projectPath]);

    const handleConfirm = () => {
        const trimmed = editingName.trim();
        if (trimmed && trimmed !== session.name) onRename(session.id, trimmed);
        setIsEditing(false);
    };

    return (
        <div
            onClick={() => !isEditing && onSelect(session.id)}
            className={`group px-3 py-3 border-b border-[var(--ac-border)] cursor-pointer transition-colors ${selected ? 'bg-[var(--ac-hover-bg)]' : 'hover:bg-[var(--ac-hover-bg)]'}`}
        >
            <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white uppercase flex-shrink-0" style={{ backgroundColor: engineColor }}>{engineAbbrev}</div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        {isEditing ? (
                            <input
                                ref={inputRef}
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' ? handleConfirm() : e.key === 'Escape' && setIsEditing(false)}
                                onBlur={handleConfirm}
                                autoFocus
                                className="flex-1 px-2 py-0.5 text-sm bg-[var(--ac-surface)] border border-[var(--ac-accent)] rounded-[var(--ac-radius-button)] text-[var(--ac-text)] outline-none"
                            />
                        ) : (
                            <>
                                <span className={`text-sm font-medium truncate ${selected ? 'text-[var(--ac-accent)]' : 'text-[var(--ac-text)]'}`}>{session.name || 'Unnamed Session'}</span>
                                {session.model && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--ac-surface-muted)] text-[var(--ac-text-subtle)] font-mono">{session.model}</span>}
                                {isRunning && <span className="px-1.5 py-0.5 text-[9px] font-medium uppercase bg-[var(--ac-success)] text-white rounded-[var(--ac-radius-button)] animate-pulse">Running</span>}
                            </>
                        )}
                    </div>
                    {session.preview && <div className="text-xs text-[var(--ac-text-muted)] truncate">{session.preview}</div>}
                    {displayPath && (
                        <div className="mt-1 text-[10px] flex items-center gap-1 text-[var(--ac-text-subtle)] font-mono truncate">
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                            <span className="truncate">{displayPath}</span>
                        </div>
                    )}
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <span className="text-[10px] text-[var(--ac-text-subtle)]">{formatDate(session.updatedAt)}</span>
                    {!isEditing && (
                        <div className="flex items-center gap-1">
                            <button onClick={(e) => { e.stopPropagation(); onOpenProject(session.id); }} className="p-1.5 text-[var(--ac-text-muted)] hover:text-[var(--ac-accent)]"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2zM12 11v6M9 14h6" /></svg></button>
                            <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="p-1.5 text-[var(--ac-text-muted)] hover:text-[var(--ac-accent)]"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                            <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this session?')) onDelete(session.id); }} className="p-1.5 text-[var(--ac-danger)] hover:opacity-70"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// =============================================================================
// Dropdown Menus (Stubs for now, will be implemented in separate files or as needed)
// =============================================================================

export const AgentProjectMenu: React.FC<{
    open: boolean;
    projects: AgentProject[];
    selectedProjectId: string;
    selectedCli: string;
    model: string;
    reasoningEffort: CodexReasoningEffort;
    useCcr: boolean;
    enableChromeMcp: boolean;
    engines: { name: string }[];
    isPicking: boolean;
    isSaving: boolean;
    error: string | null;
    onSelect: (id: string) => void;
    onNew: () => void;
    onUpdateCli: (cli: string) => void;
    onUpdateModel: (model: string) => void;
    onUpdateReasoningEffort: (effort: CodexReasoningEffort) => void;
    onUpdateCcr: (useCcr: boolean) => void;
    onUpdateChromeMcp: (enable: boolean) => void;
    onSave: () => void;
}> = ({
    open, projects, selectedProjectId, selectedCli, model, reasoningEffort,
    useCcr, enableChromeMcp, engines, isPicking, isSaving, error,
    onSelect, onNew, onUpdateCli, onUpdateModel, onUpdateReasoningEffort,
    onUpdateCcr, onUpdateChromeMcp, onSave
}) => {
        if (!open) return null;

        // Audit project and CLI to determine correct model list
        const activeProject = projects.find(p => p.id === selectedProjectId);
        const effectiveCli = selectedCli || activeProject?.preferredCli || 'claude';

        const availableModels = getModelsForCli(effectiveCli);
        const showReasoningEffort = effectiveCli === 'codex';
        const showCcr = effectiveCli === 'claude';
        const showChromeMcp = !effectiveCli || ['claude', 'codex', 'gemini'].includes(effectiveCli);

        const isModelSelectionDisabled = availableModels.length === 0;

        return (
            <div
                className="fixed top-12 left-4 right-4 z-[100] py-2 max-w-[calc(100%-2rem)] flex flex-col"
                style={{
                    backgroundColor: 'var(--ac-surface, #ffffff)',
                    border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
                    borderRadius: 'var(--ac-radius-inner, 8px)',
                    boxShadow: 'var(--ac-shadow-float, 0 4px 20px -2px rgba(0,0,0,0.1))',
                }}
            >
                {/* Projects Section */}
                <div
                    className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: 'var(--ac-text-subtle, #a8a29e)' }}
                >
                    Projects
                </div>

                {/* Project List */}
                <div className="max-h-[180px] overflow-y-auto overflow-x-hidden ac-scroll">
                    {projects.map((p) => {
                        const projectEngine = p.preferredCli || (p as any).engineName;
                        return (
                            <button
                                key={p.id}
                                onClick={() => onSelect(p.id)}
                                className="w-full text-left px-4 py-2.5 flex items-start justify-between group hover:bg-[var(--ac-hover-bg, #f3f4f6)] transition-all"
                                style={{
                                    color: selectedProjectId === p.id ? 'var(--ac-accent, #c87941)' : 'var(--ac-text, #1a1a1a)',
                                }}
                            >
                                <div className="flex-1 min-w-0 pr-2">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <div className={`truncate text-[14px] leading-tight ${selectedProjectId === p.id ? 'font-bold' : 'font-semibold'}`}>
                                            {p.name}
                                        </div>
                                        {projectEngine && (
                                            <span
                                                className="text-[9px] px-1.5 py-0.5 rounded-sm font-black uppercase text-white shrink-0 tracking-wide"
                                                style={{ backgroundColor: getEngineColor(projectEngine) }}
                                            >
                                                {projectEngine}
                                            </span>
                                        )}
                                    </div>
                                    <div
                                        className="text-[10px] truncate opacity-40 font-mono"
                                        style={{ color: 'var(--ac-text-subtle, #a8a29e)' }}
                                    >
                                        {p.rootPath}
                                    </div>
                                </div>
                                {selectedProjectId === p.id && (
                                    <div className="w-4 h-4 shrink-0 flex items-center justify-center mt-1" style={{ color: 'var(--ac-accent, #c87941)' }}>
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4" className="w-3.5 h-3.5"><path d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                <button
                    onClick={onNew}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--ac-hover-bg, #f3f4f6)] transition-colors disabled:opacity-50"
                    style={{ color: 'var(--ac-link, #3b82f6)' }}
                    disabled={isPicking}
                >
                    {isPicking ? 'Selecting...' : '+ New Project'}
                </button>

                <div
                    className="mx-3 my-1"
                    style={{ borderTop: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)' }}
                />

                <div
                    className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: 'var(--ac-text-subtle, #a8a29e)' }}
                >
                    Settings
                </div>

                <div className="px-4 py-2 space-y-3">
                    {/* CLI Selector */}
                    <div className="flex items-center gap-3">
                        <span className="text-xs w-12 text-[var(--ac-text-muted, #6e6e6e)]">CLI</span>
                        <select
                            value={selectedCli}
                            onChange={(e) => onUpdateCli(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 text-xs outline-none"
                            style={{
                                backgroundColor: 'var(--ac-surface-muted, #f2f0eb)',
                                border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
                                borderRadius: 'var(--ac-radius-button, 8px)',
                                color: 'var(--ac-text, #1a1a1a)',
                            }}
                        >
                            <option value="">Auto</option>
                            {engines.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
                        </select>
                    </div>

                    {/* Model Selector */}
                    <div className="flex items-center gap-3">
                        <span className="text-xs w-12 text-[var(--ac-text-muted, #6e6e6e)]">Model</span>
                        <select
                            value={model}
                            onChange={(e) => onUpdateModel(e.target.value)}
                            disabled={isModelSelectionDisabled}
                            className="flex-1 px-2.5 py-1.5 text-xs outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{
                                backgroundColor: 'var(--ac-surface-muted, #f2f0eb)',
                                border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
                                borderRadius: 'var(--ac-radius-button, 8px)',
                                color: isModelSelectionDisabled ? 'var(--ac-text-subtle, #a8a29e)' : 'var(--ac-text, #1a1a1a)',
                            }}
                        >
                            <option value="">Default</option>
                            {availableModels.filter(m => m.id !== '').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>

                    {/* Reasoning Effort (Codex Only) */}
                    {showReasoningEffort && (
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-xs w-12 text-[var(--ac-text-muted, #6e6e6e)]">Effort</span>
                                <select
                                    value={reasoningEffort}
                                    onChange={(e) => onUpdateReasoningEffort(e.target.value as CodexReasoningEffort)}
                                    className="flex-1 px-2 py-1 text-xs outline-none"
                                    style={{
                                        backgroundColor: 'var(--ac-surface-muted, #f2f0eb)',
                                        border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
                                        borderRadius: 'var(--ac-radius-button, 8px)',
                                        color: 'var(--ac-text, #1a1a1a)',
                                    }}
                                >
                                    {getCodexReasoningEfforts(model || getDefaultModelForCli('codex')).map(effort => (
                                        <option key={effort} value={effort}>{effort}</option>
                                    ))}
                                </select>
                            </div>
                            <p className="text-[10px] mt-1 ml-14" style={{ color: 'var(--ac-text-subtle, #a8a29e)' }}>
                                Applies to new sessions. Edit existing session in Session Settings.
                            </p>
                        </div>
                    )}

                    <div className="space-y-2 pt-1">
                        {/* CCR Toggle (Claude Only) */}
                        {showCcr && (
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={useCcr}
                                    onChange={(e) => onUpdateCcr(e.target.checked)}
                                    className="w-4 h-4 rounded"
                                    style={{ accentColor: 'var(--ac-accent, #c87941)' }}
                                />
                                <span className="text-xs text-[var(--ac-text, #1a1a1a)] group-hover:text-[var(--ac-accent, #c87941)] transition-colors">Use Claude Code Router</span>
                            </label>
                        )}

                        {/* Chrome MCP Toggle */}
                        {showChromeMcp && (
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={enableChromeMcp}
                                    onChange={(e) => onUpdateChromeMcp(e.target.checked)}
                                    className="w-4 h-4 rounded"
                                    style={{ accentColor: 'var(--ac-accent, #c87941)' }}
                                />
                                <span className="text-xs text-[var(--ac-text, #1a1a1a)] group-hover:text-[var(--ac-accent, #c87941)] transition-colors">Enable Chrome MCP Server</span>
                            </label>
                        )}
                    </div>
                </div>

                {/* Save Button */}
                <div className="px-3 py-2 mt-1">
                    <button
                        onClick={onSave}
                        disabled={isSaving}
                        className="w-full py-1.5 text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                        style={{
                            backgroundColor: 'var(--ac-accent, #c87941)',
                            color: 'var(--ac-accent-contrast, #ffffff)',
                            borderRadius: 'var(--ac-radius-button, 8px)',
                        }}
                    >
                        {isSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>

                {/* Error Message */}
                {error && (
                    <div
                        className="px-3 py-1 text-[10px]"
                        style={{ color: 'var(--ac-danger, #dc2626)' }}
                    >
                        {error}
                    </div>
                )}
            </div>
        );
    };



export const AgentSessionMenu: React.FC<{
    open: boolean;
    sessions: AgentSession[];
    selectedSessionId: string;
    isLoading: boolean;
    isCreating: boolean;
    error: string | null;
    onSelect: (id: string) => void;
    onNew: () => void;
    onDelete: (id: string) => void;
    onRename: (id: string, name: string) => void;
}> = ({ open, sessions, selectedSessionId, isLoading, isCreating, error, onSelect, onNew, onDelete, onRename }) => {
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    if (!open) return null;

    const startRename = (s: AgentSession, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingSessionId(s.id);
        setEditingName(s.name || '');
        // nextTick like focus
        setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
        }, 0);
    };

    const confirmRename = (id: string) => {
        const trimmed = editingName.trim();
        if (trimmed && trimmed !== (sessions.find(s => s.id === id)?.name || '')) {
            onRename(id, trimmed);
        }
        setEditingSessionId(null);
    };

    const handleSelect = (id: string) => {
        if (editingSessionId) return;
        onSelect(id);
    };

    const getSessionDisplayName = (s: AgentSession) => {
        return s.preview || s.name || 'Unnamed Session';
    };

    return (
        <div
            className="fixed top-12 left-4 right-4 z-[100] py-2 max-w-[calc(100%-2rem)] flex flex-col"
            style={{
                backgroundColor: 'var(--ac-surface, #ffffff)',
                border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
                borderRadius: 'var(--ac-radius-inner, 8px)',
                boxShadow: 'var(--ac-shadow-float, 0 4px 20px -2px rgba(0,0,0,0.1))',
            }}
        >
            {/* Sessions Section */}
            <div
                className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--ac-text-subtle, #a8a29e)' }}
            >
                Sessions
            </div>

            {/* Loading State */}
            {isLoading && sessions.length === 0 ? (
                <div
                    className="px-3 py-4 text-center text-xs"
                    style={{ color: 'var(--ac-text-muted, #6e6e6e)' }}
                >
                    Loading sessions...
                </div>
            ) : sessions.length === 0 ? (
                /* Empty State */
                <div
                    className="px-3 py-4 text-center text-xs"
                    style={{ color: 'var(--ac-text-muted, #6e6e6e)' }}
                >
                    No sessions yet
                </div>
            ) : (
                /* Session List */
                <div className="max-h-[240px] overflow-y-auto overflow-x-hidden ac-scroll">
                    {sessions.map((s) => (
                        <div key={s.id} className="group relative">
                            <button
                                onClick={() => handleSelect(s.id)}
                                className="w-full text-left px-3 py-2 text-sm flex items-center justify-between group hover:bg-[var(--ac-hover-bg, #f3f4f6)]"
                                style={{
                                    color: selectedSessionId === s.id ? 'var(--ac-accent, #c87941)' : 'var(--ac-text, #1a1a1a)',
                                }}
                            >
                                <div className="flex-1 min-w-0 pr-16">
                                    {/* Session Name (inline editing) */}
                                    <div className="truncate flex items-center gap-2">
                                        {editingSessionId === s.id ? (
                                            <input
                                                ref={inputRef}
                                                type="text"
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') confirmRename(s.id);
                                                    if (e.key === 'Escape') setEditingSessionId(null);
                                                }}
                                                onBlur={() => confirmRename(s.id)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full px-1 py-0.5 text-sm"
                                                style={{
                                                    backgroundColor: 'var(--ac-surface, #ffffff)',
                                                    border: 'var(--ac-border-width, 1px) solid var(--ac-accent, #c87941)',
                                                    borderRadius: 'var(--ac-radius-button, 8px)',
                                                    color: 'var(--ac-text, #1a1a1a)',
                                                    outline: 'none',
                                                }}
                                            />
                                        ) : (
                                            <>
                                                <span className="truncate">{getSessionDisplayName(s)}</span>
                                                <span
                                                    className="text-[10px] px-1.5 py-0.5 shrink-0"
                                                    style={{
                                                        backgroundColor: getEngineColor(s.engineName),
                                                        color: '#ffffff',
                                                        borderRadius: 'var(--ac-radius-button, 8px)',
                                                    }}
                                                >
                                                    {s.engineName}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                    {/* Session Info */}
                                    <div
                                        className="text-[10px] truncate flex items-center gap-2"
                                        style={{
                                            fontFamily: 'var(--ac-font-mono, monospace)',
                                            color: 'var(--ac-text-subtle, #a8a29e)',
                                        }}
                                    >
                                        {s.model && <span>{s.model}</span>}
                                        <span>{formatDate(s.updatedAt)}</span>
                                    </div>
                                </div>

                                {/* Action Buttons (shown on hover) */}
                                {!editingSessionId && (
                                    <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {/* Rename Button */}
                                        <button
                                            onClick={(e) => startRename(s, e)}
                                            className="p-1 cursor-pointer hover:bg-[var(--ac-surface)] rounded-[var(--ac-radius-button, 8px)]"
                                            style={{ color: 'var(--ac-text-muted, #6e6e6e)' }}
                                            title="Rename session"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                        </button>
                                        {/* Delete Button */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); if (confirm('Delete this session? This cannot be undone.')) { onDelete(s.id); } }}
                                            className="p-1 cursor-pointer hover:bg-[var(--ac-surface)] rounded-[var(--ac-radius-button, 8px)]"
                                            style={{ color: 'var(--ac-danger, #dc2626)' }}
                                            title="Delete session"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                )}

                                {/* Selected Check */}
                                {selectedSessionId === s.id && !editingSessionId && (
                                    <div className="w-4 h-4 shrink-0">
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* New Session Button */}
            <button
                onClick={onNew}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--ac-hover-bg, #f3f4f6)] transition-colors disabled:opacity-50"
                style={{ color: 'var(--ac-link, #3b82f6)' }}
                disabled={isCreating}
            >
                {isCreating ? 'Creating...' : '+ New Session'}
            </button>

            {/* Error */}
            {error && (
                <div
                    className="px-3 py-1 text-[10px]"
                    style={{ color: 'var(--ac-danger, #dc2626)' }}
                >
                    {error}
                </div>
            )}
        </div>
    );
};


export const AgentSettingsMenu: React.FC<{
    open: boolean;
    theme: AgentThemeId;
    onSetTheme: (theme: AgentThemeId) => void;
    onReconnect: () => void;
    onOpenAttachments: () => void;
    fakeCaretEnabled?: boolean;
    onToggleFakeCaret?: (enabled: boolean) => void;
}> = ({ open, theme, onSetTheme, onReconnect, onOpenAttachments, fakeCaretEnabled, onToggleFakeCaret }) => {
    if (!open) return null;

    const themes: { id: AgentThemeId; label: string }[] = [
        { id: 'warm-editorial', label: 'Warm Editorial' },
        { id: 'blueprint-architect', label: 'Blueprint Architect' },
        { id: 'zen-journal', label: 'Zen Journal' },
        { id: 'neo-pop', label: 'Neo Pop' },
        { id: 'dark-console', label: 'Dark Console' },
        { id: 'swiss-grid', label: 'Swiss Grid' },
    ];

    return (
        <div
            className="fixed top-12 right-4 z-[100] min-w-[180px] py-2"
            style={{
                backgroundColor: 'var(--ac-surface, #ffffff)',
                border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
                borderRadius: 'var(--ac-radius-inner, 8px)',
                boxShadow: 'var(--ac-shadow-float, 0 4px 20px -2px rgba(0,0,0,0.1))',
            }}
        >
            {/* Theme Section */}
            <div
                className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--ac-text-subtle, #a8a29e)' }}
            >
                Theme
            </div>
            {themes.map((t) => (
                <button
                    key={t.id}
                    onClick={() => onSetTheme(t.id)}
                    className="w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-[var(--ac-hover-bg, #f3f4f6)] group transition-colors"
                    style={{
                        color: theme === t.id ? 'var(--ac-accent, #c87941)' : 'var(--ac-text, #1a1a1a)',
                    }}
                >
                    <span>{t.label}</span>
                    {theme === t.id && (
                        <div className="w-4 h-4">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" /></svg>
                        </div>
                    )}
                </button>
            ))}

            {/* Divider */}
            <div
                className="my-2"
                style={{ borderTop: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)' }}
            />

            {/* Input Section */}
            <div
                className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--ac-text-subtle, #a8a29e)' }}
            >
                Input
            </div>
            <button
                onClick={() => onToggleFakeCaret?.(!fakeCaretEnabled)}
                className="w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-[var(--ac-hover-bg, #f3f4f6)] transition-colors"
                style={{ color: 'var(--ac-text, #1a1a1a)' }}
            >
                <span>Comet caret</span>
                {fakeCaretEnabled && (
                    <div className="w-4 h-4">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" /></svg>
                    </div>
                )}
            </button>

            {/* Divider */}
            <div
                className="my-2"
                style={{ borderTop: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)' }}
            />

            {/* Storage Section */}
            <div
                className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--ac-text-subtle, #a8a29e)' }}
            >
                Storage
            </div>
            <button
                onClick={onOpenAttachments}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--ac-hover-bg, #f3f4f6)] transition-colors"
                style={{ color: 'var(--ac-text, #1a1a1a)' }}
            >
                Clear Attachment Cache
            </button>

            {/* Divider */}
            <div
                className="my-2"
                style={{ borderTop: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)' }}
            />

            {/* Reconnect */}
            <button
                onClick={onReconnect}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--ac-hover-bg, #f3f4f6)] transition-colors"
                style={{ color: 'var(--ac-text, #1a1a1a)' }}
            >
                Reconnect Server
            </button>
        </div>
    );
};


export const AgentOpenProjectMenu: React.FC<{
    open: boolean;
    onSelect: (target: string) => void;
    defaultTarget?: string;
}> = ({ open, onSelect, defaultTarget }) => {
    if (!open) return null;
    return (
        <div
            className="fixed top-12 right-4 z-[100] min-w-[160px] py-2"
            style={{
                backgroundColor: 'var(--ac-surface, #ffffff)',
                border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
                borderRadius: 'var(--ac-radius-inner, 8px)',
                boxShadow: 'var(--ac-shadow-float, 0 4px 20px -2px rgba(0,0,0,0.1))',
            }}
        >
            <div
                className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--ac-text-subtle, #a8a29e)' }}
            >
                Open In
            </div>

            <button
                onClick={() => onSelect('vscode')}
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-[var(--ac-hover-bg, #f3f4f6)] group transition-colors"
                style={{
                    color: defaultTarget === 'vscode' ? 'var(--ac-accent, #c87941)' : 'var(--ac-text, #1a1a1a)',
                }}
            >
                <div className="w-4 h-4 shrink-0">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.583 2L6.167 11.667 2 8.5v7l4.167-3.167L17.583 22 22 19.75V4.25L17.583 2zm0 3.5v13l-8-6.5 8-6.5z" /></svg>
                </div>
                <span className="flex-1">VS Code</span>
                {defaultTarget === 'vscode' && (
                    <div className="w-4 h-4 shrink-0">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" /></svg>
                    </div>
                )}
            </button>

            <button
                onClick={() => onSelect('terminal')}
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-[var(--ac-hover-bg, #f3f4f6)] group transition-colors"
                style={{
                    color: defaultTarget === 'terminal' ? 'var(--ac-accent, #c87941)' : 'var(--ac-text, #1a1a1a)',
                }}
            >
                <div className="w-4 h-4 shrink-0">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <span className="flex-1">Terminal</span>
                {defaultTarget === 'terminal' && (
                    <div className="w-4 h-4 shrink-0">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" /></svg>
                    </div>
                )}
            </button>
        </div>
    );
};


function getEngineColor(engineName: string): string {
    const colors: Record<string, string> = {
        claude: '#c87941', codex: '#10a37f', cursor: '#8b5cf6', qwen: '#6366f1', glm: '#ef4444', gemini: '#4285f4'
    };
    return colors[engineName] || '#6b7280';
}

export const AgentSessionSettingsPanel: React.FC<{
    open: boolean;
    onClose: () => void;
    session: AgentSession | null;
    managementInfo: AgentManagementInfo | null;
    isLoading: boolean;
    isSaving: boolean;
    onSave: (settings: any) => void;
}> = ({ open, onClose, session, managementInfo, isLoading, isSaving, onSave }) => {
    const [localModel, setLocalModel] = useState('');
    const [localPermissionMode, setLocalPermissionMode] = useState('');
    const [localReasoningEffort, setLocalReasoningEffort] = useState<CodexReasoningEffort>('medium');
    const [localUseCustomPrompt, setLocalUseCustomPrompt] = useState(false);
    const [localCustomPrompt, setLocalCustomPrompt] = useState('');
    const [localAppendToPrompt, setLocalAppendToPrompt] = useState(false);
    const [localPromptAppend, setLocalPromptAppend] = useState('');

    useEffect(() => {
        if (session) {
            setLocalModel(session.model || '');
            setLocalPermissionMode(session.permissionMode || '');
            setLocalReasoningEffort(session.optionsConfig?.codexConfig?.reasoningEffort || 'medium');

            const config = session.systemPromptConfig;
            if (config) {
                if (config.type === 'custom') {
                    setLocalUseCustomPrompt(true);
                    setLocalCustomPrompt(config.text || '');
                    setLocalAppendToPrompt(false);
                    setLocalPromptAppend('');
                } else {
                    setLocalUseCustomPrompt(false);
                    setLocalCustomPrompt('');
                    setLocalAppendToPrompt(!!config.append);
                    setLocalPromptAppend(config.append || '');
                }
            } else {
                setLocalUseCustomPrompt(false);
                setLocalAppendToPrompt(false);
            }
        }
    }, [session, open]);

    if (!open) return null;

    const isClaude = session?.engineName === 'claude';
    const isCodex = session?.engineName === 'codex';
    const availableModels = session ? getModelsForCli(session.engineName) : [];

    const handleSave = () => {
        const settings: any = {
            model: localModel,
            permissionMode: localPermissionMode,
            systemPromptConfig: localUseCustomPrompt
                ? { type: 'custom', text: localCustomPrompt.trim() }
                : { type: 'preset', preset: 'claude_code', append: localAppendToPrompt ? localPromptAppend.trim() : undefined },
            optionsConfig: isCodex ? { codexConfig: { reasoningEffort: localReasoningEffort } } : undefined
        };
        onSave(settings);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-[var(--ac-surface)] border border-[var(--ac-border)] rounded-[var(--ac-radius-card)] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="px-4 py-3 border-b border-[var(--ac-border)] flex items-center justify-between bg-[var(--ac-surface-muted)]">
                    <h2 className="font-semibold text-sm text-[var(--ac-text)]">Session Settings</h2>
                    <button onClick={onClose} className="p-1 ac-btn rounded-full hover:bg-[var(--ac-hover-bg)] text-[var(--ac-text-subtle)]">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto ac-scroll p-4 space-y-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-10">
                            <span className="text-sm text-[var(--ac-text-subtle)]">Loading session info...</span>
                        </div>
                    ) : (
                        <>
                            <section className="space-y-3">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--ac-text-subtle)]">Session Info</label>
                                <div className="text-xs space-y-2 p-3 bg-[var(--ac-surface-muted)] rounded-lg">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[var(--ac-text-muted)]">Engine</span>
                                        <span className="px-2 py-0.5 text-[10px] text-white rounded-full font-medium" style={{ backgroundColor: getEngineColor(session?.engineName || '') }}>{session?.engineName}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[var(--ac-text-muted)]">Model</span>
                                        <span className="font-mono text-[var(--ac-text)]">{localModel || 'Default'}</span>
                                    </div>
                                    {session?.engineSessionId && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-[var(--ac-text-muted)]">Engine Session</span>
                                            <span className="font-mono text-[var(--ac-text)] truncate max-w-[200px]">{session.engineSessionId}</span>
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section className="space-y-3">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--ac-text-subtle)]">Model</label>
                                <select
                                    value={localModel}
                                    onChange={(e) => setLocalModel(e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-[var(--ac-surface)] border border-[var(--ac-border)] rounded-lg text-[var(--ac-text)] outline-none focus:border-[var(--ac-accent)]"
                                >
                                    <option value="">Default (server setting)</option>
                                    {availableModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </section>

                            {isCodex && (
                                <section className="space-y-3">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--ac-text-subtle)]">Reasoning Effort</label>
                                    <select
                                        value={localReasoningEffort}
                                        onChange={(e) => setLocalReasoningEffort(e.target.value as CodexReasoningEffort)}
                                        className="w-full px-3 py-2 text-sm bg-[var(--ac-surface)] border border-[var(--ac-border)] rounded-lg text-[var(--ac-text)] outline-none focus:border-[var(--ac-accent)]"
                                    >
                                        {getCodexReasoningEfforts(localModel || getDefaultModelForCli('codex')).map(effort => (
                                            <option key={effort} value={effort}>{effort}</option>
                                        ))}
                                    </select>
                                </section>
                            )}

                            {isClaude && (
                                <>
                                    <section className="space-y-3">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--ac-text-subtle)]">Permission Mode</label>
                                        <select
                                            value={localPermissionMode}
                                            onChange={(e) => setLocalPermissionMode(e.target.value)}
                                            className="w-full px-3 py-2 text-sm bg-[var(--ac-surface)] border border-[var(--ac-border)] rounded-lg text-[var(--ac-text)] outline-none focus:border-[var(--ac-accent)]"
                                        >
                                            <option value="">Default</option>
                                            <option value="default">default - Ask for approval</option>
                                            <option value="acceptEdits">acceptEdits - Auto-accept file edits</option>
                                            <option value="bypassPermissions">bypassPermissions - Auto-accept all</option>
                                            <option value="plan">plan - Plan mode only</option>
                                            <option value="dontAsk">dontAsk - No confirmation</option>
                                        </select>
                                    </section>

                                    <section className="space-y-3">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--ac-text-subtle)]">System Prompt</label>
                                        <div className="space-y-3">
                                            <label className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg hover:bg-[var(--ac-hover-bg)]">
                                                <input type="radio" checked={!localUseCustomPrompt} onChange={() => setLocalUseCustomPrompt(false)} className="accent-[var(--ac-accent)]" />
                                                <span className="text-[var(--ac-text)]">Use preset (claude_code)</span>
                                            </label>
                                            {!localUseCustomPrompt && (
                                                <div className="pl-6 space-y-2">
                                                    <label className="flex items-center gap-2 text-xs cursor-pointer text-[var(--ac-text-muted)]">
                                                        <input type="checkbox" checked={localAppendToPrompt} onChange={(e) => setLocalAppendToPrompt(e.target.checked)} className="accent-[var(--ac-accent)] mr-2" />
                                                        <span>Append custom text</span>
                                                    </label>
                                                    {localAppendToPrompt && (
                                                        <textarea
                                                            value={localPromptAppend}
                                                            onChange={(e) => setLocalPromptAppend(e.target.value)}
                                                            className="w-full p-2 text-xs bg-[var(--ac-surface-muted)] border border-[var(--ac-border)] rounded-lg font-mono text-[var(--ac-text)] outline-none focus:border-[var(--ac-accent)]"
                                                            rows={3}
                                                            placeholder="Additional instructions..."
                                                        />
                                                    )}
                                                </div>
                                            )}
                                            <label className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg hover:bg-[var(--ac-hover-bg)]">
                                                <input type="radio" checked={localUseCustomPrompt} onChange={() => setLocalUseCustomPrompt(true)} className="accent-[var(--ac-accent)]" />
                                                <span className="text-[var(--ac-text)]">Use custom prompt</span>
                                            </label>
                                            {localUseCustomPrompt && (
                                                <textarea
                                                    value={localCustomPrompt}
                                                    onChange={(e) => setLocalCustomPrompt(e.target.value)}
                                                    className="w-full p-2 text-xs bg-[var(--ac-surface-muted)] border border-[var(--ac-border)] rounded-lg font-mono text-[var(--ac-text)] outline-none focus:border-[var(--ac-accent)] ml-6"
                                                    rows={4}
                                                    placeholder="Enter full system prompt..."
                                                />
                                            )}
                                        </div>
                                    </section>
                                </>
                            )}

                            {managementInfo && (
                                <section className="space-y-3 border-t border-[var(--ac-border)] pt-4">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--ac-text-subtle)]">SDK Info</label>
                                    <div className="grid grid-cols-2 gap-2 text-[10px] text-[var(--ac-text-muted)] p-3 bg-[var(--ac-surface-muted)] rounded-lg font-mono">
                                        <div className="flex justify-between px-1"><span>Model</span><span className="text-[var(--ac-text)] truncate ml-2">{managementInfo.model}</span></div>
                                        <div className="flex justify-between px-1"><span>Version</span><span className="text-[var(--ac-text)]">{managementInfo.claudeCodeVersion}</span></div>
                                        <div className="flex justify-between px-1"><span>Tools</span><span className="text-[var(--ac-text)]">{managementInfo.tools?.length || 0}</span></div>
                                        <div className="flex justify-between px-1"><span>Servers</span><span className="text-[var(--ac-text)]">{managementInfo.mcpServers?.length || 0}</span></div>
                                    </div>
                                </section>
                            )}
                        </>
                    )}
                </div>

                <div className="p-4 border-t border-[var(--ac-border)] flex justify-end gap-3 bg-[var(--ac-surface-muted)]">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--ac-text-muted)] hover:text-[var(--ac-text)] hover:bg-[var(--ac-hover-bg)] rounded-lg transition-colors">Cancel</button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2 text-sm font-bold bg-[var(--ac-accent)] text-[var(--ac-accent-contrast)] rounded-lg shadow-lg shadow-[var(--ac-accent-glow)] hover:opacity-90 transition-all disabled:opacity-50"
                    >
                        {isSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const AttachmentCachePanel: React.FC<{
    open: boolean;
    onClose: () => void;
}> = ({ open, onClose }) => {
    const [stats, setStats] = useState<any>(null);
    const [clearing, setClearing] = useState(false);
    const contextPort = React.useContext(AgentServerPortContext);

    const fetchStats = async () => {
        if (!contextPort) return;
        try {
            const res = await fetch(`http://127.0.0.1:${contextPort}/agent/attachments/cache-stats`);
            if (res.ok) setStats(await res.json());
        } catch (e) { }
    };

    useEffect(() => {
        if (open) fetchStats();
    }, [open, contextPort]);

    const handleClear = async () => {
        if (!contextPort) return;
        setClearing(true);
        try {
            await fetch(`http://127.0.0.1:${contextPort}/agent/attachments/clear-cache`, { method: 'POST' });
            await fetchStats();
        } finally {
            setClearing(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-[var(--ac-surface)] border border-[var(--ac-border)] rounded-[var(--ac-radius-card)] shadow-2xl p-6">
                <h2 className="text-lg font-semibold mb-4 text-[var(--ac-text)]">Attachment Cache</h2>
                <div className="space-y-4 mb-6">
                    <div className="p-4 bg-[var(--ac-surface-muted)] rounded-lg">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-[var(--ac-text-muted)]">Cached items</span>
                            <span className="font-mono text-[var(--ac-text)]">{stats?.count || 0}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-[var(--ac-text-muted)]">Total size</span>
                            <span className="font-mono text-[var(--ac-text)]">{stats?.totalSize ? (stats.totalSize / (1024 * 1024)).toFixed(2) + ' MB' : '0 MB'}</span>
                        </div>
                    </div>
                    <p className="text-xs text-[var(--ac-text-subtle)] leading-relaxed">
                        Clearing the cache will remove all temporary images uploaded to sessions. This cannot be undone.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2 text-sm font-medium text-[var(--ac-text-muted)] hover:bg-[var(--ac-hover-bg)] rounded-lg transition-colors">Close</button>
                    <button
                        onClick={handleClear}
                        disabled={clearing}
                        className="flex-1 py-2 text-sm font-bold bg-[var(--ac-danger)] text-white rounded-lg shadow-lg hover:opacity-90 transition-all disabled:opacity-50"
                    >
                        {clearing ? 'Clearing...' : 'Clear All'}
                    </button>
                </div>
            </div>
        </div>
    );
};
