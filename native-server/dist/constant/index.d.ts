export declare enum NATIVE_MESSAGE_TYPE {
    START = "start",
    STARTED = "started",
    STOP = "stop",
    STOPPED = "stopped",
    PING = "ping",
    PONG = "pong",
    ERROR = "error"
}
export declare const NATIVE_SERVER_PORT = 12306;
export declare const TIMEOUTS: {
    readonly DEFAULT_REQUEST_TIMEOUT: 15000;
    readonly EXTENSION_REQUEST_TIMEOUT: 20000;
    readonly PROCESS_DATA_TIMEOUT: 20000;
};
export declare const SERVER_CONFIG: {
    readonly HOST: "127.0.0.1";
    /**
     * CORS origin whitelist - only allow Chrome/Firefox extensions and local debugging.
     * Use RegExp patterns for extension origins, string for exact match.
     */
    readonly CORS_ORIGIN: readonly [RegExp, RegExp, "http://127.0.0.1"];
    readonly LOGGER_ENABLED: false;
};
export declare const HTTP_STATUS: {
    readonly OK: 200;
    readonly CREATED: 201;
    readonly NO_CONTENT: 204;
    readonly BAD_REQUEST: 400;
    readonly NOT_FOUND: 404;
    readonly INTERNAL_SERVER_ERROR: 500;
    readonly GATEWAY_TIMEOUT: 504;
};
export declare const ERROR_MESSAGES: {
    readonly NATIVE_HOST_NOT_AVAILABLE: "Native host connection not established.";
    readonly SERVER_NOT_RUNNING: "Server is not actively running.";
    readonly REQUEST_TIMEOUT: "Request to extension timed out.";
    readonly INVALID_MCP_REQUEST: "Invalid MCP request or session.";
    readonly INVALID_SESSION_ID: "Invalid or missing MCP session ID.";
    readonly INTERNAL_SERVER_ERROR: "Internal Server Error";
    readonly MCP_SESSION_DELETION_ERROR: "Internal server error during MCP session deletion.";
    readonly MCP_REQUEST_PROCESSING_ERROR: "Internal server error during MCP request processing.";
    readonly INVALID_SSE_SESSION: "Invalid or missing MCP session ID for SSE.";
};
/**
 * Environment variables for dynamically resolving the local MCP HTTP endpoint.
 * CHROME_MCP_PORT is the preferred source; MCP_HTTP_PORT is kept for backward compatibility.
 */
export declare const CHROME_MCP_PORT_ENV = "CHROME_MCP_PORT";
export declare const MCP_HTTP_PORT_ENV = "MCP_HTTP_PORT";
/**
 * Get the actual port the Chrome MCP server is listening on.
 * Priority: CHROME_MCP_PORT env > MCP_HTTP_PORT env > NATIVE_SERVER_PORT default
 */
export declare function getChromeMcpPort(): number;
/**
 * Get the full URL to the local Chrome MCP HTTP endpoint.
 * This URL is used by Claude/Codex agents to connect to the MCP server.
 */
export declare function getChromeMcpUrl(): string;
