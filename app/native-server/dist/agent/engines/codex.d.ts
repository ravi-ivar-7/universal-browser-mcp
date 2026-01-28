import type { AgentEngine, EngineExecutionContext, EngineInitOptions } from './types';
import { AgentToolBridge } from '../tool-bridge';
/**
 * CodexEngine integrates the Codex CLI as an AgentEngine implementation.
 *
 * The implementation is intentionally self-contained and does not persist messages;
 * it focuses on streaming Codex JSON events into RealtimeEvent envelopes that the
 * sidepanel UI can consume.
 *
 * This engine is based on the event protocol from the Codex adapter in other/cweb,
 * handling events such as item.started/item.delta/item.completed/item.failed/error entirely,
 * and pushing encoded RealtimeEvents to the sidepanel via AgentStreamManager,
 * ensuring the data loop "Sidepanel -> Native Server -> Codex CLI -> Sidepanel" is closed.
 */
export declare class CodexEngine implements AgentEngine {
    readonly name: "codex";
    readonly supportsMcp = false;
    private readonly toolBridge;
    constructor(toolBridge?: AgentToolBridge);
    /**
     * Maximum number of stderr lines to keep in memory to avoid unbounded growth.
     */
    private static readonly MAX_STDERR_LINES;
    initializeAndRun(options: EngineInitOptions, ctx: EngineExecutionContext): Promise<void>;
    private resolveRepoPath;
    /**
     * Append project context (file listing) to the prompt.
     * Aligned with other/cweb implementation.
     */
    private appendProjectContext;
    /**
     * Build Codex CLI configuration arguments from the resolved config.
     * Aligned with other/cweb implementation for feature parity.
     */
    private buildCodexConfigArgs;
    /**
     * Write an attachment to a temporary file and return its path.
     */
    private writeAttachmentToTemp;
    private buildCodexEnv;
    private pickFirstString;
    private summarizeApplyPatch;
    private extractTodoListItems;
    private normalizeTodoListItems;
    private buildTodoListContent;
    private createTodoListMetadata;
    private encodeHash;
}
