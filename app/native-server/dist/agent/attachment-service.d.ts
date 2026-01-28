import type { AgentAttachment, AttachmentMetadata, AttachmentProjectStats } from 'chrome-mcp-shared';
export interface SaveAttachmentInput {
    projectId: string;
    messageId: string;
    attachment: AgentAttachment;
    index: number;
}
export interface SavedAttachment {
    /** Absolute path on disk (for engines) */
    absolutePath: string;
    /** Persisted filename under project dir */
    filename: string;
    /** Metadata to store in message.metadata.attachments */
    metadata: AttachmentMetadata;
}
export interface AttachmentStats {
    rootDir: string;
    totalFiles: number;
    totalBytes: number;
    projects: AttachmentProjectStats[];
}
export interface CleanupAttachmentsInput {
    /** If omitted, cleanup all project dirs under root */
    projectIds?: string[];
}
export interface CleanupProjectResult {
    projectId: string;
    dirPath: string;
    existed: boolean;
    removedFiles: number;
    removedBytes: number;
}
export interface CleanupResult {
    rootDir: string;
    removedFiles: number;
    removedBytes: number;
    results: CleanupProjectResult[];
}
export declare class AttachmentService {
    /**
     * Get the root directory for all attachments.
     */
    getAttachmentsRootDir(): string;
    /**
     * Get the directory for a specific project's attachments.
     */
    getProjectAttachmentsDir(projectId: string): string;
    /**
     * Get the absolute path for a specific attachment file.
     * Validates to prevent path traversal attacks.
     */
    getAttachmentPath(projectId: string, filename: string): string;
    /**
     * Save an attachment to persistent storage.
     * Creates directories if needed.
     */
    saveAttachment(input: SaveAttachmentInput): Promise<SavedAttachment>;
    /**
     * Get statistics for all attachments.
     */
    getAttachmentStats(): Promise<AttachmentStats>;
    /**
     * Get statistics for a single project.
     */
    private getProjectStats;
    /**
     * Cleanup attachments for specified projects or all projects.
     */
    cleanupAttachments(input?: CleanupAttachmentsInput): Promise<CleanupResult>;
    /**
     * Cleanup attachments for a single project.
     */
    private cleanupProject;
    /**
     * Check if an attachment file exists.
     */
    attachmentExists(projectId: string, filename: string): Promise<boolean>;
    /**
     * Read an attachment file.
     */
    readAttachment(projectId: string, filename: string): Promise<Buffer>;
}
export declare const attachmentService: AttachmentService;
