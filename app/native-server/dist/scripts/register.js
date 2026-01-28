#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const constant_1 = require("./constant");
const utils_1 = require("./utils");
/**
 * Main function
 */
async function main() {
    console.log((0, utils_1.colorText)(`Registering ${constant_1.COMMAND_NAME} Native Messaging Host...`, 'blue'));
    try {
        // Write Node.js path before registration
        (0, utils_1.writeNodePathFile)(path_1.default.join(__dirname, '..'));
        await (0, utils_1.registerWithElevatedPermissions)();
        console.log((0, utils_1.colorText)('Registration successful! The Chrome extension can now communicate with the local service via Native Messaging.', 'green'));
    }
    catch (error) {
        console.error((0, utils_1.colorText)(`Registration failed: ${error.message}`, 'red'));
        process.exit(1);
    }
}
// Execute main function
main();
//# sourceMappingURL=register.js.map