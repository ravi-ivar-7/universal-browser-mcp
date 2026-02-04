import React, { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { NativeMessageType } from 'chrome-mcp-shared';
import { Navbar } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { AdvancedView } from './components/AdvancedView';
import { WorkflowsView } from './components/WorkflowsView';
import { MarkersView } from './components/MarkersView';
import { AgentChat } from './components/AgentChat';
import { useAgentTheme, preloadAgentTheme } from './hooks/useAgentTheme';

// Import styles
import '../styles/tailwind.css';

// Preload theme before mounting
preloadAgentTheme();

// Ensure native connection
void chrome.runtime.sendMessage({ type: NativeMessageType.ENSURE_NATIVE }).catch(() => { });

function App() {
    const { theme: currentTheme, initTheme } = useAgentTheme();
    const [activeTab, setActiveTab] = useState<'home' | 'agent-chat' | 'workflows' | 'advanced' | 'markers'>('home');

    // Initialize
    useEffect(() => {
        initTheme();

        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab');
        if (tabParam === 'agent-chat') {
            setActiveTab('agent-chat');
        } else if (tabParam === 'workflows') {
            setActiveTab('workflows');
        } else if (tabParam === 'advanced') {
            setActiveTab('advanced');
        } else if (tabParam === 'element-markers' || tabParam === 'markers') {
            setActiveTab('markers');
        }
    }, [initTheme]);

    // Handle Tab Change
    const handleTabChange = useCallback((tab: 'home' | 'agent-chat' | 'workflows' | 'advanced' | 'markers') => {
        setActiveTab(tab);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        history.replaceState(null, '', url.toString());
    }, []);

    return (
        <div className="h-full w-full bg-[#fdfcf8] relative overflow-hidden font-sans flex flex-col" data-agent-theme={currentTheme}>
            {/* Persistent Navbar */}
            <Navbar currentView={activeTab} onChange={handleTabChange} />

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden relative">
                <div className={`h-full overflow-y-auto ${activeTab === 'home' ? 'block' : 'hidden'}`}>
                    <HomeView />
                </div>

                <div className={`h-full ${activeTab === 'agent-chat' ? 'block' : 'hidden'}`}>
                    <AgentChat />
                </div>

                <div className={`h-full overflow-y-auto ${activeTab === 'workflows' ? 'block' : 'hidden'} bg-[#f8fafc]`}>
                    <WorkflowsView isActive={activeTab === 'workflows'} />
                </div>

                <div className={`h-full overflow-y-auto ${activeTab === 'markers' ? 'block' : 'hidden'} bg-[#f8fafc]`}>
                    <MarkersView />
                </div>

                <div className={`h-full overflow-y-auto ${activeTab === 'advanced' ? 'block' : 'hidden'}`}>
                    <AdvancedView />
                </div>
            </div>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('app')!);
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

