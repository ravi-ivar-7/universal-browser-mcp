#!/usr/bin/env node
/**
 * doctor.ts
 *
 * Diagnoses common installation and runtime issues for the Chrome Native Messaging host.
 * Provides checks for manifest files, Node.js path, permissions, and connectivity.
 */
export interface DoctorOptions {
    json?: boolean;
    fix?: boolean;
    browser?: string;
}
export type DoctorStatus = 'ok' | 'warn' | 'error';
export interface DoctorFixAttempt {
    id: string;
    description: string;
    success: boolean;
    error?: string;
}
export interface DoctorCheckResult {
    id: string;
    title: string;
    status: DoctorStatus;
    message: string;
    details?: Record<string, unknown>;
}
export interface DoctorReport {
    schemaVersion: number;
    timestamp: string;
    ok: boolean;
    summary: {
        ok: number;
        warn: number;
        error: number;
    };
    environment: {
        platform: NodeJS.Platform;
        arch: string;
        node: {
            version: string;
            execPath: string;
        };
        package: {
            name: string;
            version: string;
            rootDir: string;
            distDir: string;
        };
        command: {
            canonical: string;
            aliases: string[];
        };
        nativeHost: {
            hostName: string;
            expectedPort: number;
        };
    };
    fixes: DoctorFixAttempt[];
    checks: DoctorCheckResult[];
    nextSteps: string[];
}
/**
 * Collect doctor report without outputting to console.
 * Used by both runDoctor and report command.
 */
export declare function collectDoctorReport(options: DoctorOptions): Promise<DoctorReport>;
/**
 * Run doctor command with console output.
 */
export declare function runDoctor(options: DoctorOptions): Promise<number>;
