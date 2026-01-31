"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSession = createSession;
exports.getSession = getSession;
exports.getSessionsByProject = getSessionsByProject;
exports.getAllSessions = getAllSessions;
exports.getSessionsByProjectAndEngine = getSessionsByProjectAndEngine;
exports.updateSession = updateSession;
exports.deleteSession = deleteSession;
exports.updateEngineSessionId = updateEngineSessionId;
exports.touchSessionActivity = touchSessionActivity;
exports.updateManagementInfo = updateManagementInfo;
exports.getOrCreateDefaultSession = getOrCreateDefaultSession;
/**
 * Session Service - Database-backed implementation using Drizzle ORM.
 *
 * Provides CRUD operations for agent sessions with:
 * - Type-safe database queries
 * - Engine-agnostic session configuration storage
 * - JSON config and management info caching
 */
const node_crypto_1 = require("node:crypto");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("./db");
// ============================================================
// JSON Parsing Utilities
// ============================================================
function parseJson(value) {
    if (!value)
        return undefined;
    try {
        return JSON.parse(value);
    }
    catch (_a) {
        return undefined;
    }
}
function stringifyJson(value) {
    if (value === null || value === undefined)
        return null;
    return JSON.stringify(value);
}
// ============================================================
// Type Conversion
// ============================================================
function rowToSession(row) {
    var _a, _b, _c;
    return {
        id: row.id,
        projectId: row.projectId,
        engineName: row.engineName,
        engineSessionId: (_a = row.engineSessionId) !== null && _a !== void 0 ? _a : undefined,
        name: (_b = row.name) !== null && _b !== void 0 ? _b : undefined,
        model: (_c = row.model) !== null && _c !== void 0 ? _c : undefined,
        permissionMode: row.permissionMode,
        allowDangerouslySkipPermissions: row.allowDangerouslySkipPermissions === '1',
        systemPromptConfig: parseJson(row.systemPromptConfig),
        optionsConfig: parseJson(row.optionsConfig),
        managementInfo: parseJson(row.managementInfo),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}
// ============================================================
// Public API
// ============================================================
/**
 * Create a new session for a project.
 */
async function createSession(projectId, engineName, options = {}) {
    var _a, _b, _c, _d, _e;
    const db = (0, db_1.getDb)();
    const now = new Date().toISOString();
    // Resolve permission mode - AgentChat defaults to bypassPermissions for headless operation
    const resolvedPermissionMode = ((_a = options.permissionMode) === null || _a === void 0 ? void 0 : _a.trim()) || 'bypassPermissions';
    // SDK requires allowDangerouslySkipPermissions=true when using bypassPermissions mode
    // If explicitly provided, use that value; otherwise infer from permission mode
    const resolvedAllowDangerouslySkipPermissions = typeof options.allowDangerouslySkipPermissions === 'boolean'
        ? options.allowDangerouslySkipPermissions
        : resolvedPermissionMode === 'bypassPermissions';
    const sessionData = {
        id: ((_b = options.id) === null || _b === void 0 ? void 0 : _b.trim()) || (0, node_crypto_1.randomUUID)(),
        projectId,
        engineName,
        engineSessionId: ((_c = options.engineSessionId) === null || _c === void 0 ? void 0 : _c.trim()) || null,
        name: ((_d = options.name) === null || _d === void 0 ? void 0 : _d.trim()) || null,
        model: ((_e = options.model) === null || _e === void 0 ? void 0 : _e.trim()) || null,
        permissionMode: resolvedPermissionMode,
        allowDangerouslySkipPermissions: resolvedAllowDangerouslySkipPermissions ? '1' : null,
        systemPromptConfig: stringifyJson(options.systemPromptConfig),
        optionsConfig: stringifyJson(options.optionsConfig),
        managementInfo: null,
        createdAt: now,
        updatedAt: now,
    };
    await db.insert(db_1.sessions).values(sessionData);
    return rowToSession(sessionData);
}
/**
 * Get a session by ID.
 */
async function getSession(sessionId) {
    const db = (0, db_1.getDb)();
    const rows = await db.select().from(db_1.sessions).where((0, drizzle_orm_1.eq)(db_1.sessions.id, sessionId)).limit(1);
    return rows.length > 0 ? rowToSession(rows[0]) : undefined;
}
/** Maximum length for preview text */
const MAX_PREVIEW_LENGTH = 50;
/**
 * Truncate text to max length with ellipsis.
 */
function truncatePreview(text, maxLength = MAX_PREVIEW_LENGTH) {
    const trimmed = text.trim().replace(/\s+/g, ' ');
    if (trimmed.length <= maxLength)
        return trimmed;
    return trimmed.slice(0, maxLength - 1) + '…';
}
/**
 * Add preview to sessions by fetching first user message for each.
 * Shared helper to avoid code duplication.
 */
async function addPreviewsToSessions(rows) {
    const db = (0, db_1.getDb)();
    return Promise.all(rows.map(async (row) => {
        const session = rowToSession(row);
        // Query last user message for this session (include metadata for special rendering)
        const lastUserMessages = await db
            .select({ content: db_1.messages.content, metadata: db_1.messages.metadata })
            .from(db_1.messages)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.messages.sessionId, row.id), (0, drizzle_orm_1.eq)(db_1.messages.role, 'user')))
            .orderBy((0, drizzle_orm_1.desc)(db_1.messages.createdAt))
            .limit(1);
        if (lastUserMessages.length > 0 && lastUserMessages[0].content) {
            const content = lastUserMessages[0].content;
            const metadataJson = lastUserMessages[0].metadata;
            session.preview = truncatePreview(content);
            // Parse metadata to extract clientMeta/displayText for special rendering
            if (metadataJson) {
                try {
                    const parsed = JSON.parse(metadataJson);
                    // Type-safe extraction with validation
                    const rawClientMeta = parsed.clientMeta;
                    const rawDisplayText = parsed.displayText;
                    // Validate displayText is a string
                    const displayText = typeof rawDisplayText === 'string' ? rawDisplayText : undefined;
                    // Validate clientMeta structure
                    const clientMeta = rawClientMeta &&
                        typeof rawClientMeta === 'object' &&
                        'kind' in rawClientMeta &&
                        (rawClientMeta.kind === 'web_editor_apply_batch' ||
                            rawClientMeta.kind === 'web_editor_apply_single')
                        ? rawClientMeta
                        : undefined;
                    // Only set previewMeta if we have valid special metadata
                    if (clientMeta || displayText) {
                        session.previewMeta = {
                            displayText: displayText || truncatePreview(content),
                            clientMeta,
                            // Truncate fullContent to avoid payload bloat (200 chars max)
                            fullContent: truncatePreview(content, 200),
                        };
                    }
                }
                catch (_a) {
                    // Ignore JSON parse errors, just use plain preview
                }
            }
        }
        return session;
    }));
}
/**
 * Get all sessions for a project, sorted by most recently updated.
 * Includes preview from first user message for each session.
 */
async function getSessionsByProject(projectId) {
    const db = (0, db_1.getDb)();
    const rows = await db
        .select()
        .from(db_1.sessions)
        .where((0, drizzle_orm_1.eq)(db_1.sessions.projectId, projectId))
        .orderBy((0, drizzle_orm_1.desc)(db_1.sessions.updatedAt));
    return addPreviewsToSessions(rows);
}
/**
 * Get all sessions across all projects, sorted by most recently updated.
 * Includes preview from first user message for each session.
 */
async function getAllSessions() {
    const db = (0, db_1.getDb)();
    const rows = await db.select().from(db_1.sessions).orderBy((0, drizzle_orm_1.desc)(db_1.sessions.updatedAt));
    return addPreviewsToSessions(rows);
}
/**
 * Get sessions for a project filtered by engine name.
 */
async function getSessionsByProjectAndEngine(projectId, engineName) {
    const db = (0, db_1.getDb)();
    const rows = await db
        .select()
        .from(db_1.sessions)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.sessions.projectId, projectId), (0, drizzle_orm_1.eq)(db_1.sessions.engineName, engineName)))
        .orderBy((0, drizzle_orm_1.desc)(db_1.sessions.updatedAt));
    return rows.map(rowToSession);
}
/**
 * Update an existing session.
 */
async function updateSession(sessionId, updates) {
    var _a, _b, _c, _d;
    const db = (0, db_1.getDb)();
    const now = new Date().toISOString();
    const updateData = {
        updatedAt: now,
    };
    if (updates.engineSessionId !== undefined) {
        updateData.engineSessionId = ((_a = updates.engineSessionId) === null || _a === void 0 ? void 0 : _a.trim()) || null;
    }
    if (updates.name !== undefined) {
        updateData.name = ((_b = updates.name) === null || _b === void 0 ? void 0 : _b.trim()) || null;
    }
    if (updates.model !== undefined) {
        updateData.model = ((_c = updates.model) === null || _c === void 0 ? void 0 : _c.trim()) || null;
    }
    if (updates.permissionMode !== undefined) {
        updateData.permissionMode = ((_d = updates.permissionMode) === null || _d === void 0 ? void 0 : _d.trim()) || 'bypassPermissions';
    }
    if (updates.allowDangerouslySkipPermissions !== undefined) {
        updateData.allowDangerouslySkipPermissions = updates.allowDangerouslySkipPermissions
            ? '1'
            : null;
    }
    if (updates.systemPromptConfig !== undefined) {
        updateData.systemPromptConfig = stringifyJson(updates.systemPromptConfig);
    }
    if (updates.optionsConfig !== undefined) {
        updateData.optionsConfig = stringifyJson(updates.optionsConfig);
    }
    if (updates.managementInfo !== undefined) {
        updateData.managementInfo = stringifyJson(updates.managementInfo);
    }
    await db.update(db_1.sessions).set(updateData).where((0, drizzle_orm_1.eq)(db_1.sessions.id, sessionId));
}
/**
 * Delete a session by ID.
 * Note: Messages associated with this session are NOT automatically deleted.
 * The caller should handle message cleanup if needed.
 */
async function deleteSession(sessionId) {
    const db = (0, db_1.getDb)();
    await db.delete(db_1.sessions).where((0, drizzle_orm_1.eq)(db_1.sessions.id, sessionId));
}
/**
 * Update the engine session ID (e.g., Claude SDK session_id).
 */
async function updateEngineSessionId(sessionId, engineSessionId) {
    await updateSession(sessionId, { engineSessionId });
}
/**
 * Touch session activity - updates the updatedAt timestamp.
 * Used when a message is sent to move the session to the top of the list.
 */
async function touchSessionActivity(sessionId) {
    const db = (0, db_1.getDb)();
    const now = new Date().toISOString();
    await db.update(db_1.sessions).set({ updatedAt: now }).where((0, drizzle_orm_1.eq)(db_1.sessions.id, sessionId));
}
/**
 * Update the cached management information.
 */
async function updateManagementInfo(sessionId, info) {
    // Add timestamp to management info
    const infoWithTimestamp = info ? { ...info, lastUpdated: new Date().toISOString() } : null;
    await updateSession(sessionId, { managementInfo: infoWithTimestamp });
}
/**
 * Get or create a default session for a project and engine.
 * Useful for backwards compatibility - creates a session if none exists.
 */
async function getOrCreateDefaultSession(projectId, engineName, options = {}) {
    const existingSessions = await getSessionsByProjectAndEngine(projectId, engineName);
    if (existingSessions.length > 0) {
        // Return the most recently updated session
        return existingSessions[0];
    }
    // Create a new default session
    return createSession(projectId, engineName, {
        ...options,
        name: options.name || `Default ${engineName} session`,
    });
}
//# sourceMappingURL=session-service.js.map