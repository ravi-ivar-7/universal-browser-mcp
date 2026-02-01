#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const utils_1 = require("./scripts/utils");
const browser_config_1 = require("./scripts/browser-config");
const doctor_1 = require("./scripts/doctor");
const report_1 = require("./scripts/report");
commander_1.program
    .version(require('../package.json').version)
    .description('Mcp Chrome Bridge - Local service for communicating with Chrome extension');
// Register Native Messaging host
commander_1.program
    .command('register')
    .description('Register Native Messaging host')
    .option('-f, --force', 'Force re-registration')
    .option('-s, --system', 'Use system-level installation (requires administrator/sudo privileges)')
    .option('-b, --browser <browser>', 'Register for specific browser (chrome, chromium, or all)')
    .option('-d, --detect', 'Auto-detect installed browsers')
    .action(async (options) => {
    try {
        // Write Node.js path for run_host scripts
        (0, utils_1.writeNodePathFile)(__dirname);
        // Determine which browsers to register
        let targetBrowsers;
        if (options.browser) {
            if (options.browser.toLowerCase() === 'all') {
                targetBrowsers = [browser_config_1.BrowserType.CHROME, browser_config_1.BrowserType.CHROMIUM];
                console.log((0, utils_1.colorText)('Registering for all supported browsers...', 'blue'));
            }
            else {
                const browserType = (0, browser_config_1.parseBrowserType)(options.browser);
                if (!browserType) {
                    console.error((0, utils_1.colorText)(`Invalid browser: ${options.browser}. Use 'chrome', 'chromium', or 'all'`, 'red'));
                    process.exit(1);
                }
                targetBrowsers = [browserType];
            }
        }
        else if (options.detect) {
            targetBrowsers = (0, browser_config_1.detectInstalledBrowsers)();
            if (targetBrowsers.length === 0) {
                console.log((0, utils_1.colorText)('No supported browsers detected, will register for Chrome and Chromium', 'yellow'));
                targetBrowsers = undefined; // Will use default behavior
            }
        }
        // If neither option specified, tryRegisterUserLevelHost will detect browsers
        // Detect if running with root/administrator privileges
        const isRoot = process.getuid && process.getuid() === 0; // Unix/Linux/Mac
        let isAdmin = false;
        if (process.platform === 'win32') {
            try {
                isAdmin = require('is-admin')(); // Windows requires additional package
            }
            catch (error) {
                console.warn((0, utils_1.colorText)('Warning: Unable to detect administrator privileges on Windows', 'yellow'));
                isAdmin = false;
            }
        }
        const hasElevatedPermissions = isRoot || isAdmin;
        // If --system option is specified or running with root/administrator privileges
        if (options.system || hasElevatedPermissions) {
            // TODO: Update registerWithElevatedPermissions to support multiple browsers
            await (0, utils_1.registerWithElevatedPermissions)();
            console.log((0, utils_1.colorText)('System-level Native Messaging host registered successfully!', 'green'));
            console.log((0, utils_1.colorText)('You can now use connectNative in Chrome extension to connect to this service.', 'blue'));
        }
        else {
            // Regular user-level installation
            console.log((0, utils_1.colorText)('Registering user-level Native Messaging host...', 'blue'));
            const success = await (0, utils_1.tryRegisterUserLevelHost)(targetBrowsers);
            if (success) {
                console.log((0, utils_1.colorText)('Native Messaging host registered successfully!', 'green'));
                console.log((0, utils_1.colorText)('You can now use connectNative in Chrome extension to connect to this service.', 'blue'));
            }
            else {
                console.log((0, utils_1.colorText)('User-level registration failed, please try the following methods:', 'yellow'));
                console.log((0, utils_1.colorText)('  1. sudo mcp-chrome-bridge register', 'yellow'));
                console.log((0, utils_1.colorText)('  2. mcp-chrome-bridge register --system', 'yellow'));
                process.exit(1);
            }
        }
    }
    catch (error) {
        console.error((0, utils_1.colorText)(`Registration failed: ${error.message}`, 'red'));
        process.exit(1);
    }
});
// Fix execution permissions
commander_1.program
    .command('fix-permissions')
    .description('Fix execution permissions for native host files')
    .action(async () => {
    try {
        console.log((0, utils_1.colorText)('Fixing execution permissions...', 'blue'));
        await (0, utils_1.ensureExecutionPermissions)();
        console.log((0, utils_1.colorText)('✓ Execution permissions fixed successfully!', 'green'));
    }
    catch (error) {
        console.error((0, utils_1.colorText)(`Failed to fix permissions: ${error.message}`, 'red'));
        process.exit(1);
    }
});
// Update port in stdio-config.json
commander_1.program
    .command('update-port <port>')
    .description('Update the port number in stdio-config.json')
    .action(async (port) => {
    try {
        const portNumber = parseInt(port, 10);
        if (isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
            console.error((0, utils_1.colorText)('Error: Port must be a valid number between 1 and 65535', 'red'));
            process.exit(1);
        }
        const configPath = path.join(__dirname, 'mcp', 'stdio-config.json');
        if (!fs.existsSync(configPath)) {
            console.error((0, utils_1.colorText)(`Error: Configuration file not found at ${configPath}`, 'red'));
            process.exit(1);
        }
        const configData = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configData);
        const currentUrl = new URL(config.url);
        currentUrl.port = portNumber.toString();
        config.url = currentUrl.toString();
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
        console.log((0, utils_1.colorText)(`✓ Port updated successfully to ${portNumber}`, 'green'));
        console.log((0, utils_1.colorText)(`Updated URL: ${config.url}`, 'blue'));
    }
    catch (error) {
        console.error((0, utils_1.colorText)(`Failed to update port: ${error.message}`, 'red'));
        process.exit(1);
    }
});
// Diagnose installation and environment issues
commander_1.program
    .command('doctor')
    .description('Diagnose installation and environment issues')
    .option('--json', 'Output diagnostics as JSON')
    .option('--fix', 'Attempt to fix common issues automatically')
    .option('-b, --browser <browser>', 'Target browser (chrome, chromium, or all)')
    .action(async (options) => {
    try {
        const exitCode = await (0, doctor_1.runDoctor)({
            json: Boolean(options.json),
            fix: Boolean(options.fix),
            browser: options.browser,
        });
        process.exit(exitCode);
    }
    catch (error) {
        console.error((0, utils_1.colorText)(`Doctor failed: ${error.message}`, 'red'));
        process.exit(1);
    }
});
// Export diagnostic report for GitHub Issues
commander_1.program
    .command('report')
    .description('Export a diagnostic report for GitHub Issues')
    .option('--json', 'Output report as JSON (default: Markdown)')
    .option('--output <file>', 'Write report to file instead of stdout')
    .option('--copy', 'Copy report to clipboard')
    .option('--no-redact', 'Disable redaction of usernames/paths/tokens')
    .option('--include-logs <mode>', 'Include wrapper logs: none | tail | full', 'tail')
    .option('--log-lines <n>', 'Lines to include when --include-logs=tail', '200')
    .option('-b, --browser <browser>', 'Target browser (chrome, chromium, or all)')
    .action(async (options) => {
    try {
        const exitCode = await (0, report_1.runReport)({
            json: Boolean(options.json),
            output: options.output,
            copy: Boolean(options.copy),
            redact: options.redact,
            includeLogs: options.includeLogs,
            logLines: options.logLines ? parseInt(options.logLines, 10) : undefined,
            browser: options.browser,
        });
        process.exit(exitCode);
    }
    catch (error) {
        console.error((0, utils_1.colorText)(`Report failed: ${error.message}`, 'red'));
        process.exit(1);
    }
});
commander_1.program.parse(process.argv);
// If no command provided, show help
if (!process.argv.slice(2).length) {
    commander_1.program.outputHelp();
}
//# sourceMappingURL=cli.js.map