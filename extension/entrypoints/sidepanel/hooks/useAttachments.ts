import { useState, useCallback, useMemo, useRef } from 'react';
import type { AgentAttachment } from 'chrome-mcp-shared';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ATTACHMENTS = 10; // Maximum number of attachments

// Allowed image MIME types (exclude SVG for security)
const ALLOWED_IMAGE_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
]);

/**
 * Extended attachment type with preview URL support.
 */
export interface AttachmentWithPreview extends AgentAttachment {
    /** Unique ID for the attachment */
    id: string;
    /** Data URL for image preview (data:xxx;base64,...) */
    previewUrl?: string;
}

export function useAttachments() {
    const [attachments, setAttachments] = useState<AttachmentWithPreview[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Computed
    const hasImages = useMemo(() => attachments.some((a) => a.type === 'image'), [attachments]);
    const canAddMore = useMemo(() => attachments.length < MAX_ATTACHMENTS, [attachments]);

    /**
     * Open file picker for image selection.
     */
    const openFilePicker = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    /**
     * Convert file to base64 string.
     */
    const fileToBase64 = useCallback((file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                // Remove data:xxx;base64, prefix
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }, []);

    /**
     * Generate preview URL for image attachments.
     */
    const getPreviewUrl = useCallback((attachment: AttachmentWithPreview): string => {
        if (attachment.previewUrl) {
            return attachment.previewUrl;
        }
        // Generate data URL from base64
        return `data:${attachment.mimeType};base64,${attachment.dataBase64}`;
    }, []);

    /**
     * Process files and add them as attachments.
     */
    const handleFiles = useCallback(async (files: File[]) => {
        setError(null);

        // Filter to only allowed image types (exclude SVG for security)
        const imageFiles = files.filter((file) => ALLOWED_IMAGE_TYPES.has(file.type));
        if (imageFiles.length === 0) {
            setError('Only PNG, JPEG, GIF, and WebP images are supported.');
            return;
        }

        // Check attachment limit
        const remaining = MAX_ATTACHMENTS - attachments.length;
        if (remaining <= 0) {
            setError(`Maximum ${MAX_ATTACHMENTS} attachments allowed.`);
            return;
        }

        const filesToProcess = imageFiles.slice(0, remaining);
        if (filesToProcess.length < imageFiles.length) {
            setError(`Only ${remaining} more attachment(s) allowed. Some files were skipped.`);
        }

        const newAttachments: AttachmentWithPreview[] = [];

        for (const file of filesToProcess) {
            // Validate file size
            if (file.size > MAX_FILE_SIZE) {
                setError(`File "${file.name}" is too large. Maximum size is 10MB.`);
                continue;
            }

            try {
                const base64 = await fileToBase64(file);
                const previewUrl = `data:${file.type};base64,${base64}`;

                newAttachments.push({
                    id: Math.random().toString(36).substring(7) + Date.now(),
                    type: 'image',
                    name: file.name,
                    mimeType: file.type || 'image/png',
                    dataBase64: base64,
                    previewUrl,
                });
            } catch (err) {
                console.error('Failed to read file:', err);
                setError(`Failed to read file "${file.name}".`);
            }
        }

        setAttachments(prev => [...prev, ...newAttachments]);
    }, [attachments, fileToBase64]);

    /**
     * Handle file selection from input element.
     */
    const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        await handleFiles(Array.from(files));

        // Clear input to allow selecting the same file again
        event.target.value = '';
    }, [handleFiles]);

    // Also support the original simpler Event if passed from manual event listener
    const handleFileSelectManual = useCallback(async (event: Event) => {
        const input = event.target as HTMLInputElement;
        const files = input.files;
        if (!files || files.length === 0) return;

        await handleFiles(Array.from(files));
        input.value = '';
    }, [handleFiles]);


    const handleDragOver = useCallback((event: React.DragEvent | DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((event: React.DragEvent | DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback(async (event: React.DragEvent | DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(false);

        // Check various sources of files
        let files: FileList | null = null;
        if ('dataTransfer' in event) {
            files = event.dataTransfer?.files || null;
        }

        if (!files || files.length === 0) return;

        await handleFiles(Array.from(files));
    }, [handleFiles]);

    const handlePaste = useCallback(async (event: React.ClipboardEvent | ClipboardEvent) => {
        const clipboardData = 'clipboardData' in event ? event.clipboardData : (event as any).originalEvent?.clipboardData;
        const items = clipboardData?.items;
        if (!items) return;

        const imageFiles: File[] = [];
        for (const item of items) {
            if (ALLOWED_IMAGE_TYPES.has(item.type)) {
                const file = item.getAsFile();
                if (file) {
                    const ext = item.type.split('/')[1] || 'png';
                    const namedFile = new File([file], `pasted-image-${Date.now()}.${ext}`, {
                        type: file.type,
                    });
                    imageFiles.push(namedFile);
                }
            }
        }

        if (imageFiles.length > 0) {
            event.preventDefault();
            await handleFiles(imageFiles);
        }
    }, [handleFiles]);

    const removeAttachment = useCallback((id: string) => {
        setAttachments(prev => prev.filter(a => a.id !== id));
        setError(null);
    }, []);


    const clearAttachments = useCallback(() => {
        setAttachments([]);
        setError(null);
    }, []);

    const getAttachments = useCallback((): AgentAttachment[] | undefined => {
        if (attachments.length === 0) return undefined;
        return attachments.map(({ type, name, mimeType, dataBase64 }) => ({
            type,
            name,
            mimeType,
            dataBase64,
        }));
    }, [attachments]);

    return {
        attachments,
        fileInputRef,
        error,
        isDragOver,
        hasImages,
        canAddMore,

        openFilePicker,
        handleFileSelect,
        handleFileSelectManual, // for raw event listeners
        handleFiles,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        handlePaste,
        removeAttachment,
        clearAttachments,
        getAttachments,
        getPreviewUrl,
    };
}
