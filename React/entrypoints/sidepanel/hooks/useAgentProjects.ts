import { useState, useCallback, useMemo, useRef } from 'react';
import type { AgentProject, AgentStoredMessage, CodexReasoningEffort } from 'chrome-mcp-shared';

const STORAGE_KEY_SELECTED_PROJECT = 'agent-selected-project-id';

export interface UseAgentProjectsOptions {
    getServerPort: () => number | null;
    ensureServer: () => Promise<boolean>;
    onHistoryLoaded?: (messages: AgentStoredMessage[]) => void;
}

interface PathValidationResult {
    valid: boolean;
    absolute: string;
    exists: boolean;
    needsCreation: boolean;
    error?: string;
}

/**
 * Normalize path for comparison (handle trailing slashes and separators).
 */
function normalizePathForComparison(path: string): string {
    // Remove trailing slashes and normalize separators
    return path
        .trim()
        .replace(/[/\\]+$/, '')
        .replace(/\\/g, '/')
        .toLowerCase();
}

export function useAgentProjects(options: UseAgentProjectsOptions) {
    // State
    const [projects, setProjects] = useState<AgentProject[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [isLoadingProjects, setIsLoadingProjects] = useState(false);
    const [showCreateProject, setShowCreateProject] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectRootPath, setNewProjectRootPath] = useState('');
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [projectError, setProjectError] = useState<string | null>(null);

    // Computed
    const selectedProject = useMemo(() => {
        return projects.find((p) => p.id === selectedProjectId) || null;
    }, [projects, selectedProjectId]);

    const canCreateProject = useMemo(() => {
        return newProjectName.trim().length > 0 && newProjectRootPath.trim().length > 0;
    }, [newProjectName, newProjectRootPath]);

    // Load selected project from storage
    const loadSelectedProjectId = useCallback(async () => {
        try {
            const result = await chrome.storage.local.get(STORAGE_KEY_SELECTED_PROJECT);
            if (result[STORAGE_KEY_SELECTED_PROJECT]) {
                setSelectedProjectId(result[STORAGE_KEY_SELECTED_PROJECT]);
            }
        } catch (error) {
            console.error('Failed to load selected project ID:', error);
        }
    }, []);

    // Save selected project to storage
    const saveSelectedProjectId = useCallback(async (id?: string) => {
        try {
            await chrome.storage.local.set({
                [STORAGE_KEY_SELECTED_PROJECT]: id || selectedProjectId,
            });
        } catch (error) {
            console.error('Failed to save selected project ID:', error);
        }
    }, [selectedProjectId]);

    // Fetch projects from server
    const fetchProjects = useCallback(async () => {
        const serverPort = options.getServerPort();
        if (!serverPort) return;

        setIsLoadingProjects(true);
        try {
            const url = `http://127.0.0.1:${serverPort}/agent/projects`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setProjects(data.projects || []);
            }
        } catch (error) {
            console.error('Failed to fetch projects:', error);
        } finally {
            setIsLoadingProjects(false);
        }
    }, [options]);

    // Refresh projects
    const refreshProjects = useCallback(async () => {
        const ready = await options.ensureServer();
        if (!ready) return;
        await fetchProjects();
    }, [options, fetchProjects]);

    // Track pending history load with nonce to prevent A→B→A race conditions
    const historyLoadNonceRef = useRef(0);

    /**
     * Load chat history for a project with race-condition protection.
     */
    const loadChatHistory = useCallback(async (projectId: string) => {
        const serverPort = options.getServerPort();
        if (!serverPort || !projectId) return;

        const myNonce = ++historyLoadNonceRef.current;

        // We can't check selectedProjectId via Ref here explicitly so we either assume caller ensures it matches
        // or we check selectedProjectId state but that might be stale if inside closure.
        // However, usually loadChatHistory is called *after* selection change.
        // We'll trust projectId arg.

        try {
            const url = `http://127.0.0.1:${serverPort}/agent/chat/${encodeURIComponent(projectId)}/messages?limit=100`;
            const response = await fetch(url);

            if (myNonce !== historyLoadNonceRef.current) return;

            if (response.ok) {
                const result = await response.json();

                if (myNonce !== historyLoadNonceRef.current) return;

                // Server returns { success, data: messages[], totalCount, pagination }
                const stored = result.data || [];
                options.onHistoryLoaded?.(stored);
            }
        } catch (error) {
            console.error('Failed to load chat history:', error);
        }
    }, [options]);

    // Validate path before creating project
    const validatePath = useCallback(async (rootPath: string): Promise<PathValidationResult | null> => {
        const serverPort = options.getServerPort();
        if (!serverPort) return null;

        try {
            const url = `http://127.0.0.1:${serverPort}/agent/projects/validate-path`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rootPath }),
            });

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(text || `Validation failed: HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to validate path:', error);
            return null;
        }
    }, [options]);

    // Create project
    const createProject = useCallback(async (): Promise<AgentProject | null> => {
        const name = newProjectName.trim();
        const rootPath = newProjectRootPath.trim();
        if (!name || !rootPath) return null;

        const ready = await options.ensureServer();
        const serverPort = options.getServerPort();
        if (!ready || !serverPort) {
            setProjectError('Agent server is not available.');
            return null;
        }

        setIsCreatingProject(true);
        setProjectError(null);

        try {
            // Step 1: Validate the path
            const validation = await validatePath(rootPath);
            if (!validation) {
                setProjectError('Failed to validate path');
                return null;
            }

            if (!validation.valid) {
                setProjectError(validation.error || 'Invalid path');
                return null;
            }

            // Step 2: If directory doesn't exist, ask user for confirmation
            let allowCreate = false;
            if (validation.needsCreation) {
                const confirmed = window.confirm(
                    `目录 "${validation.absolute}" 不存在，是否创建？\n\nThe directory "${validation.absolute}" does not exist. Create it?`,
                );
                if (!confirmed) {
                    return null;
                }
                allowCreate = true;
            }

            // Step 3: Create the project
            const url = `http://127.0.0.1:${serverPort}/agent/projects`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, rootPath, allowCreate }),
            });

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(text || `HTTP ${response.status}`);
            }

            const payload = await response.json();
            const project = payload?.project as AgentProject | undefined;

            if (project?.id) {
                // Update local state
                setProjects(prev => {
                    const others = prev.filter((p) => p.id !== project.id);
                    return [...others, project];
                });

                setSelectedProjectId(project.id);
                await saveSelectedProjectId(project.id);
                await loadChatHistory(project.id);

                // Clear form
                setNewProjectName('');
                setNewProjectRootPath('');
                setShowCreateProject(false);

                return project;
            } else {
                setProjectError('Project created but response is invalid.');
                return null;
            }
        } catch (error: unknown) {
            console.error('Failed to create project:', error);
            setProjectError(error instanceof Error ? error.message : 'Failed to create project.');
            return null;
        } finally {
            setIsCreatingProject(false);
        }
    }, [newProjectName, newProjectRootPath, options, validatePath, saveSelectedProjectId, loadChatHistory]);

    const toggleCreateProject = useCallback(() => {
        setShowCreateProject(prev => {
            const next = !prev;
            if (!next) {
                setNewProjectName('');
                setNewProjectRootPath('');
                setProjectError(null);
            }
            return next;
        });
    }, []);

    const getDefaultProjectRoot = useCallback(async (projectName: string): Promise<string | null> => {
        const serverPort = options.getServerPort();
        if (!serverPort || !projectName.trim()) return null;

        try {
            const url = `http://127.0.0.1:${serverPort}/agent/projects/default-root`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectName: projectName.trim() }),
            });
            if (response.ok) {
                const data = await response.json();
                return data.path || null;
            }
            return null;
        } catch (error) {
            console.error('Failed to get default project root:', error);
            return null;
        }
    }, [options]);

    const pickDirectory = useCallback(async (): Promise<string | null> => {
        const ready = await options.ensureServer();
        const serverPort = options.getServerPort();
        if (!ready || !serverPort) {
            setProjectError('Server not available');
            return null;
        }

        try {
            const url = `http://127.0.0.1:${serverPort}/agent/projects/pick-directory`;
            const response = await fetch(url, { method: 'POST' });

            if (!response.ok) {
                if (response.status === 404) {
                    setProjectError('Directory picker not available. Please rebuild and restart the native server.');
                } else {
                    setProjectError(`Server error: HTTP ${response.status}`);
                }
                return null;
            }

            const data = await response.json();

            if (data.success && data.path) {
                return data.path;
            } else if (data.cancelled) {
                return null;
            } else {
                setProjectError(data.error || 'Failed to open directory picker');
                return null;
            }
        } catch (error) {
            console.error('Failed to open directory picker:', error);
            setProjectError('Failed to open directory picker');
            return null;
        }
    }, [options]);

    const ensureDefaultProject = useCallback(async (): Promise<AgentProject | null> => {
        const ready = await options.ensureServer();
        const serverPort = options.getServerPort();
        if (!ready || !serverPort) return null;

        try {
            // First fetch current projects
            // Note: we can't await fetchProjects() state update here. 
            // We must fetch and check response directly or assume empty if we trust initial state? No.
            // We'll reimplement fetch here to check.
            const projectsUrl = `http://127.0.0.1:${serverPort}/agent/projects`;
            const projectsResp = await fetch(projectsUrl);
            const projectsData = await projectsResp.json();
            const currentProjects = projectsData.projects || [];

            if (currentProjects.length > 0) {
                setProjects(currentProjects);
                return null; // Already exists
            }

            // Get default workspace directory from server
            const defaultRootUrl = `http://127.0.0.1:${serverPort}/agent/projects/default-root`;
            const defaultRootResponse = await fetch(defaultRootUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectName: 'default' }),
            });
            const defaultRootData = await defaultRootResponse.json();
            const defaultRoot = defaultRootData.path;

            if (!defaultRoot) {
                console.error('Failed to get default project root');
                return null;
            }

            // Create default project
            const createUrl = `http://127.0.0.1:${serverPort}/agent/projects`;
            const createResponse = await fetch(createUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Default',
                    rootPath: defaultRoot,
                    allowCreate: true,
                }),
            });

            if (!createResponse.ok) {
                const text = await createResponse.text().catch(() => '');
                console.error('Failed to create default project:', text);
                return null;
            }

            const payload = await createResponse.json();
            const project = payload?.project as AgentProject | undefined;

            if (project?.id) {
                setProjects([project]);
                setSelectedProjectId(project.id);
                await saveSelectedProjectId(project.id);
                return project;
            }

            return null;
        } catch (error) {
            console.error('Failed to ensure default project:', error);
            return null;
        }
    }, [options, saveSelectedProjectId]);

    const createProjectFromPath = useCallback(async (
        rootPath: string,
        name: string,
    ): Promise<AgentProject | null> => {
        const ready = await options.ensureServer();
        const serverPort = options.getServerPort();
        if (!ready || !serverPort) {
            setProjectError('Agent server is not available.');
            return null;
        }

        setProjectError(null);

        try {
            // Validate available projects first by fetching?
            // Re-fetch to ensure we have latest list for duplicates check
            // For now we trust `projects` state or accept race condition.

            // Step 1: Validate the path
            const validation = await validatePath(rootPath);
            if (!validation) {
                setProjectError('Failed to validate path');
                return null;
            }

            if (!validation.valid) {
                setProjectError(validation.error || 'Invalid path');
                return null;
            }

            // Check if project with same path already exists
            const normalizedPath = normalizePathForComparison(validation.absolute);
            // NOTE: Using `projects` from closure. May be stale if not updated recently.
            const existingProject = projects.find(
                (p) => normalizePathForComparison(p.rootPath) === normalizedPath,
            );

            if (existingProject) {
                const shouldSwitch = window.confirm(
                    `目录 "${validation.absolute}" 已存在对应的项目：${existingProject.name}\n\n` +
                    `是否切换到该项目？\n\n` +
                    `A project already exists for "${validation.absolute}": ${existingProject.name}\n` +
                    `Switch to that project?`,
                );
                if (shouldSwitch) {
                    setSelectedProjectId(existingProject.id);
                    await saveSelectedProjectId(existingProject.id);
                    await loadChatHistory(existingProject.id);
                    return existingProject;
                }
                return null;
            }

            // If directory doesn't exist, ask user for confirmation
            let allowCreate = false;
            if (validation.needsCreation) {
                const confirmed = window.confirm(
                    `目录 "${validation.absolute}" 不存在，是否创建？\n\nThe directory "${validation.absolute}" does not exist. Create it?`,
                );
                if (!confirmed) {
                    return null;
                }
                allowCreate = true;
            }

            // Create the project
            const url = `http://127.0.0.1:${serverPort}/agent/projects`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, rootPath, allowCreate }),
            });

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(text || `HTTP ${response.status}`);
            }

            const payload = await response.json();
            const project = payload?.project as AgentProject | undefined;

            if (project?.id) {
                setProjects(prev => {
                    const others = prev.filter((p) => p.id !== project.id);
                    return [...others, project];
                });
                setSelectedProjectId(project.id);
                await saveSelectedProjectId(project.id);
                await loadChatHistory(project.id);

                return project;
            } else {
                setProjectError('Project created but response is invalid.');
                return null;
            }
        } catch (error: unknown) {
            console.error('Failed to create project from path:', error);
            setProjectError(error instanceof Error ? error.message : 'Failed to create project.');
            return null;
        }
    }, [options, validatePath, projects /* dep on projects for existing check */, saveSelectedProjectId, loadChatHistory]);

    const handleProjectChanged = useCallback(async () => {
        // This seems redundant if we have setSelectedProjectId which saves it.
        // But maybe useful if external change?
        if (selectedProjectId) {
            await saveSelectedProjectId(selectedProjectId);
            await loadChatHistory(selectedProjectId);
        }
    }, [selectedProjectId, saveSelectedProjectId, loadChatHistory]);

    const saveProjectPreference = useCallback(async (
        cli?: string,
        model?: string,
        useCcr?: boolean,
        enableChromeMcp?: boolean,
        reasoningEffort?: CodexReasoningEffort,
    ) => {
        const project = projects.find(p => p.id === selectedProjectId);
        const serverPort = options.getServerPort();

        if (!project || !serverPort) return;

        setIsSavingSettings(true);
        setProjectError(null);

        try {
            const url = `http://127.0.0.1:${serverPort}/agent/projects`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: project.id,
                    name: project.name,
                    rootPath: project.rootPath,
                    preferredCli: cli?.trim() ?? project.preferredCli,
                    selectedModel: model?.trim() ?? project.selectedModel,
                    useCcr: useCcr ?? project.useCcr,
                    enableChromeMcp: enableChromeMcp ?? project.enableChromeMcp,
                    reasoningEffort: reasoningEffort ?? (project as any).reasoningEffort,
                }),
            });

            if (response.ok) {
                const payload = await response.json();
                const updatedProject = payload?.project as AgentProject | undefined;
                if (updatedProject?.id) {
                    setProjects(prev => {
                        const index = prev.findIndex((p) => p.id === updatedProject.id);
                        if (index !== -1) {
                            const copy = [...prev];
                            copy[index] = updatedProject;
                            return copy;
                        }
                        return prev;
                    });
                }
            }
        } catch (error) {
            console.error('Failed to save project preference:', error);
        } finally {
            setIsSavingSettings(false);
        }
    }, [selectedProjectId, projects, options]);

    // Setters exposed?
    const setSelectedProjectIdExposed = useCallback((id: string) => {
        setSelectedProjectId(id);
        saveSelectedProjectId(id);
        if (id) loadChatHistory(id);
    }, [saveSelectedProjectId, loadChatHistory]);

    const setNewProjectNameExposed = setNewProjectName;
    const setNewProjectRootPathExposed = setNewProjectRootPath;

    return {
        projects,
        selectedProjectId,
        isLoadingProjects,
        showCreateProject,
        newProjectName,
        newProjectRootPath,
        isCreatingProject,
        isSavingSettings,
        projectError,

        selectedProject,
        canCreateProject,

        // Setters
        setSelectedProjectId: setSelectedProjectIdExposed,
        setNewProjectName: setNewProjectNameExposed,
        setNewProjectRootPath: setNewProjectRootPathExposed,

        loadSelectedProjectId,
        saveSelectedProjectId,
        fetchProjects,
        refreshProjects,
        loadChatHistory,
        createProject,
        toggleCreateProject,
        handleProjectChanged,
        saveProjectPreference,
        getDefaultProjectRoot,
        pickDirectory,
        ensureDefaultProject,
        createProjectFromPath,
    };
}
