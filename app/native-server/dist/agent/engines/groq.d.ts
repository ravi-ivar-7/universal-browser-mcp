import type { AgentEngine, EngineExecutionContext, EngineInitOptions } from './types';
/**
 * GroqEngine integrates Groq's ultra-fast inference API as an AgentEngine implementation.
 * Uses OpenAI-compatible API with Groq's LPU-powered models (Llama, Mixtral, etc.)
 */
export declare class GroqEngine implements AgentEngine {
    readonly name: "groq";
    readonly supportsMcp = true;
    private readonly baseUrl;
    initializeAndRun(options: EngineInitOptions, ctx: EngineExecutionContext): Promise<void>;
}
