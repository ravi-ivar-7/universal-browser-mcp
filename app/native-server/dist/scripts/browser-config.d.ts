export declare enum BrowserType {
    CHROME = "chrome",
    CHROMIUM = "chromium"
}
export interface BrowserConfig {
    type: BrowserType;
    displayName: string;
    userManifestPath: string;
    systemManifestPath: string;
    registryKey?: string;
    systemRegistryKey?: string;
}
/**
 * Get browser configuration
 */
export declare function getBrowserConfig(browser: BrowserType): BrowserConfig;
/**
 * Detect installed browsers on the system
 */
export declare function detectInstalledBrowsers(): BrowserType[];
/**
 * Get all supported browser configs
 */
export declare function getAllBrowserConfigs(): BrowserConfig[];
/**
 * Parse browser type from string
 */
export declare function parseBrowserType(browserStr: string): BrowserType | undefined;
