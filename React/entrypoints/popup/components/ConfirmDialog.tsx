import React from 'react';

interface ConfirmDialogProps {
    visible: boolean;
    title: string;
    message: string;
    items?: string[];
    warning?: string;
    icon?: string;
    confirmText: string;
    cancelText: string;
    confirmingText?: string;
    isConfirming?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    visible,
    title,
    message,
    items = [],
    warning,
    icon = '⚠️',
    confirmText,
    cancelText,
    confirmingText,
    isConfirming,
    onConfirm,
    onCancel
}) => {
    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-[#0f172a]/60 backdrop-blur-sm transition-opacity"
                onClick={onCancel}
            />

            {/* Dialog Container */}
            <div className="relative w-full max-w-[320px] bg-white rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-[#e2e8f0] overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200">
                <div className="p-7 flex flex-col items-center text-center">
                    {/* Icon */}
                    <div className="w-16 h-16 bg-[#fef2f2] text-[#ef4444] rounded-[20px] flex items-center justify-center text-3xl mb-5 shadow-inner border border-[#fee2e2]">
                        {icon}
                    </div>

                    {/* Content */}
                    <h3 className="text-[19px] font-[900] text-[#0f172a] mb-2 leading-tight tracking-tight">
                        {title}
                    </h3>

                    <p className="text-[14px] font-medium text-[#64748b] mb-5 leading-relaxed">
                        {message}
                    </p>

                    {/* Items List */}
                    {items.length > 0 && (
                        <div className="w-full bg-[#f8fafc] border border-[#f1f5f9] rounded-[16px] p-4 mb-5">
                            <ul className="text-left m-0 p-0 flex flex-col gap-2">
                                {items.map((item, index) => (
                                    <li key={index} className="flex gap-2.5 text-[13px] font-bold text-[#475569]">
                                        <span className="text-[#ef4444]/60 text-[10px] mt-0.5">•</span>
                                        <span className="leading-snug">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Warning Message */}
                    {warning && (
                        <div className="w-full p-4 bg-[#fef2f2] border border-[#fee2e2] rounded-[12px] mb-6">
                            <p className="text-[12px] text-[#ef4444] font-black m-0 italic leading-snug">
                                {warning}
                            </p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="w-full flex flex-col gap-2.5">
                        <button
                            className="w-full py-4 px-4 bg-[#ef4444] text-white rounded-[16px] font-[900] text-[15px] shadow-lg shadow-[#fee2e2] hover:bg-[#dc2626] active:scale-[0.98] transition-all disabled:opacity-50"
                            onClick={onConfirm}
                            disabled={isConfirming}
                        >
                            {isConfirming ? (confirmingText || 'Confirming...') : confirmText}
                        </button>

                        <button
                            className="w-full py-3.5 px-4 bg-white text-[#94a3b8] rounded-[16px] font-[900] text-[14px] hover:text-[#475569] hover:bg-[#f8fafc] transition-all disabled:opacity-50"
                            onClick={onCancel}
                            disabled={isConfirming}
                        >
                            {cancelText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
