export interface DirectoryPickerResult {
    success: boolean;
    path?: string;
    cancelled?: boolean;
    error?: string;
}
/**
 * Open a native directory picker dialog.
 * Returns the selected directory path or indicates cancellation.
 */
export declare function openDirectoryPicker(title?: string): Promise<DirectoryPickerResult>;
