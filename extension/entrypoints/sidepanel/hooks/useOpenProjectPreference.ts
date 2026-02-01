import { useState, useCallback, useEffect } from 'react';
import type { OpenProjectTarget, OpenProjectResponse } from 'chrome-mcp-shared';

const STORAGE_KEY = 'agent-open-project-default';

export interface UseOpenProjectPreferenceOptions {
    getServerPort: () => number | null;
}

export function useOpenProjectPreference(options: UseOpenProjectPreferenceOptions) {
    const [defaultTarget, setDefaultTarget] = useState<OpenProjectTarget | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const load = async () => {
            const result = await chrome.storage.local.get(STORAGE_KEY);
            const stored = result[STORAGE_KEY];
            if (stored === 'vscode' || stored === 'terminal') {
                setDefaultTarget(stored);
            }
        };
        void load();
    }, []);

    const saveDefaultTarget = useCallback(async (target: OpenProjectTarget) => {
        await chrome.storage.local.set({ [STORAGE_KEY]: target });
        setDefaultTarget(target);
    }, []);

    const openBySession = useCallback(async (sessionId: string, target: OpenProjectTarget): Promise<OpenProjectResponse> => {
        const port = options.getServerPort();
        if (!port) return { success: false, error: 'Server not connected' };

        setLoading(true);
        try {
            const url = `http://127.0.0.1:${port}/agent/sessions/${encodeURIComponent(sessionId)}/open`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target }),
            });
            return await response.json();
        } catch (error) {
            return { success: false, error: String(error) };
        } finally {
            setLoading(false);
        }
    }, [options]);

    const openByProject = useCallback(async (projectId: string, target: OpenProjectTarget): Promise<OpenProjectResponse> => {
        const port = options.getServerPort();
        if (!port) return { success: false, error: 'Server not connected' };

        setLoading(true);
        try {
            const url = `http://127.0.0.1:${port}/agent/projects/${encodeURIComponent(projectId)}/open`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target }),
            });
            return await response.json();
        } catch (error) {
            return { success: false, error: String(error) };
        } finally {
            setLoading(false);
        }
    }, [options]);

    return {
        defaultTarget,
        loading,
        saveDefaultTarget,
        openBySession,
        openByProject
    };
}
