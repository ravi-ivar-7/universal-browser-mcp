"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentToolBridge = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
const index_js_2 = require("../constant/index.js");
/**
 * AgentToolBridge maps CLI tool events (Codex, etc.) to MCP tool calls
 * against the local chrome MCP server via the official MCP SDK client.
 *
 * This bridge layer is responsible for converting CLI reported tool calls into standard MCP CallTool requests,
 * reusing the existing /mcp HTTP server instead of developing additional protocols within this project.
 */
class AgentToolBridge {
    constructor(options = {}) {
        const url = options.mcpUrl || `http://127.0.0.1:${process.env.MCP_HTTP_PORT || index_js_2.NATIVE_SERVER_PORT}/mcp`;
        this.transport = new streamableHttp_js_1.StreamableHTTPClientTransport(new URL(url));
        this.client = new index_js_1.Client({
            name: 'chrome-mcp-agent-bridge',
            version: '1.0.0',
        }, {});
    }
    /**
     * Connects the MCP client over Streamable HTTP if not already connected.
     */
    async ensureConnected() {
        // Client.connect is idempotent; repeated calls reuse the same transport session.
        if (this.transport._sessionId) {
            return;
        }
        await this.client.connect(this.transport);
    }
    /**
     * Invoke an MCP tool based on a CLI tool event.
     * Returns the raw result from MCP client.callTool().
     */
    async callTool(invocation) {
        var _a;
        await this.ensureConnected();
        const args = (_a = invocation.args) !== null && _a !== void 0 ? _a : {};
        const result = await this.client.callTool({
            name: invocation.tool,
            arguments: args,
        });
        // The SDK returns a compatible structure; cast to satisfy strict typing.
        return result;
    }
}
exports.AgentToolBridge = AgentToolBridge;
//# sourceMappingURL=tool-bridge.js.map