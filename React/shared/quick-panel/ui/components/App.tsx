import React, { useState } from 'react';
import { QuickPanelShell } from './QuickPanelShell';
import type { AgentThemeId } from '@/shared/theme/ThemeEngine';
import type { QuickPanelAgentBridge } from '../../core/agent-bridge';
import { AiChatPanel } from './AiChatPanel';
import { SearchPanel } from './SearchPanel';
import type { QuickPanelView } from '../../core/types';

interface AppProps {
    agentBridge: QuickPanelAgentBridge;
    onClose: () => void;
    initialTheme: AgentThemeId;
}

export const App: React.FC<AppProps> = ({ agentBridge, onClose, initialTheme }) => {
    const [theme, setTheme] = useState<AgentThemeId>(initialTheme);
    const [view, setView] = useState<QuickPanelView>('search');
    const [initialChatQuery, setInitialChatQuery] = useState('');

    const handleSwitchToChat = (query: string = '') => {
        setInitialChatQuery(query);
        setView('chat');
    };

    const handleThemeChange = (newTheme: AgentThemeId) => {
        setTheme(newTheme);
        // Persist theme to storage
        chrome.storage.local.set({ agentTheme: newTheme }).catch(console.error);
    };

    // Load persisted theme on mount
    React.useEffect(() => {
        chrome.storage.local.get(['agentTheme']).then((result) => {
            if (result.agentTheme) {
                setTheme(result.agentTheme as AgentThemeId);
            }
        }).catch(console.error);
    }, []);

    return (
        <QuickPanelShell theme={theme} onThemeChange={handleThemeChange} onClose={onClose}>
            {view === 'search' ? (
                <SearchPanel onSwitchToChat={handleSwitchToChat} />
            ) : (
                <AiChatPanel
                    agentBridge={agentBridge}
                    initialQuery={initialChatQuery}
                    onBack={() => setView('search')}
                />
            )}
        </QuickPanelShell>
    );
};
