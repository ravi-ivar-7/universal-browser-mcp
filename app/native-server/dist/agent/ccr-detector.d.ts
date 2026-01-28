/**
 * Result of CCR detection.
 */
export interface CcrDetectionResult {
    detected: boolean;
    baseUrl?: string;
    authToken?: string;
    source?: 'env' | 'config';
    error?: string;
}
/**
 * Result of validating CCR configuration.
 */
export interface CcrValidationResult {
    /** Whether a CCR config file was found and inspected */
    checked: boolean;
    /** Whether the configuration is valid */
    valid: boolean;
    /** Path to the CCR config file */
    configPath: string;
    /** Current Router.default value if available */
    routerDefault?: string;
    /** Human-readable issue description when valid is false */
    issue?: string;
    /** Suggested Router.default value in "provider,model" format */
    suggestedFix?: string;
    /** Full suggestion message for the user */
    suggestion?: string;
}
/**
 * Detect CCR configuration and verify it's running.
 *
 * This function:
 * 1. Returns cached result if still valid
 * 2. Checks if CCR env vars are already set in process.env
 * 3. If not, reads and parses CCR config file
 * 4. Verifies CCR is running via health check
 *
 * @returns Detection result with baseUrl and authToken if CCR is available
 */
export declare function detectCcr(): Promise<CcrDetectionResult>;
/**
 * Clear the CCR detection cache.
 * Useful for testing or when user wants to re-detect.
 */
export declare function clearCcrCache(): void;
/**
 * Validate CCR configuration for common misconfigurations.
 *
 * This function checks for issues that would cause runtime errors in CCR,
 * particularly the "Router.default must be provider,model" requirement.
 *
 * The most common misconfiguration is setting Router.default to just a provider
 * name (e.g., "venus") instead of the required "provider,model" format
 * (e.g., "venus,claude-4-5-sonnet-20250929"). This causes CCR to crash with
 * "Cannot read properties of undefined (reading 'includes')" when it tries
 * to split the model name.
 */
export declare function validateCcrConfig(): Promise<CcrValidationResult>;
