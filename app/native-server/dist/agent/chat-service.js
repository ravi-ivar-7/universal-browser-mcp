"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentChatService = void 0;
const node_crypto_1 = require("node:crypto");
const project_service_1 = require("./project-service");
const message_service_1 = require("./message-service");
const session_service_1 = require("./session-service");
const attachment_service_1 = require("./attachment-service");
/**
 * AgentChatService coordinates incoming /agent/chat requests and delegates to engines.
 *
 * This service is responsible for session-level scheduling and is agnostic to specific CLI/SDK implementation details.
 * It implements dependency inversion via the Engine interface, so that replacing or adding engines does not require modifying the HTTP routing layer.
 */
class AgentChatService {
    constructor(options) {
        this.engines = new Map();
        /**
         * Registry of currently running executions, keyed by requestId.
         */
        this.runningExecutions = new Map();
        this.nativeHost = null;
        this.streamManager = options.streamManager;
        for (const engine of options.engines) {
            this.engines.set(engine.name, engine);
        }
        if (options.defaultEngineName && this.engines.has(options.defaultEngineName)) {
            this.defaultEngineName = options.defaultEngineName;
        }
        else {
            // Fallback to first registered engine to avoid hard-coding 'claude' here.
            const firstEngine = options.engines[0];
            if (!firstEngine) {
                throw new Error('AgentChatService requires at least one engine');
            }
            this.defaultEngineName = firstEngine.name;
        }
    }
    setNativeHost(host) {
        this.nativeHost = host;
    }
    async handleAct(sessionId, payload) {
        var _a, _b, _c;
        const trimmed = (_a = payload.instruction) === null || _a === void 0 ? void 0 : _a.trim();
        if (!trimmed) {
            throw new Error('instruction is required');
        }
        const requestId = payload.requestId || (0, node_crypto_1.randomUUID)();
        let projectId = payload.projectId;
        // Normalize empty string to undefined
        const rawDbSessionId = typeof payload.dbSessionId === 'string' ? payload.dbSessionId.trim() : '';
        const dbSessionId = rawDbSessionId || undefined;
        // Load session from database if dbSessionId is provided
        let dbSession;
        if (dbSessionId) {
            dbSession = await (0, session_service_1.getSession)(dbSessionId);
            if (!dbSession) {
                throw new Error(`Session not found for id: ${dbSessionId}`);
            }
            // Validate project association
            if (projectId && dbSession.projectId !== projectId) {
                throw new Error(`Session ${dbSessionId} does not belong to project: ${projectId}`);
            }
            // Use session's project if not explicitly provided
            if (!projectId) {
                projectId = dbSession.projectId;
            }
        }
        // Project is required - workspace path must come from project system
        if (!projectId) {
            throw new Error('projectId is required. Please select or create a project first.');
        }
        const project = await (0, project_service_1.getProject)(projectId);
        if (!project) {
            throw new Error(`Project not found for id: ${projectId}`);
        }
        const projectRoot = project.rootPath;
        const projectPreferredCli = project.preferredCli;
        const projectSelectedModel = project.selectedModel;
        const projectUseCcr = project.useCcr;
        // Legacy fallback: if caller does not use sessions table, use project-level resume id
        let resumeClaudeSessionId;
        if (!dbSessionId) {
            resumeClaudeSessionId = project.activeClaudeSessionId;
        }
        // Resolve engine name - session binding takes precedence
        let engineName;
        if (dbSession) {
            engineName = dbSession.engineName;
            // Validate cliPreference matches session engine
            if (payload.cliPreference && payload.cliPreference !== engineName) {
                throw new Error(`cliPreference (${payload.cliPreference}) does not match session.engineName (${engineName})`);
            }
        }
        else {
            engineName = this.resolveEngineName(payload.cliPreference, projectPreferredCli);
        }
        const engine = this.engines.get(engineName);
        if (!engine) {
            throw new Error(`No agent engine registered for ${engineName}`);
        }
        // Model priority: request > session > project
        const effectiveModel = ((_b = payload.model) === null || _b === void 0 ? void 0 : _b.trim()) || (dbSession === null || dbSession === void 0 ? void 0 : dbSession.model) || projectSelectedModel;
        // For Claude engine with session, use session's engineSessionId for resume
        if (dbSession && engineName === 'claude') {
            resumeClaudeSessionId = dbSession.engineSessionId;
        }
        const now = new Date().toISOString();
        const userMessageId = (0, node_crypto_1.randomUUID)();
        // Process and persist image attachments
        const savedAttachments = [];
        let attachmentMetadata;
        let resolvedImagePaths;
        if (projectId && payload.attachments && payload.attachments.length > 0) {
            const imageAttachments = payload.attachments.filter((a) => a.type === 'image');
            if (imageAttachments.length > 0) {
                try {
                    console.error(`[AgentChatService] Saving ${imageAttachments.length} image attachment(s) for project ${projectId}`);
                    for (let i = 0; i < imageAttachments.length; i++) {
                        const attachment = imageAttachments[i];
                        const saved = await attachment_service_1.attachmentService.saveAttachment({
                            projectId,
                            messageId: userMessageId,
                            attachment,
                            index: i,
                        });
                        savedAttachments.push(saved);
                    }
                    // Build metadata array for message persistence
                    attachmentMetadata = savedAttachments.map((s) => s.metadata);
                    // Build paths array for engine consumption
                    resolvedImagePaths = savedAttachments.map((s) => s.absolutePath);
                    console.error(`[AgentChatService] Saved ${savedAttachments.length} attachment(s): ${resolvedImagePaths.join(', ')}`);
                }
                catch (error) {
                    console.error('[AgentChatService] Failed to save attachments:', error);
                    // Continue without attachments - don't fail the entire request
                }
            }
        }
        // Build metadata object for user message
        // Include attachments, clientMeta, and displayText if present
        let userMessageMetadata;
        const hasAttachments = attachmentMetadata && attachmentMetadata.length > 0;
        const hasClientMeta = payload.clientMeta !== undefined;
        const hasDisplayText = payload.displayText !== undefined;
        if (hasAttachments || hasClientMeta || hasDisplayText) {
            userMessageMetadata = {};
            if (hasAttachments) {
                userMessageMetadata.attachments = attachmentMetadata;
            }
            if (hasClientMeta) {
                userMessageMetadata.clientMeta = payload.clientMeta;
            }
            if (hasDisplayText) {
                userMessageMetadata.displayText = payload.displayText;
            }
        }
        // Emit a canonical user message into the stream so UI can render from server events only.
        const userMessage = {
            id: userMessageId,
            sessionId,
            role: 'user',
            content: trimmed,
            messageType: 'chat',
            cliSource: engineName,
            requestId,
            isStreaming: false,
            isFinal: true,
            createdAt: now,
            metadata: userMessageMetadata,
        };
        this.streamManager.publish({ type: 'message', data: userMessage });
        if (projectId) {
            // Persist user message into project history for later reload.
            try {
                await (0, project_service_1.touchProjectActivity)(projectId);
                // Update session activity timestamp so it appears at top of session list
                if (dbSessionId) {
                    await (0, session_service_1.touchSessionActivity)(dbSessionId);
                }
                await (0, message_service_1.createMessage)({
                    projectId,
                    role: 'user',
                    messageType: 'chat',
                    content: trimmed,
                    sessionId,
                    cliSource: engineName,
                    requestId,
                    id: userMessage.id,
                    createdAt: userMessage.createdAt,
                    metadata: userMessageMetadata,
                });
            }
            catch (error) {
                console.error('[AgentChatService] Failed to persist user message:', error);
            }
        }
        this.streamManager.publish({
            type: 'status',
            data: {
                sessionId,
                status: 'starting',
                requestId,
                message: 'Agent request accepted',
            },
        });
        const ctx = {
            emit: (event) => {
                var _a;
                this.streamManager.publish(event);
                if (!projectId) {
                    return;
                }
                if (event.type === 'message') {
                    const msg = event.data;
                    if (!msg)
                        return;
                    // Only persist final snapshots; streaming deltas are transient.
                    if (msg.isStreaming && !msg.isFinal) {
                        return;
                    }
                    // User messages are already handled above.
                    if (msg.role === 'user') {
                        return;
                    }
                    const content = (_a = msg.content) === null || _a === void 0 ? void 0 : _a.trim();
                    if (!content) {
                        return;
                    }
                    void (0, message_service_1.createMessage)({
                        projectId,
                        role: msg.role,
                        messageType: msg.messageType,
                        content,
                        metadata: msg.metadata,
                        sessionId: msg.sessionId,
                        conversationId: undefined,
                        cliSource: msg.cliSource,
                        requestId: msg.requestId,
                        id: msg.id,
                        createdAt: msg.createdAt,
                    }).catch((error) => {
                        console.error('[AgentChatService] Failed to persist agent message:', error);
                    });
                }
            },
            // Callback to persist Claude session ID when SDK returns system/init message
            // Prefer session-level persistence over project-level
            persistClaudeSessionId: dbSessionId
                ? async (claudeSessionId) => {
                    await (0, session_service_1.updateEngineSessionId)(dbSessionId, claudeSessionId);
                }
                : projectId
                    ? async (claudeSessionId) => {
                        await (0, project_service_1.updateProjectClaudeSessionId)(projectId, claudeSessionId);
                    }
                    : undefined,
            // Callback to persist management info from system:init message
            // Only available when using session-level persistence
            persistManagementInfo: dbSessionId
                ? async (info) => {
                    await (0, session_service_1.updateManagementInfo)(dbSessionId, info);
                }
                : undefined,
        };
        const engineOptions = {
            sessionId,
            instruction: trimmed,
            model: effectiveModel,
            projectRoot,
            requestId,
            // Pass original attachments (for fallback) and resolved paths (preferred)
            attachments: payload.attachments,
            resolvedImagePaths,
            projectId,
            dbSessionId,
            // Session-level configuration for ClaudeEngine
            permissionMode: dbSession === null || dbSession === void 0 ? void 0 : dbSession.permissionMode,
            allowDangerouslySkipPermissions: dbSession === null || dbSession === void 0 ? void 0 : dbSession.allowDangerouslySkipPermissions,
            systemPromptConfig: dbSession === null || dbSession === void 0 ? void 0 : dbSession.systemPromptConfig,
            optionsConfig: dbSession === null || dbSession === void 0 ? void 0 : dbSession.optionsConfig,
            // Pass Claude session ID for session resumption (ClaudeEngine only)
            resumeClaudeSessionId: engineName === 'claude' ? resumeClaudeSessionId : undefined,
            // Pass useCcr flag for Claude Code Router support (ClaudeEngine only)
            useCcr: engineName === 'claude' ? projectUseCcr : undefined,
            // Pass Codex-specific configuration (CodexEngine only)
            codexConfig: engineName === 'codex' ? (_c = dbSession === null || dbSession === void 0 ? void 0 : dbSession.optionsConfig) === null || _c === void 0 ? void 0 : _c.codexConfig : undefined,
            // Inject native host for browser control
            nativeMessagingHost: this.nativeHost,
        };
        // Create abort controller for cancellation support
        const abortController = new AbortController();
        // Register execution in the running executions registry
        this.runningExecutions.set(requestId, {
            requestId,
            sessionId,
            engineName,
            abortController,
            startedAt: new Date(),
        });
        // Fire-and-forget execution to keep HTTP handler fast.
        void this.runEngine(engine, engineOptions, ctx, sessionId, requestId, abortController);
        return { requestId };
    }
    /**
     * Cancel a running execution by requestId.
     * Returns true if the execution was found and cancelled, false otherwise.
     */
    cancelExecution(requestId) {
        const execution = this.runningExecutions.get(requestId);
        if (!execution) {
            return false;
        }
        // Abort the execution
        execution.abortController.abort();
        // Emit cancelled status
        this.streamManager.publish({
            type: 'status',
            data: {
                sessionId: execution.sessionId,
                status: 'cancelled',
                requestId,
                message: 'Execution cancelled by user',
            },
        });
        // Remove from registry
        this.runningExecutions.delete(requestId);
        return true;
    }
    /**
     * Cancel all running executions for a session.
     * Returns the number of executions cancelled.
     */
    cancelSessionExecutions(sessionId) {
        let cancelled = 0;
        for (const [requestId, execution] of this.runningExecutions) {
            if (execution.sessionId === sessionId) {
                execution.abortController.abort();
                this.runningExecutions.delete(requestId);
                cancelled++;
            }
        }
        if (cancelled > 0) {
            this.streamManager.publish({
                type: 'status',
                data: {
                    sessionId,
                    status: 'cancelled',
                    message: `Cancelled ${cancelled} running execution(s)`,
                },
            });
        }
        return cancelled;
    }
    /**
     * Get list of running executions for diagnostics.
     */
    getRunningExecutions() {
        return Array.from(this.runningExecutions.values());
    }
    resolveEngineName(preference, projectPreferredCli) {
        if (preference && this.engines.has(preference)) {
            return preference;
        }
        if (projectPreferredCli && this.engines.has(projectPreferredCli)) {
            return projectPreferredCli;
        }
        return this.defaultEngineName;
    }
    async runEngine(engine, options, ctx, sessionId, requestId, abortController) {
        try {
            // Check if already aborted before starting
            if (abortController.signal.aborted) {
                return;
            }
            this.streamManager.publish({
                type: 'status',
                data: {
                    sessionId,
                    status: 'running',
                    requestId,
                },
            });
            // Pass abort signal to engine
            const optionsWithSignal = {
                ...options,
                signal: abortController.signal,
            };
            await engine.initializeAndRun(optionsWithSignal, ctx);
            // Only emit completed if not aborted
            if (!abortController.signal.aborted) {
                this.streamManager.publish({
                    type: 'status',
                    data: {
                        sessionId,
                        status: 'completed',
                        requestId,
                    },
                });
            }
        }
        catch (error) {
            // Check if this was an abort error
            if (abortController.signal.aborted) {
                // Already handled by cancelExecution, just return
                return;
            }
            const message = error instanceof Error ? error.message : String(error);
            this.streamManager.publish({
                type: 'error',
                error: message,
                data: { sessionId, requestId },
            });
            this.streamManager.publish({
                type: 'status',
                data: {
                    sessionId,
                    status: 'error',
                    message,
                    requestId,
                },
            });
        }
        finally {
            // Always remove from running executions when done
            this.runningExecutions.delete(requestId);
        }
    }
    /**
     * Expose registered engines for UI and diagnostics.
     */
    getEngineInfos() {
        const result = [];
        for (const engine of this.engines.values()) {
            result.push({
                name: engine.name,
                supportsMcp: engine.supportsMcp,
            });
        }
        return result;
    }
}
exports.AgentChatService = AgentChatService;
//# sourceMappingURL=chat-service.js.map