"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachmentService = exports.AttachmentService = void 0;
/**
 * Attachment Service for persisting and managing image attachments.
 *
 * Handles:
 * - Saving attachments to persistent storage (not temp files)
 * - Getting attachment statistics per project
 * - Cleaning up attachments by project or all
 *
 * Storage structure:
 *   ~/.chrome-mcp-agent/attachments/{projectId}/{messageId}-{index}-{uuid}.{ext}
 */
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const storage_1 = require("./storage");
// ============================================================
// Constants
// ============================================================
const ATTACHMENTS_DIR_NAME = 'attachments';
/** Allowed MIME types for image attachments */
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
// ============================================================
// Helper Functions
// ============================================================
/**
 * Convert MIME type to file extension.
 */
function mimeTypeToExt(mimeType) {
    switch (mimeType) {
        case 'image/png':
            return 'png';
        case 'image/jpeg':
            return 'jpg';
        case 'image/gif':
            return 'gif';
        case 'image/webp':
            return 'webp';
        default:
            return 'bin';
    }
}
/**
 * Build a unique filename for an attachment.
 * Format: {messageId}-{index}-{uuid}.{ext}
 */
function buildAttachmentFilename(params) {
    const ext = mimeTypeToExt(params.mimeType);
    const uuid = (0, node_crypto_1.randomUUID)().slice(0, 8);
    return `${params.messageId}-${params.index}-${uuid}.${ext}`;
}
/**
 * Validate filename to prevent path traversal attacks.
 */
function isValidFilename(filename) {
    // Reject empty, path separators, parent directory references
    if (!filename || filename.includes('/') || filename.includes('\\')) {
        return false;
    }
    if (filename === '.' || filename === '..' || filename.startsWith('.')) {
        return false;
    }
    // Only allow alphanumeric, dash, underscore, dot
    return /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(filename);
}
/**
 * Validate projectId to prevent path traversal attacks.
 */
function isValidProjectId(projectId) {
    if (!projectId)
        return false;
    // UUID format or alphanumeric with dashes
    return /^[a-zA-Z0-9_-]+$/.test(projectId);
}
// ============================================================
// AttachmentService Class
// ============================================================
class AttachmentService {
    /**
     * Get the root directory for all attachments.
     */
    getAttachmentsRootDir() {
        return node_path_1.default.join((0, storage_1.getAgentDataDir)(), ATTACHMENTS_DIR_NAME);
    }
    /**
     * Get the directory for a specific project's attachments.
     */
    getProjectAttachmentsDir(projectId) {
        if (!isValidProjectId(projectId)) {
            throw new Error(`Invalid projectId: ${projectId}`);
        }
        return node_path_1.default.join(this.getAttachmentsRootDir(), projectId);
    }
    /**
     * Get the absolute path for a specific attachment file.
     * Validates to prevent path traversal attacks.
     */
    getAttachmentPath(projectId, filename) {
        if (!isValidProjectId(projectId)) {
            throw new Error(`Invalid projectId: ${projectId}`);
        }
        if (!isValidFilename(filename)) {
            throw new Error(`Invalid filename: ${filename}`);
        }
        const projectDir = this.getProjectAttachmentsDir(projectId);
        const filePath = node_path_1.default.join(projectDir, filename);
        // Double-check resolved path is within project directory (defense in depth)
        const resolved = node_path_1.default.resolve(filePath);
        const resolvedProjectDir = node_path_1.default.resolve(projectDir);
        if (!resolved.startsWith(resolvedProjectDir + node_path_1.default.sep)) {
            throw new Error('Path traversal attempt detected');
        }
        return filePath;
    }
    /**
     * Save an attachment to persistent storage.
     * Creates directories if needed.
     */
    async saveAttachment(input) {
        const { projectId, messageId, attachment, index } = input;
        // Validate input
        if (!isValidProjectId(projectId)) {
            throw new Error(`Invalid projectId: ${projectId}`);
        }
        if (attachment.type !== 'image') {
            throw new Error(`Unsupported attachment type: ${attachment.type}`);
        }
        if (!ALLOWED_MIME_TYPES.has(attachment.mimeType)) {
            throw new Error(`Unsupported MIME type: ${attachment.mimeType}`);
        }
        // Build filename and paths
        const filename = buildAttachmentFilename({
            messageId,
            index,
            mimeType: attachment.mimeType,
        });
        const projectDir = this.getProjectAttachmentsDir(projectId);
        const absolutePath = node_path_1.default.join(projectDir, filename);
        // Decode base64 and get size
        const buffer = Buffer.from(attachment.dataBase64, 'base64');
        const sizeBytes = buffer.length;
        // Create directory and write file
        await promises_1.default.mkdir(projectDir, { recursive: true });
        await promises_1.default.writeFile(absolutePath, buffer);
        // Build metadata
        const metadata = {
            version: 1,
            kind: 'image',
            projectId,
            messageId,
            index,
            filename,
            urlPath: `/agent/attachments/${projectId}/${filename}`,
            mimeType: attachment.mimeType,
            sizeBytes,
            originalName: attachment.name,
            createdAt: new Date().toISOString(),
        };
        console.error(`[AttachmentService] Saved attachment: ${absolutePath} (${sizeBytes} bytes)`);
        return {
            absolutePath,
            filename,
            metadata,
        };
    }
    /**
     * Get statistics for all attachments.
     */
    async getAttachmentStats() {
        const rootDir = this.getAttachmentsRootDir();
        const projects = [];
        let totalFiles = 0;
        let totalBytes = 0;
        try {
            // Check if root directory exists
            await promises_1.default.access(rootDir);
            // Read all project directories
            const entries = await promises_1.default.readdir(rootDir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory())
                    continue;
                const projectId = entry.name;
                const dirPath = node_path_1.default.join(rootDir, projectId);
                try {
                    const stats = await this.getProjectStats(projectId, dirPath);
                    projects.push(stats);
                    totalFiles += stats.fileCount;
                    totalBytes += stats.totalBytes;
                }
                catch (error) {
                    // Skip directories we can't read
                    console.error(`[AttachmentService] Failed to stat project ${projectId}:`, error);
                }
            }
        }
        catch (_a) {
            // Root directory doesn't exist - return empty stats
        }
        return {
            rootDir,
            totalFiles,
            totalBytes,
            projects,
        };
    }
    /**
     * Get statistics for a single project.
     */
    async getProjectStats(projectId, dirPath) {
        let fileCount = 0;
        let totalBytes = 0;
        let lastModifiedAt;
        let latestMtime = 0;
        try {
            const files = await promises_1.default.readdir(dirPath);
            for (const file of files) {
                const filePath = node_path_1.default.join(dirPath, file);
                try {
                    const stat = await promises_1.default.stat(filePath);
                    if (stat.isFile()) {
                        fileCount++;
                        totalBytes += stat.size;
                        if (stat.mtimeMs > latestMtime) {
                            latestMtime = stat.mtimeMs;
                            lastModifiedAt = stat.mtime.toISOString();
                        }
                    }
                }
                catch (_a) {
                    // Skip files we can't stat
                }
            }
            return {
                projectId,
                dirPath,
                exists: true,
                fileCount,
                totalBytes,
                lastModifiedAt,
            };
        }
        catch (_b) {
            return {
                projectId,
                dirPath,
                exists: false,
                fileCount: 0,
                totalBytes: 0,
            };
        }
    }
    /**
     * Cleanup attachments for specified projects or all projects.
     */
    async cleanupAttachments(input) {
        const rootDir = this.getAttachmentsRootDir();
        const results = [];
        let totalRemovedFiles = 0;
        let totalRemovedBytes = 0;
        // Determine which projects to clean
        let projectIds;
        if ((input === null || input === void 0 ? void 0 : input.projectIds) && input.projectIds.length > 0) {
            // Clean specific projects
            projectIds = input.projectIds;
        }
        else {
            // Clean all projects - enumerate from filesystem
            try {
                const entries = await promises_1.default.readdir(rootDir, { withFileTypes: true });
                projectIds = entries.filter((e) => e.isDirectory()).map((e) => e.name);
            }
            catch (_a) {
                // Root doesn't exist - nothing to clean
                return {
                    rootDir,
                    removedFiles: 0,
                    removedBytes: 0,
                    results: [],
                };
            }
        }
        // Clean each project
        for (const projectId of projectIds) {
            if (!isValidProjectId(projectId)) {
                console.error(`[AttachmentService] Skipping invalid projectId: ${projectId}`);
                continue;
            }
            const result = await this.cleanupProject(projectId);
            results.push(result);
            totalRemovedFiles += result.removedFiles;
            totalRemovedBytes += result.removedBytes;
        }
        return {
            rootDir,
            removedFiles: totalRemovedFiles,
            removedBytes: totalRemovedBytes,
            results,
        };
    }
    /**
     * Cleanup attachments for a single project.
     */
    async cleanupProject(projectId) {
        const dirPath = this.getProjectAttachmentsDir(projectId);
        try {
            // Get stats before deletion
            const stats = await this.getProjectStats(projectId, dirPath);
            if (!stats.exists) {
                return {
                    projectId,
                    dirPath,
                    existed: false,
                    removedFiles: 0,
                    removedBytes: 0,
                };
            }
            // Remove directory and all contents
            await promises_1.default.rm(dirPath, { recursive: true, force: true });
            console.error(`[AttachmentService] Cleaned up ${stats.fileCount} files (${stats.totalBytes} bytes) for project ${projectId}`);
            return {
                projectId,
                dirPath,
                existed: true,
                removedFiles: stats.fileCount,
                removedBytes: stats.totalBytes,
            };
        }
        catch (error) {
            console.error(`[AttachmentService] Failed to cleanup project ${projectId}:`, error);
            return {
                projectId,
                dirPath,
                existed: false,
                removedFiles: 0,
                removedBytes: 0,
            };
        }
    }
    /**
     * Check if an attachment file exists.
     */
    async attachmentExists(projectId, filename) {
        try {
            const filePath = this.getAttachmentPath(projectId, filename);
            await promises_1.default.access(filePath);
            return true;
        }
        catch (_a) {
            return false;
        }
    }
    /**
     * Read an attachment file.
     */
    async readAttachment(projectId, filename) {
        const filePath = this.getAttachmentPath(projectId, filename);
        return promises_1.default.readFile(filePath);
    }
}
exports.AttachmentService = AttachmentService;
// ============================================================
// Singleton Export
// ============================================================
exports.attachmentService = new AttachmentService();
//# sourceMappingURL=attachment-service.js.map