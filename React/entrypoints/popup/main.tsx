import React from 'react';
import { createRoot } from 'react-dom/client';
import { NativeMessageType } from 'chrome-mcp-shared';
import { preloadAgentTheme } from '../sidepanel/hooks/useAgentTheme';
import App from './App';
import './style.css';

// Mount
preloadAgentTheme().then(() => {
    // Ensure native server is checked on popup open
    void chrome.runtime.sendMessage({ type: NativeMessageType.ENSURE_NATIVE }).catch(() => { });

    const root = document.getElementById('app');
    if (root) {
        createRoot(root).render(<App />);
    }
});
