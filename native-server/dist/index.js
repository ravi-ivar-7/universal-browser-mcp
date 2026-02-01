#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_path_1 = require("node:path");
const node_fs_1 = __importDefault(require("node:fs"));
// Manually load .env to avoid dotenv package printing to stdout
function manualLoadEnv(path) {
    try {
        if (node_fs_1.default.existsSync(path)) {
            const content = node_fs_1.default.readFileSync(path, 'utf8');
            const lines = content.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#'))
                    continue;
                const [key, ...values] = trimmed.split('=');
                if (key && values.length > 0) {
                    const val = values.join('=').trim();
                    // Simple unquote if needed (dotenv handles complex cases, but this is a fallback for simple keys)
                    const cleanVal = val.replace(/^["'](.*)["']$/, '$1');
                    if (!process.env[key.trim()]) {
                        process.env[key.trim()] = cleanVal;
                    }
                }
            }
        }
    }
    catch (e) {
        // Ignore errors silently
    }
}
// Load envs
manualLoadEnv((0, node_path_1.join)(__dirname, '..', '.env'));
manualLoadEnv((0, node_path_1.join)(__dirname, '.env'));
const server_1 = __importDefault(require("./server"));
const native_messaging_host_1 = __importDefault(require("./native-messaging-host"));
try {
    server_1.default.setNativeHost(native_messaging_host_1.default); // Server needs setNativeHost method
    native_messaging_host_1.default.setServer(server_1.default); // NativeHost needs setServer method
    native_messaging_host_1.default.start();
}
catch (error) {
    process.exit(1);
}
process.on('error', (error) => {
    process.exit(1);
});
// Handle process signals and uncaught exceptions
process.on('SIGINT', () => {
    process.exit(0);
});
process.on('SIGTERM', () => {
    process.exit(0);
});
process.on('exit', (code) => {
});
process.on('uncaughtException', (error) => {
    console.error('[NativeServer] UNCAUGHT EXCEPTION:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    console.error('[NativeServer] UNHANDLED REJECTION:', reason);
});
//# sourceMappingURL=index.js.map