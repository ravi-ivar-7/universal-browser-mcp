"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroqEngine = void 0;
const node_crypto_1 = require("node:crypto");
const chrome_mcp_shared_1 = require("chrome-mcp-shared");
/**
 * GroqEngine integrates Groq's ultra-fast inference API as an AgentEngine implementation.
 * Uses OpenAI-compatible API with Groq's LPU-powered models (Llama, Mixtral, etc.)
 */
class GroqEngine {
    constructor() {
        this.name = 'groq';
        this.supportsMcp = true;
        this.baseUrl = 'https://api.groq.com/openai/v1';
    }
    async initializeAndRun(options, ctx) {
        var _a, _b, _c, _d, _e;
        const { sessionId, instruction, model, requestId, signal, resolvedImagePaths, } = options;
        if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
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
        const tools = chrome_mcp_shared_1.TOOL_SCHEMAS.map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema,
            }
        }));
        let assistantMessageId = null;
        let assistantCreatedAt = null;
        let lastAssistantEmitted = null;
        const emitAssistant = (content, isFinal) => {
            const trimmed = content.trim();
            if (!trimmed && !isFinal)
                return;
            if (lastAssistantEmitted &&
                lastAssistantEmitted.content === trimmed &&
                lastAssistantEmitted.isFinal === isFinal) {
                return;
            }
            lastAssistantEmitted = { content: trimmed, isFinal };
            if (!assistantMessageId)
                assistantMessageId = (0, node_crypto_1.randomUUID)();
            if (!assistantCreatedAt)
                assistantCreatedAt = new Date().toISOString();
            const message = {
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
        const emitToolCall = (name, args, callId) => {
            const message = {
                id: (0, node_crypto_1.randomUUID)(),
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
        const emitToolResult = (name, result, callId) => {
            const message = {
                id: (0, node_crypto_1.randomUUID)(),
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
            const messages = [];
            // System message for tool usage
            messages.push({
                role: 'system',
                content: `You are a helpful AI assistant with access to browser automation tools. Use the provided tools to help the user accomplish their tasks. When using tools, analyze the results and continue working towards the user's goal.`
            });
            // User message with instruction
            const userContent = [{ type: 'text', text: instruction }];
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
                if (signal === null || signal === void 0 ? void 0 : signal.aborted)
                    throw new Error('Cancelled');
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
                const reader = (_a = response.body) === null || _a === void 0 ? void 0 : _a.getReader();
                if (!reader)
                    throw new Error('No response body');
                const decoder = new TextDecoder();
                let fullText = '';
                let toolCalls = [];
                let currentToolCall = null;
                // Process SSE stream
                let buffer = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        if (!line.startsWith('data: '))
                            continue;
                        const data = line.slice(6).trim();
                        if (data === '[DONE]')
                            continue;
                        try {
                            const json = JSON.parse(data);
                            const delta = (_c = (_b = json.choices) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.delta;
                            if (delta === null || delta === void 0 ? void 0 : delta.content) {
                                fullText += delta.content;
                                emitAssistant(fullText, false);
                            }
                            // Handle tool calls
                            if (delta === null || delta === void 0 ? void 0 : delta.tool_calls) {
                                for (const tc of delta.tool_calls) {
                                    if (tc.index !== undefined) {
                                        // Initialize or update tool call
                                        if (!toolCalls[tc.index]) {
                                            toolCalls[tc.index] = {
                                                id: tc.id || (0, node_crypto_1.randomUUID)(),
                                                function: { name: '', arguments: '' }
                                            };
                                        }
                                        if ((_d = tc.function) === null || _d === void 0 ? void 0 : _d.name) {
                                            toolCalls[tc.index].function.name = tc.function.name;
                                        }
                                        if ((_e = tc.function) === null || _e === void 0 ? void 0 : _e.arguments) {
                                            toolCalls[tc.index].function.arguments += tc.function.arguments;
                                        }
                                    }
                                }
                            }
                        }
                        catch (e) {
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
                    let args;
                    try {
                        args = JSON.parse(fn.arguments || '{}');
                    }
                    catch (_f) {
                        args = {};
                    }
                    emitToolCall(fn.name, args, callId);
                    try {
                        // Use injected nativeHost instance
                        let nativeMessagingHostInstance = options.nativeMessagingHost;
                        if (!nativeMessagingHostInstance) {
                            const module = await import('../../native-messaging-host.js');
                            nativeMessagingHostInstance = module.default;
                        }
                        if (!nativeMessagingHostInstance) {
                            throw new Error('NativeMessagingHost instance not ready');
                        }
                        const response = await nativeMessagingHostInstance.sendRequestToExtensionAndWait({ name: fn.name, args }, chrome_mcp_shared_1.NativeMessageType.CALL_TOOL, 120000);
                        const toolResult = response.status === 'success' ? response.data : { error: response.error };
                        emitToolResult(fn.name, toolResult, callId);
                        // Add tool result to messages
                        messages.push({
                            role: 'tool',
                            tool_call_id: callId,
                            content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult)
                        });
                    }
                    catch (err) {
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
        }
        catch (error) {
            console.error(`[GroqEngine] Error:`, error);
            const message = error instanceof Error ? error.message : String(error);
            ctx.emit({
                type: 'message',
                data: {
                    id: (0, node_crypto_1.randomUUID)(),
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
exports.GroqEngine = GroqEngine;
//# sourceMappingURL=groq.js.map