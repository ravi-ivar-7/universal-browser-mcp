import type { AgentEngine, EngineExecutionContext, EngineInitOptions } from './types';
/**
 * ClaudeEngine integrates the Claude Agent SDK as an AgentEngine implementation.
 *
 * This engine uses the @anthropic-ai/claude-agent-sdk to interact with Claude,
 * streaming events back to the sidepanel UI via RealtimeEvent envelopes.
 */
export declare class ClaudeEngine implements AgentEngine {
    readonly name: "claude";
    readonly supportsMcp = true;
    /**
     * Maximum number of stderr lines to keep in memory.
     */
    private static readonly MAX_STDERR_LINES;
    initializeAndRun(options: EngineInitOptions, ctx: EngineExecutionContext): Promise<void>;
    /**
     * Build environment variables for Claude Code.
     * Supports Claude Code Router (CCR) when useCcr is true:
     * 1. Auto-detecting CCR from config file (~/.claude-code-router/config.json)
     * 2. Passing through env vars if already set (via `eval "$(ccr activate)"`)
     *
     * SDK treats options.env as a complete replacement (not merged with process.env),
     * so we must explicitly include all necessary variables.
     *
     * @param useCcr - Whether CCR is enabled for this project. When false/undefined, CCR detection is skipped.
     */
    private buildClaudeEnv;
    /**
     * Resolve project root path.
     */
    private resolveRepoPath;
    /**
     * Pick first string value from unknown input.
     */
    private pickFirstString;
    /**
     * Extract content from SDK message.
     * Handles various message structures from Claude Agent SDK:
     * - result.result (final result text)
     * - assistant.message (nested message content)
     * - content/text (direct content fields)
     * - content[] (array of content blocks)
     *
     * @param message - The message object to extract content from
     * @param depth - Current recursion depth (max 3 to prevent infinite loops)
     */
    private extractMessageContent;
    /**
     * Format error message for user display.
     * Preserves the original error message and only appends stderr context if useful.
     */
    private classifyError;
    /**
     * Validate CCR configuration and emit a warning message if issues are found.
     * This is a best-effort check to provide actionable guidance before CCR crashes.
     */
    private validateAndWarnCcrConfig;
    /**
     * Enhance error messages for CCR-related errors.
     * Detects the common "includes of undefined" crash and provides actionable guidance.
     */
    private enhanceCcrErrorMessage;
    /**
     * Build metadata for tool result events.
     */
    private buildToolResultMetadata;
    /**
     * Extract content from a tool_result block.
     */
    private extractToolResultContent;
    /**
     * Encode string to base64 for hashing.
     */
    private encodeHash;
    /**
     * Write an attachment to a temporary file and return its path.
     */
    private writeAttachmentToTemp;
}
