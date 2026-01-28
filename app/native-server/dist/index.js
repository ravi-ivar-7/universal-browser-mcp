#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    // Don't exit immediately, let the program continue running
});
//# sourceMappingURL=index.js.map