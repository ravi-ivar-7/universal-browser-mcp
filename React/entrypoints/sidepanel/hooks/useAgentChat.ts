import { useState, useCallback, useMemo, useRef } from 'react';
import type {
    AgentMessage,
    AgentActRequest,
    AgentAttachment,
    RealtimeEvent,
    AgentStatusEvent,
    AgentCliPreference,
    AgentUsageStats,
} from 'chrome-mcp-shared';

export interface AgentActRequestClientMeta {
    [key: string]: any;
}

export type AgentRequestState = 'idle' | AgentStatusEvent['status'];

export interface AgentUsageMetrics {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

export interface UseAgentChatOptions {
    getServerPort: () => number | null;
    getSessionId: () => string | null;
    ensureServer: () => Promise<boolean>;
    openEventSource: () => void;
}

export function useAgentChat(options: UseAgentChatOptions) {
    // State
    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [requestState, setRequestState] = useState<AgentRequestState>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [usage, setUsage] = useState<AgentUsageStats | null>(null);
    const [fakeCaretEnabled, setFakeCaretEnabled] = useState(false);

    // Refs
    const currentRequestIdRef = useRef<string | null>(null);
    const requestStateRef = useRef<AgentRequestState>('idle');

    // Sync refs
    currentRequestIdRef.current = currentRequestId;
    requestStateRef.current = requestState;

    // Computed
    const canSend = input.trim().length > 0 && !sending;

    const isRequestActive = useMemo(() => {
        return (
            requestState === 'starting' ||
            requestState === 'ready' ||
            requestState === 'running'
        );
    }, [requestState]);

    const isDifferentActiveRequest = useCallback((incomingRequestId?: string): boolean => {
        const incoming = incomingRequestId?.trim();
        const current = currentRequestIdRef.current?.trim();
        if (!incoming || !current) return false;
        if (incoming === current) return false;
        const active = requestStateRef.current === 'starting' ||
            requestStateRef.current === 'ready' ||
            requestStateRef.current === 'running';
        return active;
    }, []);

    const handleMessageEvent = useCallback((msg: AgentMessage) => {
        setMessages(prevMessages => {
            const newMessages = [...prevMessages];
            if (msg.role === 'user' && msg.requestId) {
                const optimisticIndex = newMessages.findIndex(
                    (m) => m.role === 'user' && m.requestId === msg.requestId && m.id.startsWith('temp-'),
                );
                if (optimisticIndex >= 0) {
                    const optimistic = newMessages[optimisticIndex];
                    newMessages[optimisticIndex] = {
                        ...msg,
                        content: optimistic.content,
                        metadata: msg.metadata ?? optimistic.metadata,
                    };
                    return newMessages;
                }
            }

            const existingIndex = newMessages.findIndex((m) => m.id === msg.id);
            if (existingIndex >= 0) {
                newMessages[existingIndex] = msg;
            } else {
                newMessages.push(msg);
            }
            return newMessages;
        });

        const msgRequestId = msg.requestId?.trim() || undefined;
        if (isDifferentActiveRequest(msgRequestId)) return;

        if (msgRequestId && msgRequestId !== currentRequestIdRef.current) {
            setCurrentRequestId(msgRequestId);
            currentRequestIdRef.current = msgRequestId;
        }

        if (msg.role === 'assistant' || msg.role === 'tool') {
            const streaming = msg.isStreaming === true && !msg.isFinal;
            setIsStreaming(streaming);

            if (
                requestStateRef.current === 'idle' ||
                requestStateRef.current === 'starting' ||
                requestStateRef.current === 'ready'
            ) {
                setRequestState('running');
                requestStateRef.current = 'running';
            }
        }
    }, [isDifferentActiveRequest]);

    const handleStatusEvent = useCallback((status: AgentStatusEvent) => {
        const statusRequestId = status.requestId?.trim() || undefined;
        if (isDifferentActiveRequest(statusRequestId)) return;

        if (statusRequestId && statusRequestId !== currentRequestIdRef.current) {
            setCurrentRequestId(statusRequestId);
            currentRequestIdRef.current = statusRequestId;
        }

        setRequestState(status.status);
        requestStateRef.current = status.status;

        switch (status.status) {
            case 'completed':
            case 'error':
            case 'cancelled':
                setIsStreaming(false);
                setCancelling(false);
                if (!statusRequestId || statusRequestId === currentRequestIdRef.current) {
                    setCurrentRequestId(null);
                    currentRequestIdRef.current = null;
                }
                break;
        }
    }, [isDifferentActiveRequest]);

    const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
        const currentSessionId = options.getSessionId();
        if (!currentSessionId) return;

        switch (event.type) {
            case 'message':
                if (event.data.sessionId !== currentSessionId) return;
                handleMessageEvent(event.data);
                break;
            case 'status':
                if (event.data.sessionId !== currentSessionId) return;
                handleStatusEvent(event.data);
                break;
            case 'error':
                if (event.data?.sessionId && event.data.sessionId !== currentSessionId) return;
                if (isDifferentActiveRequest(event.data?.requestId)) return;

                setErrorMessage(event.error);
                setIsStreaming(false);
                setRequestState('error');
                requestStateRef.current = 'error';

                if (!event.data?.requestId || event.data.requestId === currentRequestIdRef.current) {
                    setCurrentRequestId(null);
                    currentRequestIdRef.current = null;
                }
                break;
            case 'connected':
                console.log('[AgentChat] Connected to session:', event.data.sessionId);
                break;
            case 'usage':
                if (event.data?.sessionId && event.data.sessionId !== currentSessionId) return;
                setUsage(event.data);
                break;
        }
    }, [options.getSessionId, handleMessageEvent, handleStatusEvent, isDifferentActiveRequest]);

    const send = useCallback(async (
        chatOptions: {
            cliPreference?: string;
            model?: string;
            projectId?: string;
            projectRoot?: string;
            dbSessionId?: string;
            instruction?: string;
            displayText?: string;
            clientMeta?: AgentActRequestClientMeta;
            attachments?: AgentAttachment[];
        } = {}
    ) => {
        const userText = input.trim();
        const instructionText = chatOptions.instruction?.trim() || userText;
        const msgAttachments = chatOptions.attachments || [];

        if (!userText && msgAttachments.length === 0) return;

        await options.ensureServer();
        const serverPort = options.getServerPort();
        const sessionId = options.getSessionId();

        if (!serverPort || !sessionId) {
            setErrorMessage('Agent server is not available.');
            return;
        }

        options.openEventSource();

        const requestId = crypto.randomUUID();
        const tempMessageId = `temp-${Date.now()}`;

        const optimisticMessage: AgentMessage = {
            id: tempMessageId,
            sessionId: sessionId,
            role: 'user',
            content: userText,
            messageType: 'chat',
            requestId,
            createdAt: new Date().toISOString(),
            metadata: {
                attachments: msgAttachments.length > 0 ? msgAttachments : undefined,
                ...(chatOptions.displayText || chatOptions.clientMeta ? {
                    displayText: chatOptions.displayText?.trim(),
                    clientMeta: chatOptions.clientMeta,
                } : {})
            },
        };

        setMessages(prev => [...prev, optimisticMessage]);

        const payload: AgentActRequest = {
            instruction: instructionText,
            requestId,
            displayText: chatOptions.displayText?.trim() || undefined,
            clientMeta: chatOptions.clientMeta,
            cliPreference: chatOptions.cliPreference as AgentCliPreference,
            model: chatOptions.model?.trim() || undefined,
            projectId: chatOptions.projectId || undefined,
            projectRoot: chatOptions.projectRoot?.trim() || undefined,
            dbSessionId: chatOptions.dbSessionId || undefined,
            attachments: msgAttachments.length > 0 ? msgAttachments : undefined,
        };

        setSending(true);
        setRequestState('starting');
        requestStateRef.current = 'starting';
        setCurrentRequestId(requestId);
        currentRequestIdRef.current = requestId;
        setIsStreaming(false);
        setErrorMessage(null);

        const savedInput = input;
        setInput('');

        // Note: attachments are managed externally, so handled by caller logic if send succeeds/fails?
        // Typically caller should clear attachments if we return success.
        // But since this is async, we can't easily signal atomic success without return value.
        // We'll return Promise<boolean>
        let success = false;

        try {
            const url = `http://127.0.0.1:${serverPort}/agent/chat/${encodeURIComponent(sessionId)}/act`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(text || `HTTP ${response.status}`);
            }

            const result = await response.json().catch(() => ({}));

            const currentSessionId = options.getSessionId();
            if (currentSessionId !== sessionId) {
                // Context switched loop
                // Reset request state but don't error?
                // Actually if switched, we just stop tracking this request.
                setIsStreaming(false);
                setRequestState('idle');
                requestStateRef.current = 'idle';
                setCurrentRequestId(null);
                currentRequestIdRef.current = null;
                return false;
            }

            if (result.requestId) {
                setCurrentRequestId(result.requestId);
                currentRequestIdRef.current = result.requestId;
            }

            success = true;
        } catch (error: any) {
            const currentSessionId = options.getSessionId();
            if (currentSessionId !== sessionId) return false;

            console.error('Failed to send agent act request:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Failed to send request.');

            // RESTORE INPUT
            setInput(savedInput);
            setMessages(prev => prev.filter(m => m.id !== tempMessageId));

            setIsStreaming(false);
            setRequestState('idle');
            requestStateRef.current = 'idle';
            setCurrentRequestId(null);
            currentRequestIdRef.current = null;
            success = false;
        } finally {
            setSending(false);
        }

        return success;
    }, [input, options]);

    const cancelCurrentRequest = useCallback(async () => {
        if (!currentRequestIdRef.current) return;

        const serverPort = options.getServerPort();
        const sessionId = options.getSessionId();
        if (!serverPort || !sessionId) return;

        setCancelling(true);
        try {
            const url = `http://127.0.0.1:${serverPort}/agent/chat/${encodeURIComponent(sessionId)}/cancel/${encodeURIComponent(currentRequestIdRef.current)}`;
            const response = await fetch(url, { method: 'DELETE' });
            const data = await response.json().catch(() => null);

            if (!response.ok || data?.success === false) {
                const errorMsg = data?.message || `Failed to cancel (HTTP ${response.status})`;
                setErrorMessage(errorMsg);
                return;
            }
        } catch (error: any) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to cancel');
            setCancelling(false);
        }
    }, [options]);

    const clearMessages = useCallback(() => setMessages([]), []);
    const clearRequestState = useCallback(() => {
        setCurrentRequestId(null);
        currentRequestIdRef.current = null;
        setIsStreaming(false);
        setCancelling(false);
        setRequestState('idle');
        requestStateRef.current = 'idle';
    }, []);

    return {
        messages,
        setMessages,
        input,
        setInput,
        sending,
        isStreaming,
        requestState,
        errorMessage,
        setErrorMessage,
        currentRequestId,
        cancelling,

        usage,
        fakeCaretEnabled,
        setFakeCaretEnabled,
        canSend,
        isRequestActive,
        handleRealtimeEvent,
        send,
        cancelCurrentRequest,
        clearMessages,
        clearRequestState,
    };
}
