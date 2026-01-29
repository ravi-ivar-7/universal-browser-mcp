"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiEngine = void 0;
const node_crypto_1 = require("node:crypto");
const chrome_mcp_shared_1 = require("chrome-mcp-shared");
const generative_ai_1 = require("@google/generative-ai");
/**
 * GeminiEngine integrates Google Gemini Models as an AgentEngine implementation.
 */
class GeminiEngine {
    constructor() {
        this.name = 'gemini';
        this.supportsMcp = true;
    }
    async initializeAndRun(options, ctx) {
        const { sessionId, instruction, model, requestId, signal, attachments, resolvedImagePaths, } = options;
        if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
            throw new Error('GeminiEngine: execution was cancelled');
        }
        const apiKey = process.env.GOOGLE_API_KEY;
        console.error(`[GeminiEngine] Checking API Key. Key present: ${!!apiKey}`);
        if (!apiKey) {
            throw new Error('GeminiEngine: GOOGLE_API_KEY environment variable is not set');
        }
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        console.error(`[GeminiEngine] Request for model: ${model}`);
        // Fallback to gemini-2.5-flash as it is confirmed working for this user
        let resolvedModel = model || 'gemini-2.5-flash';
        // Aggressively force 2.5 flash if we see 2.0 or 1.5 variants which are failing/rate-limited
        if (!model || model.includes('2.0') || model.includes('1.5')) {
            console.error(`[GeminiEngine] Forcing switch to gemini-2.5-flash (User has access to 2.5 preview)`);
            resolvedModel = 'gemini-2.5-flash';
        }
        // Convert MCP tool schemas to Gemini function declarations
        const tools = [
            {
                functionDeclarations: chrome_mcp_shared_1.TOOL_SCHEMAS.map(tool => {
                    const sanitizeSchema = (schema) => {
                        // 1. Flatten oneOf/anyOf to string (Gemini doesn't support polymorphism well)
                        if (schema.oneOf || schema.anyOf) {
                            return { type: 'string', description: schema.description };
                        }
                        // 2. Extract standard fields
                        const { type, properties, required, description, items, enum: enumValues } = schema;
                        const newSchema = { description };
                        // 3. Handle Types
                        if (type) {
                            let typeStr = Array.isArray(type)
                                ? (type.find((t) => t !== 'null') || 'string')
                                : type;
                            if (typeof typeStr !== 'string') {
                                typeStr = 'string';
                            }
                            newSchema.type = typeStr.toUpperCase();
                            if (typeStr === 'array' && items) {
                                newSchema.items = sanitizeSchema(items);
                            }
                            if (typeStr === 'object' && properties) {
                                newSchema.properties = {};
                                for (const [key, value] of Object.entries(properties)) {
                                    newSchema.properties[key] = sanitizeSchema(value);
                                }
                                if (required) {
                                    newSchema.required = required;
                                }
                            }
                            if (enumValues) {
                                newSchema.enum = enumValues;
                            }
                        }
                        else {
                            // Infer type if missing
                            if (properties) {
                                newSchema.type = 'OBJECT';
                                newSchema.properties = {};
                                for (const [key, value] of Object.entries(properties)) {
                                    newSchema.properties[key] = sanitizeSchema(value);
                                }
                            }
                            else {
                                newSchema.type = 'STRING'; // Safe default
                            }
                        }
                        return newSchema;
                    };
                    return {
                        name: tool.name,
                        description: tool.description,
                        parameters: sanitizeSchema(tool.inputSchema),
                    };
                })
            }
        ];
        const generativeModel = genAI.getGenerativeModel({
            model: resolvedModel,
            tools,
        });
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
            console.error(`[GeminiEngine] Starting session with model: ${resolvedModel}`);
            const chat = generativeModel.startChat({
                history: [],
            });
            let currentPrompt = instruction;
            // Handle images if any
            if (resolvedImagePaths && resolvedImagePaths.length > 0) {
                const fs = await import('node:fs/promises');
                const imageParts = await Promise.all(resolvedImagePaths.map(async (p) => {
                    const data = await fs.readFile(p);
                    return {
                        inlineData: {
                            data: data.toString('base64'),
                            mimeType: 'image/png', // Assuming PNG for now
                        },
                    };
                }));
                currentPrompt = [instruction, ...imageParts];
            }
            // Loop for tool calls
            while (true) {
                if (signal === null || signal === void 0 ? void 0 : signal.aborted)
                    throw new Error('Cancelled');
                const result = await chat.sendMessageStream(currentPrompt);
                let fullText = '';
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    fullText += chunkText;
                    emitAssistant(fullText, false);
                }
                const response = await result.response;
                const calls = response.functionCalls();
                if (!calls || calls.length === 0) {
                    emitAssistant(fullText, true);
                    break;
                }
                // Handle function calls
                const toolResultsParts = [];
                for (const call of calls) {
                    const { name, args } = call;
                    const callId = (0, node_crypto_1.randomUUID)();
                    emitToolCall(name, args, callId);
                    try {
                        // Use injected nativeHost instance
                        let nativeMessagingHostInstance = options.nativeMessagingHost;
                        if (!nativeMessagingHostInstance) {
                            // Fallback (though this path is circular and likely fails, we keep it just in case)
                            const module = await import('../../native-messaging-host.js');
                            nativeMessagingHostInstance = module.default;
                        }
                        if (!nativeMessagingHostInstance) {
                            throw new Error('NativeMessagingHost instance not ready');
                        }
                        const response = await nativeMessagingHostInstance.sendRequestToExtensionAndWait({ name, args }, chrome_mcp_shared_1.NativeMessageType.CALL_TOOL, 120000);
                        const toolResult = response.status === 'success' ? response.data : { error: response.error };
                        emitToolResult(name, toolResult, callId);
                        toolResultsParts.push({
                            functionResponse: {
                                name,
                                response: { result: toolResult },
                            }
                        });
                    }
                    catch (err) {
                        const errorMsg = err instanceof Error ? err.message : String(err);
                        emitToolResult(name, { error: errorMsg }, callId);
                        toolResultsParts.push({
                            functionResponse: {
                                name,
                                response: { error: errorMsg },
                            }
                        });
                    }
                }
                // Send tool results back to Gemini
                currentPrompt = toolResultsParts;
            }
        }
        catch (error) {
            console.error(`[GeminiEngine] Error:`, error);
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
exports.GeminiEngine = GeminiEngine;
//# sourceMappingURL=gemini.js.map