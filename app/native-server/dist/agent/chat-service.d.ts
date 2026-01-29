import type { AgentActRequest } from './types';
import type { AgentEngine, EngineName, RunningExecution } from './engines/types';
import { AgentStreamManager } from './stream-manager';
export interface AgentChatServiceOptions {
    engines: AgentEngine[];
    streamManager: AgentStreamManager;
    defaultEngineName?: EngineName;
}
/**
 * AgentChatService coordinates incoming /agent/chat requests and delegates to engines.
 *
 * This service is responsible for session-level scheduling and is agnostic to specific CLI/SDK implementation details.
 * It implements dependency inversion via the Engine interface, so that replacing or adding engines does not require modifying the HTTP routing layer.
 */
export declare class AgentChatService {
    private readonly engines;
    private readonly streamManager;
    private readonly defaultEngineName;
    /**
     * Registry of currently running executions, keyed by requestId.
     */
    private readonly runningExecutions;
    private nativeHost;
    constructor(options: AgentChatServiceOptions);
    setNativeHost(host: any): void;
    handleAct(sessionId: string, payload: AgentActRequest): Promise<{
        requestId: string;
    }>;
    /**
     * Cancel a running execution by requestId.
     * Returns true if the execution was found and cancelled, false otherwise.
     */
    cancelExecution(requestId: string): boolean;
    /**
     * Cancel all running executions for a session.
     * Returns the number of executions cancelled.
     */
    cancelSessionExecutions(sessionId: string): number;
    /**
     * Get list of running executions for diagnostics.
     */
    getRunningExecutions(): RunningExecution[];
    private resolveEngineName;
    private runEngine;
    /**
     * Expose registered engines for UI and diagnostics.
     */
    getEngineInfos(): Array<{
        name: EngineName;
        supportsMcp?: boolean;
    }>;
}
