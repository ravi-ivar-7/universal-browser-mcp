import type { AgentRole, AgentStoredMessage } from 'chrome-mcp-shared';
export type { AgentStoredMessage };
export interface CreateAgentStoredMessageInput {
    projectId: string;
    role: AgentRole;
    messageType: AgentStoredMessage['messageType'];
    content: string;
    metadata?: Record<string, unknown>;
    sessionId?: string;
    conversationId?: string | null;
    cliSource?: string;
    requestId?: string;
    id?: string;
    createdAt?: string;
}
/**
 * Get messages by project ID with pagination.
 * Returns messages sorted by creation time (oldest first).
 */
export declare function getMessagesByProjectId(projectId: string, limit?: number, offset?: number): Promise<AgentStoredMessage[]>;
/**
 * Get the total count of messages for a project.
 */
export declare function getMessagesCountByProjectId(projectId: string): Promise<number>;
/**
 * Create a new message.
 */
export declare function createMessage(input: CreateAgentStoredMessageInput): Promise<AgentStoredMessage>;
/**
 * Delete messages by project ID.
 * Optionally filter by conversation ID.
 * Returns the number of deleted messages.
 */
export declare function deleteMessagesByProjectId(projectId: string, conversationId?: string): Promise<number>;
/**
 * Get messages by session ID with optional pagination.
 * Returns messages sorted by creation time (oldest first).
 *
 * @param sessionId - The session ID to filter by
 * @param limit - Maximum number of messages to return (0 = no limit)
 * @param offset - Number of messages to skip
 */
export declare function getMessagesBySessionId(sessionId: string, limit?: number, offset?: number): Promise<AgentStoredMessage[]>;
/**
 * Get count of messages by session ID.
 */
export declare function getMessagesCountBySessionId(sessionId: string): Promise<number>;
/**
 * Delete all messages for a session.
 * Returns the number of deleted messages.
 */
export declare function deleteMessagesBySessionId(sessionId: string): Promise<number>;
/**
 * Get messages by request ID.
 */
export declare function getMessagesByRequestId(requestId: string): Promise<AgentStoredMessage[]>;
