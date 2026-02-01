/**
 * Resolve base data directory for agent state.
 *
 * Environment:
 * - CHROME_MCP_AGENT_DATA_DIR: overrides the default base directory.
 */
export declare function getAgentDataDir(): string;
/**
 * Resolve database file path.
 *
 * Environment:
 * - CHROME_MCP_AGENT_DB_FILE: overrides the default database path.
 */
export declare function getDatabasePath(): string;
/**
 * Get the default workspace directory for agent projects.
 * This is a subdirectory under the agent data directory.
 *
 * Cross-platform compatible:
 * - Mac/Linux: ~/.chrome-mcp-agent/workspaces
 * - Windows: %USERPROFILE%\.chrome-mcp-agent\workspaces
 */
export declare function getDefaultWorkspaceDir(): string;
/**
 * Generate a default project root path for a given project name.
 */
export declare function getDefaultProjectRoot(projectName: string): string;
