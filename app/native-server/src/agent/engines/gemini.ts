import { randomUUID } from 'node:crypto';
import type { AgentEngine, EngineExecutionContext, EngineInitOptions } from './types';
import type { AgentMessage, RealtimeEvent } from '../types';
import { getChromeMcpUrl } from '../../constant';
import { TOOL_SCHEMAS, NativeMessageType } from 'chrome-mcp-shared';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';

/**
 * GeminiEngine integrates Google Gemini Models as an AgentEngine implementation.
 */
export class GeminiEngine implements AgentEngine {
    public readonly name = 'gemini' as const;
    public readonly supportsMcp = true;

    async initializeAndRun(options: EngineInitOptions, ctx: EngineExecutionContext): Promise<void> {
        const {
            sessionId,
            instruction,
            model,
            requestId,
            signal,
            attachments,
            resolvedImagePaths,
        } = options;

        if (signal?.aborted) {
            throw new Error('GeminiEngine: execution was cancelled');
        }

        const apiKey = process.env.GOOGLE_API_KEY;
        console.error(`[GeminiEngine] Checking API Key. Key present: ${!!apiKey}`);
        if (!apiKey) {
            throw new Error('GeminiEngine: GOOGLE_API_KEY environment variable is not set');
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        console.error(`[GeminiEngine] Request for model: ${model}`);
        // Fallback to gemini-2.5-flash as it is confirmed working for this user
        let resolvedModel = model || 'gemini-2.5-flash';

        // Aggressively force 2.5 flash if we see 2.0 or 1.5 variants which are failing/rate-limited
        if (!model || model.includes('2.0') || model.includes('1.5')) {
            console.error(`[GeminiEngine] Forcing switch to gemini-2.5-flash (User has access to 2.5 preview)`);
            resolvedModel = 'gemini-2.5-flash';
        }

        // Convert MCP tool schemas to Gemini function declarations
        const tools: any[] = [
            {
                functionDeclarations: TOOL_SCHEMAS.map(tool => {
                    const sanitizeSchema = (schema: any): any => {
                        // 1. Flatten oneOf/anyOf to string (Gemini doesn't support polymorphism well)
                        if (schema.oneOf || schema.anyOf) {
                            return { type: 'string', description: schema.description };
                        }

                        // 2. Extract standard fields
                        const { type, properties, required, description, items, enum: enumValues } = schema;
                        const newSchema: any = { description };

                        // 3. Handle Types
                        if (type) {
                            let typeStr = Array.isArray(type)
                                ? (type.find((t: any) => t !== 'null') || 'string')
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
                        } else {
                            // Infer type if missing
                            if (properties) {
                                newSchema.type = 'OBJECT';
                                newSchema.properties = {};
                                for (const [key, value] of Object.entries(properties)) {
                                    newSchema.properties[key] = sanitizeSchema(value);
                                }
                            } else {
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
            console.error(`[GeminiEngine] Starting session with model: ${resolvedModel}`);

            const chat = generativeModel.startChat({
                history: [],
            });

            let currentPrompt: string | Array<string | Part> = instruction;

            // Handle images if any
            if (resolvedImagePaths && resolvedImagePaths.length > 0) {
                const fs = await import('node:fs/promises');
                const imageParts: Part[] = await Promise.all(
                    resolvedImagePaths.map(async (p) => {
                        const data = await fs.readFile(p);
                        return {
                            inlineData: {
                                data: data.toString('base64'),
                                mimeType: 'image/png', // Assuming PNG for now
                            },
                        };
                    })
                );
                currentPrompt = [instruction, ...imageParts];
            }

            // Loop for tool calls
            while (true) {
                if (signal?.aborted) throw new Error('Cancelled');

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
                const toolResultsParts: Part[] = [];
                for (const call of calls) {
                    const { name, args } = call;
                    const callId = randomUUID();
                    emitToolCall(name, args, callId);

                    try {
                        // Use injected nativeHost instance
                        let nativeMessagingHostInstance = (options as any).nativeMessagingHost;

                        if (!nativeMessagingHostInstance) {
                            // Fallback (though this path is circular and likely fails, we keep it just in case)
                            const module = await import('../../native-messaging-host.js');
                            nativeMessagingHostInstance = (module as any).default;
                        }

                        if (!nativeMessagingHostInstance) {
                            throw new Error('NativeMessagingHost instance not ready');
                        }

                        const response = await nativeMessagingHostInstance.sendRequestToExtensionAndWait(
                            { name, args },
                            NativeMessageType.CALL_TOOL,
                            120000
                        );

                        const toolResult = response.status === 'success' ? response.data : { error: response.error };

                        emitToolResult(name, toolResult, callId);
                        toolResultsParts.push({
                            functionResponse: {
                                name,
                                response: { result: toolResult },
                            }
                        });
                    } catch (err) {
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

        } catch (error) {
            console.error(`[GeminiEngine] Error:`, error);
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
