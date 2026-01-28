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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileHandler = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const crypto = __importStar(require("crypto"));
const node_fetch_1 = __importDefault(require("node-fetch"));
/**
 * File handler for managing file uploads through the native messaging host
 */
class FileHandler {
    constructor() {
        // Create a temp directory for file operations
        this.tempDir = path.join(os.tmpdir(), 'chrome-mcp-uploads');
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }
    /**
     * Handle file preparation request from the extension
     */
    async handleFileRequest(request) {
        const { action, fileUrl, base64Data, fileName, filePath, traceFilePath, insightName } = request;
        try {
            switch (action) {
                case 'prepareFile':
                    if (fileUrl) {
                        return await this.downloadFile(fileUrl, fileName);
                    }
                    else if (base64Data) {
                        return await this.saveBase64File(base64Data, fileName);
                    }
                    else if (filePath) {
                        return await this.verifyFile(filePath);
                    }
                    break;
                case 'readBase64File': {
                    if (!filePath)
                        return { success: false, error: 'filePath is required' };
                    return await this.readBase64File(filePath);
                }
                case 'cleanupFile':
                    return await this.cleanupFile(filePath);
                case 'analyzeTrace': {
                    const targetPath = traceFilePath || filePath;
                    if (!targetPath) {
                        return { success: false, error: 'traceFilePath is required' };
                    }
                    try {
                        // With tsconfig moduleResolution=NodeNext, relative ESM imports need explicit .js extension
                        const { analyzeTraceFile } = await import('./trace-analyzer.js');
                        const res = await analyzeTraceFile(targetPath, insightName);
                        return { success: true, ...res };
                    }
                    catch (e) {
                        return { success: false, error: (e === null || e === void 0 ? void 0 : e.message) || String(e) };
                    }
                }
                default:
                    return {
                        success: false,
                        error: `Unknown file action: ${action}`,
                    };
            }
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    /**
     * Download a file from URL and save to temp directory
     */
    async downloadFile(fileUrl, fileName) {
        try {
            const response = await (0, node_fetch_1.default)(fileUrl);
            if (!response.ok) {
                throw new Error(`Failed to download file: ${response.statusText}`);
            }
            // Generate filename if not provided
            const finalFileName = fileName || this.generateFileName(fileUrl);
            const filePath = path.join(this.tempDir, finalFileName);
            // Get the file buffer
            const buffer = await response.buffer();
            // Save to file
            fs.writeFileSync(filePath, buffer);
            return {
                success: true,
                filePath: filePath,
                fileName: finalFileName,
                size: buffer.length,
            };
        }
        catch (error) {
            throw new Error(`Failed to download file from URL: ${error}`);
        }
    }
    /**
     * Save base64 data as a file
     */
    async saveBase64File(base64Data, fileName) {
        try {
            // Remove data URL prefix if present
            const base64Content = base64Data.replace(/^data:.*?;base64,/, '');
            // Convert base64 to buffer
            const buffer = Buffer.from(base64Content, 'base64');
            // Generate filename if not provided
            const finalFileName = fileName || `upload-${Date.now()}.bin`;
            const filePath = path.join(this.tempDir, finalFileName);
            // Save to file
            fs.writeFileSync(filePath, buffer);
            return {
                success: true,
                filePath: filePath,
                fileName: finalFileName,
                size: buffer.length,
            };
        }
        catch (error) {
            throw new Error(`Failed to save base64 file: ${error}`);
        }
    }
    /**
     * Verify that a file exists and is accessible
     */
    async verifyFile(filePath) {
        try {
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                throw new Error(`File does not exist: ${filePath}`);
            }
            // Get file stats
            const stats = fs.statSync(filePath);
            // Check if it's actually a file
            if (!stats.isFile()) {
                throw new Error(`Path is not a file: ${filePath}`);
            }
            // Check if file is readable
            fs.accessSync(filePath, fs.constants.R_OK);
            return {
                success: true,
                filePath: filePath,
                fileName: path.basename(filePath),
                size: stats.size,
            };
        }
        catch (error) {
            throw new Error(`Failed to verify file: ${error}`);
        }
    }
    /**
     * Read file content and return as base64 string
     */
    async readBase64File(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error(`File does not exist: ${filePath}`);
            }
            const stats = fs.statSync(filePath);
            if (!stats.isFile()) {
                throw new Error(`Path is not a file: ${filePath}`);
            }
            const buf = fs.readFileSync(filePath);
            const base64 = buf.toString('base64');
            return {
                success: true,
                filePath,
                fileName: path.basename(filePath),
                size: stats.size,
                base64Data: base64,
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
    /**
     * Clean up a temporary file
     */
    async cleanupFile(filePath) {
        try {
            // Only allow cleanup of files in our temp directory
            if (!filePath.startsWith(this.tempDir)) {
                return {
                    success: false,
                    error: 'Can only cleanup files in temp directory',
                };
            }
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            return {
                success: true,
                message: 'File cleaned up successfully',
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to cleanup file: ${error}`,
            };
        }
    }
    /**
     * Generate a filename from URL or create a unique one
     */
    generateFileName(url) {
        if (url) {
            try {
                const urlObj = new URL(url);
                const pathname = urlObj.pathname;
                const basename = path.basename(pathname);
                if (basename && basename !== '/') {
                    // Add random suffix to avoid collisions
                    const ext = path.extname(basename);
                    const name = path.basename(basename, ext);
                    const randomSuffix = crypto.randomBytes(4).toString('hex');
                    return `${name}-${randomSuffix}${ext}`;
                }
            }
            catch (_a) {
                // Invalid URL, fall through to generate random name
            }
        }
        // Generate random filename
        return `upload-${crypto.randomBytes(8).toString('hex')}.bin`;
    }
    /**
     * Clean up old temporary files (older than 1 hour)
     */
    cleanupOldFiles() {
        try {
            const now = Date.now();
            const oneHour = 60 * 60 * 1000;
            const files = fs.readdirSync(this.tempDir);
            for (const file of files) {
                const filePath = path.join(this.tempDir, file);
                const stats = fs.statSync(filePath);
                if (now - stats.mtimeMs > oneHour) {
                    fs.unlinkSync(filePath);
                    // Use stderr to avoid polluting stdout (Native Messaging protocol)
                    console.error(`Cleaned up old temp file: ${file}`);
                }
            }
        }
        catch (error) {
            console.error('Error cleaning up old files:', error);
        }
    }
}
exports.FileHandler = FileHandler;
exports.default = new FileHandler();
//# sourceMappingURL=file-handler.js.map