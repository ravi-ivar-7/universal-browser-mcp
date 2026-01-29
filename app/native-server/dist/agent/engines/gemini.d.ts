import type { AgentEngine, EngineExecutionContext, EngineInitOptions } from './types';
/**
 * GeminiEngine integrates Google Gemini Models as an AgentEngine implementation.
 */
export declare class GeminiEngine implements AgentEngine {
    readonly name: "gemini";
    readonly supportsMcp = true;
    initializeAndRun(options: EngineInitOptions, ctx: EngineExecutionContext): Promise<void>;
}
