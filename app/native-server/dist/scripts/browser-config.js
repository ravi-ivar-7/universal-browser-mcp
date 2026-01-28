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
exports.BrowserType = void 0;
exports.getBrowserConfig = getBrowserConfig;
exports.detectInstalledBrowsers = detectInstalledBrowsers;
exports.getAllBrowserConfigs = getAllBrowserConfigs;
exports.parseBrowserType = parseBrowserType;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const constant_1 = require("./constant");
var BrowserType;
(function (BrowserType) {
    BrowserType["CHROME"] = "chrome";
    BrowserType["CHROMIUM"] = "chromium";
})(BrowserType || (exports.BrowserType = BrowserType = {}));
/**
 * Get the user-level manifest path for a specific browser
 */
function getUserManifestPathForBrowser(browser) {
    const platform = os.platform();
    if (platform === 'win32') {
        const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        switch (browser) {
            case BrowserType.CHROME:
                return path.join(appData, 'Google', 'Chrome', 'NativeMessagingHosts', `${constant_1.HOST_NAME}.json`);
            case BrowserType.CHROMIUM:
                return path.join(appData, 'Chromium', 'NativeMessagingHosts', `${constant_1.HOST_NAME}.json`);
            default:
                return path.join(appData, 'Google', 'Chrome', 'NativeMessagingHosts', `${constant_1.HOST_NAME}.json`);
        }
    }
    else if (platform === 'darwin') {
        const home = os.homedir();
        switch (browser) {
            case BrowserType.CHROME:
                return path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts', `${constant_1.HOST_NAME}.json`);
            case BrowserType.CHROMIUM:
                return path.join(home, 'Library', 'Application Support', 'Chromium', 'NativeMessagingHosts', `${constant_1.HOST_NAME}.json`);
            default:
                return path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts', `${constant_1.HOST_NAME}.json`);
        }
    }
    else {
        // Linux
        const home = os.homedir();
        switch (browser) {
            case BrowserType.CHROME:
                return path.join(home, '.config', 'google-chrome', 'NativeMessagingHosts', `${constant_1.HOST_NAME}.json`);
            case BrowserType.CHROMIUM:
                return path.join(home, '.config', 'chromium', 'NativeMessagingHosts', `${constant_1.HOST_NAME}.json`);
            default:
                return path.join(home, '.config', 'google-chrome', 'NativeMessagingHosts', `${constant_1.HOST_NAME}.json`);
        }
    }
}
/**
 * Get the system-level manifest path for a specific browser
 */
function getSystemManifestPathForBrowser(browser) {
    const platform = os.platform();
    if (platform === 'win32') {
        const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
        switch (browser) {
            case BrowserType.CHROME:
                return path.join(programFiles, 'Google', 'Chrome', 'NativeMessagingHosts', `${constant_1.HOST_NAME}.json`);
            case BrowserType.CHROMIUM:
                return path.join(programFiles, 'Chromium', 'NativeMessagingHosts', `${constant_1.HOST_NAME}.json`);
            default:
                return path.join(programFiles, 'Google', 'Chrome', 'NativeMessagingHosts', `${constant_1.HOST_NAME}.json`);
        }
    }
    else if (platform === 'darwin') {
        switch (browser) {
            case BrowserType.CHROME:
                return path.join('/Library', 'Google', 'Chrome', 'NativeMessagingHosts', `${constant_1.HOST_NAME}.json`);
            case BrowserType.CHROMIUM:
                return path.join('/Library', 'Application Support', 'Chromium', 'NativeMessagingHosts', `${constant_1.HOST_NAME}.json`);
            default:
                return path.join('/Library', 'Google', 'Chrome', 'NativeMessagingHosts', `${constant_1.HOST_NAME}.json`);
        }
    }
    else {
        // Linux
        switch (browser) {
            case BrowserType.CHROME:
                return path.join('/etc', 'opt', 'chrome', 'native-messaging-hosts', `${constant_1.HOST_NAME}.json`);
            case BrowserType.CHROMIUM:
                return path.join('/etc', 'chromium', 'native-messaging-hosts', `${constant_1.HOST_NAME}.json`);
            default:
                return path.join('/etc', 'opt', 'chrome', 'native-messaging-hosts', `${constant_1.HOST_NAME}.json`);
        }
    }
}
/**
 * Get Windows registry keys for a browser
 */
function getRegistryKeys(browser) {
    if (os.platform() !== 'win32')
        return undefined;
    const browserPaths = {
        [BrowserType.CHROME]: {
            user: `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${constant_1.HOST_NAME}`,
            system: `HKLM\\Software\\Google\\Chrome\\NativeMessagingHosts\\${constant_1.HOST_NAME}`,
        },
        [BrowserType.CHROMIUM]: {
            user: `HKCU\\Software\\Chromium\\NativeMessagingHosts\\${constant_1.HOST_NAME}`,
            system: `HKLM\\Software\\Chromium\\NativeMessagingHosts\\${constant_1.HOST_NAME}`,
        },
    };
    return browserPaths[browser];
}
/**
 * Get browser configuration
 */
function getBrowserConfig(browser) {
    const registryKeys = getRegistryKeys(browser);
    return {
        type: browser,
        displayName: browser.charAt(0).toUpperCase() + browser.slice(1),
        userManifestPath: getUserManifestPathForBrowser(browser),
        systemManifestPath: getSystemManifestPathForBrowser(browser),
        registryKey: registryKeys === null || registryKeys === void 0 ? void 0 : registryKeys.user,
        systemRegistryKey: registryKeys === null || registryKeys === void 0 ? void 0 : registryKeys.system,
    };
}
/**
 * Detect installed browsers on the system
 */
function detectInstalledBrowsers() {
    const detectedBrowsers = [];
    const platform = os.platform();
    if (platform === 'win32') {
        // Check Windows registry for installed browsers
        const browsers = [
            { type: BrowserType.CHROME, registryPath: 'HKLM\\SOFTWARE\\Google\\Chrome' },
            { type: BrowserType.CHROMIUM, registryPath: 'HKLM\\SOFTWARE\\Chromium' },
        ];
        for (const browser of browsers) {
            try {
                (0, child_process_1.execSync)(`reg query "${browser.registryPath}" 2>nul`, { stdio: 'pipe' });
                detectedBrowsers.push(browser.type);
            }
            catch (_a) {
                // Browser not installed
            }
        }
    }
    else if (platform === 'darwin') {
        // Check macOS Applications folder
        const browsers = [
            { type: BrowserType.CHROME, appPath: '/Applications/Google Chrome.app' },
            { type: BrowserType.CHROMIUM, appPath: '/Applications/Chromium.app' },
        ];
        for (const browser of browsers) {
            if (fs.existsSync(browser.appPath)) {
                detectedBrowsers.push(browser.type);
            }
        }
    }
    else {
        // Check Linux paths using which command
        const browsers = [
            { type: BrowserType.CHROME, commands: ['google-chrome', 'google-chrome-stable'] },
            { type: BrowserType.CHROMIUM, commands: ['chromium', 'chromium-browser'] },
        ];
        for (const browser of browsers) {
            for (const cmd of browser.commands) {
                try {
                    (0, child_process_1.execSync)(`which ${cmd} 2>/dev/null`, { stdio: 'pipe' });
                    detectedBrowsers.push(browser.type);
                    break; // Found one command, no need to check others
                }
                catch (_b) {
                    // Command not found
                }
            }
        }
    }
    return detectedBrowsers;
}
/**
 * Get all supported browser configs
 */
function getAllBrowserConfigs() {
    return Object.values(BrowserType).map((browser) => getBrowserConfig(browser));
}
/**
 * Parse browser type from string
 */
function parseBrowserType(browserStr) {
    const normalized = browserStr.toLowerCase();
    return Object.values(BrowserType).find((type) => type === normalized);
}
//# sourceMappingURL=browser-config.js.map