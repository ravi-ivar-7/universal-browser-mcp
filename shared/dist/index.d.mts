import { Tool } from '@modelcontextprotocol/sdk/types.js';

declare const DEFAULT_SERVER_PORT = 12306;
declare const HOST_NAME = "com.chromemcp.nativehost";

declare enum NativeMessageType {
    START = "start",
    STARTED = "started",
    STOP = "stop",
    STOPPED = "stopped",
    PING = "ping",
    PONG = "pong",
    ERROR = "error",
    PROCESS_DATA = "process_data",
    PROCESS_DATA_RESPONSE = "process_data_response",
    CALL_TOOL = "call_tool",
    CALL_TOOL_RESPONSE = "call_tool_response",
    SERVER_STARTED = "server_started",
    SERVER_STOPPED = "server_stopped",
    ERROR_FROM_NATIVE_HOST = "error_from_native_host",
    CONNECT_NATIVE = "connectNative",
    ENSURE_NATIVE = "ensure_native",
    PING_NATIVE = "ping_native",
    DISCONNECT_NATIVE = "disconnect_native"
}
interface NativeMessage<P = any, E = any> {
    type?: NativeMessageType;
    responseToRequestId?: string;
    payload?: P;
    error?: E;
}
/**
 * A single element selection request from the AI.
 */
interface ElementPickerRequest {
    /**
     * Optional stable request id. If omitted, the extension will generate one.
     */
    id?: string;
    /**
     * Short label shown to the user (e.g., "Login button").
     */
    name: string;
    /**
     * Optional longer instruction shown to the user.
     */
    description?: string;
}
/**
 * Bounding rectangle of a picked element.
 */
interface PickedElementRect {
    x: number;
    y: number;
    width: number;
    height: number;
}
/**
 * Center point of a picked element.
 */
interface PickedElementPoint {
    x: number;
    y: number;
}
/**
 * A picked element that can be used with other tools (click, fill, etc.).
 */
interface PickedElement {
    /**
     * Element ref written into window.__claudeElementMap (frame-local).
     * Can be used directly with chrome_click_element, chrome_fill_or_select, etc.
     */
    ref: string;
    /**
     * Best-effort stable CSS selector.
     */
    selector: string;
    /**
     * Selector type (currently CSS only).
     */
    selectorType: 'css';
    /**
     * Bounding rect in the element's frame viewport coordinates.
     */
    rect: PickedElementRect;
    /**
     * Center point in the element's frame viewport coordinates.
     * Can be used as coordinates for chrome_computer.
     */
    center: PickedElementPoint;
    /**
     * Optional text snippet to help verify the selection.
     */
    text?: string;
    /**
     * Lowercased tag name.
     */
    tagName?: string;
    /**
     * Chrome frameId for iframe targeting.
     * Pass this to chrome_click_element/chrome_fill_or_select for cross-frame support.
     */
    frameId: number;
}
/**
 * Result for a single element selection request.
 */
interface ElementPickerResultItem {
    /**
     * The request id (matches the input request).
     */
    id: string;
    /**
     * The request name (for reference).
     */
    name: string;
    /**
     * The picked element, or null if not selected.
     */
    element: PickedElement | null;
    /**
     * Error message if selection failed for this request.
     */
    error?: string;
}
/**
 * Result of the chrome_request_element_selection tool.
 */
interface ElementPickerResult {
    /**
     * True if the user confirmed all selections.
     */
    success: boolean;
    /**
     * Session identifier for this picker session.
     */
    sessionId: string;
    /**
     * Timeout value used for this session.
     */
    timeoutMs: number;
    /**
     * True if the user cancelled the selection.
     */
    cancelled?: boolean;
    /**
     * True if the selection timed out.
     */
    timedOut?: boolean;
    /**
     * List of request IDs that were not selected (for debugging).
     */
    missingRequestIds?: string[];
    /**
     * Results for each requested element.
     */
    results: ElementPickerResultItem[];
}

declare const TOOL_NAMES: {
    BROWSER: {
        GET_WINDOWS_AND_TABS: string;
        SEARCH_TABS_CONTENT: string;
        NAVIGATE: string;
        SCREENSHOT: string;
        CLOSE_TABS: string;
        SWITCH_TAB: string;
        WEB_FETCHER: string;
        CLICK: string;
        FILL: string;
        REQUEST_ELEMENT_SELECTION: string;
        GET_INTERACTIVE_ELEMENTS: string;
        NETWORK_CAPTURE: string;
        NETWORK_CAPTURE_START: string;
        NETWORK_CAPTURE_STOP: string;
        NETWORK_REQUEST: string;
        NETWORK_DEBUGGER_START: string;
        NETWORK_DEBUGGER_STOP: string;
        KEYBOARD: string;
        HISTORY: string;
        BOOKMARK_SEARCH: string;
        BOOKMARK_ADD: string;
        BOOKMARK_DELETE: string;
        INJECT_SCRIPT: string;
        SEND_COMMAND_TO_INJECT_SCRIPT: string;
        JAVASCRIPT: string;
        CONSOLE: string;
        FILE_UPLOAD: string;
        READ_PAGE: string;
        COMPUTER: string;
        HANDLE_DIALOG: string;
        HANDLE_DOWNLOAD: string;
        USERSCRIPT: string;
        PERFORMANCE_START_TRACE: string;
        PERFORMANCE_STOP_TRACE: string;
        PERFORMANCE_ANALYZE_INSIGHT: string;
        GIF_RECORDER: string;
    };
    RECORD_REPLAY: {
        FLOW_RUN: string;
        LIST_PUBLISHED: string;
    };
};
declare const TOOL_SCHEMAS: Tool[];

declare const EDGE_LABELS: {
    readonly DEFAULT: "default";
    readonly TRUE: "true";
    readonly FALSE: "false";
    readonly ON_ERROR: "onError";
};
type EdgeLabel = (typeof EDGE_LABELS)[keyof typeof EDGE_LABELS];

interface RRNode {
    id: string;
    type: string;
    config?: Record<string, unknown>;
}
interface RREdge {
    id: string;
    from: string;
    to: string;
    label?: EdgeLabel;
}
declare const RR_STEP_TYPES: {
    readonly CLICK: "click";
    readonly DBLCLICK: "dblclick";
    readonly FILL: "fill";
    readonly DRAG: "drag";
    readonly KEY: "key";
    readonly WAIT: "wait";
    readonly ASSERT: "assert";
    readonly IF: "if";
    readonly FOREACH: "foreach";
    readonly WHILE: "while";
    readonly NAVIGATE: "navigate";
    readonly SCRIPT: "script";
    readonly HTTP: "http";
    readonly EXTRACT: "extract";
    readonly SCREENSHOT: "screenshot";
    readonly SCROLL: "scroll";
    readonly TRIGGER_EVENT: "triggerEvent";
    readonly SET_ATTRIBUTE: "setAttribute";
    readonly LOOP_ELEMENTS: "loopElements";
    readonly SWITCH_FRAME: "switchFrame";
    readonly OPEN_TAB: "openTab";
    readonly SWITCH_TAB: "switchTab";
    readonly CLOSE_TAB: "closeTab";
    readonly EXECUTE_FLOW: "executeFlow";
    readonly HANDLE_DOWNLOAD: "handleDownload";
    readonly DELAY: "delay";
};
type RRStepType = (typeof RR_STEP_TYPES)[keyof typeof RR_STEP_TYPES];
declare function topoOrder<T extends RRNode>(nodes: T[], edges: RREdge[]): T[];
declare function mapNodeToStep(node: RRNode): any;
declare function nodesToSteps(nodes: RRNode[], edges: RREdge[]): any[];
declare function mapStepToNodeConfig(step: unknown): Record<string, unknown>;
declare function stepsToNodes(steps: ReadonlyArray<unknown>): RRNode[];
/**
 * Convert linear steps array to DAG format (nodes + edges).
 * Generates sequential edges connecting nodes in order.
 */
declare function stepsToDAG(steps: ReadonlyArray<unknown>): {
    nodes: RRNode[];
    edges: RREdge[];
};

declare const STEP_TYPES: {
    readonly CLICK: "click";
    readonly DBLCLICK: "dblclick";
    readonly FILL: "fill";
    readonly TRIGGER_EVENT: "triggerEvent";
    readonly SET_ATTRIBUTE: "setAttribute";
    readonly SCREENSHOT: "screenshot";
    readonly SWITCH_FRAME: "switchFrame";
    readonly LOOP_ELEMENTS: "loopElements";
    readonly KEY: "key";
    readonly SCROLL: "scroll";
    readonly DRAG: "drag";
    readonly WAIT: "wait";
    readonly ASSERT: "assert";
    readonly SCRIPT: "script";
    readonly IF: "if";
    readonly FOREACH: "foreach";
    readonly WHILE: "while";
    readonly NAVIGATE: "navigate";
    readonly HTTP: "http";
    readonly EXTRACT: "extract";
    readonly OPEN_TAB: "openTab";
    readonly SWITCH_TAB: "switchTab";
    readonly CLOSE_TAB: "closeTab";
    readonly HANDLE_DOWNLOAD: "handleDownload";
    readonly EXECUTE_FLOW: "executeFlow";
    readonly TRIGGER: "trigger";
    readonly DELAY: "delay";
};
type StepTypeConst = (typeof STEP_TYPES)[keyof typeof STEP_TYPES];

type FieldType = 'string' | 'number' | 'boolean' | 'select' | 'object' | 'array' | 'json';
interface FieldSpecBase {
    key: string;
    label: string;
    type: FieldType;
    required?: boolean;
    placeholder?: string;
    help?: string;
    widget?: string;
    uiProps?: Record<string, any>;
}
interface FieldString extends FieldSpecBase {
    type: 'string';
    default?: string;
}
interface FieldNumber extends FieldSpecBase {
    type: 'number';
    min?: number;
    max?: number;
    step?: number;
    default?: number;
}
interface FieldBoolean extends FieldSpecBase {
    type: 'boolean';
    default?: boolean;
}
interface FieldSelect extends FieldSpecBase {
    type: 'select';
    options: Array<{
        label: string;
        value: string | number | boolean;
    }>;
    default?: string | number | boolean;
}
interface FieldObject extends FieldSpecBase {
    type: 'object';
    fields: FieldSpec[];
    default?: Record<string, any>;
}
interface FieldArray extends FieldSpecBase {
    type: 'array';
    item: FieldString | FieldNumber | FieldBoolean | FieldSelect | FieldObject | FieldJson;
    default?: any[];
}
interface FieldJson extends FieldSpecBase {
    type: 'json';
    default?: any;
}
type FieldSpec = FieldString | FieldNumber | FieldBoolean | FieldSelect | FieldObject | FieldArray | FieldJson;
type NodeCategory = 'Flow' | 'Actions' | 'Logic' | 'Tools' | 'Tabs' | 'Page';
interface NodeSpecDisplay {
    label: string;
    iconClass: string;
    category: NodeCategory;
    docUrl?: string;
}
interface NodeSpec {
    type: string;
    version: number;
    display: NodeSpecDisplay;
    ports: {
        inputs: number | 'any';
        outputs: Array<{
            label?: string;
        }> | 'any';
    };
    schema: FieldSpec[];
    defaults: Record<string, any>;
    validate?: (config: any) => string[];
}

declare function registerNodeSpec(spec: NodeSpec): void;
declare function getNodeSpec(type: string): NodeSpec | undefined;
declare function listNodeSpecs(): NodeSpec[];

declare function registerBuiltinSpecs(): void;

/**
 * Agent-side shared data contracts.
 * These types are shared between native-server and chrome-extension to ensure consistency.
 *
 * English is used for technical contracts; Chinese comments explain design choices.
 */
type AgentRole = 'user' | 'assistant' | 'tool' | 'system';
interface AgentMessage {
    id: string;
    sessionId: string;
    role: AgentRole;
    content: string;
    messageType: 'chat' | 'tool_use' | 'tool_result' | 'status';
    cliSource?: string;
    requestId?: string;
    isStreaming?: boolean;
    isFinal?: boolean;
    createdAt: string;
    metadata?: Record<string, unknown>;
}
type StreamTransport = 'sse' | 'websocket';
interface AgentStatusEvent {
    sessionId: string;
    status: 'starting' | 'ready' | 'running' | 'completed' | 'error' | 'cancelled';
    message?: string;
    requestId?: string;
}
interface AgentConnectedEvent {
    sessionId: string;
    transport: StreamTransport;
    timestamp: string;
}
interface AgentHeartbeatEvent {
    timestamp: string;
}
/** Usage statistics for a request */
interface AgentUsageStats {
    sessionId: string;
    requestId?: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens?: number;
    cacheCreationInputTokens?: number;
    totalCostUsd: number;
    durationMs: number;
    numTurns: number;
}
type RealtimeEvent = {
    type: 'message';
    data: AgentMessage;
} | {
    type: 'status';
    data: AgentStatusEvent;
} | {
    type: 'error';
    error: string;
    data?: {
        sessionId?: string;
        requestId?: string;
    };
} | {
    type: 'connected';
    data: AgentConnectedEvent;
} | {
    type: 'heartbeat';
    data: AgentHeartbeatEvent;
} | {
    type: 'usage';
    data: AgentUsageStats;
};
interface AgentAttachment {
    type: 'file' | 'image';
    name: string;
    mimeType: string;
    dataBase64: string;
}
type AgentCliPreference = 'claude' | 'codex' | 'cursor' | 'qwen' | 'glm' | 'gemini' | 'groq';
interface AgentActRequest {
    instruction: string;
    cliPreference?: AgentCliPreference;
    model?: string;
    attachments?: AgentAttachment[];
    /**
     * Optional logical project identifier. When provided, the backend
     * can resolve a stable workspace configuration instead of relying
     * solely on ad-hoc paths.
     */
    projectId?: string;
    /**
     * Optional database session ID (sessions.id). When provided, the backend
     * will load session-level configuration (engine, model, permission mode,
     * resume ids, etc.) from the sessions table.
     */
    dbSessionId?: string;
    /**
     * Optional project root / workspace directory on the local filesystem
     * that the engine should use as its working directory.
     */
    projectRoot?: string;
    /**
     * Optional request id from client; server will generate one if missing.
     */
    requestId?: string;
    /**
     * Optional client metadata to store with the user message.
     * For extension-specific context that should be preserved.
     */
    clientMeta?: Record<string, unknown>;
    /**
     * Optional display text override for the instruction.
     * When set, UI should display this instead of raw instruction.
     */
    displayText?: string;
}
interface AgentActResponse {
    requestId: string;
    sessionId: string;
    status: 'accepted';
}
interface AgentProject {
    id: string;
    name: string;
    description?: string;
    /**
     * Absolute filesystem path for this project workspace.
     */
    rootPath: string;
    preferredCli?: AgentCliPreference;
    selectedModel?: string;
    /**
     * Active Claude session ID (UUID format) for session resumption.
     * Captured from SDK's system/init message and used for the 'resume' parameter.
     */
    activeClaudeSessionId?: string;
    /**
     * Whether to use Claude Code Router (CCR) for this project.
     * When enabled, the engine will auto-detect CCR configuration.
     */
    useCcr?: boolean;
    /**
     * Whether to enable Chrome MCP integration for this project.
     * Default: true
     */
    enableChromeMcp?: boolean;
    createdAt: string;
    updatedAt: string;
    lastActiveAt?: string;
}
interface AgentEngineInfo {
    name: string;
    supportsMcp?: boolean;
}
/**
 * System prompt configuration for a session.
 */
type AgentSystemPromptConfig = {
    type: 'custom';
    text: string;
} | {
    type: 'preset';
    preset: 'claude_code';
    append?: string;
};
/**
 * Tools configuration - can be a list of tool names or a preset.
 */
type AgentToolsConfig = string[] | {
    type: 'preset';
    preset: 'claude_code';
};
/**
 * Session options configuration.
 */
interface AgentSessionOptionsConfig {
    settingSources?: string[];
    allowedTools?: string[];
    disallowedTools?: string[];
    tools?: AgentToolsConfig;
    betas?: string[];
    maxThinkingTokens?: number;
    maxTurns?: number;
    maxBudgetUsd?: number;
    mcpServers?: Record<string, unknown>;
    outputFormat?: Record<string, unknown>;
    enableFileCheckpointing?: boolean;
    sandbox?: Record<string, unknown>;
    env?: Record<string, string>;
    /**
     * Optional Codex-specific configuration overrides.
     * Only applicable when using CodexEngine.
     */
    codexConfig?: Partial<CodexEngineConfig>;
}
/**
 * Cached management information from Claude SDK.
 */
interface AgentManagementInfo {
    tools?: string[];
    agents?: string[];
    plugins?: Array<{
        name: string;
        path?: string;
    }>;
    skills?: string[];
    mcpServers?: Array<{
        name: string;
        status: string;
    }>;
    slashCommands?: string[];
    model?: string;
    permissionMode?: string;
    cwd?: string;
    outputStyle?: string;
    betas?: string[];
    claudeCodeVersion?: string;
    apiKeySource?: string;
    lastUpdated?: string;
}
/**
 * Agent session - represents an independent conversation within a project.
 */
interface AgentSession {
    id: string;
    projectId: string;
    engineName: AgentCliPreference;
    engineSessionId?: string;
    name?: string;
    /** Preview text from first user message, for display in session list */
    preview?: string;
    model?: string;
    permissionMode: string;
    allowDangerouslySkipPermissions: boolean;
    systemPromptConfig?: AgentSystemPromptConfig;
    optionsConfig?: AgentSessionOptionsConfig;
    managementInfo?: AgentManagementInfo;
    createdAt: string;
    updatedAt: string;
}
/**
 * Options for creating a new session.
 */
interface CreateAgentSessionInput {
    engineName: AgentCliPreference;
    name?: string;
    model?: string;
    permissionMode?: string;
    allowDangerouslySkipPermissions?: boolean;
    systemPromptConfig?: AgentSystemPromptConfig;
    optionsConfig?: AgentSessionOptionsConfig;
}
/**
 * Options for updating a session.
 */
interface UpdateAgentSessionInput {
    name?: string | null;
    model?: string | null;
    permissionMode?: string | null;
    allowDangerouslySkipPermissions?: boolean | null;
    systemPromptConfig?: AgentSystemPromptConfig | null;
    optionsConfig?: AgentSessionOptionsConfig | null;
}
interface AgentStoredMessage {
    id: string;
    projectId: string;
    sessionId: string;
    conversationId?: string | null;
    role: AgentRole;
    content: string;
    messageType: AgentMessage['messageType'];
    metadata?: Record<string, unknown>;
    cliSource?: string | null;
    createdAt?: string;
    requestId?: string;
}
/**
 * Sandbox mode for Codex CLI execution.
 */
type CodexSandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access';
/**
 * Reasoning effort for Codex models.
 * - low/medium/high: supported by all models
 * - xhigh: only supported by gpt-5.2 and gpt-5.1-codex-max
 */
type CodexReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';
/**
 * Configuration options for Codex Engine.
 * These can be overridden per-session via session settings.
 */
interface CodexEngineConfig {
    /** Enable apply_patch tool for file modifications. Default: true */
    includeApplyPatchTool: boolean;
    /** Enable plan tool for task planning. Default: true */
    includePlanTool: boolean;
    /** Enable web search capability. Default: true */
    enableWebSearch: boolean;
    /** Use experimental streamable shell tool. Default: true */
    useStreamableShell: boolean;
    /** Sandbox mode for command execution. Default: 'danger-full-access' */
    sandboxMode: CodexSandboxMode;
    /** Maximum number of turns. Default: 20 */
    maxTurns: number;
    /** Maximum thinking tokens. Default: 4096 */
    maxThinkingTokens: number;
    /** Reasoning effort for supported models. Default: 'medium' */
    reasoningEffort: CodexReasoningEffort;
    /** Auto instructions for autonomous behavior. Default: AUTO_INSTRUCTIONS */
    autoInstructions: string;
    /** Append project context (file listing) to prompt. Default: true */
    appendProjectContext: boolean;
}
/**
 * Default auto instructions for Codex to act autonomously.
 * Aligned with other/cweb implementation.
 */
declare const CODEX_AUTO_INSTRUCTIONS = "Act autonomously without asking for confirmations.\nUse apply_patch to create and modify files directly in the current working directory (do not create subdirectories unless the user explicitly requests it).\nUse exec_command to run, build, and test as needed.\nYou have full permissions. Keep taking concrete actions until the task is complete.\nRespect the existing project structure when creating or modifying files.\nPrefer concise status updates over questions.";
/**
 * Default configuration for Codex Engine.
 * Aligned with other/cweb implementation for feature parity.
 */
declare const DEFAULT_CODEX_CONFIG: CodexEngineConfig;
/**
 * Metadata for a persisted attachment file.
 */
interface AttachmentMetadata {
    /** Schema version for forward compatibility */
    version: number;
    /** Kind of attachment (e.g., 'image', 'file') */
    kind: string;
    /** Project ID this attachment belongs to */
    projectId: string;
    /** Message ID this attachment is associated with */
    messageId: string;
    /** Index of this attachment in the message */
    index: number;
    /** Persisted filename under project dir */
    filename: string;
    /** URL path to access this attachment */
    urlPath: string;
    /** MIME type of the attachment */
    mimeType: string;
    /** File size in bytes */
    sizeBytes: number;
    /** Original filename from upload */
    originalName: string;
    /** Timestamp when attachment was created */
    createdAt: string;
}
/**
 * Statistics for attachments in a single project.
 */
interface AttachmentProjectStats {
    projectId: string;
    /** Directory path for this project's attachments */
    dirPath: string;
    /** Whether the directory exists */
    exists: boolean;
    fileCount: number;
    totalBytes: number;
    /** Last modification timestamp (only when exists is true) */
    lastModifiedAt?: string;
}
/**
 * Cleanup result for a single project.
 */
interface CleanupProjectResult {
    projectId: string;
    dirPath: string;
    existed: boolean;
    removedFiles: number;
    removedBytes: number;
}
/**
 * Response for attachment statistics endpoint.
 */
interface AttachmentStatsResponse {
    success: boolean;
    rootDir: string;
    totalFiles: number;
    totalBytes: number;
    projects: Array<AttachmentProjectStats & {
        projectName?: string;
        existsInDb: boolean;
    }>;
    orphanProjectIds: string[];
}
/**
 * Request body for attachment cleanup endpoint.
 */
interface AttachmentCleanupRequest {
    /** If provided, cleanup only these projects. Otherwise cleanup all. */
    projectIds?: string[];
}
/**
 * Response for attachment cleanup endpoint.
 */
interface AttachmentCleanupResponse {
    success: boolean;
    scope: 'project' | 'selected' | 'all';
    removedFiles: number;
    removedBytes: number;
    results: CleanupProjectResult[];
}
/**
 * Target application for opening a project directory.
 */
type OpenProjectTarget = 'vscode' | 'terminal';
/**
 * Request body for open-project endpoint.
 */
interface OpenProjectRequest {
    /** Target application to open the project in */
    target: OpenProjectTarget;
}
/**
 * Response for open-project endpoint.
 */
type OpenProjectResponse = {
    success: true;
} | {
    success: false;
    error: string;
};

export { type AgentActRequest, type AgentActResponse, type AgentAttachment, type AgentCliPreference, type AgentConnectedEvent, type AgentEngineInfo, type AgentHeartbeatEvent, type AgentManagementInfo, type AgentMessage, type AgentProject, type AgentRole, type AgentSession, type AgentSessionOptionsConfig, type AgentStatusEvent, type AgentStoredMessage, type AgentSystemPromptConfig, type AgentToolsConfig, type AgentUsageStats, type AttachmentCleanupRequest, type AttachmentCleanupResponse, type AttachmentMetadata, type AttachmentProjectStats, type AttachmentStatsResponse, CODEX_AUTO_INSTRUCTIONS, type CleanupProjectResult, type CodexEngineConfig, type CodexReasoningEffort, type CodexSandboxMode, type CreateAgentSessionInput, DEFAULT_CODEX_CONFIG, DEFAULT_SERVER_PORT, EDGE_LABELS, type EdgeLabel, type ElementPickerRequest, type ElementPickerResult, type ElementPickerResultItem, type FieldArray, type FieldBoolean, type FieldJson, type FieldNumber, type FieldObject, type FieldSelect, type FieldSpec, type FieldSpecBase, type FieldString, type FieldType, HOST_NAME, type NativeMessage, NativeMessageType, type NodeCategory, type NodeSpec, type NodeSpecDisplay, type OpenProjectRequest, type OpenProjectResponse, type OpenProjectTarget, type PickedElement, type PickedElementPoint, type PickedElementRect, type RREdge, type RRNode, type RRStepType, RR_STEP_TYPES, type RealtimeEvent, STEP_TYPES, type StepTypeConst, type StreamTransport, TOOL_NAMES, TOOL_SCHEMAS, type UpdateAgentSessionInput, getNodeSpec, listNodeSpecs, mapNodeToStep, mapStepToNodeConfig, nodesToSteps, registerBuiltinSpecs, registerNodeSpec, stepsToDAG, stepsToNodes, topoOrder };
