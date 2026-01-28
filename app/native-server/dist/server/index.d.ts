/**
 * HTTP Server - Core server implementation.
 *
 * Responsibilities:
 * - Fastify instance management
 * - Plugin registration (CORS, etc.)
 * - Route delegation to specialized modules
 * - MCP transport handling
 * - Server lifecycle management
 */
import { FastifyInstance } from 'fastify';
import { NativeMessagingHost } from '../native-messaging-host';
export declare class Server {
    private fastify;
    isRunning: boolean;
    private nativeHost;
    private transportsMap;
    private agentStreamManager;
    private agentChatService;
    constructor();
    /**
     * Associate NativeMessagingHost instance.
     */
    setNativeHost(nativeHost: NativeMessagingHost): void;
    private setupPlugins;
    private setupRoutes;
    private setupHealthRoutes;
    private setupExtensionRoutes;
    private setupMcpRoutes;
    start(port: number | undefined, nativeHost: NativeMessagingHost): Promise<void>;
    stop(): Promise<void>;
    getInstance(): FastifyInstance;
}
declare const serverInstance: Server;
export default serverInstance;
