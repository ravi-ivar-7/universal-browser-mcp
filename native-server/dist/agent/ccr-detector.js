"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectCcr = detectCcr;
exports.clearCcrCache = clearCcrCache;
exports.validateCcrConfig = validateCcrConfig;
/**
 * Claude Code Router (CCR) Auto-Detection Module.
 *
 * This module provides automatic detection of CCR configuration
 * for users who have already set up CCR on their system.
 *
 * CCR config location: ~/.claude-code-router/config.json
 * CCR uses env vars: ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN
 *
 * The detection flow:
 * 1. Check if CCR env vars are already set (skip if yes)
 * 2. Read CCR config file
 * 3. Parse JSON5 config with env var interpolation
 * 4. Verify CCR is running via health check
 * 5. Return derived env vars if healthy
 */
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const node_os_1 = __importDefault(require("node:os"));
/**
 * Default CCR port.
 */
const DEFAULT_CCR_PORT = 9898;
/**
 * CCR config file path.
 */
const CCR_CONFIG_PATH = node_path_1.default.join(node_os_1.default.homedir(), '.claude-code-router', 'config.json');
/**
 * Health check timeout in milliseconds.
 */
const HEALTH_CHECK_TIMEOUT = 2000;
/**
 * Cache for CCR detection result (to avoid repeated file reads and health checks).
 * Cached for the lifetime of the process.
 */
let cachedResult = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute
/**
 * Detect CCR configuration and verify it's running.
 *
 * This function:
 * 1. Returns cached result if still valid
 * 2. Checks if CCR env vars are already set in process.env
 * 3. If not, reads and parses CCR config file
 * 4. Verifies CCR is running via health check
 *
 * @returns Detection result with baseUrl and authToken if CCR is available
 */
async function detectCcr() {
    var _a, _b, _c, _d, _e;
    // Check cache
    const now = Date.now();
    if (cachedResult && now - cacheTimestamp < CACHE_TTL) {
        return cachedResult;
    }
    try {
        // First, check if env vars are already set (user ran `eval "$(ccr activate)"`)
        const envBaseUrl = process.env.ANTHROPIC_BASE_URL;
        const envAuthToken = process.env.ANTHROPIC_AUTH_TOKEN;
        if (envBaseUrl && envAuthToken) {
            // Verify CCR is running
            const healthy = await checkCcrHealth(envBaseUrl);
            if (healthy) {
                cachedResult = {
                    detected: true,
                    baseUrl: envBaseUrl,
                    authToken: envAuthToken,
                    source: 'env',
                };
                cacheTimestamp = now;
                return cachedResult;
            }
            // Env vars set but CCR not healthy - fall through to config detection
        }
        // Try to read CCR config file
        const configResult = await readCcrConfig();
        if (!configResult.config) {
            cachedResult = {
                detected: false,
                error: configResult.error || 'CCR config not found or invalid',
            };
            cacheTimestamp = now;
            return cachedResult;
        }
        const config = configResult.config;
        // Derive env vars from config (support both uppercase and lowercase field names)
        const port = (_b = (_a = config.PORT) !== null && _a !== void 0 ? _a : config.port) !== null && _b !== void 0 ? _b : DEFAULT_CCR_PORT;
        const host = (_d = (_c = config.HOST) !== null && _c !== void 0 ? _c : config.host) !== null && _d !== void 0 ? _d : '127.0.0.1';
        const baseUrl = `http://${host}:${port}`;
        // APIKEY can be empty string in config, use 'APIKEY' as fallback (CCR accepts this)
        const apiKey = (_e = config.APIKEY) !== null && _e !== void 0 ? _e : config.apiKey;
        const authToken = apiKey && apiKey.length > 0 ? apiKey : 'APIKEY';
        // Verify CCR is running
        const healthy = await checkCcrHealth(baseUrl);
        if (!healthy) {
            cachedResult = {
                detected: false,
                error: 'CCR config found but service not running',
            };
            cacheTimestamp = now;
            return cachedResult;
        }
        cachedResult = {
            detected: true,
            baseUrl,
            authToken,
            source: 'config',
        };
        cacheTimestamp = now;
        return cachedResult;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        cachedResult = { detected: false, error: message };
        cacheTimestamp = now;
        return cachedResult;
    }
}
/**
 * Read and parse CCR config file.
 */
async function readCcrConfig() {
    try {
        const content = await (0, promises_1.readFile)(CCR_CONFIG_PATH, 'utf-8');
        const config = parseJson5Config(content);
        if (!config) {
            return { config: null, error: 'Failed to parse CCR config file' };
        }
        return { config };
    }
    catch (error) {
        const err = error;
        if (err.code === 'ENOENT') {
            // Config file doesn't exist - CCR not installed
            return { config: null, error: 'CCR config file not found' };
        }
        return { config: null, error: `Failed to read CCR config: ${err.message}` };
    }
}
/**
 * Parse CCR config file.
 *
 * CCR config is standard JSON (not JSON5), so we can use JSON.parse directly.
 * We only need to handle env var interpolation: ${VAR_NAME}
 *
 * Note: Previous implementation tried to strip comments using regex which
 * incorrectly matched "http://" URLs inside strings.
 */
function parseJson5Config(content) {
    try {
        // First try standard JSON parse (CCR config is usually valid JSON)
        // Only interpolate env vars if needed
        let processed = content;
        // Interpolate env vars: ${VAR_NAME} -> value
        // Only do this outside of the JSON parsing to avoid breaking strings
        if (content.includes('${')) {
            processed = content.replace(/\$\{([^}]+)\}/g, (_, varName) => {
                const value = process.env[varName.trim()];
                return value || '';
            });
        }
        const parsed = JSON.parse(processed);
        return parsed;
    }
    catch (parseError) {
        // Log parse error for debugging
        console.error('[CCR] Failed to parse config:', parseError);
        return null;
    }
}
/**
 * Check if CCR is running by hitting its health endpoint.
 */
async function checkCcrHealth(baseUrl) {
    try {
        const healthUrl = `${baseUrl}/health`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);
        try {
            const response = await fetch(healthUrl, {
                method: 'GET',
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            return response.ok;
        }
        catch (_a) {
            clearTimeout(timeoutId);
            return false;
        }
    }
    catch (_b) {
        return false;
    }
}
/**
 * Clear the CCR detection cache.
 * Useful for testing or when user wants to re-detect.
 */
function clearCcrCache() {
    cachedResult = null;
    cacheTimestamp = 0;
}
/**
 * Validate CCR configuration for common misconfigurations.
 *
 * This function checks for issues that would cause runtime errors in CCR,
 * particularly the "Router.default must be provider,model" requirement.
 *
 * The most common misconfiguration is setting Router.default to just a provider
 * name (e.g., "venus") instead of the required "provider,model" format
 * (e.g., "venus,claude-4-5-sonnet-20250929"). This causes CCR to crash with
 * "Cannot read properties of undefined (reading 'includes')" when it tries
 * to split the model name.
 */
async function validateCcrConfig() {
    var _a, _b, _c;
    const configResult = await readCcrConfig();
    // If we can't read the config, return early (not our problem to report)
    if (!configResult.config) {
        return {
            checked: false,
            valid: true,
            configPath: CCR_CONFIG_PATH,
            issue: configResult.error,
        };
    }
    const config = configResult.config;
    const router = (_a = config.Router) !== null && _a !== void 0 ? _a : config.router;
    const routerDefault = (_b = router === null || router === void 0 ? void 0 : router.default) === null || _b === void 0 ? void 0 : _b.trim();
    // No Router.default configured
    if (!routerDefault) {
        return {
            checked: true,
            valid: false,
            configPath: CCR_CONFIG_PATH,
            issue: 'CCR Router.default is not configured.',
            suggestion: `Edit ${CCR_CONFIG_PATH} and set Router.default to "provider,model" format, then restart CCR.`,
        };
    }
    // Check if Router.default contains a comma (required format: provider,model)
    if (!routerDefault.includes(',')) {
        const suggestedFix = inferSuggestedRouterDefault(routerDefault, config, router);
        const example = suggestedFix !== null && suggestedFix !== void 0 ? suggestedFix : `${routerDefault},<model>`;
        return {
            checked: true,
            valid: false,
            configPath: CCR_CONFIG_PATH,
            routerDefault,
            issue: `CCR Router.default must be "provider,model" format, but got "${routerDefault}" (missing model).`,
            suggestedFix,
            suggestion: `Edit ${CCR_CONFIG_PATH} and change Router.default from "${routerDefault}" to "${example}", then restart CCR.`,
        };
    }
    // Validate the model part is not empty after splitting
    const [providerPart, modelPart] = routerDefault.split(',', 2);
    if (!(providerPart === null || providerPart === void 0 ? void 0 : providerPart.trim()) || !(modelPart === null || modelPart === void 0 ? void 0 : modelPart.trim())) {
        const suggestedFix = inferSuggestedRouterDefault((_c = providerPart === null || providerPart === void 0 ? void 0 : providerPart.trim()) !== null && _c !== void 0 ? _c : '', config, router);
        return {
            checked: true,
            valid: false,
            configPath: CCR_CONFIG_PATH,
            routerDefault,
            issue: `CCR Router.default "${routerDefault}" has empty provider or model part.`,
            suggestedFix,
            suggestion: `Edit ${CCR_CONFIG_PATH} and set Router.default to a valid "provider,model" format, then restart CCR.`,
        };
    }
    return {
        checked: true,
        valid: true,
        configPath: CCR_CONFIG_PATH,
        routerDefault,
    };
}
/**
 * Try to infer a suggested Router.default value based on available providers and models.
 */
function inferSuggestedRouterDefault(providerName, config, router) {
    var _a, _b, _c;
    const normalizedProvider = providerName.toLowerCase();
    if (!normalizedProvider)
        return undefined;
    // Try to find the provider in Providers array and get its first model
    const providers = (_b = (_a = config.Providers) !== null && _a !== void 0 ? _a : config.providers) !== null && _b !== void 0 ? _b : [];
    const matchedProvider = providers.find((p) => { var _a; return ((_a = p.name) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === normalizedProvider; });
    if ((matchedProvider === null || matchedProvider === void 0 ? void 0 : matchedProvider.name) && ((_c = matchedProvider.models) === null || _c === void 0 ? void 0 : _c[0])) {
        return `${matchedProvider.name},${matchedProvider.models[0]}`;
    }
    // Fallback: look at other Router entries that have valid "provider,model" format
    const routerEntries = [router === null || router === void 0 ? void 0 : router.background, router === null || router === void 0 ? void 0 : router.think, router === null || router === void 0 ? void 0 : router.longContext];
    for (const entry of routerEntries) {
        if (!entry || !entry.includes(','))
            continue;
        const [p, m] = entry.split(',', 2);
        if ((p === null || p === void 0 ? void 0 : p.trim().toLowerCase()) === normalizedProvider && (m === null || m === void 0 ? void 0 : m.trim())) {
            return `${providerName},${m.trim()}`;
        }
    }
    return undefined;
}
//# sourceMappingURL=ccr-detector.js.map