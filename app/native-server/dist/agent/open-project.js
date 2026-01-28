"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openFileInVSCode = openFileInVSCode;
exports.openProjectDirectory = openProjectDirectory;
/**
 * Open Project Service.
 *
 * Provides cross-platform functionality to open a project directory in:
 * - VS Code (or compatible editors)
 * - System terminal
 *
 * Security:
 * - Uses validateRootPath() for path validation (allowed directories check)
 * - Uses spawn() with args array (shell: false) to prevent command injection
 *
 * Platform Support:
 * - macOS: Terminal.app, VS Code via 'code' or 'open -b'
 * - Windows: Windows Terminal, PowerShell, VS Code
 * - Linux: gnome-terminal, konsole, xfce4-terminal, xterm
 */
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const promises_1 = require("node:fs/promises");
const node_child_process_1 = require("node:child_process");
const project_service_1 = require("./project-service");
// ============================================================
// Utility Functions
// ============================================================
/**
 * Convert spawn error to human-readable string.
 */
function formatSpawnError(err) {
    if (err instanceof Error) {
        const errnoErr = err;
        if (errnoErr.code) {
            return `${errnoErr.code}: ${err.message}`;
        }
        return err.message;
    }
    return String(err);
}
/**
 * Format process exit information.
 */
function formatExitFailure(code, signal) {
    if (typeof code === 'number') {
        return `Exit code ${code}`;
    }
    if (signal) {
        return `Terminated by signal ${signal}`;
    }
    return 'Exited with unknown status';
}
// ============================================================
// Launch Logic
// ============================================================
/**
 * Attempt to launch a process.
 *
 * Strategy:
 * - If spawn fails immediately (e.g., ENOENT): return failure
 * - If process exits quickly with code 0: return success
 * - If process exits quickly with non-zero: return failure
 * - If process is still running after successAfterMs: return success
 *   (for long-lived terminal processes)
 */
async function tryLaunch(attempt) {
    var _a;
    const successAfterMs = (_a = attempt.successAfterMs) !== null && _a !== void 0 ? _a : 1500;
    const detached = attempt.detached !== false;
    return new Promise((resolve) => {
        let settled = false;
        let timer = null;
        const cleanup = () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            child.removeAllListeners('error');
            child.removeAllListeners('exit');
        };
        const child = (0, node_child_process_1.spawn)(attempt.cmd, attempt.args, {
            shell: false,
            stdio: 'ignore',
            detached,
        });
        if (detached) {
            // Let the child process continue independently
            child.unref();
        }
        child.once('error', (err) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            resolve({ success: false, error: formatSpawnError(err) });
        });
        child.once('exit', (code, signal) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            if (code === 0) {
                resolve({ success: true });
            }
            else {
                resolve({ success: false, error: formatExitFailure(code, signal) });
            }
        });
        // If process is still running after timeout, consider it successful
        timer = setTimeout(() => {
            if (settled)
                return;
            settled = true;
            cleanup();
            resolve({ success: true });
        }, successAfterMs);
    });
}
/**
 * Try multiple launch attempts in sequence until one succeeds.
 */
async function runFallbackSequence(errorTitle, attempts) {
    const errors = [];
    for (const attempt of attempts) {
        const result = await tryLaunch(attempt);
        if (result.success) {
            return;
        }
        errors.push(`${attempt.label}: ${result.error}`);
    }
    throw new Error(`${errorTitle}\n${errors.map((e) => `  - ${e}`).join('\n')}`);
}
// ============================================================
// VS Code
// ============================================================
/**
 * Open directory in VS Code.
 *
 * Strategy:
 * - All platforms: try 'code' command first
 * - Windows: also try 'code.cmd'
 * - macOS: fallback to 'open -b com.microsoft.VSCode'
 */
async function openInVSCode(absolutePath) {
    const platform = node_os_1.default.platform();
    const attempts = [
        {
            label: 'code',
            cmd: 'code',
            args: [absolutePath],
            successAfterMs: 8000, // VS Code takes time to start
        },
    ];
    // Windows: code.cmd is the batch wrapper
    if (platform === 'win32') {
        attempts.push({
            label: 'code.cmd',
            cmd: 'code.cmd',
            args: [absolutePath],
            successAfterMs: 8000,
        });
    }
    // macOS: fallback to bundle identifier
    if (platform === 'darwin') {
        attempts.push({
            label: 'open -b com.microsoft.VSCode',
            cmd: 'open',
            args: ['-b', 'com.microsoft.VSCode', absolutePath],
            successAfterMs: 3000,
        });
    }
    await runFallbackSequence(`Failed to open VS Code for: ${absolutePath}`, attempts);
}
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
async function openFileInVSCode(projectRoot, filePath, line, column) {
    var _a;
    try {
        // Validate project root
        const projectValidation = await (0, project_service_1.validateRootPath)(projectRoot);
        if (!projectValidation.valid) {
            return {
                success: false,
                error: (_a = projectValidation.error) !== null && _a !== void 0 ? _a : 'Invalid project rootPath',
            };
        }
        if (!projectValidation.exists) {
            return {
                success: false,
                error: `Project directory does not exist: ${projectValidation.absolute}`,
            };
        }
        const rootAbs = projectValidation.absolute;
        // Validate file path
        const trimmedFile = String(filePath !== null && filePath !== void 0 ? filePath : '').trim();
        if (!trimmedFile) {
            return { success: false, error: 'filePath is required' };
        }
        // Resolve file path with smart fallback
        // Some frameworks (Vue/Vite) return paths like "/src/components/Foo.vue" which
        // look absolute but are actually relative to project root. We try multiple strategies:
        // 1. If path looks absolute and exists as-is, use it
        // 2. Otherwise, strip leading slash and try as relative path
        // 3. Finally, try as relative path directly
        let absoluteFile = '';
        let fileExists = false;
        if (node_path_1.default.isAbsolute(trimmedFile)) {
            // Try as true absolute path first
            const asAbsolute = node_path_1.default.resolve(trimmedFile);
            try {
                const fileStat = await (0, promises_1.stat)(asAbsolute);
                if (fileStat.isFile()) {
                    absoluteFile = asAbsolute;
                    fileExists = true;
                }
            }
            catch (_b) {
                // Not found as absolute path
            }
            // If not found and path starts with /, try stripping it and treating as relative
            if (!fileExists && trimmedFile.startsWith('/')) {
                const strippedPath = trimmedFile.slice(1);
                const asRelative = node_path_1.default.resolve(rootAbs, strippedPath);
                try {
                    const fileStat = await (0, promises_1.stat)(asRelative);
                    if (fileStat.isFile()) {
                        absoluteFile = asRelative;
                        fileExists = true;
                    }
                }
                catch (_c) {
                    // Not found as relative path either
                }
            }
            // Default to absolute interpretation if nothing found
            if (!absoluteFile) {
                absoluteFile = node_path_1.default.resolve(trimmedFile);
            }
        }
        else {
            // Relative path - resolve against project root
            absoluteFile = node_path_1.default.resolve(rootAbs, trimmedFile);
        }
        // Security: ensure file stays within project root
        const relativeToRoot = node_path_1.default.relative(rootAbs, absoluteFile);
        if (relativeToRoot.startsWith('..') || node_path_1.default.isAbsolute(relativeToRoot)) {
            return { success: false, error: 'File path must be within project directory' };
        }
        // Check file exists
        if (!fileExists) {
            try {
                const fileStat = await (0, promises_1.stat)(absoluteFile);
                if (!fileStat.isFile()) {
                    return { success: false, error: `Not a file: ${absoluteFile}` };
                }
            }
            catch (_d) {
                return { success: false, error: `File does not exist: ${absoluteFile}` };
            }
        }
        // Validate and sanitize line/column
        const safeLine = typeof line === 'number' && Number.isFinite(line) && line > 0 ? Math.floor(line) : undefined;
        const safeColumn = typeof column === 'number' && Number.isFinite(column) && column > 0
            ? Math.floor(column)
            : undefined;
        // Build goto argument: file:line:col
        let gotoArg = absoluteFile;
        if (safeLine) {
            gotoArg += `:${safeLine}`;
            if (safeColumn) {
                gotoArg += `:${safeColumn}`;
            }
        }
        const platform = node_os_1.default.platform();
        // Build launch attempts
        // Use -r to reuse existing window, -g for goto
        const attempts = [
            {
                label: 'code -r -g',
                cmd: 'code',
                args: ['-r', rootAbs, '-g', gotoArg],
                successAfterMs: 8000,
            },
        ];
        if (platform === 'win32') {
            attempts.push({
                label: 'code.cmd -r -g',
                cmd: 'code.cmd',
                args: ['-r', rootAbs, '-g', gotoArg],
                successAfterMs: 8000,
            });
        }
        if (platform === 'darwin') {
            // macOS: use --args to pass flags to VS Code
            attempts.push({
                label: 'open -b com.microsoft.VSCode --args',
                cmd: 'open',
                args: ['-b', 'com.microsoft.VSCode', '--args', '-r', rootAbs, '-g', gotoArg],
                successAfterMs: 3000,
            });
        }
        await runFallbackSequence(`Failed to open VS Code for: ${gotoArg}`, attempts);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: formatSpawnError(error) };
    }
}
// ============================================================
// Terminal
// ============================================================
/**
 * Open directory in system terminal.
 */
async function openInTerminal(absolutePath) {
    const platform = node_os_1.default.platform();
    switch (platform) {
        case 'darwin':
            return openTerminalDarwin(absolutePath);
        case 'win32':
            return openTerminalWindows(absolutePath);
        case 'linux':
            return openTerminalLinux(absolutePath);
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
}
/**
 * macOS: Open Terminal.app with directory.
 */
async function openTerminalDarwin(absolutePath) {
    await runFallbackSequence(`Failed to open Terminal for: ${absolutePath}`, [
        {
            label: 'open -a Terminal',
            cmd: 'open',
            args: ['-a', 'Terminal', absolutePath],
            successAfterMs: 3000,
        },
    ]);
}
/**
 * Windows: Open Windows Terminal or PowerShell.
 */
async function openTerminalWindows(absolutePath) {
    await runFallbackSequence(`Failed to open terminal for: ${absolutePath}`, [
        // Windows Terminal (wt)
        {
            label: 'wt -d',
            cmd: 'wt',
            args: ['-d', absolutePath],
            successAfterMs: 3000,
        },
        // PowerShell fallback - using -LiteralPath to handle special characters
        // Use powershell.exe for better PATH compatibility
        {
            label: 'powershell.exe Set-Location',
            cmd: 'powershell.exe',
            args: ['-NoExit', '-Command', 'Set-Location -LiteralPath $args[0]', absolutePath],
            successAfterMs: 1500,
        },
    ]);
}
/**
 * Linux: Try common terminal emulators in sequence.
 */
async function openTerminalLinux(absolutePath) {
    await runFallbackSequence(`Failed to open terminal for: ${absolutePath}. Please install gnome-terminal, konsole, xfce4-terminal, or xterm.`, [
        // GNOME Terminal
        {
            label: 'gnome-terminal',
            cmd: 'gnome-terminal',
            args: ['--working-directory', absolutePath],
            successAfterMs: 3000,
        },
        // KDE Konsole
        {
            label: 'konsole',
            cmd: 'konsole',
            args: ['--workdir', absolutePath],
            successAfterMs: 3000,
        },
        // XFCE Terminal
        {
            label: 'xfce4-terminal',
            cmd: 'xfce4-terminal',
            args: ['--working-directory', absolutePath],
            successAfterMs: 3000,
        },
        // xterm (last resort)
        {
            label: 'xterm',
            cmd: 'xterm',
            // Use bash with positional parameter to safely pass the path
            args: ['-e', 'bash', '-lc', 'cd -- "$1" && exec "${SHELL:-bash}"', '_', absolutePath],
            successAfterMs: 3000,
        },
    ]);
}
// ============================================================
// Public API
// ============================================================
/**
 * Open a project directory in the specified target application.
 *
 * @param rootPath - The project directory path
 * @param target - 'vscode' or 'terminal'
 * @returns Response indicating success or failure with error message
 */
async function openProjectDirectory(rootPath, target) {
    var _a;
    try {
        // Validate path security and existence
        const validation = await (0, project_service_1.validateRootPath)(rootPath);
        if (!validation.valid) {
            return {
                success: false,
                error: (_a = validation.error) !== null && _a !== void 0 ? _a : 'Invalid project rootPath',
            };
        }
        if (!validation.exists) {
            return {
                success: false,
                error: `Directory does not exist: ${validation.absolute}`,
            };
        }
        const absolutePath = validation.absolute;
        // Open in target application
        switch (target) {
            case 'vscode':
                await openInVSCode(absolutePath);
                return { success: true };
            case 'terminal':
                await openInTerminal(absolutePath);
                return { success: true };
            default: {
                // Type guard for exhaustive check
                const _exhaustive = target;
                return {
                    success: false,
                    error: `Unsupported target: ${String(_exhaustive)}`,
                };
            }
        }
    }
    catch (error) {
        return {
            success: false,
            error: formatSpawnError(error),
        };
    }
}
//# sourceMappingURL=open-project.js.map