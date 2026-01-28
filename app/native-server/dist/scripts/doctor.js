#!/usr/bin/env node
"use strict";
/**
 * doctor.ts
 *
 * Diagnoses common installation and runtime issues for the Chrome Native Messaging host.
 * Provides checks for manifest files, Node.js path, permissions, and connectivity.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectDoctorReport = collectDoctorReport;
exports.runDoctor = runDoctor;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const constant_1 = require("./constant");
const browser_config_1 = require("./browser-config");
const utils_1 = require("./utils");
const constant_2 = require("../constant");
const EXPECTED_PORT = 12306;
const SCHEMA_VERSION = 1;
const MIN_NODE_MAJOR_VERSION = 20;
// ============================================================================
// Utility Functions
// ============================================================================
function readPackageJson() {
    try {
        return require('../../package.json');
    }
    catch (_a) {
        return {};
    }
}
function getCommandInfo(pkg) {
    const bin = pkg.bin;
    if (!bin || typeof bin !== 'object') {
        return { canonical: constant_1.COMMAND_NAME, aliases: [] };
    }
    const canonical = constant_1.COMMAND_NAME;
    const canonicalTarget = bin[canonical];
    const aliases = canonicalTarget
        ? Object.keys(bin).filter((name) => name !== canonical && bin[name] === canonicalTarget)
        : [];
    return { canonical, aliases };
}
function resolveDistDir() {
    // __dirname is dist/scripts when running from compiled code
    const candidateFromDistScripts = path_1.default.resolve(__dirname, '..');
    const candidateFromSrcScripts = path_1.default.resolve(__dirname, '..', '..', 'dist');
    const looksLikeDist = (dir) => {
        return (fs_1.default.existsSync(path_1.default.join(dir, 'mcp', 'stdio-config.json')) ||
            fs_1.default.existsSync(path_1.default.join(dir, 'run_host.sh')) ||
            fs_1.default.existsSync(path_1.default.join(dir, 'run_host.bat')));
    };
    if (looksLikeDist(candidateFromDistScripts))
        return candidateFromDistScripts;
    if (looksLikeDist(candidateFromSrcScripts))
        return candidateFromSrcScripts;
    return candidateFromDistScripts;
}
function stringifyError(err) {
    if (err instanceof Error)
        return err.message;
    return String(err);
}
function canExecute(filePath) {
    try {
        fs_1.default.accessSync(filePath, fs_1.default.constants.X_OK);
        return true;
    }
    catch (_a) {
        return false;
    }
}
function normalizeComparablePath(filePath) {
    if (process.platform === 'win32') {
        return path_1.default.normalize(filePath).toLowerCase();
    }
    return path_1.default.normalize(filePath);
}
function stripOuterQuotes(input) {
    const trimmed = input.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}
function expandTilde(inputPath) {
    if (inputPath === '~')
        return os_1.default.homedir();
    if (inputPath.startsWith('~/') || inputPath.startsWith('~\\')) {
        return path_1.default.join(os_1.default.homedir(), inputPath.slice(2));
    }
    return inputPath;
}
function expandWindowsEnvVars(input) {
    if (process.platform !== 'win32')
        return input;
    return input.replace(/%([^%]+)%/g, (_match, name) => {
        var _a, _b, _c;
        const key = String(name);
        return ((_c = (_b = (_a = process.env[key]) !== null && _a !== void 0 ? _a : process.env[key.toUpperCase()]) !== null && _b !== void 0 ? _b : process.env[key.toLowerCase()]) !== null && _c !== void 0 ? _c : _match);
    });
}
function parseVersionFromDirName(dirName) {
    const cleaned = dirName.trim().replace(/^v/, '');
    if (!/^\d+(\.\d+){0,3}$/.test(cleaned))
        return null;
    return cleaned.split('.').map((part) => Number(part));
}
/**
 * Parse Node.js version string from `node -v` output.
 * Handles versions like: v20.10.0, v22.0.0-nightly.2024..., v21.0.0-rc.1
 * Returns major version number or null if parsing fails.
 */
function parseNodeMajorVersion(versionString) {
    if (!versionString)
        return null;
    // Match pattern: v?MAJOR.MINOR.PATCH[-anything]
    const match = versionString.trim().match(/^v?(\d+)(?:\.\d+)*(?:[-+].*)?$/i);
    if (match === null || match === void 0 ? void 0 : match[1]) {
        const major = Number(match[1]);
        return Number.isNaN(major) ? null : major;
    }
    return null;
}
function compareVersions(a, b) {
    var _a, _b;
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
        const av = (_a = a[i]) !== null && _a !== void 0 ? _a : 0;
        const bv = (_b = b[i]) !== null && _b !== void 0 ? _b : 0;
        if (av !== bv)
            return av - bv;
    }
    return 0;
}
function pickLatestVersionDir(parentDir) {
    if (!fs_1.default.existsSync(parentDir))
        return null;
    const dirents = fs_1.default.readdirSync(parentDir, { withFileTypes: true });
    let best = null;
    for (const dirent of dirents) {
        if (!dirent.isDirectory())
            continue;
        const parsed = parseVersionFromDirName(dirent.name);
        if (!parsed)
            continue;
        if (!best || compareVersions(parsed, best.version) > 0) {
            best = { name: dirent.name, version: parsed };
        }
    }
    return best ? path_1.default.join(parentDir, best.name) : null;
}
// ============================================================================
// Node Resolution (mirrors run_host.sh/bat logic)
// ============================================================================
function resolveNodeCandidate(distDir) {
    const nodeFileName = process.platform === 'win32' ? 'node.exe' : 'node';
    const nodePathFilePath = path_1.default.join(distDir, 'node_path.txt');
    const nodePathFile = {
        path: nodePathFilePath,
        exists: fs_1.default.existsSync(nodePathFilePath),
    };
    const consider = (source, rawCandidate) => {
        if (!rawCandidate)
            return null;
        let candidate = expandTilde(stripOuterQuotes(rawCandidate));
        try {
            if (fs_1.default.existsSync(candidate) && fs_1.default.statSync(candidate).isDirectory()) {
                candidate = path_1.default.join(candidate, nodeFileName);
            }
        }
        catch (_a) {
            // ignore
        }
        if (canExecute(candidate)) {
            return { nodePath: candidate, source };
        }
        return null;
    };
    // Priority 0: CHROME_MCP_NODE_PATH
    const fromEnv = consider('CHROME_MCP_NODE_PATH', process.env.CHROME_MCP_NODE_PATH);
    if (fromEnv) {
        return { ...fromEnv, nodePathFile };
    }
    // Priority 1: node_path.txt
    if (nodePathFile.exists) {
        try {
            const content = fs_1.default.readFileSync(nodePathFilePath, 'utf8').trim();
            nodePathFile.value = content;
            const fromFile = consider('node_path.txt', content);
            nodePathFile.valid = Boolean(fromFile);
            if (fromFile) {
                return { ...fromFile, nodePathFile };
            }
        }
        catch (e) {
            nodePathFile.error = stringifyError(e);
            nodePathFile.valid = false;
        }
    }
    // Priority 1.5: Relative path fallback (mirrors run_host.sh/bat)
    // Unix: ../../../bin/node (from dist/)
    // Windows: ..\..\..\node.exe (from dist/, no bin/ subdirectory)
    const relativeNodePath = process.platform === 'win32'
        ? path_1.default.resolve(distDir, '..', '..', '..', nodeFileName)
        : path_1.default.resolve(distDir, '..', '..', '..', 'bin', nodeFileName);
    const fromRelative = consider('relative', relativeNodePath);
    if (fromRelative)
        return { ...fromRelative, nodePathFile };
    // Priority 2: Volta
    const voltaHome = process.env.VOLTA_HOME || path_1.default.join(os_1.default.homedir(), '.volta');
    const fromVolta = consider('volta', path_1.default.join(voltaHome, 'bin', nodeFileName));
    if (fromVolta)
        return { ...fromVolta, nodePathFile };
    // Priority 3: asdf (cross-platform)
    const asdfDir = process.env.ASDF_DATA_DIR || path_1.default.join(os_1.default.homedir(), '.asdf');
    const asdfNodejsDir = path_1.default.join(asdfDir, 'installs', 'nodejs');
    const latestAsdf = pickLatestVersionDir(asdfNodejsDir);
    if (latestAsdf) {
        const fromAsdf = consider('asdf', path_1.default.join(latestAsdf, 'bin', nodeFileName));
        if (fromAsdf)
            return { ...fromAsdf, nodePathFile };
    }
    // Priority 4: fnm (cross-platform, Windows uses different layout)
    const fnmDir = process.env.FNM_DIR || path_1.default.join(os_1.default.homedir(), '.fnm');
    const fnmVersionsDir = path_1.default.join(fnmDir, 'node-versions');
    const latestFnm = pickLatestVersionDir(fnmVersionsDir);
    if (latestFnm) {
        const fnmNodePath = process.platform === 'win32'
            ? path_1.default.join(latestFnm, 'installation', nodeFileName)
            : path_1.default.join(latestFnm, 'installation', 'bin', nodeFileName);
        const fromFnm = consider('fnm', fnmNodePath);
        if (fromFnm)
            return { ...fromFnm, nodePathFile };
    }
    // Priority 5: NVM (Unix only)
    if (process.platform !== 'win32') {
        const nvmDir = process.env.NVM_DIR || path_1.default.join(os_1.default.homedir(), '.nvm');
        const nvmDefaultAlias = path_1.default.join(nvmDir, 'alias', 'default');
        try {
            if (fs_1.default.existsSync(nvmDefaultAlias)) {
                const stat = fs_1.default.lstatSync(nvmDefaultAlias);
                const maybeVersion = stat.isSymbolicLink()
                    ? fs_1.default.readlinkSync(nvmDefaultAlias).trim()
                    : fs_1.default.readFileSync(nvmDefaultAlias, 'utf8').trim();
                const fromDefault = consider('nvm-default', path_1.default.join(nvmDir, 'versions', 'node', maybeVersion, 'bin', 'node'));
                if (fromDefault)
                    return { ...fromDefault, nodePathFile };
            }
        }
        catch (_a) {
            // ignore
        }
        const latestNvm = pickLatestVersionDir(path_1.default.join(nvmDir, 'versions', 'node'));
        if (latestNvm) {
            const fromNvm = consider('nvm-latest', path_1.default.join(latestNvm, 'bin', 'node'));
            if (fromNvm)
                return { ...fromNvm, nodePathFile };
        }
    }
    // Priority 6: Common paths
    const commonPaths = process.platform === 'win32'
        ? [
            path_1.default.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'node.exe'),
            path_1.default.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'nodejs', 'node.exe'),
            path_1.default.join(process.env.LOCALAPPDATA || '', 'Programs', 'nodejs', 'node.exe'),
        ].filter((p) => path_1.default.isAbsolute(p))
        : ['/opt/homebrew/bin/node', '/usr/local/bin/node', '/usr/bin/node'];
    for (const common of commonPaths) {
        const resolved = consider('common', common);
        if (resolved)
            return { ...resolved, nodePathFile };
    }
    // Priority 7: PATH
    const pathEnv = process.env.PATH || '';
    for (const rawDir of pathEnv.split(path_1.default.delimiter)) {
        const dir = stripOuterQuotes(rawDir);
        if (!dir)
            continue;
        const candidate = path_1.default.join(dir, nodeFileName);
        if (canExecute(candidate)) {
            return { nodePath: candidate, source: 'PATH', nodePathFile };
        }
    }
    return { nodePathFile };
}
// ============================================================================
// Browser Resolution
// ============================================================================
function resolveTargetBrowsers(browserArg) {
    if (!browserArg)
        return undefined;
    const normalized = browserArg.toLowerCase();
    if (normalized === 'all')
        return [browser_config_1.BrowserType.CHROME, browser_config_1.BrowserType.CHROMIUM];
    if (normalized === 'detect' || normalized === 'auto')
        return undefined;
    const parsed = (0, browser_config_1.parseBrowserType)(normalized);
    if (!parsed) {
        throw new Error(`Invalid browser: ${browserArg}. Use 'chrome', 'chromium', or 'all'`);
    }
    return [parsed];
}
function resolveBrowsersToCheck(requested) {
    if (requested && requested.length > 0)
        return requested;
    const detected = (0, browser_config_1.detectInstalledBrowsers)();
    if (detected.length > 0)
        return detected;
    return [browser_config_1.BrowserType.CHROME, browser_config_1.BrowserType.CHROMIUM];
}
function queryWindowsRegistryDefaultValue(registryKey) {
    try {
        const output = (0, child_process_1.execFileSync)('reg', ['query', registryKey, '/ve'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 2500,
            windowsHide: true,
        });
        const lines = output
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
        for (const line of lines) {
            const match = line.match(/\b(REG_SZ|REG_EXPAND_SZ)\b\s+(.*)$/i);
            if (match === null || match === void 0 ? void 0 : match[2]) {
                const valueType = match[1].toUpperCase();
                return { value: match[2].trim(), valueType };
            }
        }
        return { error: 'No REG_SZ/REG_EXPAND_SZ default value found' };
    }
    catch (e) {
        return { error: stringifyError(e) };
    }
}
// ============================================================================
// Fix Attempts
// ============================================================================
async function attemptFixes(enabled, silent, distDir, targetBrowsers) {
    if (!enabled)
        return [];
    const fixes = [];
    const logDir = (0, utils_1.getLogDir)();
    const nodePathFile = path_1.default.join(distDir, 'node_path.txt');
    const withMutedConsole = async (fn) => {
        if (!silent)
            return await fn();
        const originalLog = console.log;
        const originalInfo = console.info;
        const originalWarn = console.warn;
        const originalError = console.error;
        console.log = () => { };
        console.info = () => { };
        console.warn = () => { };
        console.error = () => { };
        try {
            return await fn();
        }
        finally {
            console.log = originalLog;
            console.info = originalInfo;
            console.warn = originalWarn;
            console.error = originalError;
        }
    };
    const attempt = async (id, description, action) => {
        try {
            await withMutedConsole(async () => {
                await action();
            });
            fixes.push({ id, description, success: true });
        }
        catch (e) {
            fixes.push({ id, description, success: false, error: stringifyError(e) });
        }
    };
    await attempt('logs', 'Ensure logs directory exists', async () => {
        fs_1.default.mkdirSync(logDir, { recursive: true });
    });
    await attempt('node_path', 'Write node_path.txt for run_host scripts', async () => {
        fs_1.default.writeFileSync(nodePathFile, process.execPath, 'utf8');
    });
    await attempt('permissions', 'Fix execution permissions for native host files', async () => {
        await (0, utils_1.ensureExecutionPermissions)();
    });
    await attempt('register', 'Re-register Native Messaging host (user-level)', async () => {
        const ok = await (0, utils_1.tryRegisterUserLevelHost)(targetBrowsers);
        if (!ok) {
            throw new Error('User-level registration failed');
        }
    });
    return fixes;
}
// ============================================================================
// JSON File Reading
// ============================================================================
function readJsonFile(filePath) {
    try {
        const raw = fs_1.default.readFileSync(filePath, 'utf8');
        return { ok: true, value: JSON.parse(raw) };
    }
    catch (e) {
        return { ok: false, error: stringifyError(e) };
    }
}
function resolveFetch() {
    var _a;
    if (typeof globalThis.fetch === 'function') {
        return globalThis.fetch.bind(globalThis);
    }
    try {
        const mod = require('node-fetch');
        return ((_a = mod.default) !== null && _a !== void 0 ? _a : mod);
    }
    catch (_b) {
        return null;
    }
}
async function checkConnectivity(url, timeoutMs) {
    const fetchFn = resolveFetch();
    if (!fetchFn) {
        return { ok: false, error: 'fetch is not available (requires Node.js >=18 or node-fetch)' };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    // Prevent timeout from keeping the process alive
    if (typeof timeout.unref === 'function') {
        timeout.unref();
    }
    try {
        const res = await fetchFn(url, { method: 'GET', signal: controller.signal });
        return { ok: res.ok, status: res.status };
    }
    catch (e) {
        const errMessage = e instanceof Error ? e.message : String(e);
        const errName = e instanceof Error ? e.name : '';
        if (errName === 'AbortError' || errMessage.toLowerCase().includes('abort')) {
            return { ok: false, error: `Timeout after ${timeoutMs}ms` };
        }
        return { ok: false, error: errMessage };
    }
    finally {
        clearTimeout(timeout);
    }
}
// ============================================================================
// Summary Computation
// ============================================================================
function computeSummary(checks) {
    let ok = 0;
    let warn = 0;
    let error = 0;
    for (const check of checks) {
        if (check.status === 'ok')
            ok++;
        else if (check.status === 'warn')
            warn++;
        else
            error++;
    }
    return { ok, warn, error };
}
function statusBadge(status) {
    if (status === 'ok')
        return (0, utils_1.colorText)('[OK]', 'green');
    if (status === 'warn')
        return (0, utils_1.colorText)('[WARN]', 'yellow');
    return (0, utils_1.colorText)('[ERROR]', 'red');
}
// ============================================================================
// Main Doctor Function
// ============================================================================
/**
 * Collect doctor report without outputting to console.
 * Used by both runDoctor and report command.
 */
async function collectDoctorReport(options) {
    const pkg = readPackageJson();
    const distDir = resolveDistDir();
    const rootDir = path_1.default.resolve(distDir, '..');
    const packageName = typeof pkg.name === 'string' ? pkg.name : 'mcp-chrome-bridge';
    const packageVersion = typeof pkg.version === 'string' ? pkg.version : 'unknown';
    const commandInfo = getCommandInfo(pkg);
    const targetBrowsers = resolveTargetBrowsers(options.browser);
    const browsersToCheck = resolveBrowsersToCheck(targetBrowsers);
    const wrapperScriptName = process.platform === 'win32' ? 'run_host.bat' : 'run_host.sh';
    const wrapperPath = path_1.default.resolve(distDir, wrapperScriptName);
    const nodeScriptPath = path_1.default.resolve(distDir, 'index.js');
    const logDir = (0, utils_1.getLogDir)();
    const stdioConfigPath = path_1.default.resolve(distDir, 'mcp', 'stdio-config.json');
    // Run fixes if requested
    const fixes = await attemptFixes(Boolean(options.fix), Boolean(options.json), distDir, targetBrowsers);
    const checks = [];
    const nextSteps = [];
    // Check 1: Installation info
    checks.push({
        id: 'installation',
        title: 'Installation',
        status: 'ok',
        message: `${packageName}@${packageVersion}, ${process.platform}-${process.arch}, node ${process.version}`,
        details: {
            packageRoot: rootDir,
            distDir,
            execPath: process.execPath,
            aliases: commandInfo.aliases,
        },
    });
    // Check 2: Host files
    const missingHostFiles = [];
    if (!fs_1.default.existsSync(wrapperPath))
        missingHostFiles.push(wrapperPath);
    if (!fs_1.default.existsSync(nodeScriptPath))
        missingHostFiles.push(nodeScriptPath);
    if (!fs_1.default.existsSync(stdioConfigPath))
        missingHostFiles.push(stdioConfigPath);
    if (missingHostFiles.length > 0) {
        checks.push({
            id: 'host.files',
            title: 'Host files',
            status: 'error',
            message: `Missing required files (${missingHostFiles.length})`,
            details: { missing: missingHostFiles },
        });
        nextSteps.push(`Reinstall: npm install -g ${constant_1.COMMAND_NAME}`);
    }
    else {
        checks.push({
            id: 'host.files',
            title: 'Host files',
            status: 'ok',
            message: `Wrapper: ${wrapperPath}`,
            details: { wrapperPath, nodeScriptPath, stdioConfigPath },
        });
    }
    // Check 3: Permissions (Unix only)
    if (process.platform !== 'win32' && fs_1.default.existsSync(wrapperPath)) {
        const executable = canExecute(wrapperPath);
        checks.push({
            id: 'host.permissions',
            title: 'Host permissions',
            status: executable ? 'ok' : 'error',
            message: executable ? 'run_host.sh is executable' : 'run_host.sh is not executable',
            details: {
                path: wrapperPath,
                fix: executable
                    ? undefined
                    : [`${constant_1.COMMAND_NAME} fix-permissions`, `chmod +x "${wrapperPath}"`],
            },
        });
        if (!executable)
            nextSteps.push(`${constant_1.COMMAND_NAME} fix-permissions`);
    }
    else {
        checks.push({
            id: 'host.permissions',
            title: 'Host permissions',
            status: 'ok',
            message: process.platform === 'win32' ? 'Not applicable on Windows' : 'N/A',
        });
    }
    // Check 4: Node resolution
    const nodeResolution = resolveNodeCandidate(distDir);
    if (nodeResolution.nodePath) {
        try {
            nodeResolution.version = (0, child_process_1.execFileSync)(nodeResolution.nodePath, ['-v'], {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: 2500,
                windowsHide: true,
            }).trim();
        }
        catch (e) {
            nodeResolution.versionError = stringifyError(e);
        }
    }
    // Parse Node version and check if it meets minimum requirement
    const nodeMajorVersion = parseNodeMajorVersion(nodeResolution.version || '');
    const nodeVersionTooOld = nodeMajorVersion !== null && nodeMajorVersion < MIN_NODE_MAJOR_VERSION;
    const nodePathWarn = Boolean(nodeResolution.nodePath) &&
        (!nodeResolution.nodePathFile.exists || nodeResolution.nodePathFile.valid === false) &&
        !process.env.CHROME_MCP_NODE_PATH;
    // Determine node check status: error if not found or version too old, warn if path issue
    let nodeStatus = 'ok';
    let nodeMessage;
    let nodeFix;
    if (!nodeResolution.nodePath) {
        nodeStatus = 'error';
        nodeMessage = 'Node.js executable not found by wrapper search order';
        nodeFix = [
            `${constant_1.COMMAND_NAME} doctor --fix`,
            `Or set CHROME_MCP_NODE_PATH to an absolute node path`,
        ];
        nextSteps.push(`${constant_1.COMMAND_NAME} doctor --fix`);
    }
    else if (nodeResolution.versionError) {
        nodeStatus = 'error';
        nodeMessage = `Found ${nodeResolution.source}: ${nodeResolution.nodePath} but failed to run "node -v" (${nodeResolution.versionError})`;
        nodeFix = [
            `Verify the executable: "${nodeResolution.nodePath}" -v`,
            `Reinstall/repair Node.js`,
        ];
        nextSteps.push(`Verify Node.js: "${nodeResolution.nodePath}" -v`);
    }
    else if (nodeVersionTooOld) {
        nodeStatus = 'error';
        nodeMessage = `Node.js ${nodeResolution.version} is too old (requires >= ${MIN_NODE_MAJOR_VERSION}.0.0)`;
        nodeFix = [`Upgrade Node.js to version ${MIN_NODE_MAJOR_VERSION} or higher`];
        nextSteps.push(`Upgrade Node.js to version ${MIN_NODE_MAJOR_VERSION}+`);
    }
    else if (nodePathWarn) {
        nodeStatus = 'warn';
        nodeMessage = `Using ${nodeResolution.source}: ${nodeResolution.nodePath}${nodeResolution.version ? ` (${nodeResolution.version})` : ''}`;
        nodeFix = [
            `${constant_1.COMMAND_NAME} doctor --fix`,
            `Or set CHROME_MCP_NODE_PATH to an absolute node path`,
        ];
    }
    else {
        nodeStatus = 'ok';
        nodeMessage = `Using ${nodeResolution.source}: ${nodeResolution.nodePath}${nodeResolution.version ? ` (${nodeResolution.version})` : ''}`;
    }
    checks.push({
        id: 'node',
        title: 'Node executable',
        status: nodeStatus,
        message: nodeMessage,
        details: {
            resolved: nodeResolution.nodePath
                ? {
                    source: nodeResolution.source,
                    path: nodeResolution.nodePath,
                    version: nodeResolution.version,
                    versionError: nodeResolution.versionError,
                    majorVersion: nodeMajorVersion,
                }
                : undefined,
            nodePathFile: nodeResolution.nodePathFile,
            minRequired: `>=${MIN_NODE_MAJOR_VERSION}.0.0`,
            fix: nodeFix,
        },
    });
    // Check 5: Manifest checks per browser
    for (const browser of browsersToCheck) {
        const config = (0, browser_config_1.getBrowserConfig)(browser);
        const candidates = [config.userManifestPath, config.systemManifestPath];
        const found = candidates.find((p) => fs_1.default.existsSync(p));
        if (!found) {
            checks.push({
                id: `manifest.${browser}`,
                title: `${config.displayName} manifest`,
                status: 'error',
                message: 'Manifest not found',
                details: {
                    expected: candidates,
                    fix: [
                        `${constant_1.COMMAND_NAME} register --browser ${browser}`,
                        `${constant_1.COMMAND_NAME} register --detect`,
                    ],
                },
            });
            nextSteps.push(`${constant_1.COMMAND_NAME} register --detect`);
            continue;
        }
        const parsed = readJsonFile(found);
        if (!parsed.ok) {
            checks.push({
                id: `manifest.${browser}`,
                title: `${config.displayName} manifest`,
                status: 'error',
                message: `Failed to parse manifest: ${parsed.error}`,
                details: { path: found, fix: [`${constant_1.COMMAND_NAME} register --browser ${browser}`] },
            });
            nextSteps.push(`${constant_1.COMMAND_NAME} register --browser ${browser}`);
            continue;
        }
        const manifest = parsed.value;
        const issues = [];
        if (manifest.name !== constant_1.HOST_NAME)
            issues.push(`name != ${constant_1.HOST_NAME}`);
        if (manifest.type !== 'stdio')
            issues.push(`type != stdio`);
        if (typeof manifest.path !== 'string')
            issues.push('path is missing');
        if (typeof manifest.path === 'string') {
            const actual = normalizeComparablePath(manifest.path);
            const expected = normalizeComparablePath(wrapperPath);
            if (actual !== expected)
                issues.push('path does not match installed wrapper');
            if (!fs_1.default.existsSync(manifest.path))
                issues.push('path target does not exist');
        }
        const expectedOrigins = constant_1.EXTENSION_IDS.map((id) => `chrome-extension://${id}/`);
        const allowedOrigins = manifest.allowed_origins;
        const hasValidOrigin = Array.isArray(allowedOrigins) &&
            expectedOrigins.some((origin) => allowedOrigins.includes(origin));
        if (!hasValidOrigin) {
            issues.push(`allowed_origins mismatch (expected one of ${constant_1.EXTENSION_IDS.join(', ')})`);
        }
        checks.push({
            id: `manifest.${browser}`,
            title: `${config.displayName} manifest`,
            status: issues.length === 0 ? 'ok' : 'error',
            message: issues.length === 0 ? found : `Invalid manifest (${issues.join('; ')})`,
            details: {
                path: found,
                expectedWrapperPath: wrapperPath,
                expectedOrigins,
                fix: issues.length === 0 ? undefined : [`${constant_1.COMMAND_NAME} register --browser ${browser}`],
            },
        });
        if (issues.length > 0)
            nextSteps.push(`${constant_1.COMMAND_NAME} register --browser ${browser}`);
    }
    // Check 6: Windows registry (Windows only)
    if (process.platform === 'win32') {
        for (const browser of browsersToCheck) {
            const config = (0, browser_config_1.getBrowserConfig)(browser);
            const keySpecs = [
                config.registryKey ? { key: config.registryKey, expected: config.userManifestPath } : null,
                config.systemRegistryKey
                    ? { key: config.systemRegistryKey, expected: config.systemManifestPath }
                    : null,
            ].filter(Boolean);
            if (keySpecs.length === 0)
                continue;
            let anyValue = false;
            let anyExistingTarget = false;
            let anyMissingTarget = false;
            let anyMismatch = false;
            const results = [];
            for (const spec of keySpecs) {
                const res = queryWindowsRegistryDefaultValue(spec.key);
                if (!res.value) {
                    results.push({ key: spec.key, expected: spec.expected, error: res.error });
                    continue;
                }
                anyValue = true;
                // Expand environment variables for REG_EXPAND_SZ values
                const expandedValue = expandWindowsEnvVars(stripOuterQuotes(res.value));
                const exists = fs_1.default.existsSync(expandedValue);
                const matchesExpected = normalizeComparablePath(expandedValue) === normalizeComparablePath(spec.expected);
                if (exists) {
                    anyExistingTarget = true;
                    if (!matchesExpected)
                        anyMismatch = true;
                }
                else {
                    anyMissingTarget = true;
                }
                results.push({
                    key: spec.key,
                    expected: spec.expected,
                    value: res.value,
                    valueType: res.valueType,
                    expandedValue: expandedValue !== res.value ? expandedValue : undefined,
                    exists,
                    matchesExpected,
                });
            }
            let status = 'error';
            let message = 'Registry entry not found';
            if (!anyValue) {
                status = 'error';
                message = 'Registry entry not found';
            }
            else if (!anyExistingTarget) {
                status = 'error';
                message = 'Registry entry points to missing manifest';
            }
            else if (anyMissingTarget || anyMismatch) {
                status = 'warn';
                message = 'Registry entry found but inconsistent';
            }
            else {
                status = 'ok';
                message = 'Registry entry points to manifest';
            }
            checks.push({
                id: `registry.${browser}`,
                title: `${config.displayName} registry`,
                status,
                message,
                details: {
                    keys: keySpecs.map((s) => s.key),
                    results,
                    fix: status === 'ok' ? undefined : [`${constant_1.COMMAND_NAME} register --browser ${browser}`],
                },
            });
            if (status !== 'ok')
                nextSteps.push(`${constant_1.COMMAND_NAME} register --browser ${browser}`);
        }
    }
    // Check 7: Port configuration
    if (fs_1.default.existsSync(stdioConfigPath)) {
        const cfg = readJsonFile(stdioConfigPath);
        if (!cfg.ok) {
            checks.push({
                id: 'port.config',
                title: 'Port config',
                status: 'error',
                message: `Failed to parse stdio-config.json: ${cfg.error}`,
            });
        }
        else {
            try {
                const configValue = cfg.value;
                const url = new URL(configValue.url);
                const port = Number(url.port);
                const portOk = port === EXPECTED_PORT;
                checks.push({
                    id: 'port.config',
                    title: 'Port config',
                    status: portOk ? 'ok' : 'error',
                    message: configValue.url,
                    details: {
                        expectedPort: EXPECTED_PORT,
                        actualPort: port,
                        fix: portOk ? undefined : [`${constant_1.COMMAND_NAME} update-port ${EXPECTED_PORT}`],
                    },
                });
                if (!portOk)
                    nextSteps.push(`${constant_1.COMMAND_NAME} update-port ${EXPECTED_PORT}`);
                // Check constant consistency
                const nativePortOk = constant_2.NATIVE_SERVER_PORT === EXPECTED_PORT;
                checks.push({
                    id: 'port.constant',
                    title: 'Port constant',
                    status: nativePortOk ? 'ok' : 'warn',
                    message: `NATIVE_SERVER_PORT=${constant_2.NATIVE_SERVER_PORT}`,
                    details: { expectedPort: EXPECTED_PORT },
                });
                // Connectivity check
                const pingUrl = new URL('/ping', url);
                const ping = await checkConnectivity(pingUrl.toString(), 1500);
                checks.push({
                    id: 'connectivity',
                    title: 'Connectivity',
                    status: ping.ok ? 'ok' : 'warn',
                    message: ping.ok
                        ? `GET ${pingUrl} -> ${ping.status}`
                        : `GET ${pingUrl} failed (${ping.error || 'unknown error'})`,
                    details: {
                        hint: 'If the server is not running, click "Connect" in the extension and retry.',
                    },
                });
                if (!ping.ok)
                    nextSteps.push('Click "Connect" in the extension, then re-run doctor');
            }
            catch (e) {
                checks.push({
                    id: 'port.config',
                    title: 'Port config',
                    status: 'error',
                    message: `Invalid URL in stdio-config.json: ${stringifyError(e)}`,
                });
            }
        }
    }
    // Check 8: Logs directory
    checks.push({
        id: 'logs',
        title: 'Logs',
        status: fs_1.default.existsSync(logDir) ? 'ok' : 'warn',
        message: logDir,
        details: {
            hint: 'Wrapper logs are created when Chrome launches the native host.',
        },
    });
    // Compute summary
    const summary = computeSummary(checks);
    const ok = summary.error === 0;
    const report = {
        schemaVersion: SCHEMA_VERSION,
        timestamp: new Date().toISOString(),
        ok,
        summary,
        environment: {
            platform: process.platform,
            arch: process.arch,
            node: { version: process.version, execPath: process.execPath },
            package: { name: packageName, version: packageVersion, rootDir, distDir },
            command: { canonical: commandInfo.canonical, aliases: commandInfo.aliases },
            nativeHost: { hostName: constant_1.HOST_NAME, expectedPort: EXPECTED_PORT },
        },
        fixes,
        checks,
        nextSteps: Array.from(new Set(nextSteps)).slice(0, 10),
    };
    return report;
}
/**
 * Run doctor command with console output.
 */
async function runDoctor(options) {
    var _a;
    const report = await collectDoctorReport(options);
    const packageVersion = report.environment.package.version;
    // Output
    if (options.json) {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    }
    else {
        console.log(`${constant_1.COMMAND_NAME} doctor v${packageVersion}\n`);
        for (const check of report.checks) {
            console.log(`${statusBadge(check.status)}    ${check.title}: ${check.message}`);
            const fix = (_a = check.details) === null || _a === void 0 ? void 0 : _a.fix;
            if (check.status !== 'ok' && fix && fix.length > 0) {
                console.log(`        Fix: ${fix[0]}`);
            }
        }
        if (report.fixes.length > 0) {
            console.log('\nFix attempts:');
            for (const f of report.fixes) {
                const badge = f.success ? (0, utils_1.colorText)('[OK]', 'green') : (0, utils_1.colorText)('[ERROR]', 'red');
                console.log(`${badge} ${f.description}${f.success ? '' : ` (${f.error})`}`);
            }
        }
        if (report.nextSteps.length > 0) {
            console.log('\nNext steps:');
            report.nextSteps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
        }
    }
    return report.ok ? 0 : 1;
}
//# sourceMappingURL=doctor.js.map