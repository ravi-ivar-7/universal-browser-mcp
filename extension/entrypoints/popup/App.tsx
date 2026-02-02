import React, { useEffect, useState, useMemo } from 'react';
import { useAgentTheme } from '../sidepanel/hooks/useAgentTheme';
import { getMessage } from '../../utils/i18n';
import { BACKGROUND_MESSAGE_TYPES } from '../../common/message-types';
import { useLocalModel } from './hooks/useLocalModel';
import LocalModelPage from './components/LocalModelPage';
import ConfirmDialog from './components/ConfirmDialog';
import {
    BoltIcon,
    RefreshIcon,
    MarkerIcon,
    AgentIcon,
    LocalModelIcon,
    ElementMarkerIcon,
    ChevronRightIcon,
    DocsIcon,
    GuideIcon,
    RecordIcon,
    StopIcon,
    WorkflowIcon,
    EditIcon
} from './components/icons';

export default function App() {
    const { theme } = useAgentTheme();
    const [currentView, setCurrentView] = useState<'home' | 'local-model'>('home');

    // Local Model Logic
    const localModel = useLocalModel();

    // Server State
    const [serverStatus, setServerStatus] = useState<{ isRunning: boolean; port: number; lastUpdated: number }>({
        isRunning: false,
        port: 0,
        lastUpdated: Date.now()
    });
    const [nativeConnectionStatus, setNativeConnectionStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown');
    const [nativeServerPort, setNativeServerPort] = useState(12306);
    const [isConnecting, setIsConnecting] = useState(false);

    // UI State
    const [copyButtonText, setCopyButtonText] = useState(getMessage('copyConfigButton'));

    const showMcpConfig = useMemo(() => {
        return nativeConnectionStatus === 'connected' && serverStatus.isRunning;
    }, [nativeConnectionStatus, serverStatus.isRunning]);

    const mcpConfigJson = useMemo(() => {
        const port = serverStatus.port || nativeServerPort;
        const config = {
            mcpServers: {
                'streamable-mcp-server': {
                    'type': 'streamable-http',
                    'url': `http://127.0.0.1:${port}/mcp`
                }
            }
        };
        return JSON.stringify(config, null, 2);
    }, [serverStatus.port, nativeServerPort]);

    useEffect(() => {
        refreshServerStatus();
    }, []);

    const refreshServerStatus = async () => {
        try {
            const res: any = await chrome.runtime.sendMessage({ type: BACKGROUND_MESSAGE_TYPES.GET_SERVER_STATUS });
            if (res && res.success) {
                setServerStatus(res.serverStatus);
                setNativeConnectionStatus(res.connected ? 'connected' : 'disconnected');
                if (res.serverStatus.port) setNativeServerPort(res.serverStatus.port);
            }
        } catch (e) {
            setNativeConnectionStatus('disconnected');
        }
    };

    const testNativeConnection = async () => {
        setIsConnecting(true);
        try {
            const type = nativeConnectionStatus === 'connected'
                ? BACKGROUND_MESSAGE_TYPES.DISCONNECT_NATIVE
                : BACKGROUND_MESSAGE_TYPES.CONNECT_NATIVE;

            await chrome.runtime.sendMessage({ type, port: nativeServerPort });
            await refreshServerStatus();
        } catch (e) {
            console.error('Connection test failed:', e);
        } finally {
            setIsConnecting(false);
        }
    };

    const copyMcpConfig = async () => {
        try {
            await navigator.clipboard.writeText(mcpConfigJson);
            setCopyButtonText(getMessage('copiedStatus'));
            setTimeout(() => {
                setCopyButtonText(getMessage('copyConfigButton'));
            }, 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    const openSidepanelAndClose = async (tab: string) => {
        try {
            const current = await chrome.windows.getCurrent();
            if ((chrome.sidePanel as any)?.setOptions) {
                await (chrome.sidePanel as any).setOptions({
                    path: `sidepanel.html?tab=${tab}`,
                    enabled: true,
                });
            }
            if (chrome.sidePanel && (chrome.sidePanel as any).open) {
                await (chrome.sidePanel as any).open({ windowId: current.id! });
            }
            window.close();
        } catch (e) {
            console.warn(`Failed to open sidepanel (${tab}):`, e);
        }
    };

    const toggleElementMarker = async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) return;
            await chrome.runtime.sendMessage({
                type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_START,
                tabId: tab.id,
            });
            window.close();
        } catch (error) {
            console.warn('Failed to start element marker:', error);
        }
    };

    const openWelcomePage = async () => {
        try {
            await chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
        } catch { /* ignore */ }
    };

    // Record & Replay state and handlers
    const [rrRecording, setRrRecording] = useState(false);
    const [comingSoonToast, setComingSoonToast] = useState<{ show: boolean; feature: string }>({ show: false, feature: '' });

    const showComingSoonToast = (feature: string) => {
        setComingSoonToast({ show: true, feature });
        setTimeout(() => {
            setComingSoonToast({ show: false, feature: '' });
        }, 2000);
    };

    const startRecording = async () => {
        if (rrRecording) return;
        try {
            const res: any = await chrome.runtime.sendMessage({
                type: BACKGROUND_MESSAGE_TYPES.RR_START_RECORDING,
                meta: { name: 'New Recording' },
            });
            setRrRecording(!!(res && res.success));
        } catch (e) {
            console.error('Failed to start recording:', e);
            setRrRecording(false);
        }
    };

    const stopRecording = async () => {
        if (!rrRecording) return;
        try {
            const res: any = await chrome.runtime.sendMessage({
                type: BACKGROUND_MESSAGE_TYPES.RR_STOP_RECORDING,
            });
            setRrRecording(false);
        } catch (e) {
            console.error('Failed to stop recording:', e);
            setRrRecording(false);
        }
    };

    const toggleWebEditor = async () => {
        // Web Editor was excluded from this extension
        showComingSoonToast('Web Editor');
    };

    const openWorkflowSidepanel = async () => {
        await openSidepanelAndClose('workflows');
    };

    const getStatusText = () => {
        if (nativeConnectionStatus === 'connected') {
            if (serverStatus.isRunning) {
                return getMessage('serviceRunningStatus', [(serverStatus.port || 'Unknown').toString()]);
            } else {
                return getMessage('connectedServiceNotStartedStatus');
            }
        } else if (nativeConnectionStatus === 'disconnected') {
            return getMessage('serviceNotConnectedStatus');
        } else {
            return getMessage('detectingStatus');
        }
    };

    const getStatusClass = () => {
        if (nativeConnectionStatus === 'connected') {
            return serverStatus.isRunning ? 'bg-[#10b981]' : 'bg-[#f59e0b]'; // emerald-500 or amber-500
        } else if (nativeConnectionStatus === 'disconnected') {
            return 'bg-[#ef4444]'; // rose-500
        }
        return 'bg-[#94a3b8]'; // slate-400
    };

    return (
        <div className="w-[360px] h-full bg-[#f8fafc] flex flex-col overflow-hidden font-sans" data-agent-theme={theme}>
            {currentView === 'home' ? (
                <div className="flex flex-col h-full overflow-y-auto">
                    {/* Header */}
                    <header className="p-5 bg-white border-b border-[#f1f5f9] shrink-0 z-10 shadow-sm">
                        <h1 className="text-[17px] font-[900] text-[#0f172a] tracking-tight m-0 uppercase">Chrome MCP Server</h1>
                    </header>

                    <div className="p-4 flex flex-col gap-7">
                        {/* Server Config Section */}
                        <section className="flex flex-col gap-3">
                            <h2 className="text-[11px] font-[900] text-[#94a3b8] uppercase tracking-widest pl-1">{getMessage('nativeServerConfigLabel')}</h2>
                            <div className="bg-white border border-[#e2e8f0] rounded-[24px] overflow-hidden shadow-sm">
                                {/* Status Card */}
                                <div className="p-5 border-b border-[#f8fafc]">
                                    <div className="flex justify-between items-center mb-2.5">
                                        <p className="text-[13px] font-black text-[#64748b] m-0">{getMessage('runningStatusLabel')}</p>
                                        <button
                                            className="p-1.5 rounded-[10px] text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-all"
                                            onClick={refreshServerStatus}
                                        >
                                            <RefreshIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2.5 h-2.5 rounded-full ${getStatusClass()} shadow-[0_0_8px_rgba(0,0,0,0.1)] animate-pulse`}></div>
                                        <span className="text-[15px] font-[900] text-[#0f172a] leading-tight">{getStatusText()}</span>
                                    </div>
                                    {serverStatus.lastUpdated && (
                                        <div className="text-[10px] text-[#94a3b8] font-bold mt-2.5 opacity-80 uppercase tracking-tighter">
                                            {getMessage('lastUpdatedLabel')} {new Date(serverStatus.lastUpdated).toLocaleTimeString()}
                                        </div>
                                    )}
                                </div>

                                {/* MCP Config JSON */}
                                {showMcpConfig && (
                                    <div className="p-5 bg-[#f8fafc] border-b border-[#f1f5f9]">
                                        <div className="flex justify-between items-center mb-3">
                                            <p className="text-[11px] font-black text-[#94a3b8] uppercase tracking-tight">{getMessage('mcpServerConfigLabel')}</p>
                                            <button
                                                className="text-[10px] font-black text-[#2563eb] hover:bg-[#dbeafe] bg-[#eff6ff] px-2.5 py-1 rounded-[8px] transition-all uppercase tracking-wider"
                                                onClick={copyMcpConfig}
                                            >
                                                {copyButtonText}
                                            </button>
                                        </div>
                                        <div className="bg-white border border-[#e2e8f0] rounded-[16px] p-4 max-h-[140px] overflow-auto shadow-inner">
                                            <pre className="text-[11px] font-mono text-[#475569] m-0 leading-relaxed font-bold">{mcpConfigJson}</pre>
                                        </div>
                                    </div>
                                )}

                                {/* Port Setting */}
                                <div className="p-5 flex items-center justify-between">
                                    <label htmlFor="port" className="text-[13px] font-black text-[#64748b]">{getMessage('connectionPortLabel')}</label>
                                    <input
                                        type="number"
                                        id="port"
                                        value={nativeServerPort}
                                        onChange={(e) => setNativeServerPort(Number(e.target.value))}
                                        className="w-24 text-[14px] font-[900] p-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-[12px] text-right focus:outline-none focus:border-[#3b82f6] focus:bg-white transition-all shadow-sm"
                                    />
                                </div>

                                {/* Primary Connect Button */}
                                <button
                                    className={`w-full p-5 flex items-center justify-center gap-2.5 font-black text-[15px] transition-all active:scale-[0.98] ${nativeConnectionStatus === 'connected'
                                        ? 'bg-[#ef4444] hover:bg-[#dc2626] text-white'
                                        : 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#dbeafe]'
                                        } disabled:opacity-50`}
                                    disabled={isConnecting}
                                    onClick={testNativeConnection}
                                >
                                    <BoltIcon className="w-5 h-5" />
                                    <span className="tracking-tight">
                                        {isConnecting
                                            ? getMessage('connectingStatus')
                                            : nativeConnectionStatus === 'connected'
                                                ? getMessage('disconnectButton')
                                                : getMessage('connectButton')
                                        }
                                    </span>
                                </button>
                            </div>
                        </section>

                        {/* Power Tools Section */}
                        <section className="flex flex-col gap-3">
                            <h2 className="text-[11px] font-[900] text-[#94a3b8] uppercase tracking-widest pl-1">Power Tools</h2>
                            <div className="flex gap-4">
                                <button
                                    className="p-4 bg-white border border-[#e2e8f0] rounded-[24px] text-[#ef4444] hover:bg-[#fef2f2] hover:border-[#fecaca] transition-all shadow-sm active:scale-90 group relative"
                                    onClick={startRecording}
                                    title="Start Recording"
                                >
                                    <RecordIcon className="w-7 h-7 group-hover:scale-110 transition-transform" recording={rrRecording} />
                                </button>
                                <button
                                    className="p-4 bg-white border border-[#e2e8f0] rounded-[24px] text-[#64748b] hover:bg-[#f8fafc] hover:border-[#cbd5e1] transition-all shadow-sm active:scale-90 group"
                                    onClick={stopRecording}
                                    title="Stop Recording"
                                >
                                    <StopIcon className="w-7 h-7 group-hover:scale-110 transition-transform" />
                                </button>
                                <button
                                    className="p-4 bg-white border border-[#e2e8f0] rounded-[24px] text-[#3b82f6] hover:bg-[#eff6ff] hover:border-[#bfdbfe] transition-all shadow-sm active:scale-90 group"
                                    onClick={toggleWebEditor}
                                    title="Toggle Web Editor Mode"
                                >
                                    <EditIcon className="w-7 h-7 group-hover:scale-110 transition-transform" />
                                </button>
                                <button
                                    className="p-4 bg-white border border-[#e2e8f0] rounded-[24px] text-[#10b981] hover:bg-[#f0fdf4] hover:border-[#bbf7d0] transition-all shadow-sm active:scale-90 group"
                                    onClick={toggleElementMarker}
                                    title="Open Element Marker"
                                >
                                    <MarkerIcon className="w-7 h-7 group-hover:scale-110 transition-transform" />
                                </button>
                            </div>
                        </section>

                        {/* Management Grid */}
                        <section className="flex flex-col gap-3 pb-4">
                            <h2 className="text-[11px] font-[900] text-[#94a3b8] uppercase tracking-widest pl-1">Management</h2>
                            <div className="bg-white border border-[#e2e8f0] rounded-[24px] overflow-hidden shadow-sm">
                                {[
                                    { id: 'agent', icon: <AgentIcon className="w-5 h-5" />, title: 'AI Assistant', desc: 'Agent Control Center', color: '#3b82f6', bg: 'bg-[#3b82f6]', onClick: () => openSidepanelAndClose('agent-chat') },
                                    { id: 'workflow', icon: <WorkflowIcon className="w-5 h-5" />, title: 'Workflows', desc: 'Record & Replay Automation', color: '#f59e0b', bg: 'bg-[#f59e0b]', onClick: openWorkflowSidepanel },
                                    { id: 'marker', icon: <ElementMarkerIcon className="w-5 h-5" />, title: 'Selectors', desc: 'Saved Element Data', color: '#10b981', bg: 'bg-[#10b981]', onClick: () => openSidepanelAndClose('element-markers') },
                                    { id: 'model', icon: <LocalModelIcon className="w-5 h-5" />, title: 'Local Models', desc: 'Semantic Search Engine', color: '#8b5cf6', bg: 'bg-[#8b5cf6]', onClick: () => setCurrentView('local-model') }
                                ].map((item, idx, arr) => (
                                    <button
                                        key={item.id}
                                        className={`w-full p-5 flex items-center gap-5 hover:bg-[#f8fafc] transition-all ${idx !== arr.length - 1 ? 'border-b border-[#f1f5f9]' : ''}`}
                                        onClick={item.onClick}
                                    >
                                        <div className={`w-11 h-11 rounded-[14px] flex items-center justify-center text-white shrink-0 ${item.bg} shadow-md`}>
                                            {item.icon}
                                        </div>
                                        <div className="flex flex-col text-left flex-1 min-w-0">
                                            <span className="text-[15px] font-[900] text-[#0f172a] leading-tight tracking-tight">{item.title}</span>
                                            <span className="text-[11px] font-bold text-[#94a3b8] mt-1 uppercase tracking-tighter opacity-80">{item.desc}</span>
                                        </div>
                                        <ChevronRightIcon className="w-4 h-4 text-[#cbd5e1]" />
                                    </button>
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* Footer */}
                    <footer className="mt-auto p-6 border-t border-[#f1f5f9] flex flex-col items-center gap-4 bg-white/50">
                        <div className="flex gap-6">
                            <button className="flex items-center gap-2 text-[11px] font-[900] text-[#94a3b8] hover:text-[#0f172a] transition-all uppercase tracking-widest" onClick={openWelcomePage}>
                                <GuideIcon className="w-4 h-4" />
                                GUIDE
                            </button>
                            <button className="flex items-center gap-2 text-[11px] font-[900] text-[#94a3b8] hover:text-[#0f172a] transition-all uppercase tracking-widest">
                                <DocsIcon className="w-4 h-4" />
                                DOCS
                            </button>
                        </div>
                        <p className="text-[10px] font-black text-[#cbd5e1] uppercase tracking-[0.2em] opacity-80">Chrome MCP Engine v1.0</p>
                    </footer>
                </div>
            ) : (
                <>
                    <LocalModelPage
                        semanticEngineStatus={localModel.semanticEngineStatus}
                        isSemanticEngineInitializing={localModel.isSemanticEngineInitializing}
                        semanticEngineInitProgress={localModel.semanticEngineInitProgress}
                        semanticEngineLastUpdated={localModel.semanticEngineLastUpdated}
                        availableModels={localModel.availableModels}
                        currentModel={localModel.currentModel}
                        isModelSwitching={localModel.isModelSwitching}
                        isModelDownloading={localModel.isModelDownloading}
                        modelDownloadProgress={localModel.modelDownloadProgress}
                        modelInitializationStatus={localModel.modelInitializationStatus}
                        modelErrorMessage={localModel.modelErrorMessage}
                        modelErrorType={localModel.modelErrorType}
                        storageStats={localModel.storageStats}
                        isClearingData={localModel.isClearingData}
                        clearDataProgress={localModel.clearDataProgress}
                        cacheStats={localModel.cacheStats}
                        isManagingCache={localModel.isManagingCache}

                        onBack={() => setCurrentView('home')}
                        onInitializeSemanticEngine={localModel.initializeSemanticEngine}
                        onSwitchModel={localModel.switchModel}
                        onRetryModelInitialization={localModel.retryModelInitialization}
                        onShowClearConfirmation={() => localModel.setShowClearConfirmation(true)}
                        onCleanupCache={localModel.handleCleanupCache}
                        onClearAllCache={localModel.handleClearAllCache}
                    />
                    <ConfirmDialog
                        visible={localModel.showClearConfirmation}
                        title={getMessage('confirmClearDataTitle')}
                        message={getMessage('clearDataWarningMessage')}
                        items={[
                            getMessage('clearDataList1'),
                            getMessage('clearDataList2'),
                            getMessage('clearDataList3'),
                        ]}
                        warning={getMessage('clearDataIrreversibleWarning')}
                        icon="⚠️"
                        confirmText={getMessage('confirmClearButton')}
                        cancelText={getMessage('cancelButton')}
                        confirmingText={getMessage('clearingStatus')}
                        isConfirming={localModel.isClearingData}
                        onConfirm={localModel.confirmClearAllData}
                        onCancel={() => localModel.setShowClearConfirmation(false)}
                    />
                </>
            )}
        </div>
    );
}
