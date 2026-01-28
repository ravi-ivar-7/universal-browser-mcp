import type { OpenProjectResponse, OpenProjectTarget } from 'chrome-mcp-shared';
/**
 * Open a file in VS Code at a specific line/column.
 *
 * Uses 'code -g file:line:col' syntax for goto functionality.
 * Also opens the project root with -r to reuse existing window.
 *
 * Security:
 * - Validates that file path stays within project root
 * - Uses spawn with args array (no shell interpolation)
 *
 * @param projectRoot - Project root directory (for security validation and -r flag)
 * @param filePath - File path (relative or absolute)
 * @param line - Optional line number (1-based)
 * @param column - Optional column number (1-based)
 */
export declare function openFileInVSCode(projectRoot: string, filePath: string, line?: number, column?: number): Promise<OpenProjectResponse>;
/**
 * Open a project directory in the specified target application.
 *
 * @param rootPath - The project directory path
 * @param target - 'vscode' or 'terminal'
 * @returns Response indicating success or failure with error message
 */
export declare function openProjectDirectory(rootPath: string, target: OpenProjectTarget): Promise<OpenProjectResponse>;
