"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMessagesByProjectId = getMessagesByProjectId;
exports.getMessagesCountByProjectId = getMessagesCountByProjectId;
exports.createMessage = createMessage;
exports.deleteMessagesByProjectId = deleteMessagesByProjectId;
exports.getMessagesBySessionId = getMessagesBySessionId;
exports.getMessagesCountBySessionId = getMessagesCountBySessionId;
exports.deleteMessagesBySessionId = deleteMessagesBySessionId;
exports.getMessagesByRequestId = getMessagesByRequestId;
/**
 * Message Service - Database-backed implementation using Drizzle ORM.
 *
 * Provides CRUD operations for agent chat messages with:
 * - Type-safe database queries
 * - Efficient indexed queries
 * - Consistent with AgentStoredMessage interface from shared types
 */
const node_crypto_1 = require("node:crypto");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("./db");
// ============================================================
// Type Conversion
// ============================================================
/**
 * Convert database row to AgentStoredMessage interface.
 */
function rowToMessage(row) {
    var _a;
    return {
        id: row.id,
        projectId: row.projectId,
        sessionId: row.sessionId,
        conversationId: row.conversationId,
        role: row.role,
        content: row.content,
        messageType: row.messageType,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        cliSource: row.cliSource,
        requestId: (_a = row.requestId) !== null && _a !== void 0 ? _a : undefined,
        createdAt: row.createdAt,
    };
}
// ============================================================
// Public API
// ============================================================
/**
 * Get messages by project ID with pagination.
 * Returns messages sorted by creation time (oldest first).
 */
async function getMessagesByProjectId(projectId, limit = 50, offset = 0) {
    const db = (0, db_1.getDb)();
    const query = db
        .select()
        .from(db_1.messages)
        .where((0, drizzle_orm_1.eq)(db_1.messages.projectId, projectId))
        .orderBy((0, drizzle_orm_1.asc)(db_1.messages.createdAt));
    // Apply pagination if specified
    if (limit > 0) {
        query.limit(limit);
    }
    if (offset > 0) {
        query.offset(offset);
    }
    const rows = await query;
    return rows.map(rowToMessage);
}
/**
 * Get the total count of messages for a project.
 */
async function getMessagesCountByProjectId(projectId) {
    var _a, _b;
    const db = (0, db_1.getDb)();
    const result = await db
        .select({ count: (0, drizzle_orm_1.count)() })
        .from(db_1.messages)
        .where((0, drizzle_orm_1.eq)(db_1.messages.projectId, projectId));
    return (_b = (_a = result[0]) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 0;
}
/**
 * Create a new message.
 */
async function createMessage(input) {
    var _a, _b, _c, _d;
    const db = (0, db_1.getDb)();
    const now = new Date().toISOString();
    const messageData = {
        id: ((_a = input.id) === null || _a === void 0 ? void 0 : _a.trim()) || (0, node_crypto_1.randomUUID)(),
        projectId: input.projectId,
        sessionId: input.sessionId || '',
        conversationId: (_b = input.conversationId) !== null && _b !== void 0 ? _b : null,
        role: input.role,
        content: input.content,
        messageType: input.messageType,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        cliSource: (_c = input.cliSource) !== null && _c !== void 0 ? _c : null,
        requestId: (_d = input.requestId) !== null && _d !== void 0 ? _d : null,
        createdAt: input.createdAt || now,
    };
    await db
        .insert(db_1.messages)
        .values(messageData)
        .onConflictDoUpdate({
        target: db_1.messages.id,
        set: {
            role: messageData.role,
            messageType: messageData.messageType,
            content: messageData.content,
            metadata: messageData.metadata,
            sessionId: messageData.sessionId,
            conversationId: messageData.conversationId,
            cliSource: messageData.cliSource,
            requestId: messageData.requestId,
        },
    });
    return rowToMessage(messageData);
}
/**
 * Delete messages by project ID.
 * Optionally filter by conversation ID.
 * Returns the number of deleted messages.
 */
async function deleteMessagesByProjectId(projectId, conversationId) {
    const db = (0, db_1.getDb)();
    // Get count before deletion
    const beforeCount = await getMessagesCountByProjectId(projectId);
    if (conversationId) {
        await db
            .delete(db_1.messages)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.messages.projectId, projectId), (0, drizzle_orm_1.eq)(db_1.messages.conversationId, conversationId)));
    }
    else {
        await db.delete(db_1.messages).where((0, drizzle_orm_1.eq)(db_1.messages.projectId, projectId));
    }
    // Get count after deletion to calculate deleted count
    const afterCount = await getMessagesCountByProjectId(projectId);
    return beforeCount - afterCount;
}
/**
 * Get messages by session ID with optional pagination.
 * Returns messages sorted by creation time (oldest first).
 *
 * @param sessionId - The session ID to filter by
 * @param limit - Maximum number of messages to return (0 = no limit)
 * @param offset - Number of messages to skip
 */
async function getMessagesBySessionId(sessionId, limit = 0, offset = 0) {
    const db = (0, db_1.getDb)();
    const query = db
        .select()
        .from(db_1.messages)
        .where((0, drizzle_orm_1.eq)(db_1.messages.sessionId, sessionId))
        .orderBy((0, drizzle_orm_1.asc)(db_1.messages.createdAt));
    if (limit > 0) {
        query.limit(limit);
    }
    if (offset > 0) {
        query.offset(offset);
    }
    const rows = await query;
    return rows.map(rowToMessage);
}
/**
 * Get count of messages by session ID.
 */
async function getMessagesCountBySessionId(sessionId) {
    var _a, _b;
    const db = (0, db_1.getDb)();
    const result = await db
        .select({ count: (0, drizzle_orm_1.count)() })
        .from(db_1.messages)
        .where((0, drizzle_orm_1.eq)(db_1.messages.sessionId, sessionId));
    return (_b = (_a = result[0]) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 0;
}
/**
 * Delete all messages for a session.
 * Returns the number of deleted messages.
 */
async function deleteMessagesBySessionId(sessionId) {
    const db = (0, db_1.getDb)();
    const beforeCount = await getMessagesCountBySessionId(sessionId);
    await db.delete(db_1.messages).where((0, drizzle_orm_1.eq)(db_1.messages.sessionId, sessionId));
    const afterCount = await getMessagesCountBySessionId(sessionId);
    return beforeCount - afterCount;
}
/**
 * Get messages by request ID.
 */
async function getMessagesByRequestId(requestId) {
    const db = (0, db_1.getDb)();
    const rows = await db
        .select()
        .from(db_1.messages)
        .where((0, drizzle_orm_1.eq)(db_1.messages.requestId, requestId))
        .orderBy((0, drizzle_orm_1.asc)(db_1.messages.createdAt));
    return rows.map(rowToMessage);
}
//# sourceMappingURL=message-service.js.map