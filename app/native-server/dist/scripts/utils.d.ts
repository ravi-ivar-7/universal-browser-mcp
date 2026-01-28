import fs from 'fs';
import { BrowserType } from './browser-config';
export declare const access: typeof fs.access.__promisify__;
export declare const mkdir: typeof fs.mkdir.__promisify__;
export declare const writeFile: typeof fs.writeFile.__promisify__;
/**
 * Get the log directory path for wrapper scripts.
 * Uses platform-appropriate user directories to avoid permission issues.
 *
 * - macOS: ~/Library/Logs/mcp-chrome-bridge
 * - Windows: %LOCALAPPDATA%/mcp-chrome-bridge/logs
 * - Linux: $XDG_STATE_HOME/mcp-chrome-bridge/logs or ~/.local/state/mcp-chrome-bridge/logs
 */
export declare function getLogDir(): string;
/**
 * Print colored text
 */
export declare function colorText(text: string, color: string): string;
/**
 * Get user-level manifest file path
 */
export declare function getUserManifestPath(): string;
/**
 * Get system-level manifest file path
 */
export declare function getSystemManifestPath(): string;
/**
 * Get native host startup script file path
 */
export declare function getMainPath(): Promise<string>;
/**
 * Write Node.js executable path to node_path.txt for run_host scripts.
 * This ensures the native host uses the same Node.js version that was used during installation,
 * avoiding NODE_MODULE_VERSION mismatch errors with native modules like better-sqlite3.
 *
 * @param distDir - The dist directory where node_path.txt should be written
 * @param nodeExecPath - The Node.js executable path to write (defaults to current process.execPath)
 */
export declare function writeNodePathFile(distDir: string, nodeExecPath?: string): void;
/**
 * Ensure execution permissions for critical files
 */
export declare function ensureExecutionPermissions(): Promise<void>;
/**
 * Create Native Messaging host manifest content
 */
export declare function createManifestContent(): Promise<any>;
/**
 * Write node_path.txt and then register user-level Native Messaging host.
 * This is the recommended entry point for development and production registration,
 * as it ensures the Node.js path is captured before registration.
 *
 * @param browsers - Optional list of browsers to register for
 * @returns true if at least one browser was registered successfully
 */
export declare function registerUserLevelHostWithNodePath(browsers?: BrowserType[]): Promise<boolean>;
/**
 * Attempt to register user-level Native Messaging host
 */
export declare function tryRegisterUserLevelHost(targetBrowsers?: BrowserType[]): Promise<boolean>;
/**
 * Register system-level manifest with elevated permissions
 */
export declare function registerWithElevatedPermissions(): Promise<void>;
