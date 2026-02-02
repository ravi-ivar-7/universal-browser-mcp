import React from 'react';
import { Cloud, Lock, Settings, Folder, Globe, BrainCircuit } from 'lucide-react';

const ContextLoader = ({
    className = "w-32 h-32",
    showScanLine = true,
    showRotation = true
}: {
    className?: string;
    showScanLine?: boolean;
    showRotation?: boolean;
}) => {
    return (
        <div className={`${className} relative flex items-center justify-center`}>
            <svg
                viewBox="0 0 200 200"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full drop-shadow-2xl"
            >
                <defs>
                    <linearGradient id="bgGradientNew" x1="0" y1="0" x2="0" y2="200">
                        <stop offset="0%" stopColor="#0B1121" />
                        <stop offset="100%" stopColor="#1E293B" />
                    </linearGradient>

                    <linearGradient id="browserGlass" x1="0" y1="0" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.1" />
                    </linearGradient>

                    <linearGradient id="neonGlow" x1="0" y1="0" x2="100%" y2="0">
                        <stop offset="0%" stopColor="#06b6d4" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>

                    <filter id="glowNice" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* 1. Main Circular Base */}
                <circle cx="100" cy="100" r="95" fill="url(#bgGradientNew)" stroke="#334155" strokeWidth="4" />

                {/* Revolving Data Ring (Controlled by showRotation) */}
                {showRotation && (
                    <>
                        <path
                            d="M 100, 10 A 90 90 0 0 1 100 190 A 90 90 0 0 1 100 10"
                            fill="none"
                            stroke="url(#neonGlow)"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray="20 160"
                        >
                            <animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="8s" repeatCount="indefinite" />
                        </path>
                        <path
                            d="M 100, 10 A 90 90 0 0 1 100 190 A 90 90 0 0 1 100 10"
                            fill="none"
                            stroke="#a855f7"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeDasharray="10 200"
                            opacity="0.7"
                        >
                            <animateTransform attributeName="transform" type="rotate" from="180 100 100" to="540 100 100" dur="12s" repeatCount="indefinite" />
                        </path>
                    </>
                )}


                {/* 2. Central Content Group - Shifted Up and Scaled Down for clearance */}
                <g transform="translate(25, 18) scale(0.72)">



                    {/* Connection Cable */}
                    <path d="M 85 60 L 85 90" stroke="#64748b" strokeWidth="3" strokeDasharray="4 2" />

                    {/* The Browser Window */}
                    <g transform="translate(10, 80)">
                        <rect x="0" y="0" width="180" height="110" rx="12" fill="#0f172a" stroke="#334155" strokeWidth="3" />
                        <rect x="5" y="25" width="170" height="80" rx="6" fill="url(#browserGlass)" />
                        <circle cx="15" cy="12" r="4" fill="#ef4444" />
                        <circle cx="30" cy="12" r="4" fill="#eab308" />
                        <circle cx="45" cy="12" r="4" fill="#22c55e" />
                        <rect x="20" y="40" width="60" height="50" rx="4" fill="#1e293b" stroke="#3b82f6" strokeWidth="1" strokeOpacity="0.5" />
                        <rect x="90" y="40" width="70" height="8" rx="2" fill="#475569" />
                        <rect x="90" y="55" width="70" height="8" rx="2" fill="#475569" />
                        <rect x="90" y="70" width="40" height="8" rx="2" fill="#475569" />
                        {showScanLine && (
                            <rect x="5" y="25" width="170" height="2" fill="#38bdf8" opacity="0.6">
                                <animate attributeName="y" from="25" to="105" dur="3s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0;0.8;0" dur="3s" repeatCount="indefinite" />
                            </rect>
                        )}

                        {/* ===== CONNECTED CIRCUIT LINES ===== */}
                        {/* Connecting icons to the central lock and each other */}
                        <g stroke="#22d3ee" strokeWidth="1.5" strokeOpacity="0.5" strokeLinecap="round">
                            {/* Cloud (23,33) to Lock (90,62) */}
                            <line x1="23" y1="33" x2="90" y2="62" />

                            {/* Settings (157,33) to Lock (90,62) */}
                            <line x1="157" y1="33" x2="90" y2="62" />

                            {/* Folder (42,89) to Lock (90,62) */}
                            <line x1="42" y1="89" x2="90" y2="62" />

                            {/* Globe (138,89) to Lock (90,62) */}
                            <line x1="138" y1="89" x2="90" y2="62" />

                            {/* Horizontal Interconnects */}
                            <line x1="23" y1="33" x2="42" y2="89" strokeOpacity="0.3" /> {/* Cloud to Folder */}
                            <line x1="157" y1="33" x2="138" y2="89" strokeOpacity="0.3" /> {/* Settings to Globe */}
                        </g>

                        {/* Connection Nodes (at intersections) */}
                        <circle cx="90" cy="62" r="4" fill="#22d3ee" opacity="0.4">
                            <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.2;0.6;0.2" dur="2s" repeatCount="indefinite" />
                        </circle>

                        {/* ===== LUCIDE ICONS (Properly positioned over SVG nodes) ===== */}
                    </g>
                </g>


            </svg>

            {/* Main Brain Icon - Rotated 90deg */}
            {/* Positioned above the cable (left ~55%, top ~28%) */}
            <BrainCircuit
                className="absolute w-12 h-12 text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]"
                style={{
                    top: '36%',
                    left: '50%',
                    transform: 'translate(-50%, -50%) rotate(90deg)'
                }}
                strokeWidth={1.5}
            />

            {/* Icon 1: Cloud - Top Left */}
            <Cloud
                className="absolute w-4 h-4 text-cyan-400 drop-shadow-lg"
                style={{ top: '51%', left: '25%', transform: 'translate(-50%, -50%)' }}
                strokeWidth={2.5}
            />

            {/* Icon 2: Lock - Center */}
            <Lock
                className="absolute w-6 h-6 text-pink-500 drop-shadow-xl"
                style={{ top: '62%', left: '50%', transform: 'translate(-50%, -50%)' }}
                strokeWidth={2.5}
            />

            {/* Icon 3: Settings - Top Right */}
            <Settings
                className="absolute w-4 h-4 text-purple-400 drop-shadow-lg"
                style={{ top: '51%', left: '75%', transform: 'translate(-50%, -50%)' }}
                strokeWidth={2.5}
            />

            {/* Icon 4: Folder - Bottom Left */}
            <Folder
                className="absolute w-4 h-4 text-amber-400 drop-shadow-lg"
                style={{ top: '71%', left: '32%', transform: 'translate(-50%, -50%)' }}
                strokeWidth={2.5}
            />

            {/* Icon 5: Globe - Bottom Right */}
            <Globe
                className="absolute w-4 h-4 text-emerald-400 drop-shadow-lg"
                style={{ top: '71%', left: '68%', transform: 'translate(-50%, -50%)' }}
                strokeWidth={2.5}
            />
        </div>
    );
};

export default ContextLoader;
