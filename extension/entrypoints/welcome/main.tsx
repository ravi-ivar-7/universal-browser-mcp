import React from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/tailwind.css';

function App() {
    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Welcome</h1>
            <p>Welcome to Chrome MCP Server.</p>
        </div>
    );
}

const root = document.getElementById('app');
if (root) {
    createRoot(root).render(<App />);
}
