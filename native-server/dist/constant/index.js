"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCP_HTTP_PORT_ENV = exports.CHROME_MCP_PORT_ENV = exports.ERROR_MESSAGES = exports.HTTP_STATUS = exports.SERVER_CONFIG = exports.TIMEOUTS = exports.NATIVE_SERVER_PORT = exports.NATIVE_MESSAGE_TYPE = void 0;
exports.getChromeMcpPort = getChromeMcpPort;
exports.getChromeMcpUrl = getChromeMcpUrl;
var NATIVE_MESSAGE_TYPE;
(function (NATIVE_MESSAGE_TYPE) {
    NATIVE_MESSAGE_TYPE["START"] = "start";
    NATIVE_MESSAGE_TYPE["STARTED"] = "started";
    NATIVE_MESSAGE_TYPE["STOP"] = "stop";
    NATIVE_MESSAGE_TYPE["STOPPED"] = "stopped";
    NATIVE_MESSAGE_TYPE["PING"] = "ping";
    NATIVE_MESSAGE_TYPE["PONG"] = "pong";
    NATIVE_MESSAGE_TYPE["ERROR"] = "error";
})(NATIVE_MESSAGE_TYPE || (exports.NATIVE_MESSAGE_TYPE = NATIVE_MESSAGE_TYPE = {}));
exports.NATIVE_SERVER_PORT = 12306;
// Timeout constants (in milliseconds)
exports.TIMEOUTS = {
    DEFAULT_REQUEST_TIMEOUT: 15000,
    EXTENSION_REQUEST_TIMEOUT: 20000,
    PROCESS_DATA_TIMEOUT: 20000,
};
// Server configuration
exports.SERVER_CONFIG = {
    HOST: '127.0.0.1',
    /**
     * CORS origin whitelist - only allow Chrome/Firefox extensions and local debugging.
     * Use RegExp patterns for extension origins, string for exact match.
     */
    CORS_ORIGIN: [/^chrome-extension:\/\//, /^moz-extension:\/\//, 'http://127.0.0.1'],
    LOGGER_ENABLED: false,
};
// HTTP Status codes
exports.HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
    GATEWAY_TIMEOUT: 504,
};
// Error messages
exports.ERROR_MESSAGES = {
    NATIVE_HOST_NOT_AVAILABLE: 'Native host connection not established.',
    SERVER_NOT_RUNNING: 'Server is not actively running.',
    REQUEST_TIMEOUT: 'Request to extension timed out.',
    INVALID_MCP_REQUEST: 'Invalid MCP request or session.',
    INVALID_SESSION_ID: 'Invalid or missing MCP session ID.',
    INTERNAL_SERVER_ERROR: 'Internal Server Error',
    MCP_SESSION_DELETION_ERROR: 'Internal server error during MCP session deletion.',
    MCP_REQUEST_PROCESSING_ERROR: 'Internal server error during MCP request processing.',
    INVALID_SSE_SESSION: 'Invalid or missing MCP session ID for SSE.',
};
// ============================================================
// Chrome MCP Server Configuration
// ============================================================
/**
 * Environment variables for dynamically resolving the local MCP HTTP endpoint.
 * CHROME_MCP_PORT is the preferred source; MCP_HTTP_PORT is kept for backward compatibility.
 */
exports.CHROME_MCP_PORT_ENV = 'CHROME_MCP_PORT';
exports.MCP_HTTP_PORT_ENV = 'MCP_HTTP_PORT';
/**
 * Get the actual port the Chrome MCP server is listening on.
 * Priority: CHROME_MCP_PORT env > MCP_HTTP_PORT env > NATIVE_SERVER_PORT default
 */
function getChromeMcpPort() {
    const raw = process.env[exports.CHROME_MCP_PORT_ENV] || process.env[exports.MCP_HTTP_PORT_ENV];
    const port = raw ? Number.parseInt(String(raw), 10) : NaN;
    return Number.isFinite(port) && port > 0 && port <= 65535 ? port : exports.NATIVE_SERVER_PORT;
}
/**
 * Get the full URL to the local Chrome MCP HTTP endpoint.
 * This URL is used by Claude/Codex agents to connect to the MCP server.
 */
function getChromeMcpUrl() {
    return `http://${exports.SERVER_CONFIG.HOST}:${getChromeMcpPort()}/mcp`;
}
//# sourceMappingURL=index.js.map