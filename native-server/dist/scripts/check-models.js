"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generative_ai_1 = require("@google/generative-ai");
const dotenv_1 = require("dotenv");
const path_1 = require("path");
// Load env
(0, dotenv_1.config)({ path: (0, path_1.join)(__dirname, '../../.env') });
const apiKey = process.env.GOOGLE_API_KEY;
console.log('API Key present:', !!apiKey);
const modelsToTry = [
    'gemini-2.0-flash-exp', // Often the actual ID for "2.0 Flash"
    'gemini-2.0-pro-exp-02-05',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-8b',
    // Guessing IDs based on screenshot names
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-3-flash',
    'gemini-3.0-flash',
    'gemini-robotics-er-1.5-preview'
];
async function test() {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey || '');
    for (const model of modelsToTry) {
        console.log(`Testing model: ${model}`);
        try {
            const m = genAI.getGenerativeModel({ model });
            const result = await m.generateContent('Hello, are you there?');
            const response = await result.response;
            console.log(`SUCCESS: ${model} -> ${response.text().slice(0, 20)}...`);
        }
        catch (e) {
            console.log(`FAILED: ${model} -> ${e.message.split('\n')[0]}`);
        }
    }
}
test();
//# sourceMappingURL=check-models.js.map