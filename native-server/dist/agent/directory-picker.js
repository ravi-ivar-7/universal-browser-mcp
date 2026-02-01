"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openDirectoryPicker = openDirectoryPicker;
/**
 * Directory Picker Service.
 *
 * Provides cross-platform directory selection using native system dialogs.
 * Uses platform-specific commands:
 * - macOS: osascript (AppleScript)
 * - Windows: PowerShell
 * - Linux: zenity or kdialog
 */
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const node_os_1 = __importDefault(require("node:os"));
const execAsync = (0, node_util_1.promisify)(node_child_process_1.exec);
/**
 * Open a native directory picker dialog.
 * Returns the selected directory path or indicates cancellation.
 */
async function openDirectoryPicker(title = 'Select Project Directory') {
    const platform = node_os_1.default.platform();
    try {
        switch (platform) {
            case 'darwin':
                return await openMacOSPicker(title);
            case 'win32':
                return await openWindowsPicker(title);
            case 'linux':
                return await openLinuxPicker(title);
            default:
                return {
                    success: false,
                    error: `Unsupported platform: ${platform}`,
                };
        }
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
/**
 * macOS: Use osascript to open Finder folder picker.
 */
async function openMacOSPicker(title) {
    const script = `
    set selectedFolder to choose folder with prompt "${title}"
    return POSIX path of selectedFolder
  `;
    try {
        const { stdout } = await execAsync(`osascript -e '${script}'`);
        const path = stdout.trim();
        if (path) {
            return { success: true, path };
        }
        return { success: false, cancelled: true };
    }
    catch (error) {
        // User cancelled returns error code 1
        const err = error;
        if (err.code === 1) {
            return { success: false, cancelled: true };
        }
        throw error;
    }
}
/**
 * Windows: Use PowerShell to open folder browser dialog.
 */
async function openWindowsPicker(title) {
    const psScript = `
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = "${title}"
    $dialog.ShowNewFolderButton = $true
    $result = $dialog.ShowDialog()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
      Write-Output $dialog.SelectedPath
    }
  `;
    // Escape for command line
    const escapedScript = psScript.replace(/"/g, '\\"').replace(/\n/g, ' ');
    try {
        const { stdout } = await execAsync(`powershell -NoProfile -Command "${escapedScript}"`, { timeout: 60000 });
        const path = stdout.trim();
        if (path) {
            return { success: true, path };
        }
        return { success: false, cancelled: true };
    }
    catch (error) {
        const err = error;
        if (err.killed) {
            return { success: false, error: 'Dialog timed out' };
        }
        throw error;
    }
}
/**
 * Linux: Try zenity first, then kdialog as fallback.
 */
async function openLinuxPicker(title) {
    // Try zenity first (GTK)
    try {
        const { stdout } = await execAsync(`zenity --file-selection --directory --title="${title}"`, {
            timeout: 60000,
        });
        const path = stdout.trim();
        if (path) {
            return { success: true, path };
        }
        return { success: false, cancelled: true };
    }
    catch (zenityError) {
        // zenity returns exit code 1 on cancel, 5 if not installed
        const err = zenityError;
        if (err.code === 1) {
            return { success: false, cancelled: true };
        }
        // Try kdialog as fallback (KDE)
        try {
            const { stdout } = await execAsync(`kdialog --getexistingdirectory ~ --title "${title}"`, {
                timeout: 60000,
            });
            const path = stdout.trim();
            if (path) {
                return { success: true, path };
            }
            return { success: false, cancelled: true };
        }
        catch (kdialogError) {
            const kdErr = kdialogError;
            if (kdErr.code === 1) {
                return { success: false, cancelled: true };
            }
            return {
                success: false,
                error: 'No directory picker available. Please install zenity or kdialog.',
            };
        }
    }
}
//# sourceMappingURL=directory-picker.js.map