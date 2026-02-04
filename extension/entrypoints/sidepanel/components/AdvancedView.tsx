import React, { useState } from 'react';
import LocalModelPage from './LocalModelPage';
import ConfirmDialog from './ConfirmDialog';
import { useLocalModel } from '../hooks/useLocalModel';
import { getMessage } from '../../../utils/i18n';
import { GuideIcon, DocsIcon } from './icons';

export const AdvancedView: React.FC = () => {
    const localModel = useLocalModel();

    const openWelcomePage = async () => {
        try {
            await chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
        } catch { /* ignore */ }
    };

    return (
        <div className="h-full flex flex-col bg-[#f8fafc]">
            {/* We can hide the header if LocalModelPage has its own, or wrap it properly */}
            <div className="flex-1 overflow-hidden relative">
                <LocalModelPage
                    semanticEngineStatus={localModel.semanticEngineStatus}
                    isSemanticEngineInitializing={localModel.isSemanticEngineInitializing}
                    semanticEngineInitProgress={localModel.semanticEngineInitProgress}
                    semanticEngineLastUpdated={localModel.semanticEngineLastUpdated}
                    availableModels={localModel.availableModels}
                    currentModel={localModel.currentModel}
                    isModelSwitching={localModel.isModelSwitching}
                    isModelDownloading={localModel.isModelDownloading}
                    modelDownloadProgress={localModel.modelDownloadProgress}
                    modelInitializationStatus={localModel.modelInitializationStatus}
                    modelErrorMessage={localModel.modelErrorMessage}
                    modelErrorType={localModel.modelErrorType}
                    storageStats={localModel.storageStats}
                    isClearingData={localModel.isClearingData}
                    clearDataProgress={localModel.clearDataProgress}
                    cacheStats={localModel.cacheStats}
                    isManagingCache={localModel.isManagingCache}

                    // OnBack is not needed in this view as we have Navbar
                    onBack={() => { }}
                    onInitializeSemanticEngine={localModel.initializeSemanticEngine}
                    onSwitchModel={localModel.switchModel}
                    onRetryModelInitialization={localModel.retryModelInitialization}
                    onShowClearConfirmation={() => localModel.setShowClearConfirmation(true)}
                    onCleanupCache={localModel.handleCleanupCache}
                    onClearAllCache={localModel.handleClearAllCache}
                />
            </div>

            <ConfirmDialog
                visible={localModel.showClearConfirmation}
                title={getMessage('confirmClearDataTitle')}
                message={getMessage('clearDataWarningMessage')}
                items={[
                    getMessage('clearDataList1'),
                    getMessage('clearDataList2'),
                    getMessage('clearDataList3'),
                ]}
                warning={getMessage('clearDataIrreversibleWarning')}
                icon="⚠️"
                confirmText={getMessage('confirmClearButton')}
                cancelText={getMessage('cancelButton')}
                confirmingText={getMessage('clearingStatus')}
                isConfirming={localModel.isClearingData}
                onConfirm={localModel.confirmClearAllData}
                onCancel={() => localModel.setShowClearConfirmation(false)}
            />

            <footer className="p-6 border-t border-[#f1f5f9] flex flex-col items-center gap-4 bg-white/50 shrink-0">
                <div className="flex gap-6">
                    <button className="flex items-center gap-2 text-[11px] font-[900] text-[#94a3b8] hover:text-[#0f172a] transition-all uppercase tracking-widest" onClick={openWelcomePage}>
                        <GuideIcon className="w-4 h-4" />
                        GUIDE
                    </button>
                    <button className="flex items-center gap-2 text-[11px] font-[900] text-[#94a3b8] hover:text-[#0f172a] transition-all uppercase tracking-widest">
                        <DocsIcon className="w-4 h-4" />
                        DOCS
                    </button>
                </div>
                <p className="text-[10px] font-black text-[#cbd5e1] uppercase tracking-[0.2em] opacity-80">Chrome MCP Engine v1.0</p>
            </footer>
        </div>
    );
};
