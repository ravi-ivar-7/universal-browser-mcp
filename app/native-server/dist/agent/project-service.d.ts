import type { AgentProject } from 'chrome-mcp-shared';
import type { CreateOrUpdateProjectInput } from './project-types';
/**
 * Result of path validation.
 */
export interface PathValidationResult {
    valid: boolean;
    absolute: string;
    exists: boolean;
    needsCreation: boolean;
    error?: string;
}
/**
 * Validate a root path without creating it.
 * Returns validation result including whether directory needs creation.
 */
export declare function validateRootPath(rootPath: string): Promise<PathValidationResult>;
/**
 * Create a project directory after user confirmation.
 * This should only be called after validateRootPath returns needsCreation: true.
 */
export declare function createProjectDirectory(absolutePath: string): Promise<void>;
/**
 * List all projects, sorted by last activity (most recent first).
 */
export declare function listProjects(): Promise<AgentProject[]>;
/**
 * Get a single project by ID.
 */
export declare function getProject(id: string): Promise<AgentProject | undefined>;
/**
 * Create or update a project.
 */
export declare function upsertProject(input: CreateOrUpdateProjectInput): Promise<AgentProject>;
/**
 * Delete a project by ID.
 * Messages are automatically deleted via cascade.
 */
export declare function deleteProject(id: string): Promise<void>;
/**
 * Update the last activity timestamp for a project.
 */
export declare function touchProjectActivity(id: string): Promise<void>;
/**
 * Update the active Claude session ID for a project.
 * This is called when the SDK returns a system/init message with a new session_id.
 * Pass empty string or null to clear the session ID.
 */
export declare function updateProjectClaudeSessionId(id: string, claudeSessionId: string | null): Promise<void>;
