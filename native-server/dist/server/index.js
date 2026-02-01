"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Server = void 0;
/**
 * HTTP Server - Core server implementation.
 *
 * Responsibilities:
 * - Fastify instance management
 * - Plugin registration (CORS, etc.)
 * - Route delegation to specialized modules
 * - MCP transport handling
 * - Server lifecycle management
 */
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const constant_1 = require("../constant");
const sse_js_1 = require("@modelcontextprotocol/sdk/server/sse.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const node_crypto_1 = require("node:crypto");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const mcp_server_1 = require("../mcp/mcp-server");
const stream_manager_1 = require("../agent/stream-manager");
const chat_service_1 = require("../agent/chat-service");
const codex_1 = require("../agent/engines/codex");
const claude_1 = require("../agent/engines/claude");
const gemini_1 = require("../agent/engines/gemini");
const groq_1 = require("../agent/engines/groq");
const db_1 = require("../agent/db");
const routes_1 = require("./routes");
// ============================================================
// Server Class
// ============================================================
class Server {
    constructor() {
        this.isRunning = false;
        this.nativeHost = null;
        this.transportsMap = new Map();
        this.fastify = (0, fastify_1.default)({ logger: constant_1.SERVER_CONFIG.LOGGER_ENABLED });
        this.agentStreamManager = new stream_manager_1.AgentStreamManager();
        this.agentChatService = new chat_service_1.AgentChatService({
            engines: [new codex_1.CodexEngine(), new claude_1.ClaudeEngine(), new gemini_1.GeminiEngine(), new groq_1.GroqEngine()],
            streamManager: this.agentStreamManager,
        });
        this.setupPlugins();
        this.setupRoutes();
    }
    /**
     * Associate NativeMessagingHost instance.
     */
    setNativeHost(nativeHost) {
        this.nativeHost = nativeHost;
    }
    async setupPlugins() {
        await this.fastify.register(cors_1.default, {
            origin: (origin, cb) => {
                // Allow requests with no origin (e.g., curl, server-to-server)
                if (!origin) {
                    return cb(null, true);
                }
                // Check if origin matches any pattern in whitelist
                const allowed = constant_1.SERVER_CONFIG.CORS_ORIGIN.some((pattern) => pattern instanceof RegExp ? pattern.test(origin) : origin.startsWith(pattern));
                cb(null, allowed);
            },
            methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
            credentials: true,
        });
    }
    setupRoutes() {
        // Health check
        this.setupHealthRoutes();
        // Extension communication
        this.setupExtensionRoutes();
        // Agent routes (delegated to separate module)
        (0, routes_1.registerAgentRoutes)(this.fastify, {
            streamManager: this.agentStreamManager,
            chatService: this.agentChatService,
        });
        // MCP routes
        this.setupMcpRoutes();
    }
    // ============================================================
    // Health Routes
    // ============================================================
    setupHealthRoutes() {
        this.fastify.get('/ping', async (_request, reply) => {
            reply.status(constant_1.HTTP_STATUS.OK).send({
                status: 'ok',
                message: 'pong',
            });
        });
    }
    // ============================================================
    // Extension Routes
    // ============================================================
    setupExtensionRoutes() {
        this.fastify.get('/ask-extension', async (request, reply) => {
            if (!this.nativeHost) {
                return reply
                    .status(constant_1.HTTP_STATUS.INTERNAL_SERVER_ERROR)
                    .send({ error: constant_1.ERROR_MESSAGES.NATIVE_HOST_NOT_AVAILABLE });
            }
            if (!this.isRunning) {
                return reply
                    .status(constant_1.HTTP_STATUS.INTERNAL_SERVER_ERROR)
                    .send({ error: constant_1.ERROR_MESSAGES.SERVER_NOT_RUNNING });
            }
            try {
                const extensionResponse = await this.nativeHost.sendRequestToExtensionAndWait(request.query, 'process_data', constant_1.TIMEOUTS.EXTENSION_REQUEST_TIMEOUT);
                return reply.status(constant_1.HTTP_STATUS.OK).send({ status: 'success', data: extensionResponse });
            }
            catch (error) {
                const err = error;
                if (err.message.includes('timed out')) {
                    return reply
                        .status(constant_1.HTTP_STATUS.GATEWAY_TIMEOUT)
                        .send({ status: 'error', message: constant_1.ERROR_MESSAGES.REQUEST_TIMEOUT });
                }
                else {
                    return reply.status(constant_1.HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
                        status: 'error',
                        message: `Failed to get response from extension: ${err.message}`,
                    });
                }
            }
        });
    }
    // ============================================================
    // MCP Routes
    // ============================================================
    setupMcpRoutes() {
        // SSE endpoint
        this.fastify.get('/sse', async (_, reply) => {
            try {
                reply.raw.writeHead(constant_1.HTTP_STATUS.OK, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    Connection: 'keep-alive',
                });
                const transport = new sse_js_1.SSEServerTransport('/messages', reply.raw);
                this.transportsMap.set(transport.sessionId, transport);
                reply.raw.on('close', () => {
                    this.transportsMap.delete(transport.sessionId);
                });
                const server = (0, mcp_server_1.getMcpServer)();
                await server.connect(transport);
                reply.raw.write(':\n\n');
            }
            catch (error) {
                if (!reply.sent) {
                    reply.code(constant_1.HTTP_STATUS.INTERNAL_SERVER_ERROR).send(constant_1.ERROR_MESSAGES.INTERNAL_SERVER_ERROR);
                }
            }
        });
        // SSE messages endpoint
        this.fastify.post('/messages', async (req, reply) => {
            try {
                const { sessionId } = req.query;
                const transport = this.transportsMap.get(sessionId || '');
                if (!sessionId || !transport) {
                    reply.code(constant_1.HTTP_STATUS.BAD_REQUEST).send('No transport found for sessionId');
                    return;
                }
                await transport.handlePostMessage(req.raw, reply.raw, req.body);
            }
            catch (error) {
                if (!reply.sent) {
                    reply.code(constant_1.HTTP_STATUS.INTERNAL_SERVER_ERROR).send(constant_1.ERROR_MESSAGES.INTERNAL_SERVER_ERROR);
                }
            }
        });
        // MCP POST endpoint
        this.fastify.post('/mcp', async (request, reply) => {
            const sessionId = request.headers['mcp-session-id'];
            let transport = this.transportsMap.get(sessionId || '');
            if (transport) {
                // Transport found, proceed
            }
            else if (!sessionId && (0, types_js_1.isInitializeRequest)(request.body)) {
                const newSessionId = (0, node_crypto_1.randomUUID)();
                transport = new streamableHttp_js_1.StreamableHTTPServerTransport({
                    sessionIdGenerator: () => newSessionId,
                    onsessioninitialized: (initializedSessionId) => {
                        if (transport && initializedSessionId === newSessionId) {
                            this.transportsMap.set(initializedSessionId, transport);
                        }
                    },
                });
                transport.onclose = () => {
                    if ((transport === null || transport === void 0 ? void 0 : transport.sessionId) && this.transportsMap.get(transport.sessionId)) {
                        this.transportsMap.delete(transport.sessionId);
                    }
                };
                await (0, mcp_server_1.getMcpServer)().connect(transport);
            }
            else {
                reply.code(constant_1.HTTP_STATUS.BAD_REQUEST).send({ error: constant_1.ERROR_MESSAGES.INVALID_MCP_REQUEST });
                return;
            }
            try {
                await transport.handleRequest(request.raw, reply.raw, request.body);
            }
            catch (error) {
                if (!reply.sent) {
                    reply
                        .code(constant_1.HTTP_STATUS.INTERNAL_SERVER_ERROR)
                        .send({ error: constant_1.ERROR_MESSAGES.MCP_REQUEST_PROCESSING_ERROR });
                }
            }
        });
        // MCP GET endpoint (SSE stream)
        this.fastify.get('/mcp', async (request, reply) => {
            const sessionId = request.headers['mcp-session-id'];
            const transport = sessionId
                ? this.transportsMap.get(sessionId)
                : undefined;
            if (!transport) {
                reply.code(constant_1.HTTP_STATUS.BAD_REQUEST).send({ error: constant_1.ERROR_MESSAGES.INVALID_SSE_SESSION });
                return;
            }
            reply.raw.setHeader('Content-Type', 'text/event-stream');
            reply.raw.setHeader('Cache-Control', 'no-cache');
            reply.raw.setHeader('Connection', 'keep-alive');
            reply.raw.flushHeaders();
            try {
                await transport.handleRequest(request.raw, reply.raw);
                if (!reply.sent) {
                    reply.hijack();
                }
            }
            catch (error) {
                if (!reply.raw.writableEnded) {
                    reply.raw.end();
                }
            }
            request.socket.on('close', () => {
                request.log.info(`SSE client disconnected for session: ${sessionId}`);
            });
        });
        // MCP DELETE endpoint
        this.fastify.delete('/mcp', async (request, reply) => {
            const sessionId = request.headers['mcp-session-id'];
            const transport = sessionId
                ? this.transportsMap.get(sessionId)
                : undefined;
            if (!transport) {
                reply.code(constant_1.HTTP_STATUS.BAD_REQUEST).send({ error: constant_1.ERROR_MESSAGES.INVALID_SESSION_ID });
                return;
            }
            try {
                await transport.handleRequest(request.raw, reply.raw);
                if (!reply.sent) {
                    reply.code(constant_1.HTTP_STATUS.NO_CONTENT).send();
                }
            }
            catch (error) {
                if (!reply.sent) {
                    reply
                        .code(constant_1.HTTP_STATUS.INTERNAL_SERVER_ERROR)
                        .send({ error: constant_1.ERROR_MESSAGES.MCP_SESSION_DELETION_ERROR });
                }
            }
        });
    }
    // ============================================================
    // Server Lifecycle
    // ============================================================
    async start(port = constant_1.NATIVE_SERVER_PORT, nativeHost) {
        if (!this.nativeHost) {
            this.nativeHost = nativeHost;
        }
        else if (this.nativeHost !== nativeHost) {
            this.nativeHost = nativeHost;
        }
        // Inject native host into agent chat service to avoid circular dependencies
        this.agentChatService.setNativeHost(nativeHost);
        if (this.isRunning) {
            return;
        }
        try {
            await this.fastify.listen({ port, host: constant_1.SERVER_CONFIG.HOST });
            // Set port environment variables after successful listen for Chrome MCP URL resolution
            process.env.CHROME_MCP_PORT = String(port);
            process.env.MCP_HTTP_PORT = String(port);
            this.isRunning = true;
        }
        catch (err) {
            this.isRunning = false;
            throw err;
        }
    }
    async stop() {
        if (!this.isRunning) {
            return;
        }
        try {
            await this.fastify.close();
            (0, db_1.closeDb)();
            this.isRunning = false;
        }
        catch (err) {
            this.isRunning = false;
            (0, db_1.closeDb)();
            throw err;
        }
    }
    getInstance() {
        return this.fastify;
    }
}
exports.Server = Server;
const serverInstance = new Server();
exports.default = serverInstance;
//# sourceMappingURL=index.js.map