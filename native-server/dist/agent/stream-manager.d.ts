import type { ServerResponse } from 'node:http';
import type { RealtimeEvent } from './types';
type WebSocketLike = {
    readyState?: number;
    send(data: string): void;
    close?: () => void;
};
/**
 * AgentStreamManager manages SSE/WebSocket connections keyed by sessionId.
 *
 * This implementation references StreamManager in other/cweb, but adapted for Fastify/Node HTTP,
 * using ServerResponse to write SSE data directly, avoiding the need for extra Web Streams dependencies in the Node environment.
 */
export declare class AgentStreamManager {
    private readonly sseClients;
    private readonly webSocketClients;
    private heartbeatTimer;
    addSseStream(sessionId: string, res: ServerResponse): void;
    removeSseStream(sessionId: string, res: ServerResponse): void;
    addWebSocket(sessionId: string, socket: WebSocketLike): void;
    removeWebSocket(sessionId: string, socket: WebSocketLike): void;
    publish(event: RealtimeEvent): void;
    /**
     * Extract sessionId from event based on event type.
     */
    private extractSessionId;
    /**
     * Send event to a specific session's clients only.
     */
    private sendToSession;
    /**
     * Broadcast event to all connected clients (used for heartbeat).
     */
    private broadcastToAll;
    private isResponseDead;
    private isSocketDead;
    closeAll(): void;
    private ensureHeartbeatTimer;
    private stopHeartbeatTimerIfIdle;
    private stopHeartbeatTimer;
}
export {};
