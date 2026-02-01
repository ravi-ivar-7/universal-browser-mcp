import { Server } from './server';
export declare class NativeMessagingHost {
    private associatedServer;
    private pendingRequests;
    setServer(serverInstance: Server): void;
    start(): void;
    private setupMessageHandling;
    private handleMessage;
    /**
     * Handle file operations from the extension
     */
    private handleFileOperation;
    /**
     * Send request to Chrome and wait for response
     * @param messagePayload Data to send to Chrome
     * @param timeoutMs Timeout for waiting response (milliseconds)
     * @returns Promise, resolves to Chrome's returned payload on success, rejects on failure
     */
    sendRequestToExtensionAndWait(messagePayload: any, messageType?: string, timeoutMs?: number): Promise<any>;
    /**
     * Start Fastify server (now accepts Server instance)
     */
    private startServer;
    /**
     * Stop Fastify server
     */
    private stopServer;
    /**
     * Send message to Chrome extension
     */
    sendMessage(message: any): void;
    /**
     * Send error message to Chrome extension (mainly for sending non-request-response type errors)
     */
    private sendError;
    /**
     * Clean up resources
     */
    private cleanup;
}
declare const nativeMessagingHostInstance: NativeMessagingHost;
export default nativeMessagingHostInstance;
