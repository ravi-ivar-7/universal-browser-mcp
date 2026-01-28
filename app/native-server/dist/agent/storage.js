"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgentDataDir = getAgentDataDir;
exports.getDatabasePath = getDatabasePath;
exports.getDefaultWorkspaceDir = getDefaultWorkspaceDir;
exports.getDefaultProjectRoot = getDefaultProjectRoot;
/**
 * Storage path helpers for agent-related state.
 *
 * Provides unified path resolution for:
 * - SQLite database file
 * - Data directory
 * - Default workspace directory
 *
 * All paths can be overridden via environment variables.
 */
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const DEFAULT_DATA_DIR = node_path_1.default.join(node_os_1.default.homedir(), '.chrome-mcp-agent');
/**
 * Resolve base data directory for agent state.
 *
 * Environment:
 * - CHROME_MCP_AGENT_DATA_DIR: overrides the default base directory.
 */
function getAgentDataDir() {
    const raw = process.env.CHROME_MCP_AGENT_DATA_DIR;
    if (raw && raw.trim()) {
        return node_path_1.default.resolve(raw.trim());
    }
    return DEFAULT_DATA_DIR;
}
/**
 * Resolve database file path.
 *
 * Environment:
 * - CHROME_MCP_AGENT_DB_FILE: overrides the default database path.
 */
function getDatabasePath() {
    const raw = process.env.CHROME_MCP_AGENT_DB_FILE;
    if (raw && raw.trim()) {
        return node_path_1.default.resolve(raw.trim());
    }
    return node_path_1.default.join(getAgentDataDir(), 'agent.db');
}
/**
 * Get the default workspace directory for agent projects.
 * This is a subdirectory under the agent data directory.
 *
 * Cross-platform compatible:
 * - Mac/Linux: ~/.chrome-mcp-agent/workspaces
 * - Windows: %USERPROFILE%\.chrome-mcp-agent\workspaces
 */
function getDefaultWorkspaceDir() {
    return node_path_1.default.join(getAgentDataDir(), 'workspaces');
}
/**
 * Generate a default project root path for a given project name.
 */
function getDefaultProjectRoot(projectName) {
    // Sanitize project name for use as directory name
    const safeName = projectName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return node_path_1.default.join(getDefaultWorkspaceDir(), safeName || 'default-project');
}
//# sourceMappingURL=storage.js.map