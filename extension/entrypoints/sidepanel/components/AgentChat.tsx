import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import type { AgentStoredMessage, CodexReasoningEffort, OpenProjectTarget } from 'chrome-mcp-shared';

// Hooks
import {
    useAgentServer,
    useAgentChat,
    useAgentProjects,
    useAgentSessions,
    useAttachments,
    useAgentThreads,
    useAgentChatViewRoute,
    useOpenProjectPreference,
    useAgentTheme,
} from '../hooks';

// Components
import {
    AgentChatShell,
    AgentTopBar,
    AgentComposer,
    AgentConversation,
    AgentProjectMenu,
    AgentSessionMenu,
    AgentSettingsMenu,
    AgentSessionSettingsPanel,
    AgentSessionsView,
    AgentOpenProjectMenu,
    AttachmentCachePanel,
    RequestState,
} from './agent-chat';

import { getModelsForCli, getDefaultModelForCli, getCodexReasoningEfforts } from '@/common/agent-models';

// Context Provider helper
export const AgentServerPortContext = React.createContext<number | null>(null);

export const AgentChat: React.FC = () => {
    // Menus
    const [projectMenuOpen, setProjectMenuOpen] = useState(false);
    const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
    const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
    const [openProjectMenuOpen, setOpenProjectMenuOpen] = useState(false);

    // Panels
    const [sessionSettingsOpen, setSessionSettingsOpen] = useState(false);
    const [attachmentCacheOpen, setAttachmentCacheOpen] = useState(false);

    // Hooks initialization
    const currentSessionIdRef = useRef<string | null>(null);
    const chatRef = useRef<any>(null);
    const projectsRef = useRef<any>(null);
    const sessionsRef = useRef<any>(null);

    const themeState = useAgentTheme();
    const viewRoute = useAgentChatViewRoute();

    // Local settings state derived from project (like Vue's refs)
    const [projectCli, setProjectCli] = useState<string>('');
    const [projectModel, setProjectModel] = useState<string>('');
    const [projectReasoningEffort, setProjectReasoningEffort] = useState<CodexReasoningEffort>('medium');
    const [projectUseCcr, setProjectUseCcr] = useState(false);
    const [projectEnableChromeMcp, setProjectEnableChromeMcp] = useState(true);

    const [selectedCli, setSelectedCli] = useState<string>('claude');

    const server = useAgentServer({
        getSessionId: () => currentSessionIdRef.current,
        onMessage: (event) => chatRef.current?.handleRealtimeEvent(event),
        onError: (error) => chatRef.current?.setErrorMessage?.(error),
    });

    // Memoize options to prevent infinite loops in hooks that depend on them
    const sessionOptions = useMemo(() => ({
        getServerPort: () => server.serverPort,
        ensureServer: () => server.ensureNativeServer(),
        onSessionChanged: (sessionId: string) => {
            viewRoute.setSessionId(sessionId);
            if (viewRoute.isChatView && projectsRef.current?.selectedProjectId) {
                server.openEventSource();
            }
        },
        onHistoryLoaded: (messages: AgentStoredMessage[]) => {
            const converted = messages.map(m => ({
                id: m.id,
                sessionId: m.sessionId,
                role: m.role,
                content: m.content,
                messageType: m.messageType,
                cliSource: m.cliSource ?? undefined,
                requestId: m.requestId,
                createdAt: m.createdAt ?? new Date().toISOString(),
                metadata: m.metadata,
            }));
            chatRef.current?.setMessages(converted);
        }
    }), [server.serverPort, server.ensureNativeServer, server.openEventSource, viewRoute]);

    const sessions = useAgentSessions(sessionOptions);

    // Share sessions state via ref for handlers
    useEffect(() => {
        sessionsRef.current = sessions;
        currentSessionIdRef.current = sessions.selectedSessionId;
    }, [sessions]);

    const chatOptions = useMemo(() => ({
        getServerPort: () => server.serverPort,
        getSessionId: () => sessions.selectedSessionId,
        ensureServer: () => server.ensureNativeServer(),
        openEventSource: () => server.openEventSource(),
    }), [server.serverPort, sessions.selectedSessionId, server.ensureNativeServer, server.openEventSource]);

    const chat = useAgentChat(chatOptions);

    useEffect(() => {
        chatRef.current = chat;
    }, [chat]);

    // Initialize Route from URL on mount
    useEffect(() => {
        viewRoute.initFromUrl();
    }, []);

    const projectOptions = useMemo(() => ({
        getServerPort: () => server.serverPort,
        ensureServer: () => server.ensureNativeServer(),
    }), [server.serverPort, server.ensureNativeServer]);

    const projects = useAgentProjects(projectOptions);


    useEffect(() => {
        projectsRef.current = projects;
    }, [projects]);

    // Initialize server on mount
    useEffect(() => {
        server.initialize();
    }, []);

    const attachments = useAttachments();

    const openProjectOptions = useMemo(() => ({
        getServerPort: () => server.serverPort
    }), [server.serverPort]);

    const openProjectPreference = useOpenProjectPreference(openProjectOptions);

    // ===========================================
    // Initialization Logic
    // ===========================================


    // ===========================================
    // Initialization & Restoration Logic
    // ===========================================
    const hasRestoredSessionRef = useRef(false);
    const hasRestoredProjectRef = useRef(false);

    // 1. Boot: Trigger Fetches
    useEffect(() => {
        if (!server.isServerReady) return;
        projects.fetchProjects();
        sessions.fetchAllSessions();
    }, [server.isServerReady]);

    // 2. Project State: Restore or Default
    useEffect(() => {
        if (!server.isServerReady || projects.projects.length === 0 || hasRestoredProjectRef.current) return;

        const initProject = async () => {
            // Read storage directly to avoid state update lag
            const storage = await chrome.storage.local.get('agent-selected-project-id');
            let currentId = storage['agent-selected-project-id'];

            // If not in storage, try hook state (just in case)
            if (!currentId) currentId = projects.selectedProjectId;

            // Check validity
            const isValid = currentId && projects.projects.some(p => p.id === currentId);

            if (isValid) {
                if (projects.selectedProjectId !== currentId) {
                    projects.setSelectedProjectId(currentId);
                }
            } else {
                // Default to first
                const first = projects.projects[0];
                projects.setSelectedProjectId(first.id);
                projects.saveSelectedProjectId(first.id);
            }
            hasRestoredProjectRef.current = true;
        };
        initProject();
    }, [server.isServerReady, projects.projects.length, projects.selectedProjectId]);

    // 3. Session State: Deep Link or Restore
    useEffect(() => {
        if (!server.isServerReady || sessions.allSessions.length === 0 || hasRestoredSessionRef.current) return;

        const initSession = async () => {
            const route = viewRoute.initFromUrl();
            if (route.view === 'chat' && route.sessionId) {
                const exists = sessions.allSessions.find(s => s.id === route.sessionId);
                if (exists) {
                    if (exists.projectId !== projects.selectedProjectId) {
                        projects.setSelectedProjectId(exists.projectId);
                    }
                    sessions.selectSession(exists.id);
                    viewRoute.goToChat(exists.id);
                    server.openEventSource();
                    hasRestoredSessionRef.current = true;
                    return;
                }
            }

            // Default to sessions list view
            viewRoute.goToSessions();
            hasRestoredSessionRef.current = true;
        };
        initSession();
    }, [server.isServerReady, sessions.allSessions.length]);

    // ===========================================
    // Route -> State Synchronization (The Source of Truth)
    // ===========================================
    useEffect(() => {
        if (!server.isServerReady || !viewRoute.isChatView || !viewRoute.currentSessionId) return;

        const routeSessionId = viewRoute.currentSessionId;

        const syncContext = async () => {
            console.log('[AgentChat] Syncing context for:', routeSessionId);
            // 1. Ensure Session Selection matches Route
            if (sessions.selectedSessionId !== routeSessionId) {
                await sessions.selectSession(routeSessionId);
            }

            // 2. Ensure Project Context matches Session
            // Check known sessions first to avoid network hit
            let session = sessions.allSessions.find(s => s.id === routeSessionId)
                || sessions.sessions.find(s => s.id === routeSessionId);

            console.log('[AgentChat] Found session in list?', !!session);

            // If unknown, fetch it (deep link scenario or fresh creation)
            if (!session) {
                const fetchedSession = await sessions.getSession(routeSessionId);
                session = fetchedSession || undefined;
                console.log('[AgentChat] Fetched session individually?', !!session);
            }

            if (session) {
                // If we found the session, ensure we are in its project
                if (session.projectId && projects.selectedProjectId !== session.projectId) {
                    console.log('[AgentChat] Switching project context to:', session.projectId);
                    projects.setSelectedProjectId(session.projectId);
                    // Fetch the specific sessions for this project to populate the menu/sidebar correctly
                    sessions.fetchSessions(session.projectId);
                }
                // Load history for this session
                const msgs = await sessions.loadHistory(routeSessionId);
                console.log('[AgentChat] Loaded history messages:', msgs.length);
                const converted = msgs.map((m: any) => ({
                    id: m.id,
                    sessionId: m.sessionId,
                    role: m.role,
                    content: m.content,
                    messageType: m.messageType,
                    cliSource: m.cliSource ?? undefined,
                    requestId: m.requestId,
                    createdAt: m.createdAt ?? new Date().toISOString(),
                    metadata: m.metadata,
                }));
                chat.setMessages(converted);
            }
        };

        syncContext();
    }, [
        viewRoute.currentSessionId,
        viewRoute.isChatView,
        server.isServerReady,
        sessions.allSessions.length,
    ]);

    // ===========================================
    // View Refresh Logic
    // ===========================================
    // Always refresh the full list when visiting the sessions view
    useEffect(() => {
        if (viewRoute.isSessionsView && server.isServerReady) {
            sessions.fetchAllSessions();
        }
    }, [viewRoute.isSessionsView, server.isServerReady]);

    // Sync settings with project (Keep this, it's reactive)
    useEffect(() => {
        if (projects.selectedProject) {
            const p = projects.selectedProject;
            setProjectCli(p.preferredCli || '');
            setProjectModel(p.selectedModel || '');
            setProjectReasoningEffort((p as any).reasoningEffort || 'medium');
            setProjectUseCcr(!!p.useCcr);
            setProjectEnableChromeMcp(p.enableChromeMcp !== false);
            setSelectedCli(p.preferredCli || 'claude');
        }
    }, [projects.selectedProject]);

    // Note: We removed the old "Load sessions when project changes" effect 
    // because the syncContext effect and manual handlers now manage this more precisely.

    // ===========================================
    // Computeds & State
    // ===========================================
    const runningSessionIds = useMemo(() => {
        const currentId = sessions.selectedSessionId;
        if (currentId && chat.isRequestActive) {
            return new Set([currentId]);
        }
        return new Set<string>();
    }, [sessions.selectedSessionId, chat.isRequestActive]);

    const projectsMap = useMemo(() => {
        return new Map(projects.projects.map((p) => [p.id, p] as const));
    }, [projects.projects]);

    const threadState = useAgentThreads({
        messages: chat.messages,
        requestState: chat.requestState,
        currentRequestId: chat.currentRequestId,
    });

    const projectLabel = projects.selectedProject?.name ?? 'No project';
    const sessionLabel = sessions.selectedSession?.preview || sessions.selectedSession?.name || 'New Session';

    const connectionState: 'ready' | 'connecting' | 'disconnected' = useMemo(() => {
        if (server.isServerReady) return 'ready';
        if (server.nativeConnected) return 'connecting';
        return 'disconnected';
    }, [server.isServerReady, server.nativeConnected]);

    const currentEngineName = sessions.selectedSession?.engineName || selectedCli || 'claude';
    const availableModels = useMemo(() => getModelsForCli(currentEngineName), [currentEngineName]);
    const currentModel = sessions.selectedSession?.model || getDefaultModelForCli(currentEngineName);

    const availableReasoningEfforts = useMemo(() => {
        if (currentEngineName !== 'codex') return [];
        return getCodexReasoningEfforts(currentModel);
    }, [currentEngineName, currentModel]);

    const currentReasoningEffort = sessions.selectedSession?.optionsConfig?.codexConfig?.reasoningEffort || 'medium';

    // ===========================================
    // Handlers
    // ===========================================
    const closeMenus = useCallback(() => {
        setProjectMenuOpen(false);
        setSessionMenuOpen(false);
        setSettingsMenuOpen(false);
        setOpenProjectMenuOpen(false);
    }, []);

    const toggleProjectMenu = () => {
        const newState = !projectMenuOpen;
        setProjectMenuOpen(newState);
        if (newState) {
            setSessionMenuOpen(false);
            setSettingsMenuOpen(false);
            setOpenProjectMenuOpen(false);
        }
    };

    const toggleSessionMenu = () => {
        const newState = !sessionMenuOpen;
        setSessionMenuOpen(newState);
        if (newState) {
            setProjectMenuOpen(false);
            setSettingsMenuOpen(false);
            setOpenProjectMenuOpen(false);
        }
    };

    const toggleSettingsMenu = () => {
        const newState = !settingsMenuOpen;
        setSettingsMenuOpen(newState);
        if (newState) {
            setProjectMenuOpen(false);
            setSessionMenuOpen(false);
            setOpenProjectMenuOpen(false);
        }
    };

    const toggleOpenProjectMenu = () => {
        const newState = !openProjectMenuOpen;
        setOpenProjectMenuOpen(newState);
        if (newState) {
            setProjectMenuOpen(false);
            setSessionMenuOpen(false);
            setSettingsMenuOpen(false);
        }
    };

    const handleNewProject = async () => {
        const path = await projects.pickDirectory();
        if (path) {
            const segments = path.split(/[/\\]/).filter(s => s.length > 0);
            const dirName = segments.pop() || 'New Project';
            const project = await projects.createProjectFromPath(path, dirName);
            if (project) {
                // Ensure default session
                const engine = project.preferredCli || 'claude';
                await sessions.ensureDefaultSession(project.id, engine as any);
                if (sessions.selectedSessionId) {
                    server.openEventSource();
                }
            }
        }
    };

    const handleNewSession = async () => {
        let projectId = projects.selectedProjectId;
        if (!projectId && projects.projects.length > 0) {
            projectId = projects.projects[0].id;
        }
        if (!projectId) {
            await projects.ensureDefaultProject();
            await projects.fetchProjects();
            if (projects.projects.length > 0) projectId = projects.projects[0].id;
        }

        if (!projectId) return;

        chat.clearRequestState?.();

        const engineName = selectedCli || 'claude';
        const optionsConfig = engineName === 'codex' ? { codexConfig: { reasoningEffort: 'medium' } } : undefined;

        await sessions.createSession(projectId, {
            name: `Session ${sessions.sessions.length + 1}`,
            engineName: engineName as any,
            optionsConfig: optionsConfig as any
        });
        closeMenus();
    };

    const handleNewSessionAndNavigate = async () => {
        let projectId = projects.selectedProjectId;

        // 1. Ensure Project Context
        if (!projectId && projects.projects.length > 0) {
            projectId = projects.projects[0].id;
        }

        if (!projectId) {
            // Try to create default project if none exists
            await projects.ensureDefaultProject();
            // Re-fetch to get the new project
            const serverUrl = `http://127.0.0.1:${server.serverPort}`;
            const pData = await fetch(`${serverUrl}/agent/projects`).then(r => r.json()).catch(() => ({ projects: [] }));
            if (pData.projects && pData.projects.length > 0) {
                projects.fetchProjects(); // Sync hook
                projectId = pData.projects[0].id;
            }
        }

        if (!projectId) {
            console.error("No project available to create session");
            return;
        }

        // 2. Set Project Context explicitly
        projects.setSelectedProjectId(projectId);

        // 3. Clear Chat State
        chat.clearRequestState?.();
        chat.setMessages([]);

        const engineName = selectedCli || 'claude';
        const optionsConfig = engineName === 'codex' ? { codexConfig: { reasoningEffort: 'medium' } } : undefined;

        // 4. Create Session
        const session = await sessions.createSession(projectId, {
            name: `Session ${sessions.sessions.length + 1}`,
            engineName: engineName as any,
            optionsConfig: optionsConfig as any
        });

        if (session) {
            // 5. Select & Navigate
            await sessions.selectSession(session.id);
            viewRoute.goToChat(session.id);

            // 6. Connect
            setTimeout(() => {
                server.openEventSource();
            }, 50);
        }
    };

    const handleSessionSelect = async (id: string) => {
        // Clear messages to show loading state if needed
        chat.setMessages([]);

        // Navigate
        viewRoute.goToChat(id);

        // Ensure connection
        server.openEventSource();
        closeMenus();
    };

    const handleBackToSessions = () => {
        viewRoute.goToSessions();
    };

    const handleOpenProjectSelect = async (target: string) => {
        if (sessions.selectedSessionId) {
            await openProjectPreference.openBySession(sessions.selectedSessionId, target as OpenProjectTarget);
        }
        closeMenus();
    };

    const handleSessionReset = async () => {
        if (sessions.selectedSessionId) {
            if (confirm('Reset this conversation?')) {
                const result = await sessions.resetConversation(sessions.selectedSessionId);
                if (result) {
                    chat.setMessages([]);
                }
            }
        }
        closeMenus();
    };

    // Handlers for Project Menu
    const handleUpdateProjectCli = (cli: string) => {
        setProjectCli(cli);
        if (cli) {
            const defaultModel = getDefaultModelForCli(cli);
            setProjectModel(defaultModel);
        } else {
            setProjectModel('');
        }
    };

    const handleSaveProjectSettings = async () => {
        await projects.saveProjectPreference(
            projectCli,
            projectModel,
            projectUseCcr,
            projectEnableChromeMcp,
            projectReasoningEffort
        );
        closeMenus();
    };

    const handleSend = async () => {
        const text = chat.input;
        const rawAttachments = attachments.attachments;

        if (!text.trim() && rawAttachments.length === 0) return;

        chat.setInput('');
        attachments.clearAttachments();

        await chat.send({
            instruction: text,
            attachments: rawAttachments as any,
            projectId: projects.selectedProjectId
        });
    };

    return (
        <AgentServerPortContext.Provider value={server.serverPort}>
            <div className="relative h-full agent-theme" data-agent-theme={themeState.theme} onKeyDown={(e) => e.key === 'Escape' && closeMenus()}>
                {viewRoute.isSessionsView ? (
                    <AgentSessionsView
                        sessions={sessions.allSessions}
                        selectedSessionId={sessions.selectedSessionId}
                        isLoading={sessions.isLoadingAllSessions && sessions.allSessions.length === 0}
                        isCreating={sessions.isCreatingSession}
                        error={sessions.sessionError}
                        runningSessionIds={runningSessionIds}
                        projectsMap={projectsMap}
                        onSessionSelect={handleSessionSelect}
                        onSessionNew={handleNewSessionAndNavigate}
                        onSessionDelete={sessions.deleteSession}
                        onSessionRename={sessions.renameSession}
                        onSessionOpenProject={(id) => {
                            sessions.selectSession(id);
                            setOpenProjectMenuOpen(true);
                        }}
                        onRefresh={sessions.refreshSessions}
                    />
                ) : (
                    <AgentChatShell
                        errorMessage={chat.errorMessage}
                        onErrorDismiss={() => chat.setErrorMessage?.(null)}
                        isDragOver={attachments.isDragOver}
                        onDragOver={attachments.handleDragOver}
                        onDragLeave={attachments.handleDragLeave}
                        onDrop={attachments.handleDrop}
                        usage={chat.usage}
                        header={
                            <AgentTopBar
                                projectLabel={projectLabel}
                                sessionLabel={sessionLabel}
                                connectionState={connectionState}
                                showBackButton={true}
                                onToggleProjectMenu={toggleProjectMenu}
                                onToggleSessionMenu={toggleSessionMenu}
                                onToggleSettingsMenu={toggleSettingsMenu}
                                onToggleOpenProjectMenu={toggleOpenProjectMenu}
                                onBack={handleBackToSessions}
                            />
                        }
                        content={<AgentConversation threads={threadState.threads} />}
                        composer={
                            <AgentComposer
                                value={chat.input}
                                onUpdate={chat.setInput}
                                onSubmit={handleSend}
                                onCancel={chat.cancelCurrentRequest}
                                attachments={attachments.attachments as any}
                                attachmentError={attachments.error}
                                onRemoveAttachment={attachments.removeAttachment}
                                onAttach={attachments.openFilePicker}
                                onPaste={(e: React.ClipboardEvent) => attachments.handlePaste(e)}
                                requestState={chat.requestState as RequestState}
                                canSend={chat.canSend || attachments.hasImages}
                                sending={chat.sending}
                                cancelling={chat.cancelling}
                                engineName={currentEngineName}
                                selectedModel={currentModel}
                                availableModels={availableModels}
                                onModelChange={(modelId) => sessions.updateSession(sessions.selectedSessionId, { model: modelId || null })}
                                reasoningEffort={currentReasoningEffort}
                                availableReasoningEfforts={availableReasoningEfforts}
                                onReasoningEffortChange={(effort) => sessions.updateSession(sessions.selectedSessionId, { optionsConfig: { codexConfig: { reasoningEffort: effort } } })}
                                onReset={handleSessionReset}
                                onOpenSettings={() => setSessionSettingsOpen(true)}
                            />
                        }
                    />
                )}

                {/* Overlays */}
                {(projectMenuOpen || sessionMenuOpen || settingsMenuOpen || openProjectMenuOpen) && (
                    <div className="fixed inset-0 z-[60]" onClick={closeMenus} />
                )}

                <AgentProjectMenu
                    open={projectMenuOpen}
                    projects={projects.projects}
                    selectedProjectId={projects.selectedProjectId}
                    selectedCli={projectCli}
                    model={projectModel}
                    reasoningEffort={projectReasoningEffort}
                    useCcr={projectUseCcr}
                    enableChromeMcp={projectEnableChromeMcp}
                    engines={server.engines}
                    isPicking={projects.isCreatingProject}
                    isSaving={projects.isSavingSettings}
                    error={projects.projectError}
                    onSelect={(id: string) => {
                        projects.setSelectedProjectId(id);
                        sessions.clearSessions();
                        closeMenus();
                    }}
                    onNew={handleNewProject}
                    onUpdateCli={handleUpdateProjectCli}
                    onUpdateModel={setProjectModel}
                    onUpdateReasoningEffort={setProjectReasoningEffort}
                    onUpdateCcr={setProjectUseCcr}
                    onUpdateChromeMcp={setProjectEnableChromeMcp}
                    onSave={handleSaveProjectSettings}
                />

                <AgentSessionMenu
                    open={sessionMenuOpen}
                    sessions={sessions.sessions}
                    selectedSessionId={sessions.selectedSessionId}
                    isLoading={sessions.isLoading}
                    isCreating={sessions.isCreatingSession}
                    error={sessions.sessionError}
                    onSelect={handleSessionSelect}
                    onNew={handleNewSession}
                    onDelete={sessions.deleteSession}
                    onRename={sessions.renameSession}
                />

                <AgentSettingsMenu
                    open={settingsMenuOpen}
                    theme={themeState.theme}
                    onSetTheme={themeState.setTheme}
                    onReconnect={server.reconnect}
                    onOpenAttachments={() => setAttachmentCacheOpen(true)}
                    fakeCaretEnabled={chat.fakeCaretEnabled}
                    onToggleFakeCaret={chat.setFakeCaretEnabled}
                />

                <AgentOpenProjectMenu
                    open={openProjectMenuOpen}
                    onSelect={handleOpenProjectSelect}
                    defaultTarget={openProjectPreference.defaultTarget || undefined}
                />

                <AgentSessionSettingsPanel
                    open={sessionSettingsOpen}
                    onClose={() => setSessionSettingsOpen(false)}
                    session={sessions.selectedSession}
                    managementInfo={sessions.selectedSession?.managementInfo || null}
                    isLoading={sessions.isLoading}
                    isSaving={sessions.isUpdatingSession}
                    onSave={async (settings: any) => {
                        await sessions.updateSession(sessions.selectedSessionId, settings);
                        setSessionSettingsOpen(false);
                    }}
                />

                <AttachmentCachePanel
                    open={attachmentCacheOpen}
                    onClose={() => setAttachmentCacheOpen(false)}
                />

                {/* Hidden File Input for Attachments */}
                <input
                    type="file"
                    ref={attachments.fileInputRef}
                    className="hidden"
                    multiple
                    accept="image/png, image/jpeg, image/jpg, image/gif, image/webp"
                    onChange={attachments.handleFileSelect}
                />
            </div>
        </AgentServerPortContext.Provider>
    );
};
