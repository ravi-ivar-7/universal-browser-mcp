import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { App } from './App';
import type { QuickPanelAgentBridge } from '../../core/agent-bridge';
import type { AgentThemeId } from '@/shared/theme/ThemeEngine';

export interface QuickPanelReactManager {
    unmount: () => void;
}

export function mountQuickPanelReact(
    container: HTMLElement,
    agentBridge: QuickPanelAgentBridge,
    onClose: () => void,
    initialTheme: AgentThemeId
): QuickPanelReactManager {
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <App
                agentBridge={agentBridge}
                onClose={onClose}
                initialTheme={initialTheme}
            />
        </React.StrictMode>
    );

    return {
        unmount: () => {
            root.unmount();
        }
    };
}
