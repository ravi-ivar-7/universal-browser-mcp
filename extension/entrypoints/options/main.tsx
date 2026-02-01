import React from 'react';
import { createRoot } from 'react-dom/client';

function App() {
    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Settings</h1>
            <p>Options page is under construction.</p>
        </div>
    );
}

const root = document.getElementById('app');
if (root) {
    createRoot(root).render(<App />);
}
