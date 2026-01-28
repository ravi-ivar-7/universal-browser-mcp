#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const constant_1 = require("./constant");
const utils_1 = require("./utils");
// Check if this script is run directly
const isDirectRun = require.main === module;
// Detect global installation for both npm and pnpm
function detectGlobalInstall() {
    // npm uses npm_config_global
    if (process.env.npm_config_global === 'true') {
        return true;
    }
    // pnpm detection methods
    // Method 1: Check if PNPM_HOME is set and current path contains it
    if (process.env.PNPM_HOME && __dirname.includes(process.env.PNPM_HOME)) {
        return true;
    }
    // Method 2: Check if we're in a global pnpm directory structure
    // pnpm global packages are typically installed in ~/.local/share/pnpm/global/5/node_modules
    // Windows: %APPDATA%\pnpm\global\5\node_modules
    const globalPnpmPatterns = process.platform === 'win32'
        ? ['\\pnpm\\global\\', '\\pnpm-global\\', '\\AppData\\Roaming\\pnpm\\']
        : ['/pnpm/global/', '/.local/share/pnpm/', '/pnpm-global/'];
    if (globalPnpmPatterns.some((pattern) => __dirname.includes(pattern))) {
        return true;
    }
    // Method 3: Check npm_config_prefix for pnpm
    if (process.env.npm_config_prefix && __dirname.includes(process.env.npm_config_prefix)) {
        return true;
    }
    // Method 4: Windows-specific global installation paths
    if (process.platform === 'win32') {
        const windowsGlobalPatterns = [
            '\\npm\\node_modules\\',
            '\\AppData\\Roaming\\npm\\node_modules\\',
            '\\Program Files\\nodejs\\node_modules\\',
            '\\nodejs\\node_modules\\',
        ];
        if (windowsGlobalPatterns.some((pattern) => __dirname.includes(pattern))) {
            return true;
        }
    }
    return false;
}
const isGlobalInstall = detectGlobalInstall();
/**
 * Detect if running with elevated privileges (sudo/admin)
 * This can cause issues because user-level registration will go to root's home directory
 */
function isRunningElevated() {
    var _a;
    if (process.platform === 'win32') {
        // On Windows, check common admin indicators
        // Note: Full admin check requires is-admin package which is ESM
        return false; // Skip for now, Windows npm usually doesn't run as admin by default
    }
    else {
        // On Unix, check if running as root (UID 0)
        return ((_a = process.getuid) === null || _a === void 0 ? void 0 : _a.call(process)) === 0;
    }
}
/**
 * Ensure execution permissions (whether global installation or not)
 */
async function ensureExecutionPermissions() {
    if (process.platform === 'win32') {
        // Windows platform handling
        await ensureWindowsFilePermissions();
        return;
    }
    // Unix/Linux platform handling
    const filesToCheck = [
        path_1.default.join(__dirname, '..', 'index.js'),
        path_1.default.join(__dirname, '..', 'run_host.sh'),
        path_1.default.join(__dirname, '..', 'cli.js'),
    ];
    for (const filePath of filesToCheck) {
        if (fs_1.default.existsSync(filePath)) {
            try {
                fs_1.default.chmodSync(filePath, '755');
                console.log((0, utils_1.colorText)(`✓ Set execution permissions for ${path_1.default.basename(filePath)}`, 'green'));
            }
            catch (err) {
                console.warn((0, utils_1.colorText)(`⚠️ Unable to set execution permissions for ${path_1.default.basename(filePath)}: ${err.message}`, 'yellow'));
            }
        }
        else {
            console.warn((0, utils_1.colorText)(`⚠️ File not found: ${filePath}`, 'yellow'));
        }
    }
}
/**
 * Windows platform file permission handling
 */
async function ensureWindowsFilePermissions() {
    const filesToCheck = [
        path_1.default.join(__dirname, '..', 'index.js'),
        path_1.default.join(__dirname, '..', 'run_host.bat'),
        path_1.default.join(__dirname, '..', 'cli.js'),
    ];
    for (const filePath of filesToCheck) {
        if (fs_1.default.existsSync(filePath)) {
            try {
                // Check if file is read-only, remove read-only attribute if so
                const stats = fs_1.default.statSync(filePath);
                if (!(stats.mode & parseInt('200', 8))) {
                    // Check write permission
                    // Try to remove read-only attribute
                    fs_1.default.chmodSync(filePath, stats.mode | parseInt('200', 8));
                    console.log((0, utils_1.colorText)(`✓ Removed read-only attribute from ${path_1.default.basename(filePath)}`, 'green'));
                }
                // Verify file accessibility
                fs_1.default.accessSync(filePath, fs_1.default.constants.R_OK);
                console.log((0, utils_1.colorText)(`✓ Verified file accessibility for ${path_1.default.basename(filePath)}`, 'green'));
            }
            catch (err) {
                console.warn((0, utils_1.colorText)(`⚠️ Unable to verify file permissions for ${path_1.default.basename(filePath)}: ${err.message}`, 'yellow'));
            }
        }
        else {
            console.warn((0, utils_1.colorText)(`⚠️ File not found: ${filePath}`, 'yellow'));
        }
    }
}
async function tryRegisterNativeHost() {
    try {
        console.log((0, utils_1.colorText)('Attempting to register Chrome Native Messaging host...', 'blue'));
        // Always ensure execution permissions, regardless of installation type
        await ensureExecutionPermissions();
        // Check if running with elevated privileges
        if (isRunningElevated()) {
            console.log((0, utils_1.colorText)('\n⚠️  WARNING: Running with elevated privileges (sudo/root)', 'yellow'));
            console.log((0, utils_1.colorText)("   User-level registration will be written to root's home directory,", 'yellow'));
            console.log((0, utils_1.colorText)('   which may not work correctly for your normal user account.', 'yellow'));
            console.log((0, utils_1.colorText)('\n   Please run the following command as your normal user after installation:', 'blue'));
            console.log(`   ${constant_1.COMMAND_NAME} register`);
            console.log((0, utils_1.colorText)('\n   Or if you need system-level installation, use:', 'blue'));
            console.log(`   sudo ${constant_1.COMMAND_NAME} register --system`);
            // Skip automatic registration when running as root
            return;
        }
        if (isGlobalInstall) {
            // First try user-level installation (no elevated permissions required)
            const userLevelSuccess = await (0, utils_1.tryRegisterUserLevelHost)();
            if (!userLevelSuccess) {
                // User-level installation failed, suggest using register command
                console.log((0, utils_1.colorText)('User-level installation failed, system-level installation may be needed', 'yellow'));
                console.log((0, utils_1.colorText)('Please run the following command for system-level installation:', 'blue'));
                console.log(`  ${constant_1.COMMAND_NAME} register --system`);
                printManualInstructions();
            }
        }
        else {
            // Local installation mode, don't attempt automatic registration
            console.log((0, utils_1.colorText)('Local installation detected, skipping automatic registration', 'yellow'));
            printManualInstructions();
        }
    }
    catch (error) {
        console.log((0, utils_1.colorText)(`Error during registration: ${error instanceof Error ? error.message : String(error)}`, 'red'));
        printManualInstructions();
    }
}
/**
 * Print manual installation guide
 */
function printManualInstructions() {
    console.log('\n' + (0, utils_1.colorText)('===== Manual Registration Guide =====', 'blue'));
    console.log((0, utils_1.colorText)('1. Try user-level installation (recommended):', 'yellow'));
    if (isGlobalInstall) {
        console.log(`  ${constant_1.COMMAND_NAME} register`);
    }
    else {
        console.log(`  npx ${constant_1.COMMAND_NAME} register`);
    }
    console.log((0, utils_1.colorText)('\n2. If user-level installation fails, try system-level installation:', 'yellow'));
    console.log((0, utils_1.colorText)('   Use --system parameter (requires admin privileges):', 'yellow'));
    if (isGlobalInstall) {
        console.log(`  ${constant_1.COMMAND_NAME} register --system`);
    }
    else {
        console.log(`  npx ${constant_1.COMMAND_NAME} register --system`);
    }
    console.log((0, utils_1.colorText)('\n   Or use administrator privileges directly:', 'yellow'));
    if (os_1.default.platform() === 'win32') {
        console.log((0, utils_1.colorText)('   Please run Command Prompt or PowerShell as administrator and execute:', 'yellow'));
        if (isGlobalInstall) {
            console.log(`  ${constant_1.COMMAND_NAME} register`);
        }
        else {
            console.log(`  npx ${constant_1.COMMAND_NAME} register`);
        }
    }
    else {
        console.log((0, utils_1.colorText)('   Please run the following command in terminal:', 'yellow'));
        if (isGlobalInstall) {
            console.log(`  sudo ${constant_1.COMMAND_NAME} register`);
        }
        else {
            console.log(`  sudo npx ${constant_1.COMMAND_NAME} register`);
        }
    }
    console.log('\n' +
        (0, utils_1.colorText)('Ensure Chrome extension is installed and refresh the extension to connect to local service.', 'blue'));
}
/**
 * Main function
 */
async function main() {
    console.log((0, utils_1.colorText)(`Installing ${constant_1.COMMAND_NAME}...`, 'green'));
    // Debug information
    console.log((0, utils_1.colorText)('Installation environment debug info:', 'blue'));
    console.log(`  __dirname: ${__dirname}`);
    console.log(`  npm_config_global: ${process.env.npm_config_global}`);
    console.log(`  PNPM_HOME: ${process.env.PNPM_HOME}`);
    console.log(`  npm_config_prefix: ${process.env.npm_config_prefix}`);
    console.log(`  isGlobalInstall: ${isGlobalInstall}`);
    // Always ensure execution permissions first
    await ensureExecutionPermissions();
    // Write Node.js path for run_host scripts to use
    (0, utils_1.writeNodePathFile)(path_1.default.join(__dirname, '..'));
    // If global installation, try automatic registration
    if (isGlobalInstall) {
        await tryRegisterNativeHost();
    }
    else {
        console.log((0, utils_1.colorText)('Local installation detected', 'yellow'));
        printManualInstructions();
    }
}
// Only execute main function when running this script directly
if (isDirectRun) {
    main().catch((error) => {
        console.error((0, utils_1.colorText)(`Installation script error: ${error instanceof Error ? error.message : String(error)}`, 'red'));
        // Set non-zero exit code to indicate installation failure
        process.exitCode = 1;
    });
}
//# sourceMappingURL=postinstall.js.map