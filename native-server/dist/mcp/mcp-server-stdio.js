#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupTools = exports.ensureMcpClient = exports.getStdioMcpServer = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const index_js_2 = require("@modelcontextprotocol/sdk/client/index.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const chrome_mcp_shared_1 = require("chrome-mcp-shared");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let stdioMcpServer = null;
let mcpClient = null;
// Read configuration from stdio-config.json
const loadConfig = () => {
    try {
        const configPath = path.join(__dirname, 'stdio-config.json');
        const configData = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configData);
    }
    catch (error) {
        console.error('Failed to load stdio-config.json:', error);
        throw new Error('Configuration file stdio-config.json not found or invalid');
    }
};
const getStdioMcpServer = () => {
    if (stdioMcpServer) {
        return stdioMcpServer;
    }
    stdioMcpServer = new index_js_1.Server({
        name: 'StdioChromeMcpServer',
        version: '1.0.0',
    }, {
        capabilities: {
            tools: {},
            resources: {},
            prompts: {},
        },
    });
    (0, exports.setupTools)(stdioMcpServer);
    return stdioMcpServer;
};
exports.getStdioMcpServer = getStdioMcpServer;
const ensureMcpClient = async () => {
    try {
        if (mcpClient) {
            const pingResult = await mcpClient.ping();
            if (pingResult) {
                return mcpClient;
            }
        }
        const config = loadConfig();
        mcpClient = new index_js_2.Client({ name: 'Mcp Chrome Proxy', version: '1.0.0' }, { capabilities: {} });
        const transport = new streamableHttp_js_1.StreamableHTTPClientTransport(new URL(config.url), {});
        await mcpClient.connect(transport);
        return mcpClient;
    }
    catch (error) {
        mcpClient === null || mcpClient === void 0 ? void 0 : mcpClient.close();
        mcpClient = null;
        console.error('Failed to connect to MCP server:', error);
    }
};
exports.ensureMcpClient = ensureMcpClient;
const setupTools = (server) => {
    // List tools handler
    server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({ tools: chrome_mcp_shared_1.TOOL_SCHEMAS }));
    // Call tool handler
    server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => handleToolCall(request.params.name, request.params.arguments || {}));
    // List resources handler - REQUIRED BY MCP PROTOCOL
    server.setRequestHandler(types_js_1.ListResourcesRequestSchema, async () => ({ resources: [] }));
    // List prompts handler - REQUIRED BY MCP PROTOCOL
    server.setRequestHandler(types_js_1.ListPromptsRequestSchema, async () => ({ prompts: [] }));
};
exports.setupTools = setupTools;
const handleToolCall = async (name, args) => {
    try {
        const client = await (0, exports.ensureMcpClient)();
        if (!client) {
            throw new Error('Failed to connect to MCP server');
        }
        // Use a sane default of 2 minutes; the previous value mistakenly used 2*6*1000 (12s)
        const DEFAULT_CALL_TIMEOUT_MS = 2 * 60 * 1000;
        const result = await client.callTool({ name, arguments: args }, undefined, {
            timeout: DEFAULT_CALL_TIMEOUT_MS,
        });
        return result;
    }
    catch (error) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error calling tool: ${error.message}`,
                },
            ],
            isError: true,
        };
    }
};
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await (0, exports.getStdioMcpServer)().connect(transport);
}
main().catch((error) => {
    console.error('Fatal error Chrome MCP Server main():', error);
    process.exit(1);
});
//# sourceMappingURL=mcp-server-stdio.js.map