import React from 'react';

interface ProgressIndicatorProps {
    visible: boolean;
    text: string;
    showSpinner?: boolean;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
    visible,
    text,
    showSpinner = true
}) => {
    if (!visible) return null;

    return (
        <div className="flex items-center gap-3.5 py-4 px-5 bg-white border border-[#f1f5f9] rounded-[20px] shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 my-4">
            {showSpinner && (
                <div className="relative w-5 h-5 shrink-0">
                    <div className="absolute inset-0 border-[3px] border-[#eff6ff] rounded-full"></div>
                    <div className="absolute inset-0 border-[3px] border-[#2563eb] rounded-full border-t-transparent animate-spin"></div>
                </div>
            )}
            <span className="text-[14px] font-[800] text-[#1e293b] leading-tight truncate">
                {text}
            </span>
        </div>
    );
};

export default ProgressIndicator;