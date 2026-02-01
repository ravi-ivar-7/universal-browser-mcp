import React from 'react';
import type { AgentMessage } from 'chrome-mcp-shared';
import { MarkdownContent } from './MarkdownContent';

interface MessageItemProps {
    message: AgentMessage;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
    const isUser = message.role === 'user';

    return (
        <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl border border-[var(--ac-border)] p-3 shadow-sm ${isUser ? 'bg-[var(--ac-surface-muted)]' : 'bg-[var(--ac-surface)]'}`}>
                <MarkdownContent content={message.content} />
                <div className="flex items-center justify-between gap-2.5 mt-2 text-[10px] text-[var(--ac-text-subtle)]">
                    <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {message.isStreaming && (
                        <div className="h-2 w-2 rounded-full bg-[var(--ac-accent)] animate-pulse" />
                    )}
                </div>
            </div>
        </div>
    );
};
