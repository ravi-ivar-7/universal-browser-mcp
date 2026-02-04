import React, { useMemo } from 'react';
import { getMessage } from '@/utils/i18n';
import ProgressIndicator from './ProgressIndicator';
import ModelCacheManagement, { CacheStats } from './ModelCacheManagement'
import {
    DocumentIcon,
    DatabaseIcon,
    BoltIcon,
    TrashIcon,
    CheckIcon,
    TabIcon,
    VectorIcon,
    RefreshIcon,
} from './icons';

interface ModelDefinition {
    preset: string;
    performance: string;
    size: string;
    dimension: number;
}

interface StorageStats {
    indexedPages: number;
    totalDocuments: number;
    totalTabs: number;
    indexSize: number;
    isInitialized: boolean;
}

interface LocalModelPageProps {
    // Semantic Engine
    semanticEngineStatus: 'idle' | 'initializing' | 'ready' | 'error';
    isSemanticEngineInitializing: boolean;
    semanticEngineInitProgress: string;
    semanticEngineLastUpdated: number | null;
    // Models
    availableModels: ModelDefinition[];
    currentModel: string | null;
    isModelSwitching: boolean;
    isModelDownloading: boolean;
    modelDownloadProgress: number;
    modelInitializationStatus: string;
    modelErrorMessage: string;
    modelErrorType: string;
    // Storage Stats
    storageStats: StorageStats | null;
    isClearingData: boolean;
    clearDataProgress: string;
    // Cache
    cacheStats: CacheStats | null;
    isManagingCache: boolean;

    // Events
    onBack: () => void;
    onInitializeSemanticEngine: () => void;
    onSwitchModel: (preset: string) => void;
    onRetryModelInitialization: () => void;
    onShowClearConfirmation: () => void;
    onCleanupCache: () => void;
    onClearAllCache: () => void;
}

const LocalModelPage: React.FC<LocalModelPageProps> = (props) => {
    const {
        semanticEngineStatus,
        isSemanticEngineInitializing,
        semanticEngineInitProgress,
        semanticEngineLastUpdated,
        availableModels,
        currentModel,
        isModelSwitching,
        isModelDownloading,
        modelDownloadProgress,
        modelInitializationStatus,
        modelErrorMessage,
        modelErrorType,
        storageStats,
        isClearingData,
        clearDataProgress,
        cacheStats,
        isManagingCache,
        onBack,
        onInitializeSemanticEngine,
        onSwitchModel,
        onRetryModelInitialization,
        onShowClearConfirmation,
        onCleanupCache,
        onClearAllCache
    } = props;

    const getSemanticEngineStatusClass = () => {
        switch (semanticEngineStatus) {
            case 'ready': return 'bg-[#10b981]'; // bg-emerald-500
            case 'initializing': return 'bg-[#f59e0b]'; // bg-amber-500
            case 'error': return 'bg-[#ef4444]'; // bg-rose-500
            case 'idle':
            default: return 'bg-[#94a3b8]'; // bg-slate-400
        }
    };

    const getSemanticEngineStatusText = () => {
        switch (semanticEngineStatus) {
            case 'ready': return getMessage('semanticEngineReadyStatus');
            case 'initializing': return getMessage('semanticEngineInitializingStatus');
            case 'error': return getMessage('semanticEngineInitFailedStatus');
            case 'idle':
            default: return getMessage('semanticEngineNotInitStatus');
        }
    };

    const progressText = useMemo(() => {
        if (isModelDownloading) {
            return getMessage('downloadingModelStatus', [modelDownloadProgress.toString()]);
        } else if (isModelSwitching) {
            return getMessage('switchingModelStatus');
        }
        return '';
    }, [isModelDownloading, modelDownloadProgress, isModelSwitching]);

    const formatIndexSize = () => {
        if (!storageStats?.indexSize) return '0 MB';
        const sizeInMB = Math.round(storageStats.indexSize / (1024 * 1024));
        return `${sizeInMB} MB`;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f8fafc', overflow: 'hidden' }}>
            {/* Page Header */}
            <div className="flex items-center gap-3 p-4 bg-white border-b border-[#f1f5f9] shrink-0 z-10">
                <button
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-[8px] text-[#64748b] text-[13px] font-bold hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-all"
                    onClick={onBack}
                >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Back</span>
                </button>
                <h2 className="text-[17px] font-[900] text-[#0f172a] tracking-tight m-0 uppercase">Local Models</h2>
            </div>

            {/* Page Content */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-8 pb-10">

                {/* Semantic Engine Section */}
                <section>
                    <h3 className="text-[11px] font-[900] text-[#94a3b8] uppercase tracking-[0.1em] mb-2.5 ml-1">{getMessage('semanticEngineLabel')}</h3>
                    <div className="bg-white border border-[#e2e8f0] rounded-[16px] shadow-sm p-5">
                        <div className="flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full ${getSemanticEngineStatusClass()} shadow-sm`}></span>
                            <span className="text-[14px] font-[800] text-[#1e293b]">{getSemanticEngineStatusText()}</span>
                        </div>
                        {semanticEngineLastUpdated && (
                            <div className="text-[10px] text-[#94a3b8] font-bold mt-1.5 ml-5">
                                {getMessage('lastUpdatedLabel')} {new Date(semanticEngineLastUpdated).toLocaleTimeString()}
                            </div>
                        )}

                        <ProgressIndicator
                            visible={isSemanticEngineInitializing}
                            text={semanticEngineInitProgress}
                            showSpinner={true}
                        />

                        <button
                            className="w-full mt-5 flex items-center justify-center gap-2 py-3.5 px-4 bg-[#2563eb] text-white rounded-[12px] font-bold text-[14px] shadow-lg shadow-[#dbeafe] hover:bg-[#1d4ed8] active:scale-[0.98] transition-all disabled:opacity-50"
                            disabled={isSemanticEngineInitializing}
                            onClick={onInitializeSemanticEngine}
                        >
                            <BoltIcon className="w-5 h-5" />
                            <span>{semanticEngineStatus === 'ready' ? getMessage('reinitializeButton') : getMessage('initSemanticEngineButton')}</span>
                        </button>
                    </div>
                </section>

                {/* Model Selection Section */}
                <section>
                    <h3 className="text-[11px] font-[900] text-[#94a3b8] uppercase tracking-[0.1em] mb-2.5 ml-1">{getMessage('embeddingModelLabel')}</h3>

                    <ProgressIndicator
                        visible={(isModelSwitching || isModelDownloading) && progressText !== ''}
                        text={progressText}
                        showSpinner={true}
                    />

                    <div className="flex flex-col gap-3">
                        {availableModels.map(model => (
                            <button
                                key={model.preset}
                                className={`w-full text-left p-4 bg-white border-2 rounded-[16px] transition-all ${currentModel === model.preset
                                        ? 'border-[#3b82f6] bg-[#eff6ff]/50'
                                        : 'border-[#f1f5f9] hover:border-[#cbd5e1]'
                                    } ${isModelSwitching || isModelDownloading ? 'opacity-60 pointer-events-none' : ''}`}
                                onClick={() => !isModelSwitching && !isModelDownloading && onSwitchModel(model.preset)}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex flex-col">
                                        <p className={`text-[14px] font-[800] leading-none ${currentModel === model.preset ? 'text-[#2563eb]' : 'text-[#0f172a]'}`}>{model.preset}</p>
                                        <p className="text-[11px] text-[#64748b] font-medium mt-1.5 leading-snug">
                                            {model.preset === 'multilingual-e5-small' ? getMessage('lightweightModelDescription') : getMessage('betterThanSmallDescription')}
                                        </p>
                                    </div>
                                    {currentModel === model.preset && (
                                        <div className="bg-[#2563eb] text-white rounded-full p-1 scale-75">
                                            <CheckIcon className="w-4 h-4" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2 pt-1">
                                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-[#f1f5f9] text-[#64748b] rounded-full">{model.performance}</span>
                                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-[#f1f5f9] text-[#64748b] rounded-full">{model.size}</span>
                                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-[#f1f5f9] text-[#64748b] rounded-full">{model.dimension}D</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>

                {/* Index Management Section */}
                <section>
                    <h3 className="text-[11px] font-[900] text-[#94a3b8] uppercase tracking-[0.1em] mb-2.5 ml-1">{getMessage('indexDataManagementLabel')}</h3>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        {[
                            { label: getMessage('indexedPagesLabel'), value: storageStats?.indexedPages || 0, icon: <DocumentIcon className="w-5 h-5" />, color: 'text-violet-600', bg: 'bg-violet-50' },
                            { label: getMessage('indexSizeLabel'), value: formatIndexSize(), icon: <DatabaseIcon className="w-5 h-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                            { label: getMessage('activeTabsLabel'), value: storageStats?.totalTabs || 0, icon: <TabIcon className="w-5 h-5" />, color: 'text-blue-600', bg: 'bg-blue-50' },
                            { label: getMessage('vectorDocumentsLabel'), value: storageStats?.totalDocuments || 0, icon: <VectorIcon className="w-5 h-5" />, color: 'text-rose-600', bg: 'bg-rose-50' }
                        ].map((stat, i) => (
                            <div key={i} className="bg-white border border-[#f1f5f9] rounded-[16px] p-3 shadow-sm flex flex-col gap-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-tight">{stat.label}</span>
                                    <span className={`p-1.5 rounded-[10px] ${stat.bg} ${stat.color}`}>{stat.icon}</span>
                                </div>
                                <span className="text-[18px] font-[900] text-[#0f172a] leading-none mt-1">{stat.value}</span>
                            </div>
                        ))}
                    </div>

                    <button
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white border border-[#e2e8f0] text-[#64748b] rounded-[12px] font-bold text-[13px] hover:border-red-200 hover:text-red-600 active:scale-[0.98] transition-all"
                        disabled={isClearingData}
                        onClick={onShowClearConfirmation}
                    >
                        <TrashIcon className="w-5 h-5" />
                        <span>{isClearingData ? getMessage('clearingStatus') : getMessage('clearAllDataButton')}</span>
                    </button>
                </section>

                {/* Model Cache Management Section */}
                <ModelCacheManagement
                    cacheStats={cacheStats}
                    isManagingCache={isManagingCache}
                    onCleanupCache={onCleanupCache}
                    onClearAllCache={onClearAllCache}
                />
            </div>
        </div>
    );
};

export default LocalModelPage;
