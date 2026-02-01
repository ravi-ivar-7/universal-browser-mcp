#!/usr/bin/env node
"use strict";
/**
 * report.ts
 *
 * Export a diagnostic report for GitHub Issues.
 * Collects system info, doctor output, logs, manifests, and registry info.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runReport = runReport;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const constant_1 = require("./constant");
const browser_config_1 = require("./browser-config");
const utils_1 = require("./utils");
const doctor_1 = require("./doctor");
const REPORT_SCHEMA_VERSION = 1;
const DEFAULT_LOG_LINES = 200;
const DEFAULT_TAIL_BYTES = 256 * 1024;
const MAX_LOG_FILES = 6;
const MAX_FULL_LOG_BYTES = 1024 * 1024;
function stringifyError(err) {
    if (err instanceof Error)
        return err.message;
    return String(err);
}
function readPackageJson() {
    try {
        return require('../../package.json');
    }
    catch (_a) {
        return {};
    }
}
function getToolVersion() {
    const pkg = readPackageJson();
    const name = typeof pkg.name === 'string' ? pkg.name : constant_1.COMMAND_NAME;
    const version = typeof pkg.version === 'string' ? pkg.version : 'unknown';
    return { name, version };
}
function safeOsVersion() {
    try {
        return os_1.default.version();
    }
    catch (_a) {
        return undefined;
    }
}
function safeExecVersion(command) {
    try {
        const out = (0, child_process_1.execFileSync)(command, ['-v'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 2500,
            windowsHide: true,
        });
        return { version: out.trim() };
    }
    catch (e) {
        return { error: stringifyError(e) };
    }
}
function parseIncludeLogsMode(raw) {
    const v = typeof raw === 'string' ? raw.toLowerCase() : '';
    if (v === 'none' || v === 'tail' || v === 'full')
        return v;
    return 'tail';
}
function parsePositiveInt(raw, fallback) {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0)
        return Math.floor(raw);
    if (typeof raw === 'string') {
        const parsed = Number.parseInt(raw, 10);
        if (Number.isFinite(parsed) && parsed > 0)
            return parsed;
    }
    return fallback;
}
function resolveBrowsers(browserArg) {
    if (!browserArg) {
        const detected = (0, browser_config_1.detectInstalledBrowsers)();
        return detected.length > 0 ? detected : [browser_config_1.BrowserType.CHROME, browser_config_1.BrowserType.CHROMIUM];
    }
    const normalized = browserArg.toLowerCase();
    if (normalized === 'all')
        return [browser_config_1.BrowserType.CHROME, browser_config_1.BrowserType.CHROMIUM];
    if (normalized === 'detect' || normalized === 'auto') {
        const detected = (0, browser_config_1.detectInstalledBrowsers)();
        return detected.length > 0 ? detected : [browser_config_1.BrowserType.CHROME, browser_config_1.BrowserType.CHROMIUM];
    }
    const parsed = (0, browser_config_1.parseBrowserType)(normalized);
    if (!parsed) {
        throw new Error(`Invalid browser: ${browserArg}. Use 'chrome', 'chromium', or 'all'`);
    }
    return [parsed];
}
function readJsonSnapshot(filePath) {
    try {
        if (!fs_1.default.existsSync(filePath))
            return { exists: false };
        const raw = fs_1.default.readFileSync(filePath, 'utf8');
        try {
            const json = JSON.parse(raw);
            return { exists: true, json };
        }
        catch (e) {
            return { exists: true, raw, error: `Failed to parse JSON: ${stringifyError(e)}` };
        }
    }
    catch (e) {
        return { exists: fs_1.default.existsSync(filePath), error: stringifyError(e) };
    }
}
function collectManifests(browsers) {
    const results = [];
    for (const browser of browsers) {
        const config = (0, browser_config_1.getBrowserConfig)(browser);
        for (const scope of ['user', 'system']) {
            const manifestPath = scope === 'user' ? config.userManifestPath : config.systemManifestPath;
            const snap = readJsonSnapshot(manifestPath);
            results.push({
                browser,
                scope,
                path: manifestPath,
                exists: snap.exists,
                json: snap.json,
                raw: snap.raw,
                error: snap.error,
            });
        }
    }
    return results;
}
function readFileTail(filePath, maxBytes, maxLines) {
    const stat = fs_1.default.statSync(filePath);
    const size = stat.size;
    const bytesToRead = Math.min(size, maxBytes);
    const start = Math.max(0, size - bytesToRead);
    const fd = fs_1.default.openSync(filePath, 'r');
    try {
        const buf = Buffer.alloc(bytesToRead);
        fs_1.default.readSync(fd, buf, 0, bytesToRead, start);
        const text = buf.toString('utf8');
        const lines = text.split(/\r?\n/);
        const tail = lines.slice(Math.max(0, lines.length - maxLines));
        return { content: tail.join('\n'), truncated: size > maxBytes || lines.length > maxLines };
    }
    finally {
        fs_1.default.closeSync(fd);
    }
}
function readFileLastBytes(filePath, maxBytes) {
    const stat = fs_1.default.statSync(filePath);
    const size = stat.size;
    if (size <= maxBytes) {
        const content = fs_1.default.readFileSync(filePath, 'utf8');
        return { content, truncated: false };
    }
    const bytesToRead = maxBytes;
    const start = Math.max(0, size - bytesToRead);
    const fd = fs_1.default.openSync(filePath, 'r');
    try {
        const buf = Buffer.alloc(bytesToRead);
        fs_1.default.readSync(fd, buf, 0, bytesToRead, start);
        const content = buf.toString('utf8');
        return { content, truncated: true };
    }
    finally {
        fs_1.default.closeSync(fd);
    }
}
function collectWrapperLogs(logDir, mode, logLines) {
    if (!fs_1.default.existsSync(logDir)) {
        return { dir: logDir, mode, files: [], error: 'Log directory does not exist' };
    }
    const prefixes = ['native_host_wrapper_', 'native_host_stderr_'];
    let entries = [];
    try {
        entries = fs_1.default.readdirSync(logDir, { withFileTypes: true });
    }
    catch (e) {
        return { dir: logDir, mode, files: [], error: stringifyError(e) };
    }
    const candidates = entries
        .filter((ent) => ent.isFile())
        .map((ent) => ent.name)
        .filter((name) => name.endsWith('.log') && prefixes.some((p) => name.startsWith(p)));
    const filesWithStat = [];
    for (const name of candidates) {
        const fullPath = path_1.default.join(logDir, name);
        try {
            const stat = fs_1.default.statSync(fullPath);
            filesWithStat.push({ name, fullPath, mtimeMs: stat.mtimeMs, size: stat.size });
        }
        catch (_a) {
            // ignore
        }
    }
    filesWithStat.sort((a, b) => b.mtimeMs - a.mtimeMs);
    const selected = filesWithStat.slice(0, MAX_LOG_FILES);
    const snapshots = [];
    for (const file of selected) {
        const snap = {
            name: file.name,
            path: file.fullPath,
            mtime: new Date(file.mtimeMs).toISOString(),
            size: file.size,
        };
        if (mode !== 'none') {
            try {
                if (mode === 'tail') {
                    const read = readFileTail(file.fullPath, DEFAULT_TAIL_BYTES, logLines);
                    snap.content = read.content;
                    snap.truncated = read.truncated;
                    snap.note = `Tail: last ${logLines} lines (from last ${DEFAULT_TAIL_BYTES} bytes)`;
                }
                else {
                    const read = readFileLastBytes(file.fullPath, MAX_FULL_LOG_BYTES);
                    snap.content = read.content;
                    snap.truncated = read.truncated;
                    snap.note = read.truncated
                        ? `Truncated: showing last ${MAX_FULL_LOG_BYTES} bytes`
                        : 'Full file';
                }
            }
            catch (e) {
                snap.error = stringifyError(e);
            }
        }
        else {
            snap.note = 'Content omitted';
        }
        snapshots.push(snap);
    }
    return { dir: logDir, mode, files: snapshots };
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
            const match = line.match(/REG_SZ\s+(.*)$/i);
            if (match === null || match === void 0 ? void 0 : match[1])
                return { value: match[1].trim(), raw: output };
        }
        return { raw: output, error: 'No REG_SZ default value found' };
    }
    catch (e) {
        return { error: stringifyError(e) };
    }
}
function collectWindowsRegistry(browsers) {
    const entries = [];
    for (const browser of browsers) {
        const config = (0, browser_config_1.getBrowserConfig)(browser);
        const keySpecs = [
            config.registryKey
                ? { key: config.registryKey, scope: 'user', expected: config.userManifestPath }
                : null,
            config.systemRegistryKey
                ? {
                    key: config.systemRegistryKey,
                    scope: 'system',
                    expected: config.systemManifestPath,
                }
                : null,
        ].filter(Boolean);
        for (const spec of keySpecs) {
            const res = queryWindowsRegistryDefaultValue(spec.key);
            entries.push({
                browser,
                scope: spec.scope,
                key: spec.key,
                expectedManifestPath: spec.expected,
                value: res.value,
                raw: res.raw,
                error: res.error,
            });
        }
    }
    return { entries };
}
// ============================================================================
// Redaction
// ============================================================================
function escapeRegExp(input) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function buildLiteralReplacements() {
    const replacements = [];
    const ignoreCase = process.platform === 'win32';
    const addLiteral = (literal, replacement) => {
        if (!literal)
            return;
        const variants = new Set();
        variants.add(literal);
        variants.add(literal.replace(/\\/g, '/'));
        variants.add(literal.replace(/\//g, '\\'));
        for (const v of variants) {
            if (!v)
                continue;
            replacements.push([new RegExp(escapeRegExp(v), ignoreCase ? 'gi' : 'g'), replacement]);
        }
    };
    addLiteral(os_1.default.homedir(), '<HOME>');
    addLiteral(process.env.USERPROFILE, '<USERPROFILE>');
    addLiteral(process.env.HOME, '<HOME>');
    try {
        const username = os_1.default.userInfo().username;
        if (username) {
            replacements.push([
                new RegExp(`\\b${escapeRegExp(username)}\\b`, ignoreCase ? 'gi' : 'g'),
                '<USER>',
            ]);
        }
    }
    catch (_a) {
        // ignore
    }
    return replacements;
}
function createRedactor(enabled) {
    if (!enabled)
        return (s) => s;
    const literalReplacements = buildLiteralReplacements();
    const patternReplacements = [
        // Sensitive key=value patterns (supports JSON-style "key": "value" and env-style KEY=value)
        [
            /(\b[A-Z0-9_]*(?:TOKEN|PASSWORD|SECRET|API_KEY|ACCESS_KEY|PRIVATE_KEY)\b)(\s*["']?\s*[:=]\s*["']?)([^\s"']+)/gi,
            '$1$2<REDACTED>',
        ],
        // HTTP Authorization headers
        [/(Authorization:\s*Bearer\s+)[^\s]+/gi, '$1<REDACTED>'],
        [/(Authorization:\s*Basic\s+)[^\s]+/gi, '$1<REDACTED>'],
        // JSON-style Authorization fields ("Authorization": "Bearer ...")
        [
            /(\bAuthorization\b)(\s*["']?\s*[:=]\s*["']?)(Bearer\s+|Basic\s+)?[^\s"']+/gi,
            '$1$2$3<REDACTED>',
        ],
        // Cookies
        [/(Cookie:\s*)[^\r\n]+/gi, '$1<REDACTED>'],
        [/(Set-Cookie:\s*)[^\r\n]+/gi, '$1<REDACTED>'],
        // JSON-style Cookie fields ("Cookie": "...")
        [/(\b(?:Cookie|Set-Cookie)\b)(\s*["']?\s*[:=]\s*["']?)[^\r\n"']+/gi, '$1$2<REDACTED>'],
        // Common API header patterns (supports JSON-style)
        [
            /(\b(?:x-api-key|api-key|x-auth-token|x-access-token)\b)(\s*["']?\s*[:=]\s*["']?)([^\s"']+)/gi,
            '$1$2<REDACTED>',
        ],
        // Email addresses
        [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '<EMAIL>'],
        // User paths (Windows and macOS/Linux)
        [/[A-Z]:\\Users\\[^\\]+/gi, '<USERPROFILE>'],
        [/\/Users\/[^/]+/g, '/Users/<USER>'],
    ];
    return (input) => {
        let out = input;
        for (const [re, replacement] of literalReplacements) {
            out = out.replace(re, replacement);
        }
        for (const [re, replacement] of patternReplacements) {
            out = out.replace(re, replacement);
        }
        return out;
    };
}
function redactDeep(value, redact) {
    if (typeof value === 'string')
        return redact(value);
    if (Array.isArray(value))
        return value.map((v) => redactDeep(v, redact));
    if (value && typeof value === 'object') {
        const obj = value;
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
            out[k] = redactDeep(v, redact);
        }
        return out;
    }
    return value;
}
// ============================================================================
// Output Rendering
// ============================================================================
function renderMarkdown(report) {
    var _a, _b, _c, _d, _e;
    const lines = [];
    lines.push(`# ${report.tool.name} Diagnostic Report`);
    lines.push('');
    lines.push(`**Generated:** ${report.timestamp}`);
    lines.push(`**Redaction:** ${report.redaction.enabled ? 'enabled (default)' : 'disabled'}`);
    lines.push('');
    lines.push('## Environment');
    lines.push('');
    lines.push(`- **Platform:** ${report.environment.platform} (${report.environment.arch})`);
    lines.push(`- **OS:** ${report.environment.os.type} ${report.environment.os.release}${report.environment.os.version ? ` (${report.environment.os.version})` : ''}`);
    lines.push(`- **Node:** ${report.environment.node.version}`);
    lines.push(`- **Node execPath:** \`${report.environment.node.execPath}\``);
    lines.push(`- **CWD:** \`${report.environment.cwd}\``);
    lines.push('');
    lines.push('## Package Managers');
    lines.push('');
    lines.push(`- **npm:** ${(_a = report.packageManager.npm.version) !== null && _a !== void 0 ? _a : `ERROR: ${(_b = report.packageManager.npm.error) !== null && _b !== void 0 ? _b : 'unknown'}`}`);
    lines.push(`- **pnpm:** ${(_c = report.packageManager.pnpm.version) !== null && _c !== void 0 ? _c : `ERROR: ${(_d = report.packageManager.pnpm.error) !== null && _d !== void 0 ? _d : 'unknown'}`}`);
    lines.push('');
    lines.push('## Relevant Environment Variables');
    lines.push('');
    for (const [k, v] of Object.entries(report.environment.env)) {
        lines.push(`- \`${k}\`: ${v !== null && v !== void 0 ? v : '<unset>'}`);
    }
    lines.push('');
    lines.push('## Doctor Output');
    lines.push('');
    if (report.doctor) {
        lines.push('<details>');
        lines.push('<summary>Click to expand doctor JSON</summary>');
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(report.doctor, null, 2));
        lines.push('```');
        lines.push('</details>');
    }
    else {
        lines.push(`**Doctor failed:** ${(_e = report.doctorError) !== null && _e !== void 0 ? _e : 'unknown error'}`);
    }
    lines.push('');
    lines.push('## Wrapper Logs');
    lines.push('');
    lines.push(`**Log directory:** \`${report.wrapperLogs.dir}\``);
    lines.push(`**Mode:** ${report.wrapperLogs.mode}`);
    if (report.wrapperLogs.error) {
        lines.push(`**Error:** ${report.wrapperLogs.error}`);
    }
    lines.push('');
    if (report.wrapperLogs.files.length === 0) {
        lines.push('No wrapper logs found.');
    }
    else {
        for (const f of report.wrapperLogs.files) {
            lines.push(`### ${f.name}`);
            lines.push('');
            lines.push(`- **Path:** \`${f.path}\``);
            if (f.mtime)
                lines.push(`- **Modified:** ${f.mtime}`);
            if (typeof f.size === 'number')
                lines.push(`- **Size:** ${f.size} bytes`);
            if (f.note)
                lines.push(`- **Note:** ${f.note}`);
            if (f.error) {
                lines.push(`- **Error:** ${f.error}`);
                lines.push('');
                continue;
            }
            if (typeof f.content === 'string') {
                if (f.truncated)
                    lines.push('*(Truncated)*');
                lines.push('');
                lines.push('<details>');
                lines.push('<summary>Click to expand log content</summary>');
                lines.push('');
                lines.push('```text');
                lines.push(f.content);
                lines.push('```');
                lines.push('</details>');
            }
            else {
                lines.push('*(Content omitted)*');
            }
            lines.push('');
        }
    }
    lines.push('');
    lines.push('## Manifests');
    lines.push('');
    for (const m of report.manifests) {
        lines.push(`### ${m.browser} (${m.scope})`);
        lines.push('');
        lines.push(`- **Path:** \`${m.path}\``);
        if (!m.exists) {
            lines.push('- **Status:** not found');
            lines.push('');
            continue;
        }
        if (m.error) {
            lines.push(`- **Status:** error (${m.error})`);
        }
        if (m.json !== undefined) {
            lines.push('');
            lines.push('```json');
            lines.push(JSON.stringify(m.json, null, 2));
            lines.push('```');
        }
        else if (typeof m.raw === 'string') {
            lines.push('');
            lines.push('```text');
            lines.push(m.raw);
            lines.push('```');
        }
        lines.push('');
    }
    if (report.windowsRegistry) {
        lines.push('## Windows Registry');
        lines.push('');
        for (const entry of report.windowsRegistry.entries) {
            lines.push(`### ${entry.browser} (${entry.scope})`);
            lines.push('');
            lines.push(`- **Key:** \`${entry.key}\``);
            lines.push(`- **Expected manifest:** \`${entry.expectedManifestPath}\``);
            if (entry.error) {
                lines.push(`- **Error:** ${entry.error}`);
                lines.push('');
                continue;
            }
            if (entry.value)
                lines.push(`- **Default value:** \`${entry.value}\``);
            if (entry.raw) {
                lines.push('');
                lines.push('```text');
                lines.push(entry.raw);
                lines.push('```');
            }
            lines.push('');
        }
    }
    lines.push('---');
    lines.push('');
    lines.push('> If you are opening a GitHub Issue, paste everything above. ' +
        `You can disable redaction with: \`${report.tool.name} report --no-redact\``);
    return lines.join('\n');
}
function writeOutput(outputPath, content) {
    if (!outputPath || outputPath === '-' || outputPath.toLowerCase() === 'stdout') {
        process.stdout.write(content);
        return { ok: true, destination: 'stdout' };
    }
    try {
        const resolved = path_1.default.resolve(outputPath);
        fs_1.default.writeFileSync(resolved, content, 'utf8');
        return { ok: true, destination: resolved };
    }
    catch (e) {
        return { ok: false, error: stringifyError(e) };
    }
}
function tryCopyToClipboard(text) {
    const spawn = (cmd, args) => {
        var _a;
        const res = (0, child_process_1.spawnSync)(cmd, args, {
            input: text,
            encoding: 'utf8',
            timeout: 3000,
            windowsHide: true,
        });
        if (res.error)
            return { ok: false, error: stringifyError(res.error) };
        if (res.status !== 0)
            return { ok: false, error: `Exit code ${(_a = res.status) !== null && _a !== void 0 ? _a : 'unknown'}` };
        return { ok: true };
    };
    if (process.platform === 'darwin') {
        const r = spawn('pbcopy', []);
        return r.ok ? { ok: true, method: 'pbcopy' } : { ok: false, method: 'pbcopy', error: r.error };
    }
    if (process.platform === 'win32') {
        const r = spawn('clip', []);
        return r.ok ? { ok: true, method: 'clip' } : { ok: false, method: 'clip', error: r.error };
    }
    // Linux: try wl-copy, xclip, xsel
    for (const cmd of [
        { cmd: 'wl-copy', args: [] },
        { cmd: 'xclip', args: ['-selection', 'clipboard'] },
        { cmd: 'xsel', args: ['--clipboard', '--input'] },
    ]) {
        const r = spawn(cmd.cmd, cmd.args);
        if (r.ok)
            return { ok: true, method: cmd.cmd };
    }
    return { ok: false, error: 'No clipboard command available (tried wl-copy, xclip, xsel)' };
}
// ============================================================================
// Main Report Function
// ============================================================================
async function runReport(options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    try {
        const includeLogs = parseIncludeLogsMode(options.includeLogs);
        const logLines = parsePositiveInt(options.logLines, DEFAULT_LOG_LINES);
        const redactionEnabled = options.redact !== false;
        const tool = getToolVersion();
        const browsers = resolveBrowsers(options.browser);
        // Collect doctor report
        let doctor;
        let doctorError;
        try {
            doctor = await (0, doctor_1.collectDoctorReport)({
                json: true,
                fix: false,
                browser: options.browser,
            });
        }
        catch (e) {
            doctorError = stringifyError(e);
        }
        // Build the report
        const report = {
            schemaVersion: REPORT_SCHEMA_VERSION,
            timestamp: new Date().toISOString(),
            tool,
            environment: {
                platform: process.platform,
                arch: process.arch,
                node: { version: process.version, execPath: process.execPath },
                os: { type: os_1.default.type(), release: os_1.default.release(), version: safeOsVersion() },
                cwd: process.cwd(),
                env: {
                    CHROME_MCP_NODE_PATH: (_a = process.env.CHROME_MCP_NODE_PATH) !== null && _a !== void 0 ? _a : null,
                    VOLTA_HOME: (_b = process.env.VOLTA_HOME) !== null && _b !== void 0 ? _b : null,
                    ASDF_DATA_DIR: (_c = process.env.ASDF_DATA_DIR) !== null && _c !== void 0 ? _c : null,
                    FNM_DIR: (_d = process.env.FNM_DIR) !== null && _d !== void 0 ? _d : null,
                    NVM_DIR: (_e = process.env.NVM_DIR) !== null && _e !== void 0 ? _e : null,
                    // nvm-windows uses different environment variables
                    NVM_HOME: (_f = process.env.NVM_HOME) !== null && _f !== void 0 ? _f : null,
                    NVM_SYMLINK: (_g = process.env.NVM_SYMLINK) !== null && _g !== void 0 ? _g : null,
                    npm_config_user_agent: (_h = process.env.npm_config_user_agent) !== null && _h !== void 0 ? _h : null,
                },
            },
            packageManager: {
                npm: safeExecVersion('npm'),
                pnpm: safeExecVersion('pnpm'),
            },
            doctor,
            doctorError,
            manifests: collectManifests(browsers),
            wrapperLogs: collectWrapperLogs((0, utils_1.getLogDir)(), includeLogs, logLines),
            windowsRegistry: process.platform === 'win32' ? collectWindowsRegistry(browsers) : undefined,
            redaction: { enabled: redactionEnabled },
        };
        // Apply redaction
        const redact = createRedactor(redactionEnabled);
        const finalReport = redactionEnabled
            ? redactDeep(report, redact)
            : report;
        // Render output
        const output = options.json
            ? JSON.stringify(finalReport, null, 2) + '\n'
            : renderMarkdown(finalReport) + '\n';
        // Write output
        const write = writeOutput(options.output, output);
        if (!write.ok) {
            process.stderr.write(`Failed to write report: ${write.error}\n`);
            process.stdout.write(output);
        }
        else if (write.destination !== 'stdout') {
            process.stderr.write(`Report written to: ${write.destination}\n`);
        }
        // Copy to clipboard if requested
        if (options.copy) {
            const copied = tryCopyToClipboard(output);
            if (copied.ok) {
                process.stderr.write(`Copied to clipboard (${copied.method})\n`);
            }
            else {
                process.stderr.write(`Failed to copy to clipboard: ${(_j = copied.error) !== null && _j !== void 0 ? _j : 'unknown error'}\n`);
            }
        }
        return 0;
    }
    catch (e) {
        process.stderr.write(`Report failed: ${stringifyError(e)}\n`);
        return 1;
    }
}
//# sourceMappingURL=report.js.map