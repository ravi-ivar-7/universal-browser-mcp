import type { EngineName } from './engines/types';
/**
 * System prompt configuration options.
 */
export type SystemPromptConfig = {
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
export type ToolsConfig = string[] | {
    type: 'preset';
    preset: 'claude_code';
};
/**
 * Session options configuration (stored as JSON).
 */
export interface SessionOptionsConfig {
    settingSources?: string[];
    allowedTools?: string[];
    disallowedTools?: string[];
    tools?: ToolsConfig;
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
    codexConfig?: Partial<import('chrome-mcp-shared').CodexEngineConfig>;
}
/**
 * Cached management information from Claude SDK.
 */
export interface ManagementInfo {
    models?: Array<{
        value: string;
        displayName: string;
        description: string;
    }>;
    commands?: Array<{
        name: string;
        description: string;
        argumentHint: string;
    }>;
    account?: {
        email?: string;
        organization?: string;
        subscriptionType?: string;
    };
    mcpServers?: Array<{
        name: string;
        status: string;
    }>;
    tools?: string[];
    agents?: string[];
    /** Plugins with name and path (SDK returns { name, path }[]) */
    plugins?: Array<{
        name: string;
        path?: string;
    }>;
    skills?: string[];
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
 * Structured preview metadata for session list display.
 * When present, allows rendering special styles (e.g., chip for web editor apply).
 */
export interface AgentSessionPreviewMeta {
    /** Compact display text (e.g., user's message or "Apply changes") */
    displayText?: string;
    /** Client metadata for special rendering */
    clientMeta?: {
        kind?: 'web_editor_apply_batch' | 'web_editor_apply_single';
        pageUrl?: string;
        elementCount?: number;
        elementLabels?: string[];
    };
    /** Full content for tooltip preview (truncated to avoid payload bloat) */
    fullContent?: string;
}
/**
 * Agent session representation.
 */
export interface AgentSession {
    id: string;
    projectId: string;
    engineName: string;
    engineSessionId?: string;
    name?: string;
    /** Preview text from first user message, for display in session list */
    preview?: string;
    /** Structured preview metadata for special rendering (e.g., web editor apply chip) */
    previewMeta?: AgentSessionPreviewMeta;
    model?: string;
    permissionMode: string;
    allowDangerouslySkipPermissions: boolean;
    systemPromptConfig?: SystemPromptConfig;
    optionsConfig?: SessionOptionsConfig;
    managementInfo?: ManagementInfo;
    createdAt: string;
    updatedAt: string;
}
/**
 * Options for creating a new session.
 */
export interface CreateSessionOptions {
    id?: string;
    engineSessionId?: string;
    name?: string;
    model?: string;
    permissionMode?: string;
    allowDangerouslySkipPermissions?: boolean;
    systemPromptConfig?: SystemPromptConfig;
    optionsConfig?: SessionOptionsConfig;
}
/**
 * Options for updating an existing session.
 */
export interface UpdateSessionInput {
    engineSessionId?: string | null;
    name?: string | null;
    model?: string | null;
    permissionMode?: string | null;
    allowDangerouslySkipPermissions?: boolean | null;
    systemPromptConfig?: SystemPromptConfig | null;
    optionsConfig?: SessionOptionsConfig | null;
    managementInfo?: ManagementInfo | null;
}
/**
 * Create a new session for a project.
 */
export declare function createSession(projectId: string, engineName: EngineName, options?: CreateSessionOptions): Promise<AgentSession>;
/**
 * Get a session by ID.
 */
export declare function getSession(sessionId: string): Promise<AgentSession | undefined>;
/**
 * Get all sessions for a project, sorted by most recently updated.
 * Includes preview from first user message for each session.
 */
export declare function getSessionsByProject(projectId: string): Promise<AgentSession[]>;
/**
 * Get all sessions across all projects, sorted by most recently updated.
 * Includes preview from first user message for each session.
 */
export declare function getAllSessions(): Promise<AgentSession[]>;
/**
 * Get sessions for a project filtered by engine name.
 */
export declare function getSessionsByProjectAndEngine(projectId: string, engineName: EngineName): Promise<AgentSession[]>;
/**
 * Update an existing session.
 */
export declare function updateSession(sessionId: string, updates: UpdateSessionInput): Promise<void>;
/**
 * Delete a session by ID.
 * Note: Messages associated with this session are NOT automatically deleted.
 * The caller should handle message cleanup if needed.
 */
export declare function deleteSession(sessionId: string): Promise<void>;
/**
 * Update the engine session ID (e.g., Claude SDK session_id).
 */
export declare function updateEngineSessionId(sessionId: string, engineSessionId: string | null): Promise<void>;
/**
 * Touch session activity - updates the updatedAt timestamp.
 * Used when a message is sent to move the session to the top of the list.
 */
export declare function touchSessionActivity(sessionId: string): Promise<void>;
/**
 * Update the cached management information.
 */
export declare function updateManagementInfo(sessionId: string, info: ManagementInfo | null): Promise<void>;
/**
 * Get or create a default session for a project and engine.
 * Useful for backwards compatibility - creates a session if none exists.
 */
export declare function getOrCreateDefaultSession(projectId: string, engineName: EngineName, options?: CreateSessionOptions): Promise<AgentSession>;
