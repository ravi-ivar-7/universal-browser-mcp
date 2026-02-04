import React from 'react';
import { HomeIcon, AgentIcon, WorkflowIcon, SettingsIcon, MarkerIcon } from './icons';

type ViewType = 'home' | 'agent-chat' | 'workflows' | 'advanced' | 'markers';

interface NavbarProps {
    currentView: ViewType;
    onChange: (view: ViewType) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onChange }) => {
    const navItems = [
        { id: 'home', icon: HomeIcon, label: 'Home' },
        { id: 'agent-chat', icon: AgentIcon, label: 'Agent' },
        { id: 'workflows', icon: WorkflowIcon, label: 'Workflows' },
        { id: 'markers', icon: MarkerIcon, label: 'Elements' },
        { id: 'advanced', icon: SettingsIcon, label: 'Advanced' },
    ] as const;

    return (
        <nav className="h-16 bg-white border-b border-slate-100 flex items-center justify-around px-2 shrink-0 z-50 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
            {navItems.map((item) => {
                const isActive = currentView === item.id;
                return (
                    <button
                        key={item.id}
                        onClick={() => onChange(item.id as ViewType)}
                        className={`
                            flex flex-col items-center justify-center gap-1 min-w-[64px] h-full
                            transition-all duration-200 relative group
                        `}
                    >
                        <div className={`
                            p-2 rounded-xl transition-all duration-300
                            ${isActive
                                ? 'bg-slate-900 text-white shadow-md transform scale-100'
                                : 'text-slate-400 group-hover:text-slate-600 hover:bg-slate-50'
                            }
                        `}>
                            <item.icon className="w-5 h-5" />
                        </div>
                        <span className={`
                            text-[10px] font-bold uppercase tracking-wider
                            transition-all duration-200
                            ${isActive ? 'text-slate-900 translate-y-0 opacity-100' : 'text-slate-400 opacity-0 -translate-y-2 absolute -bottom-2'}
                        `}>
                            {item.label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
};
