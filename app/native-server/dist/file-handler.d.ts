/**
 * File handler for managing file uploads through the native messaging host
 */
export declare class FileHandler {
    private tempDir;
    constructor();
    /**
     * Handle file preparation request from the extension
     */
    handleFileRequest(request: any): Promise<any>;
    /**
     * Download a file from URL and save to temp directory
     */
    private downloadFile;
    /**
     * Save base64 data as a file
     */
    private saveBase64File;
    /**
     * Verify that a file exists and is accessible
     */
    private verifyFile;
    /**
     * Read file content and return as base64 string
     */
    private readBase64File;
    /**
     * Clean up a temporary file
     */
    private cleanupFile;
    /**
     * Generate a filename from URL or create a unique one
     */
    private generateFileName;
    /**
     * Clean up old temporary files (older than 1 hour)
     */
    cleanupOldFiles(): void;
}
declare const _default: FileHandler;
export default _default;
