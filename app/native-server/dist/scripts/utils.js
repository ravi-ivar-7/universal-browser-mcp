"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeFile = exports.mkdir = exports.access = void 0;
exports.getLogDir = getLogDir;
exports.colorText = colorText;
exports.getUserManifestPath = getUserManifestPath;
exports.getSystemManifestPath = getSystemManifestPath;
exports.getMainPath = getMainPath;
exports.writeNodePathFile = writeNodePathFile;
exports.ensureExecutionPermissions = ensureExecutionPermissions;
exports.createManifestContent = createManifestContent;
exports.registerUserLevelHostWithNodePath = registerUserLevelHostWithNodePath;
exports.tryRegisterUserLevelHost = tryRegisterUserLevelHost;
exports.registerWithElevatedPermissions = registerWithElevatedPermissions;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const constant_1 = require("./constant");
const browser_config_1 = require("./browser-config");
exports.access = (0, util_1.promisify)(fs_1.default.access);
exports.mkdir = (0, util_1.promisify)(fs_1.default.mkdir);
exports.writeFile = (0, util_1.promisify)(fs_1.default.writeFile);
/**
 * Get the log directory path for wrapper scripts.
 * Uses platform-appropriate user directories to avoid permission issues.
 *
 * - macOS: ~/Library/Logs/mcp-chrome-bridge
 * - Windows: %LOCALAPPDATA%/mcp-chrome-bridge/logs
 * - Linux: $XDG_STATE_HOME/mcp-chrome-bridge/logs or ~/.local/state/mcp-chrome-bridge/logs
 */
function getLogDir() {
    const homedir = os_1.default.homedir();
    if (os_1.default.platform() === 'darwin') {
        return path_1.default.join(homedir, 'Library', 'Logs', 'mcp-chrome-bridge');
    }
    else if (os_1.default.platform() === 'win32') {
        return path_1.default.join(process.env.LOCALAPPDATA || path_1.default.join(homedir, 'AppData', 'Local'), 'mcp-chrome-bridge', 'logs');
    }
    else {
        // Linux: XDG_STATE_HOME or ~/.local/state
        const xdgState = process.env.XDG_STATE_HOME || path_1.default.join(homedir, '.local', 'state');
        return path_1.default.join(xdgState, 'mcp-chrome-bridge', 'logs');
    }
}
/**
 * Print colored text
 */
function colorText(text, color) {
    const colors = {
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        reset: '\x1b[0m',
    };
    return colors[color] + text + colors.reset;
}
/**
 * Get user-level manifest file path
 */
function getUserManifestPath() {
    if (os_1.default.platform() === 'win32') {
        // Windows: %APPDATA%\Google\Chrome\NativeMessagingHosts\
        return path_1.default.join(process.env.APPDATA || path_1.default.join(os_1.default.homedir(), 'AppData', 'Roaming'), 'Google', 'Chrome', 'NativeMessagingHosts', `${constant_1.HOST_NAME}.json`);
    }
    else if (os_1.default.platform() === 'darwin') {
        // macOS: ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/
        return path_1.default.join(os_1.default.homedir(), 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts', `${constant_1.HOST_NAME}.json`);
    }
    else {
        // Linux: ~/.config/google-chrome/NativeMessagingHosts/
        return path_1.default.join(os_1.default.homedir(), '.config', 'google-chrome', 'NativeMessagingHosts', `${constant_1.HOST_NAME}.json`);
    }
}
/**
 * Get system-level manifest file path
 */
function getSystemManifestPath() {
    if (os_1.default.platform() === 'win32') {
        // Windows: %ProgramFiles%\Google\Chrome\NativeMessagingHosts\
        return path_1.default.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'NativeMessagingHosts', `${constant_1.HOST_NAME}.json`);
    }
    else if (os_1.default.platform() === 'darwin') {
        // macOS: /Library/Google/Chrome/NativeMessagingHosts/
        return path_1.default.join('/Library', 'Google', 'Chrome', 'NativeMessagingHosts', `${constant_1.HOST_NAME}.json`);
    }
    else {
        // Linux: /etc/opt/chrome/native-messaging-hosts/
        return path_1.default.join('/etc', 'opt', 'chrome', 'native-messaging-hosts', `${constant_1.HOST_NAME}.json`);
    }
}
/**
 * Get native host startup script file path
 */
async function getMainPath() {
    try {
        const packageDistDir = path_1.default.join(__dirname, '..');
        const wrapperScriptName = process.platform === 'win32' ? 'run_host.bat' : 'run_host.sh';
        const absoluteWrapperPath = path_1.default.resolve(packageDistDir, wrapperScriptName);
        return absoluteWrapperPath;
    }
    catch (error) {
        console.log(colorText('Cannot find global package path, using current directory', 'yellow'));
        throw error;
    }
}
/**
 * Write Node.js executable path to node_path.txt for run_host scripts.
 * This ensures the native host uses the same Node.js version that was used during installation,
 * avoiding NODE_MODULE_VERSION mismatch errors with native modules like better-sqlite3.
 *
 * @param distDir - The dist directory where node_path.txt should be written
 * @param nodeExecPath - The Node.js executable path to write (defaults to current process.execPath)
 */
function writeNodePathFile(distDir, nodeExecPath = process.execPath) {
    try {
        const nodePathFile = path_1.default.join(distDir, 'node_path.txt');
        fs_1.default.mkdirSync(distDir, { recursive: true });
        console.log(colorText(`Writing Node.js path: ${nodeExecPath}`, 'blue'));
        fs_1.default.writeFileSync(nodePathFile, nodeExecPath, 'utf8');
        console.log(colorText('✓ Node.js path written for run_host scripts', 'green'));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(colorText(`⚠️ Failed to write Node.js path: ${message}`, 'yellow'));
    }
}
/**
 * Ensure execution permissions for critical files
 */
async function ensureExecutionPermissions() {
    try {
        const packageDistDir = path_1.default.join(__dirname, '..');
        if (process.platform === 'win32') {
            // Windows platform handling
            await ensureWindowsFilePermissions(packageDistDir);
            return;
            // ... (rest of ensureExecutionPermissions body)
        }
        // Unix/Linux platform handling
        const filesToCheck = [
            path_1.default.join(packageDistDir, 'index.js'),
            path_1.default.join(packageDistDir, 'run_host.sh'),
            path_1.default.join(packageDistDir, 'cli.js'),
        ];
        for (const filePath of filesToCheck) {
            if (fs_1.default.existsSync(filePath)) {
                try {
                    fs_1.default.chmodSync(filePath, '755');
                    console.log(colorText(`✓ Set execution permissions for ${path_1.default.basename(filePath)}`, 'green'));
                }
                catch (err) {
                    console.warn(colorText(`⚠️ Unable to set execution permissions for ${path_1.default.basename(filePath)}: ${err.message}`, 'yellow'));
                }
            }
            else {
                console.warn(colorText(`⚠️ File not found: ${filePath}`, 'yellow'));
            }
        }
    }
    catch (error) {
        console.warn(colorText(`⚠️ Error ensuring execution permissions: ${error.message}`, 'yellow'));
    }
}
/**
 * Windows platform file permission handling
 */
async function ensureWindowsFilePermissions(packageDistDir) {
    const filesToCheck = [
        path_1.default.join(packageDistDir, 'index.js'),
        path_1.default.join(packageDistDir, 'run_host.bat'),
        path_1.default.join(packageDistDir, 'cli.js'),
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
                    console.log(colorText(`✓ Removed read-only attribute from ${path_1.default.basename(filePath)}`, 'green'));
                }
                // Verify file accessibility
                fs_1.default.accessSync(filePath, fs_1.default.constants.R_OK);
                console.log(colorText(`✓ Verified file accessibility for ${path_1.default.basename(filePath)}`, 'green'));
            }
            catch (err) {
                console.warn(colorText(`⚠️ Unable to verify file permissions for ${path_1.default.basename(filePath)}: ${err.message}`, 'yellow'));
            }
        }
        else {
            console.warn(colorText(`⚠️ File not found: ${filePath}`, 'yellow'));
        }
    }
}
// ... existing code ...
/**
 * Create Native Messaging host manifest content
 */
async function createManifestContent() {
    const mainPath = await getMainPath();
    return {
        name: constant_1.HOST_NAME,
        description: constant_1.DESCRIPTION,
        path: mainPath, // Node.js executable path
        type: 'stdio',
        allowed_origins: constant_1.EXTENSION_IDS.map((id) => `chrome-extension://${id}/`),
    };
}
/**
 * Verify if Windows registry key exists and points to the correct path
 */
function verifyWindowsRegistryEntry(registryKey, expectedPath) {
    if (os_1.default.platform() !== 'win32') {
        return true; // Skip verification for non-Windows platforms
    }
    const normalizeForCompare = (filePath) => path_1.default.normalize(filePath).toLowerCase();
    try {
        const output = (0, child_process_1.execSync)(`reg query "${registryKey}" /ve`, {
            encoding: 'utf8',
            stdio: 'pipe',
        });
        const lines = output
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
        for (const line of lines) {
            const match = line.match(/REG_SZ\s+(.*)$/i);
            if (!(match === null || match === void 0 ? void 0 : match[1]))
                continue;
            const actualPath = match[1].trim();
            return normalizeForCompare(actualPath) === normalizeForCompare(expectedPath);
        }
    }
    catch (_a) {
        // ignore
    }
    return false;
}
/**
 * Write node_path.txt and then register user-level Native Messaging host.
 * This is the recommended entry point for development and production registration,
 * as it ensures the Node.js path is captured before registration.
 *
 * @param browsers - Optional list of browsers to register for
 * @returns true if at least one browser was registered successfully
 */
async function registerUserLevelHostWithNodePath(browsers) {
    writeNodePathFile(path_1.default.join(__dirname, '..'));
    return tryRegisterUserLevelHost(browsers);
}
/**
 * Attempt to register user-level Native Messaging host
 */
async function tryRegisterUserLevelHost(targetBrowsers) {
    try {
        console.log(colorText('Attempting to register user-level Native Messaging host...', 'blue'));
        // 1. Ensure execution permissions
        await ensureExecutionPermissions();
        // 2. Determine browsers to register
        const browsersToRegister = targetBrowsers || (0, browser_config_1.detectInstalledBrowsers)();
        if (browsersToRegister.length === 0) {
            // If no browsers detected, default to Chrome and Chromium
            browsersToRegister.push(browser_config_1.BrowserType.CHROME, browser_config_1.BrowserType.CHROMIUM);
            console.log(colorText('No browsers detected, registering for Chrome and Chromium by default', 'yellow'));
        }
        else {
            console.log(colorText(`Detected browsers: ${browsersToRegister.join(', ')}`, 'blue'));
        }
        // 3. Create manifest content
        const manifest = await createManifestContent();
        let successCount = 0;
        const results = [];
        // 4. Register for each browser
        for (const browserType of browsersToRegister) {
            const config = (0, browser_config_1.getBrowserConfig)(browserType);
            console.log(colorText(`\nRegistering for ${config.displayName}...`, 'blue'));
            try {
                // Ensure directory exists
                await (0, exports.mkdir)(path_1.default.dirname(config.userManifestPath), { recursive: true });
                // Write manifest file
                await (0, exports.writeFile)(config.userManifestPath, JSON.stringify(manifest, null, 2));
                console.log(colorText(`✓ Manifest written to ${config.userManifestPath}`, 'green'));
                // Windows requires additional registry key
                if (os_1.default.platform() === 'win32' && config.registryKey) {
                    try {
                        // Note: backslashes don't need manual escaping, reg command handles Windows paths correctly
                        const regCommand = `reg add "${config.registryKey}" /ve /t REG_SZ /d "${config.userManifestPath}" /f`;
                        (0, child_process_1.execSync)(regCommand, { stdio: 'pipe' });
                        if (verifyWindowsRegistryEntry(config.registryKey, config.userManifestPath)) {
                            console.log(colorText(`✓ Registry entry created for ${config.displayName}`, 'green'));
                        }
                        else {
                            throw new Error('Registry verification failed');
                        }
                    }
                    catch (error) {
                        throw new Error(`Registry error: ${error.message}`);
                    }
                }
                successCount++;
                results.push({ browser: config.displayName, success: true });
                console.log(colorText(`✓ Successfully registered ${config.displayName}`, 'green'));
            }
            catch (error) {
                results.push({ browser: config.displayName, success: false, error: error.message });
                console.log(colorText(`✗ Failed to register ${config.displayName}: ${error.message}`, 'red'));
            }
        }
        // 5. Report results
        console.log(colorText('\n===== Registration Summary =====', 'blue'));
        for (const result of results) {
            if (result.success) {
                console.log(colorText(`✓ ${result.browser}: Success`, 'green'));
            }
            else {
                console.log(colorText(`✗ ${result.browser}: Failed - ${result.error}`, 'red'));
            }
        }
        return successCount > 0;
    }
    catch (error) {
        console.log(colorText(`User-level registration failed: ${error instanceof Error ? error.message : String(error)}`, 'yellow'));
        return false;
    }
}
// Import is-admin package (only used on Windows platform)
let isAdmin = () => false;
if (process.platform === 'win32') {
    try {
        isAdmin = require('is-admin');
    }
    catch (error) {
        console.warn('is-admin dependency missing, admin permission detection may fail on Windows');
        console.warn(error);
    }
}
/**
 * Register system-level manifest with elevated permissions
 */
async function registerWithElevatedPermissions() {
    try {
        console.log(colorText('Attempting to register system-level manifest...', 'blue'));
        // 1. Ensure execution permissions
        await ensureExecutionPermissions();
        // 2. Prepare manifest content
        const manifest = await createManifestContent();
        // 3. Get system-level manifest path
        const manifestPath = getSystemManifestPath();
        // 4. Create temporary manifest file
        const tempManifestPath = path_1.default.join(os_1.default.tmpdir(), `${constant_1.HOST_NAME}.json`);
        await (0, exports.writeFile)(tempManifestPath, JSON.stringify(manifest, null, 2));
        // 5. Check if already running with admin permissions
        const isRoot = process.getuid && process.getuid() === 0; // Unix/Linux/Mac
        const hasAdminRights = process.platform === 'win32' ? isAdmin() : false; // Windows platform admin check
        const hasElevatedPermissions = isRoot || hasAdminRights;
        // Prepare command
        const command = os_1.default.platform() === 'win32'
            ? `if not exist "${path_1.default.dirname(manifestPath)}" mkdir "${path_1.default.dirname(manifestPath)}" && copy "${tempManifestPath}" "${manifestPath}"`
            : `mkdir -p "${path_1.default.dirname(manifestPath)}" && cp "${tempManifestPath}" "${manifestPath}" && chmod 644 "${manifestPath}"`;
        if (hasElevatedPermissions) {
            // Already running with admin permissions, execute command directly
            try {
                // Create directory
                if (!fs_1.default.existsSync(path_1.default.dirname(manifestPath))) {
                    fs_1.default.mkdirSync(path_1.default.dirname(manifestPath), { recursive: true });
                }
                // Copy file
                fs_1.default.copyFileSync(tempManifestPath, manifestPath);
                // Set permissions (non-Windows platform)
                if (os_1.default.platform() !== 'win32') {
                    fs_1.default.chmodSync(manifestPath, '644');
                }
                console.log(colorText('System-level manifest registration successful!', 'green'));
            }
            catch (error) {
                console.error(colorText(`System-level manifest installation failed: ${error.message}`, 'red'));
                throw error;
            }
        }
        else {
            // No admin permissions, print manual instructions
            console.log(colorText('⚠️ Administrator privileges required for system-level installation', 'yellow'));
            // ... existing instructions ...
            console.log(colorText('Please run one of the following commands with administrator privileges:', 'blue'));
            if (os_1.default.platform() === 'win32') {
                console.log(colorText('  1. Open Command Prompt as Administrator and run:', 'blue'));
                console.log(colorText(`     ${command}`, 'cyan'));
            }
            else {
                console.log(colorText('  1. Run with sudo:', 'blue'));
                console.log(colorText(`     sudo ${command}`, 'cyan'));
            }
            console.log(colorText('  2. Or run the registration command with elevated privileges:', 'blue'));
            console.log(colorText(`     sudo ${constant_1.COMMAND_NAME} register --system`, 'cyan'));
            throw new Error('Administrator privileges required for system-level installation');
        }
        // 6. Windows special handling - Set system-level registry
        if (os_1.default.platform() === 'win32') {
            const registryKey = `HKLM\\Software\\Google\\Chrome\\NativeMessagingHosts\\${constant_1.HOST_NAME}`;
            // Note: backslashes don't need manual escaping, reg command handles Windows paths correctly
            const regCommand = `reg add "${registryKey}" /ve /t REG_SZ /d "${manifestPath}" /f`;
            console.log(colorText(`Creating system registry entry: ${registryKey}`, 'blue'));
            console.log(colorText(`Manifest path: ${manifestPath}`, 'blue'));
            if (hasElevatedPermissions) {
                // Already running with admin permissions, execute registry command directly
                try {
                    (0, child_process_1.execSync)(regCommand, { stdio: 'pipe' });
                    // Verify if registry entry was created successfully
                    if (verifyWindowsRegistryEntry(registryKey, manifestPath)) {
                        console.log(colorText('Windows registry entry created successfully!', 'green'));
                    }
                    else {
                        console.log(colorText('⚠️ Registry entry created but verification failed', 'yellow'));
                    }
                }
                catch (error) {
                    console.error(colorText(`Windows registry entry creation failed: ${error.message}`, 'red'));
                    console.error(colorText(`Command: ${regCommand}`, 'red'));
                    throw error;
                }
            }
            else {
                // No admin permissions, print manual instructions
                console.log(colorText('⚠️ Administrator privileges required for Windows registry modification', 'yellow'));
                console.log(colorText('Please run the following command as Administrator:', 'blue'));
                console.log(colorText(`  ${regCommand}`, 'cyan'));
                console.log(colorText('Or run the registration command with elevated privileges:', 'blue'));
                console.log(colorText(`  Run Command Prompt as Administrator and execute: ${constant_1.COMMAND_NAME} register --system`, 'cyan'));
                throw new Error('Administrator privileges required for Windows registry modification');
            }
        }
    }
    catch (error) {
        console.error(colorText(`Registration failed: ${error.message}`, 'red'));
        throw error;
    }
}
//# sourceMappingURL=utils.js.map