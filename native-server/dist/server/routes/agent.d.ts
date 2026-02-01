/**
 * Agent Routes - All agent-related HTTP endpoints.
 *
 * Handles:
 * - Projects CRUD
 * - Chat messages CRUD
 * - Chat streaming (SSE)
 * - Chat actions (act, cancel)
 * - Engine listing
 */
import type { FastifyInstance } from 'fastify';
import { AgentStreamManager } from '../../agent/stream-manager';
import { AgentChatService } from '../../agent/chat-service';
export interface AgentRoutesOptions {
    streamManager: AgentStreamManager;
    chatService: AgentChatService;
}
/**
 * Register all agent-related routes on the Fastify instance.
 */
export declare function registerAgentRoutes(fastify: FastifyInstance, options: AgentRoutesOptions): void;
