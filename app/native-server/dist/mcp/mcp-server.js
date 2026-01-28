"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMcpServer = exports.mcpServer = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const register_tools_1 = require("./register-tools");
exports.mcpServer = null;
const getMcpServer = () => {
    if (exports.mcpServer) {
        return exports.mcpServer;
    }
    exports.mcpServer = new index_js_1.Server({
        name: 'ChromeMcpServer',
        version: '1.0.0',
    }, {
        capabilities: {
            tools: {},
        },
    });
    (0, register_tools_1.setupTools)(exports.mcpServer);
    return exports.mcpServer;
};
exports.getMcpServer = getMcpServer;
//# sourceMappingURL=mcp-server.js.map