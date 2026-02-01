import { randomUUID } from 'node:crypto';
import type { AgentEngine, EngineExecutionContext, EngineInitOptions } from './types';
import type { AgentMessage, RealtimeEvent } from '../types';
import { TOOL_SCHEMAS, NativeMessageType } from 'chrome-mcp-shared';

/**
 * GroqEngine integrates Groq's ultra-fast inference API as an AgentEngine implementation.
 * Uses OpenAI-compatible API with Groq's LPU-powered models (Llama, Mixtral, etc.)
 */
export class GroqEngine implements AgentEngine {
    public readonly name = 'groq' as const;
    public readonly supportsMcp = true;

    private readonly baseUrl = 'https://api.groq.com/openai/v1';

    async initializeAndRun(options: EngineInitOptions, ctx: EngineExecutionContext): Promise<void> {
        const {
            sessionId,
            instruction,
            model,
            requestId,
            signal,
            resolvedImagePaths,
        } = options;

        if (signal?.aborted) {
            throw new Error('GroqEngine: execution was cancelled');
        }

        const apiKey = process.env.GROQ_API_KEY;
        console.error(`[GroqEngine] Checking API Key. Key present: ${!!apiKey}`);
        if (!apiKey) {
            throw new Error('GroqEngine: GROQ_API_KEY environment variable is not set');
        }

        // Default to llama-3.1-8b-instant - fast and higher TPM limits
        const resolvedModel = model || 'llama-3.1-8b-instant';
        console.error(`[GroqEngine] Using model: ${resolvedModel}`);

        // Convert MCP tool schemas to OpenAI function format
        const tools = TOOL_SCHEMAS.map(tool => ({
            type: 'function' as const,
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema,
            }
        }));

        let assistantMessageId: string | null = null;
        let assistantCreatedAt: string | null = null;
        let lastAssistantEmitted: { content: string; isFinal: boolean } | null = null;

        const emitAssistant = (content: string, isFinal: boolean): void => {
            const trimmed = content.trim();
            if (!trimmed && !isFinal) return;

            if (
                lastAssistantEmitted &&
                lastAssistantEmitted.content === trimmed &&
                lastAssistantEmitted.isFinal === isFinal
            ) {
                return;
            }
            lastAssistantEmitted = { content: trimmed, isFinal };

            if (!assistantMessageId) assistantMessageId = randomUUID();
            if (!assistantCreatedAt) assistantCreatedAt = new Date().toISOString();

            const message: AgentMessage = {
                id: assistantMessageId,
                sessionId,
                role: 'assistant',
                content: trimmed,
                messageType: 'chat',
                cliSource: this.name,
                requestId,
                isStreaming: !isFinal,
                isFinal,
                createdAt: assistantCreatedAt,
            };

            ctx.emit({ type: 'message', data: message });
        };

        const emitToolCall = (name: string, args: any, callId: string): void => {
            const message: AgentMessage = {
                id: randomUUID(),
                sessionId,
                role: 'tool',
                content: `Calling tool: ${name}`,
                messageType: 'tool_use',
                cliSource: this.name,
                requestId,
                isStreaming: false,
                isFinal: true,
                createdAt: new Date().toISOString(),
                metadata: {
                    toolName: name,
                    tool_name: name,
                    toolId: callId,
                    args,
                },
            };
            ctx.emit({ type: 'message', data: message });
        };

        const emitToolResult = (name: string, result: any, callId: string): void => {
            const message: AgentMessage = {
                id: randomUUID(),
                sessionId,
                role: 'tool',
                content: typeof result === 'string' ? result : JSON.stringify(result),
                messageType: 'tool_result',
                cliSource: this.name,
                requestId,
                isStreaming: false,
                isFinal: true,
                createdAt: new Date().toISOString(),
                metadata: {
                    toolName: name,
                    tool_name: name,
                    toolId: callId,
                },
            };
            ctx.emit({ type: 'message', data: message });
        };

        try {
            console.error(`[GroqEngine] Starting session with model: ${resolvedModel}`);

            // Build messages array
            const messages: any[] = [];

            // System message for tool usage
            messages.push({
                role: 'system',
                content: `You are a helpful AI assistant with access to browser automation tools. Use the provided tools to help the user accomplish their tasks. When using tools, analyze the results and continue working towards the user's goal.`
            });

            // User message with instruction
            const userContent: any[] = [{ type: 'text', text: instruction }];

            // Handle images if any (Groq supports vision with some models)
            if (resolvedImagePaths && resolvedImagePaths.length > 0 && resolvedModel.includes('vision')) {
                const fs = await import('node:fs/promises');
                for (const imagePath of resolvedImagePaths) {
                    const data = await fs.readFile(imagePath);
                    userContent.push({
                        type: 'image_url',
                        image_url: {
                            url: `data:image/png;base64,${data.toString('base64')}`
                        }
                    });
                }
            }

            messages.push({
                role: 'user',
                content: userContent.length === 1 ? instruction : userContent
            });

            // Loop for tool calls
            while (true) {
                if (signal?.aborted) throw new Error('Cancelled');

                // Make streaming request to Groq
                const response = await fetch(`${this.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: resolvedModel,
                        messages,
                        tools: tools.length > 0 ? tools : undefined,
                        tool_choice: tools.length > 0 ? 'auto' : undefined,
                        stream: true,
                        max_tokens: 8192,
                    }),
                    signal,
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Groq API error: ${response.status} - ${errorText}`);
                }

                const reader = response.body?.getReader();
                if (!reader) throw new Error('No response body');

                const decoder = new TextDecoder();
                let fullText = '';
                let toolCalls: Array<{ id: string; function: { name: string; arguments: string } }> = [];
                let currentToolCall: { id: string; function: { name: string; arguments: string } } | null = null;

                // Process SSE stream
                let buffer = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        const data = line.slice(6).trim();
                        if (data === '[DONE]') continue;

                        try {
                            const json = JSON.parse(data);
                            const delta = json.choices?.[0]?.delta;

                            if (delta?.content) {
                                fullText += delta.content;
                                emitAssistant(fullText, false);
                            }

                            // Handle tool calls
                            if (delta?.tool_calls) {
                                for (const tc of delta.tool_calls) {
                                    if (tc.index !== undefined) {
                                        // Initialize or update tool call
                                        if (!toolCalls[tc.index]) {
                                            toolCalls[tc.index] = {
                                                id: tc.id || randomUUID(),
                                                function: { name: '', arguments: '' }
                                            };
                                        }
                                        if (tc.function?.name) {
                                            toolCalls[tc.index].function.name = tc.function.name;
                                        }
                                        if (tc.function?.arguments) {
                                            toolCalls[tc.index].function.arguments += tc.function.arguments;
                                        }
                                    }
                                }
                            }
                        } catch (e) {
                            // Ignore JSON parse errors for malformed chunks
                        }
                    }
                }

                // Filter out any empty tool calls
                toolCalls = toolCalls.filter(tc => tc && tc.function.name);

                if (toolCalls.length === 0) {
                    emitAssistant(fullText, true);
                    break;
                }

                // Add assistant message with tool calls to history
                messages.push({
                    role: 'assistant',
                    content: fullText || null,
                    tool_calls: toolCalls.map(tc => ({
                        id: tc.id,
                        type: 'function',
                        function: tc.function
                    }))
                });

                // Execute tool calls
                for (const toolCall of toolCalls) {
                    const { id: callId, function: fn } = toolCall;
                    let args: any;
                    try {
                        args = JSON.parse(fn.arguments || '{}');
                    } catch {
                        args = {};
                    }

                    emitToolCall(fn.name, args, callId);

                    try {
                        // Use injected nativeHost instance
                        let nativeMessagingHostInstance = (options as any).nativeMessagingHost;

                        if (!nativeMessagingHostInstance) {
                            const module = await import('../../native-messaging-host.js');
                            nativeMessagingHostInstance = (module as any).default;
                        }

                        if (!nativeMessagingHostInstance) {
                            throw new Error('NativeMessagingHost instance not ready');
                        }

                        const response = await nativeMessagingHostInstance.sendRequestToExtensionAndWait(
                            { name: fn.name, args },
                            NativeMessageType.CALL_TOOL,
                            120000
                        );

                        const toolResult = response.status === 'success' ? response.data : { error: response.error };
                        emitToolResult(fn.name, toolResult, callId);

                        // Add tool result to messages
                        messages.push({
                            role: 'tool',
                            tool_call_id: callId,
                            content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult)
                        });
                    } catch (err) {
                        const errorMsg = err instanceof Error ? err.message : String(err);
                        emitToolResult(fn.name, { error: errorMsg }, callId);

                        messages.push({
                            role: 'tool',
                            tool_call_id: callId,
                            content: JSON.stringify({ error: errorMsg })
                        });
                    }
                }

                // Reset for next iteration
                assistantMessageId = null;
                assistantCreatedAt = null;
                lastAssistantEmitted = null;
            }

        } catch (error) {
            console.error(`[GroqEngine] Error:`, error);
            const message = error instanceof Error ? error.message : String(error);
            ctx.emit({
                type: 'message',
                data: {
                    id: randomUUID(),
                    sessionId,
                    role: 'assistant',
                    content: `Error: ${message}`,
                    messageType: 'chat',
                    cliSource: this.name,
                    requestId,
                    isStreaming: false,
                    isFinal: true,
                    createdAt: new Date().toISOString(),
                }
            });
        }
    }
}
