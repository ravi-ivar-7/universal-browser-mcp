#!/usr/bin/env node
/**
 * report.ts
 *
 * Export a diagnostic report for GitHub Issues.
 * Collects system info, doctor output, logs, manifests, and registry info.
 */
import { DoctorReport } from './doctor';
type IncludeLogsMode = 'none' | 'tail' | 'full';
export interface ReportOptions {
    json?: boolean;
    output?: string;
    copy?: boolean;
    redact?: boolean;
    includeLogs?: string;
    logLines?: number;
    browser?: string;
}
interface VersionResult {
    version?: string;
    error?: string;
}
interface ManifestSnapshot {
    browser: string;
    scope: 'user' | 'system';
    path: string;
    exists: boolean;
    json?: unknown;
    raw?: string;
    error?: string;
}
interface LogFileSnapshot {
    name: string;
    path: string;
    mtime?: string;
    size?: number;
    note?: string;
    content?: string;
    truncated?: boolean;
    error?: string;
}
interface WrapperLogsSnapshot {
    dir: string;
    mode: IncludeLogsMode;
    files: LogFileSnapshot[];
    error?: string;
}
interface WindowsRegistryEntrySnapshot {
    browser: string;
    scope: 'user' | 'system';
    key: string;
    expectedManifestPath: string;
    value?: string;
    raw?: string;
    error?: string;
}
interface WindowsRegistrySnapshot {
    entries: WindowsRegistryEntrySnapshot[];
}
export interface DiagnosticReport {
    schemaVersion: number;
    timestamp: string;
    tool: {
        name: string;
        version: string;
    };
    environment: {
        platform: NodeJS.Platform;
        arch: string;
        node: {
            version: string;
            execPath: string;
        };
        os: {
            type: string;
            release: string;
            version?: string;
        };
        cwd: string;
        env: Record<string, string | null>;
    };
    packageManager: {
        npm: VersionResult;
        pnpm: VersionResult;
    };
    doctor?: DoctorReport;
    doctorError?: string;
    manifests: ManifestSnapshot[];
    wrapperLogs: WrapperLogsSnapshot;
    windowsRegistry?: WindowsRegistrySnapshot;
    redaction: {
        enabled: boolean;
    };
}
export declare function runReport(options: ReportOptions): Promise<number>;
export {};
