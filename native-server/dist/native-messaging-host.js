"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NativeMessagingHost = void 0;
const process_1 = require("process");
const uuid_1 = require("uuid");
const chrome_mcp_shared_1 = require("chrome-mcp-shared");
const constant_1 = require("./constant");
const file_handler_1 = __importDefault(require("./file-handler"));
class NativeMessagingHost {
    constructor() {
        this.associatedServer = null;
        this.pendingRequests = new Map();
    }
    setServer(serverInstance) {
        this.associatedServer = serverInstance;
    }
    // add message handler to wait for start server
    start() {
        try {
            this.setupMessageHandling();
        }
        catch (error) {
            process.exit(1);
        }
    }
    setupMessageHandling() {
        let buffer = Buffer.alloc(0);
        let expectedLength = -1;
        const MAX_MESSAGES_PER_TICK = 100; // Safety guard to avoid long-running loops per readable tick
        const MAX_MESSAGE_SIZE_BYTES = 16 * 1024 * 1024; // 16MB upper bound for a single message
        const processAvailable = () => {
            let processed = 0;
            while (processed < MAX_MESSAGES_PER_TICK) {
                // Read length header when needed
                if (expectedLength === -1) {
                    if (buffer.length < 4)
                        break; // not enough for header
                    expectedLength = buffer.readUInt32LE(0);
                    buffer = buffer.slice(4);
                    // Validate length header
                    if (expectedLength <= 0 || expectedLength > MAX_MESSAGE_SIZE_BYTES) {
                        this.sendError(`Invalid message length: ${expectedLength}`);
                        // Reset state to resynchronize stream
                        expectedLength = -1;
                        buffer = Buffer.alloc(0);
                        break;
                    }
                }
                // Wait for complete body
                if (buffer.length < expectedLength)
                    break;
                const messageBuffer = buffer.slice(0, expectedLength);
                buffer = buffer.slice(expectedLength);
                expectedLength = -1;
                processed++;
                try {
                    const message = JSON.parse(messageBuffer.toString());
                    this.handleMessage(message);
                }
                catch (error) {
                    this.sendError(`Failed to parse message: ${error.message}`);
                }
            }
            // If we hit the cap but still have at least one complete message pending, schedule to continue soon
            if (processed === MAX_MESSAGES_PER_TICK) {
                setImmediate(processAvailable);
            }
        };
        process_1.stdin.on('readable', () => {
            let chunk;
            while ((chunk = process_1.stdin.read()) !== null) {
                buffer = Buffer.concat([buffer, chunk]);
                processAvailable();
            }
        });
        process_1.stdin.on('end', () => {
            this.cleanup();
        });
        process_1.stdin.on('error', () => {
            this.cleanup();
        });
    }
    async handleMessage(message) {
        var _a;
        if (!message || typeof message !== 'object') {
            this.sendError('Invalid message format');
            return;
        }
        if (message.responseToRequestId) {
            const requestId = message.responseToRequestId;
            const pending = this.pendingRequests.get(requestId);
            if (pending) {
                clearTimeout(pending.timeoutId);
                if (message.error) {
                    pending.reject(new Error(message.error));
                }
                else {
                    pending.resolve(message.payload);
                }
                this.pendingRequests.delete(requestId);
            }
            else {
                // just ignore
            }
            return;
        }
        // Handle directive messages from Chrome
        try {
            switch (message.type) {
                case chrome_mcp_shared_1.NativeMessageType.START:
                    await this.startServer(((_a = message.payload) === null || _a === void 0 ? void 0 : _a.port) || 12306);
                    break;
                case chrome_mcp_shared_1.NativeMessageType.STOP:
                    await this.stopServer();
                    break;
                // Keep ping/pong for simple liveness detection, but this differs from request-response pattern
                case 'ping_from_extension':
                    this.sendMessage({ type: 'pong_to_extension' });
                    break;
                case 'file_operation':
                    await this.handleFileOperation(message);
                    break;
                default:
                    // Double check when message type is not supported
                    if (!message.responseToRequestId) {
                        this.sendError(`Unknown message type or non-response message: ${message.type || 'no type'}`);
                    }
            }
        }
        catch (error) {
            this.sendError(`Failed to handle directive message: ${error.message}`);
        }
    }
    /**
     * Handle file operations from the extension
     */
    async handleFileOperation(message) {
        try {
            const result = await file_handler_1.default.handleFileRequest(message.payload);
            if (message.requestId) {
                // Send response back with the request ID
                this.sendMessage({
                    type: 'file_operation_response',
                    responseToRequestId: message.requestId,
                    payload: result,
                });
            }
            else {
                // No request ID, just send result
                this.sendMessage({
                    type: 'file_operation_result',
                    payload: result,
                });
            }
        }
        catch (error) {
            const errorResponse = {
                success: false,
                error: error.message || 'Unknown error during file operation',
            };
            if (message.requestId) {
                this.sendMessage({
                    type: 'file_operation_response',
                    responseToRequestId: message.requestId,
                    error: errorResponse.error,
                });
            }
            else {
                this.sendError(`File operation failed: ${errorResponse.error}`);
            }
        }
    }
    /**
     * Send request to Chrome and wait for response
     * @param messagePayload Data to send to Chrome
     * @param timeoutMs Timeout for waiting response (milliseconds)
     * @returns Promise, resolves to Chrome's returned payload on success, rejects on failure
     */
    sendRequestToExtensionAndWait(messagePayload, messageType = 'request_data', timeoutMs = constant_1.TIMEOUTS.DEFAULT_REQUEST_TIMEOUT) {
        return new Promise((resolve, reject) => {
            const requestId = (0, uuid_1.v4)(); // Generate unique request ID
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(requestId); // Remove from Map after timeout
                reject(new Error(`Request timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            // Store request's resolve/reject functions and timeout ID
            this.pendingRequests.set(requestId, { resolve, reject, timeoutId });
            // Send message with requestId to Chrome
            this.sendMessage({
                type: messageType, // Define a request type, e.g. 'request_data'
                payload: messagePayload,
                requestId: requestId, // <--- Key: include request ID
            });
        });
    }
    /**
     * Start Fastify server (now accepts Server instance)
     */
    async startServer(port) {
        if (!this.associatedServer) {
            this.sendError('Internal error: server instance not set');
            return;
        }
        try {
            if (this.associatedServer.isRunning) {
                this.sendMessage({
                    type: chrome_mcp_shared_1.NativeMessageType.ERROR,
                    payload: { message: 'Server is already running' },
                });
                return;
            }
            await this.associatedServer.start(port, this);
            this.sendMessage({
                type: chrome_mcp_shared_1.NativeMessageType.SERVER_STARTED,
                payload: { port },
            });
        }
        catch (error) {
            this.sendError(`Failed to start server: ${error.message}`);
        }
    }
    /**
     * Stop Fastify server
     */
    async stopServer() {
        if (!this.associatedServer) {
            this.sendError('Internal error: server instance not set');
            return;
        }
        try {
            // Check status through associatedServer
            if (!this.associatedServer.isRunning) {
                this.sendMessage({
                    type: chrome_mcp_shared_1.NativeMessageType.ERROR,
                    payload: { message: 'Server is not running' },
                });
                return;
            }
            await this.associatedServer.stop();
            // this.serverStarted = false; // Server should update its own status after successful stop
            this.sendMessage({ type: chrome_mcp_shared_1.NativeMessageType.SERVER_STOPPED }); // Distinguish from previous 'stopped'
        }
        catch (error) {
            this.sendError(`Failed to stop server: ${error.message}`);
        }
    }
    /**
     * Send message to Chrome extension
     */
    sendMessage(message) {
        try {
            const messageString = JSON.stringify(message);
            const messageBuffer = Buffer.from(messageString);
            const headerBuffer = Buffer.alloc(4);
            headerBuffer.writeUInt32LE(messageBuffer.length, 0);
            // Ensure atomic write
            process_1.stdout.write(Buffer.concat([headerBuffer, messageBuffer]), (err) => {
                if (err) {
                    // Consider how to handle write failure, may affect request completion
                }
                else {
                    // Message sent successfully, no action needed
                }
            });
        }
        catch (error) {
            // Catch JSON.stringify or Buffer operation errors
            // If preparation stage fails, associated request may never be sent
            // Need to consider whether to reject corresponding Promise (if called within sendRequestToExtensionAndWait)
        }
    }
    /**
     * Send error message to Chrome extension (mainly for sending non-request-response type errors)
     */
    sendError(errorMessage) {
        this.sendMessage({
            type: chrome_mcp_shared_1.NativeMessageType.ERROR_FROM_NATIVE_HOST, // Use more explicit type
            payload: { message: errorMessage },
        });
    }
    /**
     * Clean up resources
     */
    cleanup() {
        // Reject all pending requests
        this.pendingRequests.forEach((pending) => {
            clearTimeout(pending.timeoutId);
            pending.reject(new Error('Native host is shutting down or Chrome disconnected.'));
        });
        this.pendingRequests.clear();
        if (this.associatedServer && this.associatedServer.isRunning) {
            this.associatedServer
                .stop()
                .then(() => {
                process.exit(0);
            })
                .catch(() => {
                process.exit(1);
            });
        }
        else {
            process.exit(0);
        }
    }
}
exports.NativeMessagingHost = NativeMessagingHost;
const nativeMessagingHostInstance = new NativeMessagingHost();
exports.default = nativeMessagingHostInstance;
//# sourceMappingURL=native-messaging-host.js.map