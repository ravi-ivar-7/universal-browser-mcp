"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRootPath = validateRootPath;
exports.createProjectDirectory = createProjectDirectory;
exports.listProjects = listProjects;
exports.getProject = getProject;
exports.upsertProject = upsertProject;
exports.deleteProject = deleteProject;
exports.touchProjectActivity = touchProjectActivity;
exports.updateProjectClaudeSessionId = updateProjectClaudeSessionId;
/**
 * Project Service - Database-backed implementation using Drizzle ORM.
 *
 * Provides CRUD operations for agent projects with:
 * - Type-safe database queries
 * - Path validation with security checks
 * - Consistent with AgentProject interface from shared types
 */
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const node_os_1 = __importDefault(require("node:os"));
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("./db");
// ============================================================
// Security Configuration
// ============================================================
/**
 * Allowed base directories for project roots.
 * Only paths under these directories are considered safe.
 */
const ALLOWED_BASE_DIRS = [
    node_os_1.default.homedir(),
    process.env.USERPROFILE,
    process.env.MCP_ALLOWED_WORKSPACE_BASE,
].filter((dir) => typeof dir === 'string' && dir.length > 0);
/**
 * Validate a root path without creating it.
 * Returns validation result including whether directory needs creation.
 */
async function validateRootPath(rootPath) {
    const trimmed = rootPath.trim();
    if (!trimmed) {
        return {
            valid: false,
            absolute: '',
            exists: false,
            needsCreation: false,
            error: 'Project rootPath must not be empty',
        };
    }
    const absolute = node_path_1.default.isAbsolute(trimmed)
        ? node_path_1.default.resolve(trimmed)
        : node_path_1.default.resolve(process.cwd(), trimmed);
    // Security check: ensure path is under allowed base directories
    const isAllowed = ALLOWED_BASE_DIRS.some((base) => absolute.startsWith(node_path_1.default.resolve(base)));
    if (!isAllowed) {
        return {
            valid: false,
            absolute,
            exists: false,
            needsCreation: false,
            error: `Project rootPath must be under allowed directories: ${ALLOWED_BASE_DIRS.join(', ')}`,
        };
    }
    // Check if path exists
    try {
        const s = await (0, promises_1.stat)(absolute);
        if (!s.isDirectory()) {
            return {
                valid: false,
                absolute,
                exists: true,
                needsCreation: false,
                error: `Path exists but is not a directory: ${absolute}`,
            };
        }
        return { valid: true, absolute, exists: true, needsCreation: false };
    }
    catch (err) {
        const error = err;
        if (error.code === 'ENOENT') {
            // Path doesn't exist but is valid - can be created
            return { valid: true, absolute, exists: false, needsCreation: true };
        }
        return {
            valid: false,
            absolute,
            exists: false,
            needsCreation: false,
            error: error.message || 'Unknown error validating path',
        };
    }
}
/**
 * Create a project directory after user confirmation.
 * This should only be called after validateRootPath returns needsCreation: true.
 */
async function createProjectDirectory(absolutePath) {
    // Re-validate for safety
    const validation = await validateRootPath(absolutePath);
    if (!validation.valid) {
        throw new Error(validation.error || 'Invalid path');
    }
    if (validation.exists) {
        throw new Error('Directory already exists');
    }
    await (0, promises_1.mkdir)(absolutePath, { recursive: true });
}
/**
 * Normalize and validate root path.
 * @param rootPath - The path to normalize
 * @param allowCreate - If true, create directory if it doesn't exist
 */
async function normalizeRootPath(rootPath, allowCreate = false) {
    const result = await validateRootPath(rootPath);
    if (!result.valid) {
        throw new Error(result.error || 'Invalid path');
    }
    if (result.needsCreation) {
        if (allowCreate) {
            await (0, promises_1.mkdir)(result.absolute, { recursive: true });
        }
        else {
            throw new Error(`Directory does not exist: ${result.absolute}. Use the validate-path API first and confirm creation with the user.`);
        }
    }
    return result.absolute;
}
// ============================================================
// Type Conversion
// ============================================================
/**
 * Convert database row to AgentProject interface.
 */
function rowToProject(row) {
    var _a, _b, _c, _d;
    return {
        id: row.id,
        name: row.name,
        description: (_a = row.description) !== null && _a !== void 0 ? _a : undefined,
        rootPath: row.rootPath,
        preferredCli: row.preferredCli,
        selectedModel: (_b = row.selectedModel) !== null && _b !== void 0 ? _b : undefined,
        activeClaudeSessionId: (_c = row.activeClaudeSessionId) !== null && _c !== void 0 ? _c : undefined,
        useCcr: row.useCcr === '1',
        enableChromeMcp: row.enableChromeMcp !== '0',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        lastActiveAt: (_d = row.lastActiveAt) !== null && _d !== void 0 ? _d : undefined,
    };
}
// ============================================================
// Public API
// ============================================================
/**
 * List all projects, sorted by last activity (most recent first).
 */
async function listProjects() {
    const db = (0, db_1.getDb)();
    const rows = await db.select().from(db_1.projects).orderBy((0, drizzle_orm_1.desc)(db_1.projects.lastActiveAt));
    return rows.map(rowToProject);
}
/**
 * Get a single project by ID.
 */
async function getProject(id) {
    const db = (0, db_1.getDb)();
    const rows = await db.select().from(db_1.projects).where((0, drizzle_orm_1.eq)(db_1.projects.id, id)).limit(1);
    return rows.length > 0 ? rowToProject(rows[0]) : undefined;
}
/**
 * Create or update a project.
 */
async function upsertProject(input) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const db = (0, db_1.getDb)();
    const now = new Date().toISOString();
    const rootPath = await normalizeRootPath(input.rootPath, (_a = input.allowCreate) !== null && _a !== void 0 ? _a : false);
    const id = ((_b = input.id) === null || _b === void 0 ? void 0 : _b.trim()) || (0, node_crypto_1.randomUUID)();
    const existing = await getProject(id);
    // Convert booleans to strings for SQLite storage:
    // - useCcr: '1' or null (legacy)
    // - enableChromeMcp: '1' or '0' (non-null; defaults to enabled)
    const useCcrValue = input.useCcr !== undefined ? (input.useCcr ? '1' : null) : (existing === null || existing === void 0 ? void 0 : existing.useCcr) ? '1' : null;
    let enableChromeMcpValue;
    if (typeof input.enableChromeMcp === 'boolean') {
        enableChromeMcpValue = input.enableChromeMcp ? '1' : '0';
    }
    else {
        enableChromeMcpValue = (existing === null || existing === void 0 ? void 0 : existing.enableChromeMcp) === false ? '0' : '1';
    }
    const projectData = {
        id,
        name: input.name.trim(),
        description: ((_c = input.description) === null || _c === void 0 ? void 0 : _c.trim()) || (existing === null || existing === void 0 ? void 0 : existing.description) || null,
        rootPath,
        preferredCli: (_e = (_d = input.preferredCli) !== null && _d !== void 0 ? _d : existing === null || existing === void 0 ? void 0 : existing.preferredCli) !== null && _e !== void 0 ? _e : null,
        selectedModel: (_g = (_f = input.selectedModel) !== null && _f !== void 0 ? _f : existing === null || existing === void 0 ? void 0 : existing.selectedModel) !== null && _g !== void 0 ? _g : null,
        // Preserve activeClaudeSessionId from existing project (not settable via upsert)
        activeClaudeSessionId: (_h = existing === null || existing === void 0 ? void 0 : existing.activeClaudeSessionId) !== null && _h !== void 0 ? _h : null,
        useCcr: useCcrValue,
        enableChromeMcp: enableChromeMcpValue,
        createdAt: (existing === null || existing === void 0 ? void 0 : existing.createdAt) || now,
        updatedAt: now,
        lastActiveAt: now,
    };
    if (existing) {
        // Update existing project
        await db.update(db_1.projects).set(projectData).where((0, drizzle_orm_1.eq)(db_1.projects.id, id));
    }
    else {
        // Insert new project
        await db.insert(db_1.projects).values(projectData);
    }
    return rowToProject(projectData);
}
/**
 * Delete a project by ID.
 * Messages are automatically deleted via cascade.
 */
async function deleteProject(id) {
    const db = (0, db_1.getDb)();
    await db.delete(db_1.projects).where((0, drizzle_orm_1.eq)(db_1.projects.id, id));
}
/**
 * Update the last activity timestamp for a project.
 */
async function touchProjectActivity(id) {
    const db = (0, db_1.getDb)();
    const now = new Date().toISOString();
    await db.update(db_1.projects).set({ lastActiveAt: now, updatedAt: now }).where((0, drizzle_orm_1.eq)(db_1.projects.id, id));
}
/**
 * Update the active Claude session ID for a project.
 * This is called when the SDK returns a system/init message with a new session_id.
 * Pass empty string or null to clear the session ID.
 */
async function updateProjectClaudeSessionId(id, claudeSessionId) {
    const db = (0, db_1.getDb)();
    const now = new Date().toISOString();
    await db
        .update(db_1.projects)
        .set({
        // Store null if empty string is passed (to clear the session)
        activeClaudeSessionId: (claudeSessionId === null || claudeSessionId === void 0 ? void 0 : claudeSessionId.trim()) || null,
        updatedAt: now,
    })
        .where((0, drizzle_orm_1.eq)(db_1.projects.id, id));
}
//# sourceMappingURL=project-service.js.map