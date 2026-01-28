"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentStreamManager = void 0;
const WEBSOCKET_OPEN_STATE = 1;
/**
 * AgentStreamManager manages SSE/WebSocket connections keyed by sessionId.
 *
 * This implementation references StreamManager in other/cweb, but adapted for Fastify/Node HTTP,
 * using ServerResponse to write SSE data directly, avoiding the need for extra Web Streams dependencies in the Node environment.
 */
class AgentStreamManager {
    constructor() {
        this.sseClients = new Map();
        this.webSocketClients = new Map();
        this.heartbeatTimer = null;
    }
    addSseStream(sessionId, res) {
        if (!this.sseClients.has(sessionId)) {
            this.sseClients.set(sessionId, new Set());
        }
        this.sseClients.get(sessionId).add(res);
        this.ensureHeartbeatTimer();
    }
    removeSseStream(sessionId, res) {
        const clients = this.sseClients.get(sessionId);
        if (!clients) {
            return;
        }
        clients.delete(res);
        if (clients.size === 0) {
            this.sseClients.delete(sessionId);
        }
        this.stopHeartbeatTimerIfIdle();
    }
    addWebSocket(sessionId, socket) {
        if (!this.webSocketClients.has(sessionId)) {
            this.webSocketClients.set(sessionId, new Set());
        }
        this.webSocketClients.get(sessionId).add(socket);
        this.ensureHeartbeatTimer();
    }
    removeWebSocket(sessionId, socket) {
        const sockets = this.webSocketClients.get(sessionId);
        if (!sockets) {
            return;
        }
        sockets.delete(socket);
        if (sockets.size === 0) {
            this.webSocketClients.delete(sessionId);
        }
        this.stopHeartbeatTimerIfIdle();
    }
    publish(event) {
        const payload = JSON.stringify(event);
        const ssePayload = `data: ${payload}\n\n`;
        // Heartbeat events are broadcast to all connections to keep them alive.
        if (event.type === 'heartbeat') {
            this.broadcastToAll(ssePayload, payload);
            return;
        }
        // For all other event types, require a sessionId for routing.
        const targetSessionId = this.extractSessionId(event);
        if (!targetSessionId) {
            // Drop events without sessionId to prevent cross-session leakage.
            console.warn('[AgentStreamManager] Dropping event without sessionId:', event.type);
            return;
        }
        // Session-scoped routing: only send to clients subscribed to this session.
        this.sendToSession(targetSessionId, ssePayload, payload);
    }
    /**
     * Extract sessionId from event based on event type.
     */
    extractSessionId(event) {
        var _a, _b, _c, _d, _e;
        switch (event.type) {
            case 'message':
                return (_a = event.data) === null || _a === void 0 ? void 0 : _a.sessionId;
            case 'status':
                return (_b = event.data) === null || _b === void 0 ? void 0 : _b.sessionId;
            case 'connected':
                return (_c = event.data) === null || _c === void 0 ? void 0 : _c.sessionId;
            case 'error':
                return (_d = event.data) === null || _d === void 0 ? void 0 : _d.sessionId;
            case 'usage':
                return (_e = event.data) === null || _e === void 0 ? void 0 : _e.sessionId;
            case 'heartbeat':
                return undefined;
            default:
                return undefined;
        }
    }
    /**
     * Send event to a specific session's clients only.
     */
    sendToSession(sessionId, ssePayload, wsPayload) {
        // SSE clients
        const sseClients = this.sseClients.get(sessionId);
        if (sseClients) {
            const deadClients = [];
            for (const res of sseClients) {
                if (this.isResponseDead(res)) {
                    deadClients.push(res);
                    continue;
                }
                try {
                    res.write(ssePayload);
                }
                catch (_a) {
                    deadClients.push(res);
                }
            }
            for (const res of deadClients) {
                this.removeSseStream(sessionId, res);
            }
        }
        // WebSocket clients
        const wsSockets = this.webSocketClients.get(sessionId);
        if (wsSockets) {
            const deadSockets = [];
            for (const socket of wsSockets) {
                if (this.isSocketDead(socket)) {
                    deadSockets.push(socket);
                    continue;
                }
                try {
                    socket.send(wsPayload);
                }
                catch (_b) {
                    deadSockets.push(socket);
                }
            }
            for (const socket of deadSockets) {
                this.removeWebSocket(sessionId, socket);
            }
        }
    }
    /**
     * Broadcast event to all connected clients (used for heartbeat).
     */
    broadcastToAll(ssePayload, wsPayload) {
        const deadSse = [];
        for (const [sessionId, clients] of this.sseClients.entries()) {
            for (const res of clients) {
                if (this.isResponseDead(res)) {
                    deadSse.push({ sessionId, res });
                    continue;
                }
                try {
                    res.write(ssePayload);
                }
                catch (_a) {
                    deadSse.push({ sessionId, res });
                }
            }
        }
        for (const { sessionId, res } of deadSse) {
            this.removeSseStream(sessionId, res);
        }
        const deadSockets = [];
        for (const [sessionId, sockets] of this.webSocketClients.entries()) {
            for (const socket of sockets) {
                if (this.isSocketDead(socket)) {
                    deadSockets.push({ sessionId, socket });
                    continue;
                }
                try {
                    socket.send(wsPayload);
                }
                catch (_b) {
                    deadSockets.push({ sessionId, socket });
                }
            }
        }
        for (const { sessionId, socket } of deadSockets) {
            this.removeWebSocket(sessionId, socket);
        }
    }
    isResponseDead(res) {
        return res.writableEnded || res.destroyed;
    }
    isSocketDead(socket) {
        return socket.readyState !== undefined && socket.readyState !== WEBSOCKET_OPEN_STATE;
    }
    closeAll() {
        var _a;
        for (const [sessionId, clients] of this.sseClients.entries()) {
            for (const res of clients) {
                try {
                    res.end();
                }
                catch (_b) {
                    // Ignore errors during shutdown.
                }
            }
            this.sseClients.delete(sessionId);
        }
        for (const [sessionId, sockets] of this.webSocketClients.entries()) {
            for (const socket of sockets) {
                try {
                    (_a = socket.close) === null || _a === void 0 ? void 0 : _a.call(socket);
                }
                catch (_c) {
                    // Ignore errors during shutdown.
                }
            }
            this.webSocketClients.delete(sessionId);
        }
        this.stopHeartbeatTimer();
    }
    ensureHeartbeatTimer() {
        var _a, _b;
        if (this.heartbeatTimer) {
            return;
        }
        this.heartbeatTimer = setInterval(() => {
            if (this.sseClients.size === 0 && this.webSocketClients.size === 0) {
                this.stopHeartbeatTimer();
                return;
            }
            const event = {
                type: 'heartbeat',
                data: { timestamp: new Date().toISOString() },
            };
            this.publish(event);
        }, 30000);
        // Allow Node process to exit naturally even if heartbeat is active.
        (_b = (_a = this.heartbeatTimer).unref) === null || _b === void 0 ? void 0 : _b.call(_a);
    }
    stopHeartbeatTimerIfIdle() {
        if (this.sseClients.size === 0 && this.webSocketClients.size === 0) {
            this.stopHeartbeatTimer();
        }
    }
    stopHeartbeatTimer() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
}
exports.AgentStreamManager = AgentStreamManager;
//# sourceMappingURL=stream-manager.js.map