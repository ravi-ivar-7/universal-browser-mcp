import React, { useEffect, useState, useMemo } from 'react';
import { getMessage } from '../../../utils/i18n';
import { BACKGROUND_MESSAGE_TYPES } from '../../../common/message-types';
import { BoltIcon, RefreshIcon, RecordIcon, StopIcon, EditIcon, MarkerIcon } from './icons';

export const HomeView: React.FC = () => {
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
    const [rrRecording, setRrRecording] = useState(false);

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
        checkRecordingStatus();
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

    const checkRecordingStatus = async () => {
        // Simple check if we can query for active recording state
        // For now, let's assume false or listen to events if available
        // Ideally we would ask background for 'isRecording'
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

    const toggleElementMarker = async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) return;
            await chrome.runtime.sendMessage({
                type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_START,
                tabId: tab.id,
            });
            // Don't close window in sidepanel mode
        } catch (error) {
            console.warn('Failed to start element marker:', error);
        }
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
            return serverStatus.isRunning ? 'bg-[#10b981]' : 'bg-[#f59e0b]';
        } else if (nativeConnectionStatus === 'disconnected') {
            return 'bg-[#ef4444]';
        }
        return 'bg-[#94a3b8]';
    };

    return (
        <div className="flex flex-col h-full overflow-y-auto bg-[#f8fafc]">
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
                    <h2 className="text-[11px] font-[900] text-[#94a3b8] uppercase tracking-widest pl-1">Quick Actions</h2>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            className="p-4 bg-white border border-[#e2e8f0] rounded-[24px] text-[#ef4444] hover:bg-[#fef2f2] hover:border-[#fecaca] transition-all shadow-sm active:scale-95 group relative flex flex-col items-center justify-center gap-2"
                            onClick={startRecording}
                            title="Start Recording"
                        >
                            <RecordIcon className="w-8 h-8 group-hover:scale-110 transition-transform" recording={rrRecording} />
                            <span className="text-[11px] font-bold uppercase tracking-tight text-slate-600">Record</span>
                        </button>
                        <button
                            className="p-4 bg-white border border-[#e2e8f0] rounded-[24px] text-[#64748b] hover:bg-[#f8fafc] hover:border-[#cbd5e1] transition-all shadow-sm active:scale-95 group flex flex-col items-center justify-center gap-2"
                            onClick={stopRecording}
                            title="Stop Recording"
                        >
                            <StopIcon className="w-8 h-8 group-hover:scale-110 transition-transform" />
                            <span className="text-[11px] font-bold uppercase tracking-tight text-slate-600">Stop</span>
                        </button>
                        <button
                            className="p-4 bg-white border border-[#e2e8f0] rounded-[24px] text-[#10b981] hover:bg-[#f0fdf4] hover:border-[#bbf7d0] transition-all shadow-sm active:scale-95 group flex flex-col items-center justify-center gap-2"
                            onClick={toggleElementMarker}
                            title="Open Element Marker"
                        >
                            <MarkerIcon className="w-8 h-8 group-hover:scale-110 transition-transform" />
                            <span className="text-[11px] font-bold uppercase tracking-tight text-slate-600">Marker</span>
                        </button>
                        <button
                            className="p-4 bg-white border border-[#e2e8f0] rounded-[24px] text-[#3b82f6] hover:bg-[#eff6ff] hover:border-[#bfdbfe] transition-all shadow-sm active:scale-95 group flex flex-col items-center justify-center gap-2 opacity-50 cursor-not-allowed"
                            title="Web Editor (Coming Soon)"
                        >
                            <EditIcon className="w-8 h-8 group-hover:scale-110 transition-transform" />
                            <span className="text-[11px] font-bold uppercase tracking-tight text-slate-600">Editor</span>
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
};
