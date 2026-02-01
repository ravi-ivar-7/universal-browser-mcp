"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messages = exports.sessions = exports.projects = void 0;
/**
 * Drizzle ORM Schema for Agent Storage.
 *
 * Design principles:
 * - Type-safe database access
 * - Consistent with shared types (AgentProject, AgentStoredMessage)
 * - Proper indexes for common query patterns
 * - Foreign key constraints with cascade delete
 */
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
// ============================================================
// Projects Table
// ============================================================
exports.projects = (0, sqlite_core_1.sqliteTable)('projects', {
    id: (0, sqlite_core_1.text)().primaryKey(),
    name: (0, sqlite_core_1.text)().notNull(),
    description: (0, sqlite_core_1.text)(),
    rootPath: (0, sqlite_core_1.text)('root_path').notNull(),
    preferredCli: (0, sqlite_core_1.text)('preferred_cli'),
    selectedModel: (0, sqlite_core_1.text)('selected_model'),
    /**
     * Active Claude session ID (UUID format) for session resumption.
     * Captured from SDK's system/init message.
     */
    activeClaudeSessionId: (0, sqlite_core_1.text)('active_claude_session_id'),
    /**
     * Whether to use Claude Code Router (CCR) for this project.
     * Stored as '1' (true) or '0'/null (false).
     */
    useCcr: (0, sqlite_core_1.text)('use_ccr'),
    /**
     * Whether to enable the local Chrome MCP server integration for this project.
     * Stored as '1' (true) or '0' (false). Default: '1' (enabled).
     */
    enableChromeMcp: (0, sqlite_core_1.text)('enable_chrome_mcp').notNull().default('1'),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
    updatedAt: (0, sqlite_core_1.text)('updated_at').notNull(),
    lastActiveAt: (0, sqlite_core_1.text)('last_active_at'),
}, (table) => ({
    lastActiveIdx: (0, sqlite_core_1.index)('projects_last_active_idx').on(table.lastActiveAt),
}));
// ============================================================
// Sessions Table
// ============================================================
exports.sessions = (0, sqlite_core_1.sqliteTable)('sessions', {
    id: (0, sqlite_core_1.text)().primaryKey(),
    projectId: (0, sqlite_core_1.text)('project_id')
        .notNull()
        .references(() => exports.projects.id, { onDelete: 'cascade' }),
    /**
     * Engine name: claude, codex, cursor, qwen, glm, etc.
     */
    engineName: (0, sqlite_core_1.text)('engine_name').notNull(),
    /**
     * Engine-specific session ID for resumption.
     * For Claude: SDK's session_id from system:init message.
     */
    engineSessionId: (0, sqlite_core_1.text)('engine_session_id'),
    /**
     * User-defined session name for display.
     */
    name: (0, sqlite_core_1.text)(),
    /**
     * Model override for this session.
     */
    model: (0, sqlite_core_1.text)(),
    /**
     * Permission mode: default, acceptEdits, bypassPermissions, plan, dontAsk.
     */
    permissionMode: (0, sqlite_core_1.text)('permission_mode').notNull().default('bypassPermissions'),
    /**
     * Whether to allow bypassing interactive permission prompts.
     * Stored as '1' (true) or null (false).
     */
    allowDangerouslySkipPermissions: (0, sqlite_core_1.text)('allow_dangerously_skip_permissions'),
    /**
     * JSON: System prompt configuration.
     * Format: { type: 'custom', text: string } | { type: 'preset', preset: 'claude_code', append?: string }
     */
    systemPromptConfig: (0, sqlite_core_1.text)('system_prompt_config'),
    /**
     * JSON: Engine/session option overrides (settingSources, tools, betas, etc.).
     */
    optionsConfig: (0, sqlite_core_1.text)('options_config'),
    /**
     * JSON: Cached management info (supported models, commands, account, MCP servers, etc.).
     */
    managementInfo: (0, sqlite_core_1.text)('management_info'),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
    updatedAt: (0, sqlite_core_1.text)('updated_at').notNull(),
}, (table) => ({
    projectIdIdx: (0, sqlite_core_1.index)('sessions_project_id_idx').on(table.projectId),
    engineNameIdx: (0, sqlite_core_1.index)('sessions_engine_name_idx').on(table.engineName),
}));
// ============================================================
// Messages Table
// ============================================================
exports.messages = (0, sqlite_core_1.sqliteTable)('messages', {
    id: (0, sqlite_core_1.text)().primaryKey(),
    projectId: (0, sqlite_core_1.text)('project_id')
        .notNull()
        .references(() => exports.projects.id, { onDelete: 'cascade' }),
    sessionId: (0, sqlite_core_1.text)('session_id').notNull(),
    conversationId: (0, sqlite_core_1.text)('conversation_id'),
    role: (0, sqlite_core_1.text)().notNull(), // 'user' | 'assistant' | 'tool' | 'system'
    content: (0, sqlite_core_1.text)().notNull(),
    messageType: (0, sqlite_core_1.text)('message_type').notNull(), // 'chat' | 'tool_use' | 'tool_result' | 'status'
    metadata: (0, sqlite_core_1.text)(), // JSON string
    cliSource: (0, sqlite_core_1.text)('cli_source'),
    requestId: (0, sqlite_core_1.text)('request_id'),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
}, (table) => ({
    projectIdIdx: (0, sqlite_core_1.index)('messages_project_id_idx').on(table.projectId),
    sessionIdIdx: (0, sqlite_core_1.index)('messages_session_id_idx').on(table.sessionId),
    createdAtIdx: (0, sqlite_core_1.index)('messages_created_at_idx').on(table.createdAt),
    requestIdIdx: (0, sqlite_core_1.index)('messages_request_id_idx').on(table.requestId),
}));
//# sourceMappingURL=schema.js.map