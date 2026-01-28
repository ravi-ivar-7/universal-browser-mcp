"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodexEngine = void 0;
const node_child_process_1 = require("node:child_process");
const node_readline_1 = __importDefault(require("node:readline"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const chrome_mcp_shared_1 = require("chrome-mcp-shared");
const tool_bridge_1 = require("../tool-bridge");
const project_service_1 = require("../project-service");
const constant_1 = require("../../constant");
/**
 * CodexEngine integrates the Codex CLI as an AgentEngine implementation.
 *
 * The implementation is intentionally self-contained and does not persist messages;
 * it focuses on streaming Codex JSON events into RealtimeEvent envelopes that the
 * sidepanel UI can consume.
 *
 * This engine is based on the event protocol from the Codex adapter in other/cweb,
 * handling events such as item.started/item.delta/item.completed/item.failed/error entirely,
 * and pushing encoded RealtimeEvents to the sidepanel via AgentStreamManager,
 * ensuring the data loop "Sidepanel -> Native Server -> Codex CLI -> Sidepanel" is closed.
 */
class CodexEngine {
    constructor(toolBridge) {
        this.name = 'codex';
        this.supportsMcp = false;
        this.toolBridge = toolBridge !== null && toolBridge !== void 0 ? toolBridge : new tool_bridge_1.AgentToolBridge();
    }
    async initializeAndRun(options, ctx) {
        var _a;
        const { sessionId, instruction, model, projectRoot, projectId, requestId, signal, attachments, resolvedImagePaths, codexConfig, } = options;
        const repoPath = this.resolveRepoPath(projectRoot);
        // Check if already aborted
        if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
            throw new Error('CodexEngine: execution was cancelled');
        }
        const normalizedInstruction = instruction.trim();
        if (!normalizedInstruction) {
            throw new Error('CodexEngine: instruction must not be empty');
        }
        // Merge user config with defaults
        const resolvedConfig = {
            ...chrome_mcp_shared_1.DEFAULT_CODEX_CONFIG,
            ...(codexConfig !== null && codexConfig !== void 0 ? codexConfig : {}),
        };
        // Ensure autoInstructions has a value
        if (!((_a = resolvedConfig.autoInstructions) === null || _a === void 0 ? void 0 : _a.trim())) {
            resolvedConfig.autoInstructions = chrome_mcp_shared_1.CODEX_AUTO_INSTRUCTIONS;
        }
        // Resolve project-scoped Chrome MCP toggle (default: enabled)
        const enableChromeMcp = await (async () => {
            if (!projectId)
                return true;
            try {
                const project = await (0, project_service_1.getProject)(projectId);
                return (project === null || project === void 0 ? void 0 : project.enableChromeMcp) !== false;
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                console.error(`[CodexEngine] Failed to load project enableChromeMcp, defaulting to enabled: ${message}`);
                return true;
            }
        })();
        // Optionally append project context to the prompt
        const prompt = resolvedConfig.appendProjectContext
            ? await this.appendProjectContext(normalizedInstruction, repoPath)
            : normalizedInstruction;
        const executable = process.platform === 'win32' ? 'codex.cmd' : 'codex';
        const args = [
            'exec',
            '--json',
            '--skip-git-repo-check',
            '--dangerously-bypass-approvals-and-sandbox',
            '--color',
            'never',
            '--cd',
            repoPath,
        ];
        // Add Codex configuration arguments
        args.push(...this.buildCodexConfigArgs(resolvedConfig));
        // Inject local Chrome MCP server via runtime config override (no global codex config mutation)
        // Use a unique server name to avoid collision with any existing global config
        if (enableChromeMcp) {
            const chromeMcpUrl = (0, constant_1.getChromeMcpUrl)();
            // Set both url and type for complete HTTP MCP server configuration
            args.push('-c', `mcp_servers.chrome_mcp_http.url=${JSON.stringify(chromeMcpUrl)}`);
            args.push('-c', `mcp_servers.chrome_mcp_http.type="http"`);
            console.error(`[CodexEngine] Chrome MCP server enabled: ${chromeMcpUrl}`);
        }
        else {
            console.error('[CodexEngine] Chrome MCP server disabled');
        }
        if (model && model.trim()) {
            args.push('--model', model.trim());
        }
        // Process image attachments - prefer resolvedImagePaths (persisted), fallback to temp files
        const tempFiles = [];
        const hasResolvedPaths = resolvedImagePaths && resolvedImagePaths.length > 0;
        if (hasResolvedPaths) {
            // Use pre-resolved persistent paths (preferred - no temp files needed)
            console.error(`[CodexEngine] Using ${resolvedImagePaths.length} pre-resolved image path(s)`);
            for (const imagePath of resolvedImagePaths) {
                args.push('--image', imagePath);
            }
        }
        else if (attachments && attachments.length > 0) {
            // Fallback: write base64 to temp files (legacy behavior)
            for (const attachment of attachments) {
                if (attachment.type === 'image') {
                    try {
                        const tempFile = await this.writeAttachmentToTemp(attachment);
                        tempFiles.push(tempFile);
                        args.push('--image', tempFile);
                    }
                    catch (err) {
                        console.error('[CodexEngine] Failed to write attachment to temp file:', err);
                    }
                }
            }
        }
        args.push(prompt);
        // Use explicit Promise wrapping to ensure child process errors are properly rejected.
        return new Promise((resolve, reject) => {
            var _a, _b;
            const child = (0, node_child_process_1.spawn)(executable, args, {
                cwd: repoPath,
                env: this.buildCodexEnv(),
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            // State management
            const stderrBuffer = [];
            let hasCompleted = false;
            let timedOut = false;
            let settled = false;
            let timeoutHandle = null;
            // Readline interface - declared early to avoid TDZ issues in finish()
            let rl = null;
            // Assistant message state
            let assistantBuffer = '';
            let assistantMessageId = null;
            let assistantCreatedAt = null;
            const streamedToolHashes = new Set();
            const activeCommands = new Map();
            const thinkingSegments = [];
            /**
             * Cleanup temporary files created for image attachments.
             */
            const cleanupTempFiles = async () => {
                if (tempFiles.length === 0)
                    return;
                const fs = await import('node:fs/promises');
                for (const filePath of tempFiles) {
                    try {
                        await fs.unlink(filePath);
                        console.error(`[CodexEngine] Cleaned up temp file: ${filePath}`);
                    }
                    catch (err) {
                        // Ignore errors during cleanup - file may already be deleted
                        console.error(`[CodexEngine] Failed to cleanup temp file ${filePath}:`, err);
                    }
                }
            };
            /**
             * Cleanup and settle the promise (resolve or reject).
             * Waits for temp file cleanup to complete before settling.
             */
            const finish = async (error) => {
                if (settled)
                    return;
                settled = true;
                // Clear timeout
                if (timeoutHandle) {
                    clearTimeout(timeoutHandle);
                    timeoutHandle = null;
                }
                // Close readline interface
                if (rl) {
                    try {
                        rl.close();
                    }
                    catch (_a) {
                        // Ignore close errors during cleanup
                    }
                }
                // Kill child process if still running
                if (!child.killed) {
                    try {
                        child.kill();
                    }
                    catch (_b) {
                        // Ignore kill errors during cleanup
                    }
                }
                // Cleanup temp files after process is killed (wait for completion)
                await cleanupTempFiles();
                // Settle the promise
                if (error) {
                    reject(error instanceof Error ? error : new Error(String(error)));
                }
                else {
                    resolve();
                }
            };
            // Handle child process error immediately after spawn (e.g., command not found)
            child.on('error', (error) => {
                const message = error instanceof Error
                    ? error.message
                    : stderrBuffer.slice(-5).join('\n') || 'Codex CLI failed to start';
                void finish(new Error(`CodexEngine: ${message}`));
            });
            // Listen for abort signal to cancel execution
            const abortHandler = signal
                ? () => {
                    console.error('[CodexEngine] Execution cancelled via abort signal');
                    void finish(new Error('CodexEngine: execution was cancelled'));
                }
                : null;
            if (signal && abortHandler) {
                signal.addEventListener('abort', abortHandler, { once: true });
            }
            // Collect stderr with bounded buffer
            (_a = child.stderr) === null || _a === void 0 ? void 0 : _a.on('data', (chunk) => {
                const text = String(chunk).trim();
                if (!text)
                    return;
                stderrBuffer.push(text);
                // Keep only the most recent lines to prevent memory growth
                if (stderrBuffer.length > CodexEngine.MAX_STDERR_LINES) {
                    stderrBuffer.splice(0, stderrBuffer.length - CodexEngine.MAX_STDERR_LINES);
                }
                console.error('[CodexEngine][stderr]', text);
            });
            rl = node_readline_1.default.createInterface({ input: child.stdout });
            /**
             * Build the assistant message payload, combining thinking and agent content.
             */
            const buildAssistantPayload = () => {
                const trimmedAssistant = assistantBuffer.trim();
                const thinkingContent = thinkingSegments
                    .map((segment) => segment.trim())
                    .filter((segment) => segment.length > 0)
                    .map((segment) => `<thinking>${segment}</thinking>`)
                    .join('\n\n');
                const parts = [];
                if (thinkingContent) {
                    parts.push(thinkingContent);
                }
                if (trimmedAssistant) {
                    parts.push(trimmedAssistant);
                }
                return parts.join('\n\n').trim();
            };
            /**
             * Reset assistant buffers after emitting a final message.
             */
            const resetAssistantBuffers = () => {
                assistantBuffer = '';
                thinkingSegments.length = 0;
                assistantMessageId = null;
                assistantCreatedAt = null;
            };
            // Helper: emit assistant message
            const emitAssistant = (isFinal) => {
                const content = buildAssistantPayload();
                if (!content)
                    return;
                if (!assistantMessageId) {
                    assistantMessageId = (0, node_crypto_1.randomUUID)();
                }
                if (!assistantCreatedAt) {
                    assistantCreatedAt = new Date().toISOString();
                }
                const message = {
                    id: assistantMessageId,
                    sessionId,
                    role: 'assistant',
                    content,
                    messageType: 'chat',
                    cliSource: this.name,
                    requestId,
                    isStreaming: !isFinal,
                    isFinal,
                    createdAt: assistantCreatedAt,
                };
                ctx.emit({ type: 'message', data: message });
            };
            // Helper: emit tool message with deduplication
            const dispatchToolMessage = (content, metadata, messageType, isStreaming) => {
                const trimmed = content.trim();
                if (!trimmed)
                    return;
                const hash = this.encodeHash(`${messageType}:${trimmed}:${JSON.stringify(metadata)}:${sessionId}:${requestId || ''}`).slice(0, 16);
                if (streamedToolHashes.has(hash))
                    return;
                streamedToolHashes.add(hash);
                const message = {
                    id: (0, node_crypto_1.randomUUID)(),
                    sessionId,
                    role: 'tool',
                    content: trimmed,
                    messageType,
                    cliSource: this.name,
                    requestId,
                    isStreaming,
                    isFinal: !isStreaming,
                    createdAt: new Date().toISOString(),
                    metadata: { cli_type: 'codex', ...metadata },
                };
                ctx.emit({ type: 'message', data: message });
            };
            // Event handlers for specific item types
            const emitCommandStart = (item) => {
                var _a, _b;
                const id = (_a = this.pickFirstString(item.id)) !== null && _a !== void 0 ? _a : (0, node_crypto_1.randomUUID)();
                const command = this.pickFirstString(item.command);
                activeCommands.set(id, { command });
                dispatchToolMessage(command ? `Running: ${command}` : 'Running command', {
                    toolName: 'Bash',
                    tool_name: 'Bash',
                    command,
                    status: (_b = this.pickFirstString(item.status)) !== null && _b !== void 0 ? _b : 'in_progress',
                }, 'tool_use', true);
            };
            const emitCommandResult = (item) => {
                var _a, _b;
                const id = this.pickFirstString(item.id);
                const tracked = id ? activeCommands.get(id) : undefined;
                if (id) {
                    activeCommands.delete(id);
                }
                const command = (_a = this.pickFirstString(item.command)) !== null && _a !== void 0 ? _a : tracked === null || tracked === void 0 ? void 0 : tracked.command;
                const output = (_b = this.pickFirstString(item.aggregated_output)) !== null && _b !== void 0 ? _b : '';
                const exitCode = typeof item.exit_code === 'number' ? item.exit_code : undefined;
                const status = this.pickFirstString(item.status);
                const isError = status === 'failed' || (typeof exitCode === 'number' && exitCode !== 0);
                const summary = command ? `Ran: ${command}` : 'Executed shell command';
                const exitSuffix = typeof exitCode === 'number' ? ` (exit ${exitCode})` : '';
                const body = output.trim();
                const fullContent = body ? `${summary}${exitSuffix}\n\n${body}` : `${summary}${exitSuffix}`;
                dispatchToolMessage(fullContent, {
                    toolName: 'Bash',
                    tool_name: 'Bash',
                    command,
                    exitCode,
                    status,
                    output,
                    is_error: isError || undefined,
                }, 'tool_result', false);
            };
            const emitFileChange = (item) => {
                var _a;
                const { content, metadata } = this.summarizeApplyPatch({
                    changes: item.changes,
                });
                const status = (_a = this.pickFirstString(item.status)) !== null && _a !== void 0 ? _a : 'completed';
                const isError = status === 'failed';
                const toolName = (metadata === null || metadata === void 0 ? void 0 : metadata.toolName) || (metadata === null || metadata === void 0 ? void 0 : metadata.tool_name) || 'Edit';
                dispatchToolMessage(isError ? `Failed: ${content}` : content, { ...metadata, toolName, tool_name: toolName, status, is_error: isError || undefined }, 'tool_result', false);
            };
            const emitTodoListUpdate = (record, phase) => {
                var _a;
                const rawItems = this.extractTodoListItems(record);
                const items = this.normalizeTodoListItems(rawItems);
                const content = this.buildTodoListContent(items, phase);
                const status = (_a = this.pickFirstString(record.status)) !== null && _a !== void 0 ? _a : (phase === 'completed' ? 'completed' : 'in_progress');
                const metadata = this.createTodoListMetadata(items, phase, {
                    status,
                    planId: this.pickFirstString(record.id),
                });
                dispatchToolMessage(content, metadata, phase === 'completed' ? 'tool_result' : 'tool_use', phase === 'update');
            };
            // Item event handlers
            const handleItemStarted = (item) => {
                if (!item || typeof item !== 'object')
                    return;
                const record = item;
                const type = this.pickFirstString(record.type);
                if (type === 'command_execution') {
                    emitCommandStart(record);
                }
                else if (type === 'todo_list') {
                    emitTodoListUpdate(record, 'started');
                }
            };
            const handleItemDelta = (delta) => {
                if (!delta || typeof delta !== 'object')
                    return;
                const record = delta;
                const type = this.pickFirstString(record.type);
                if (type === 'agent_message') {
                    const text = this.pickFirstString(record.text);
                    if (text) {
                        assistantBuffer += text;
                        emitAssistant(false);
                    }
                }
                else if (type === 'reasoning') {
                    const text = this.pickFirstString(record.text);
                    if (text) {
                        thinkingSegments.push(text);
                        emitAssistant(false);
                    }
                }
                else if (type === 'todo_list') {
                    emitTodoListUpdate(record, 'update');
                }
            };
            const handleItemCompleted = (item) => {
                if (!item || typeof item !== 'object')
                    return;
                const record = item;
                const type = this.pickFirstString(record.type);
                switch (type) {
                    case 'command_execution':
                        emitCommandResult(record);
                        break;
                    case 'file_change':
                        emitFileChange(record);
                        break;
                    case 'todo_list':
                        emitTodoListUpdate(record, 'completed');
                        break;
                    case 'agent_message': {
                        const text = this.pickFirstString(record.text);
                        if (text)
                            assistantBuffer = text;
                        emitAssistant(true);
                        resetAssistantBuffers();
                        break;
                    }
                    case 'reasoning': {
                        const text = this.pickFirstString(record.text);
                        if (text) {
                            thinkingSegments.push(text);
                            emitAssistant(false);
                        }
                        break;
                    }
                    default: {
                        const text = this.pickFirstString(record.text);
                        if (text) {
                            thinkingSegments.push(text);
                            emitAssistant(false);
                        }
                        break;
                    }
                }
            };
            // Setup timeout
            const timeoutMs = Number.parseInt(process.env.CODEX_ENGINE_TIMEOUT_MS || '', 10) || 15 * 60 * 1000;
            timeoutHandle = setTimeout(() => {
                timedOut = true;
                // Close readline to exit the loop
                try {
                    rl.close();
                }
                catch (_a) {
                    // Ignore
                }
                if (!child.killed) {
                    try {
                        child.kill();
                    }
                    catch (_b) {
                        // Ignore
                    }
                }
            }, timeoutMs);
            (_b = timeoutHandle.unref) === null || _b === void 0 ? void 0 : _b.call(timeoutHandle);
            // Cleanup timeout and handle abnormal exit
            child.on('close', (code, closeSignal) => {
                if (timeoutHandle) {
                    clearTimeout(timeoutHandle);
                    timeoutHandle = null;
                }
                // If already timed out, settled, or completed normally, do nothing
                if (timedOut || settled || hasCompleted) {
                    return;
                }
                // Build error detail from exit code and signal
                const detailParts = [];
                if (typeof code === 'number') {
                    detailParts.push(`exit code ${code}`);
                }
                if (closeSignal) {
                    detailParts.push(`signal ${closeSignal}`);
                }
                const detail = detailParts.length > 0 ? detailParts.join(', ') : 'unexpected shutdown';
                // Emit final assistant message and mark as failed
                emitAssistant(true);
                resetAssistantBuffers();
                hasCompleted = true;
                void finish(new Error(`CodexEngine: process terminated (${detail})`));
            });
            // Main event processing loop (wrapped in IIFE to handle async properly)
            void (async () => {
                var _a, _b, _c, _d;
                try {
                    for await (const line of rl) {
                        const trimmed = line.trim();
                        if (!trimmed)
                            continue;
                        let event;
                        try {
                            event = JSON.parse(trimmed);
                        }
                        catch (_e) {
                            console.warn('[CodexEngine] Failed to parse Codex event line:', trimmed);
                            continue;
                        }
                        const eventType = this.pickFirstString(event.type);
                        switch (eventType) {
                            case 'item.started':
                                handleItemStarted((_a = event.item) !== null && _a !== void 0 ? _a : null);
                                break;
                            case 'item.delta':
                                handleItemDelta((_b = event.delta) !== null && _b !== void 0 ? _b : null);
                                break;
                            case 'item.completed':
                                handleItemCompleted((_c = event.item) !== null && _c !== void 0 ? _c : null);
                                break;
                            case 'item.failed': {
                                const item = (_d = event.item) !== null && _d !== void 0 ? _d : null;
                                handleItemCompleted(item);
                                // Flush assistant message before throwing (aligned with other/cweb)
                                emitAssistant(true);
                                resetAssistantBuffers();
                                const msg = (item &&
                                    typeof item === 'object' &&
                                    this.pickFirstString(item.error)) ||
                                    'Codex execution failed';
                                hasCompleted = true;
                                throw new Error(msg);
                            }
                            case 'error': {
                                // Flush assistant message before throwing (aligned with other/cweb)
                                emitAssistant(true);
                                resetAssistantBuffers();
                                const msg = this.pickFirstString(event.error) ||
                                    this.pickFirstString(event.message) ||
                                    stderrBuffer.slice(-5).join('\n') ||
                                    'Codex execution error';
                                hasCompleted = true;
                                throw new Error(msg);
                            }
                            case 'turn.completed':
                                emitAssistant(true);
                                resetAssistantBuffers();
                                hasCompleted = true;
                                break;
                            default:
                                // Non-critical events are ignored
                                break;
                        }
                    }
                    // Check for timeout after loop exits
                    if (timedOut) {
                        throw new Error('CodexEngine: execution timed out');
                    }
                    // Emit final assistant message if not already completed
                    if (!hasCompleted) {
                        emitAssistant(true);
                        resetAssistantBuffers();
                        hasCompleted = true;
                    }
                    await finish();
                }
                catch (error) {
                    await finish(error);
                }
            })();
        });
    }
    resolveRepoPath(projectRoot) {
        const base = (projectRoot && projectRoot.trim()) || process.env.MCP_AGENT_PROJECT_ROOT || process.cwd();
        return node_path_1.default.resolve(base);
    }
    /**
     * Append project context (file listing) to the prompt.
     * Aligned with other/cweb implementation.
     */
    async appendProjectContext(baseInstruction, repoPath) {
        try {
            const fs = await import('node:fs/promises');
            const entries = await fs.readdir(repoPath, { withFileTypes: true });
            const visible = entries
                .filter((entry) => !entry.name.startsWith('.git') && entry.name !== 'AGENTS.md')
                .map((entry) => entry.name);
            if (visible.length === 0) {
                return `${baseInstruction}

<current_project_context>
This is an empty project directory. Work directly in the current folder without creating extra subdirectories.
</current_project_context>`;
            }
            return `${baseInstruction}

<current_project_context>
Current files in project directory: ${visible.sort().join(', ')}
Work directly in the current directory. Do not create subdirectories unless specifically requested.
</current_project_context>`;
        }
        catch (error) {
            console.warn('[CodexEngine] Failed to append project context:', error);
            return baseInstruction;
        }
    }
    /**
     * Build Codex CLI configuration arguments from the resolved config.
     * Aligned with other/cweb implementation for feature parity.
     */
    buildCodexConfigArgs(config) {
        const args = [];
        const pushConfig = (key, value) => {
            args.push('-c', `${key}=${String(value)}`);
        };
        pushConfig('include_apply_patch_tool', config.includeApplyPatchTool);
        pushConfig('include_plan_tool', config.includePlanTool);
        pushConfig('tools.web_search_request', config.enableWebSearch);
        pushConfig('use_experimental_streamable_shell_tool', config.useStreamableShell);
        pushConfig('sandbox_mode', config.sandboxMode);
        pushConfig('max_turns', config.maxTurns);
        pushConfig('max_thinking_tokens', config.maxThinkingTokens);
        pushConfig('reasoning_effort', config.reasoningEffort);
        args.push('-c', `instructions=${JSON.stringify(config.autoInstructions)}`);
        return args;
    }
    /**
     * Write an attachment to a temporary file and return its path.
     */
    async writeAttachmentToTemp(attachment) {
        const os = await import('node:os');
        const fs = await import('node:fs/promises');
        const tempDir = os.tmpdir();
        const ext = attachment.mimeType.split('/')[1] || 'bin';
        const sanitizedName = attachment.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `mcp-agent-${Date.now()}-${sanitizedName}.${ext}`;
        const filePath = node_path_1.default.join(tempDir, fileName);
        const buffer = Buffer.from(attachment.dataBase64, 'base64');
        await fs.writeFile(filePath, buffer);
        return filePath;
    }
    buildCodexEnv() {
        const env = { ...process.env };
        const extraPaths = [];
        const globalPath = process.env.NPM_GLOBAL_PATH;
        if (globalPath) {
            extraPaths.push(globalPath);
        }
        // Enhanced Windows PATH handling (aligned with other/cweb)
        if (process.platform === 'win32') {
            const appData = process.env.APPDATA;
            const localApp = process.env.LOCALAPPDATA;
            if (appData) {
                extraPaths.push(node_path_1.default.join(appData, 'npm'));
            }
            if (localApp) {
                extraPaths.push(node_path_1.default.join(localApp, 'Programs', 'nodejs'));
            }
        }
        if (extraPaths.length > 0) {
            const currentPath = env.PATH || env.Path || '';
            env.PATH = [...extraPaths, currentPath].filter(Boolean).join(node_path_1.default.delimiter);
        }
        return env;
    }
    pickFirstString(value) {
        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed.length > 0 ? trimmed : undefined;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        if (Array.isArray(value)) {
            for (const entry of value) {
                const candidate = this.pickFirstString(entry);
                if (candidate) {
                    return candidate;
                }
            }
            return undefined;
        }
        if (value && typeof value === 'object') {
            const record = value;
            for (const key of Object.keys(record)) {
                const candidate = this.pickFirstString(record[key]);
                if (candidate) {
                    return candidate;
                }
            }
        }
        return undefined;
    }
    summarizeApplyPatch(payload) {
        const changes = payload === null || payload === void 0 ? void 0 : payload.changes;
        const files = [];
        if (Array.isArray(changes)) {
            for (const entry of changes) {
                const file = entry && typeof entry === 'object'
                    ? entry.path ||
                        entry.file
                    : undefined;
                if (file && typeof file === 'string') {
                    files.push(file);
                }
            }
        }
        else if (changes && typeof changes === 'object') {
            for (const key of Object.keys(changes)) {
                files.push(key);
            }
        }
        const unique = Array.from(new Set(files));
        const summary = unique.length === 0
            ? 'Applied file changes'
            : unique.length === 1
                ? `Updated ${unique[0]}`
                : `Updated ${unique.length} files (${unique
                    .slice(0, 3)
                    .join(', ')}${unique.length > 3 ? ', ...' : ''})`;
        return {
            content: summary,
            metadata: {
                files: unique,
            },
        };
    }
    extractTodoListItems(record) {
        if (Array.isArray(record.items)) {
            return record.items;
        }
        const nestedItem = record.item;
        if (nestedItem &&
            typeof nestedItem === 'object' &&
            Array.isArray(nestedItem.items)) {
            return nestedItem.items;
        }
        const delta = record.delta;
        if (delta &&
            typeof delta === 'object' &&
            Array.isArray(delta.items)) {
            return delta.items;
        }
        return [];
    }
    normalizeTodoListItems(input) {
        if (!Array.isArray(input)) {
            return [];
        }
        const result = [];
        input.forEach((entry, index) => {
            var _a;
            if (!entry || typeof entry !== 'object') {
                return;
            }
            const record = entry;
            const text = (_a = this.pickFirstString(record.text)) !== null && _a !== void 0 ? _a : `Step ${index + 1}`;
            const completed = record.completed === true || record.done === true;
            result.push({
                text,
                completed,
                index,
            });
        });
        return result;
    }
    buildTodoListContent(items, phase) {
        if (items.length === 0) {
            switch (phase) {
                case 'started':
                    return 'Started plan with no explicit steps.';
                case 'completed':
                    return 'Plan completed.';
                default:
                    return 'Plan updated.';
            }
        }
        const header = phase === 'completed'
            ? 'Plan completed:'
            : phase === 'started'
                ? 'Plan generated:'
                : 'Plan updated:';
        const stepLines = items.map((item, idx) => {
            const bullet = item.completed ? '✅' : '⬜️';
            const label = `Step ${idx + 1}`;
            return `${bullet} ${label}: ${item.text}`;
        });
        return [header, ...stepLines].join('\n');
    }
    createTodoListMetadata(items, phase, extra) {
        const totalSteps = items.length;
        const completedSteps = items.filter((item) => item.completed).length;
        return {
            toolName: 'Plan',
            tool_name: 'Plan',
            planPhase: phase,
            planStatus: phase === 'completed' ? 'completed' : 'in_progress',
            totalSteps,
            completedSteps,
            items: items.map(({ text, completed, index }) => ({
                text,
                completed,
                index,
            })),
            ...(extra !== null && extra !== void 0 ? extra : {}),
        };
    }
    encodeHash(value) {
        return Buffer.from(value, 'utf-8').toString('base64');
    }
}
exports.CodexEngine = CodexEngine;
/**
 * Maximum number of stderr lines to keep in memory to avoid unbounded growth.
 */
CodexEngine.MAX_STDERR_LINES = 200;
//# sourceMappingURL=codex.js.map