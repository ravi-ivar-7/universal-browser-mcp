import React from 'react';
import { getMessage } from '@/utils/i18n';
import ProgressIndicator from './ProgressIndicator';
import { DatabaseIcon, VectorIcon, TrashIcon } from './icons';

interface CacheEntry {
    url: string;
    size: number;
    sizeMB: number;
    timestamp: number;
    age: string;
    expired: boolean;
}

export interface CacheStats {
    totalSize: number;
    totalSizeMB: number;
    entryCount: number;
    entries: CacheEntry[];
}

interface ModelCacheManagementProps {
    cacheStats: CacheStats | null;
    isManagingCache: boolean;
    onCleanupCache: () => void;
    onClearAllCache: () => void;
}

const getModelNameFromUrl = (url: string) => {
    // Extract model name from HuggingFace URL
    const match = url.match(/huggingface\.co\/([^/]+\/[^/]+)/);
    if (match) {
        return match[1];
    }
    return url.split('/').pop() || url;
};

const ModelCacheManagement: React.FC<ModelCacheManagementProps> = ({
    cacheStats,
    isManagingCache,
    onCleanupCache,
    onClearAllCache
}) => {
    return (
        <div className="flex flex-col gap-4">
            <h3 className="text-[11px] font-[900] text-[#94a3b8] uppercase tracking-[0.1em] mb-2.5 ml-1">
                {getMessage('modelCacheManagementLabel')}
            </h3>

            {/* Cache Statistics Grid */}
            <div className="grid grid-cols-2 gap-3.5">
                <div className="bg-white border border-[#e2e8f0] rounded-[16px] shadow-sm p-4 flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-[#94a3b8] uppercase tracking-tight">{getMessage('cacheSizeLabel')}</span>
                        <span className="p-1.5 rounded-[10px] bg-[#fff7ed] text-[#ea580c] shadow-sm">
                            <DatabaseIcon className="w-5 h-5" />
                        </span>
                    </div>
                    <span className="text-[19px] font-[900] text-[#0f172a] leading-none">{cacheStats?.totalSizeMB || 0} MB</span>
                </div>

                <div className="bg-white border border-[#e2e8f0] rounded-[16px] shadow-sm p-4 flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-[#94a3b8] uppercase tracking-tight">{getMessage('cacheEntriesLabel')}</span>
                        <span className="p-1.5 rounded-[10px] bg-[#faf5ff] text-[#9333ea] shadow-sm">
                            <VectorIcon className="w-5 h-5" />
                        </span>
                    </div>
                    <span className="text-[19px] font-[900] text-[#0f172a] leading-none">{cacheStats?.entryCount || 0}</span>
                </div>
            </div>

            {/* Cache Entries Details */}
            {cacheStats && cacheStats.entries.length > 0 && (
                <div className="flex flex-col gap-2.5 mt-2">
                    <h4 className="text-[11px] font-[900] text-[#94a3b8] uppercase tracking-widest px-1">{getMessage('cacheDetailsLabel')}</h4>
                    <div className="flex flex-col gap-2.5">
                        {cacheStats.entries.map((entry) => (
                            <div key={entry.url} className="p-4 bg-white border border-[#f1f5f9] rounded-[16px] flex flex-col gap-1.5 shadow-sm">
                                <div className="text-[13px] font-[800] text-[#1e293b] truncate">{getModelNameFromUrl(entry.url)}</div>
                                <div className="flex items-center gap-3">
                                    <span className="text-[11px] text-[#64748b] font-black">{entry.sizeMB} MB</span>
                                    <span className="w-1 h-1 rounded-full bg-[#e2e8f0]"></span>
                                    <span className="text-[11px] text-[#94a3b8] font-bold">{entry.age}</span>
                                    {entry.expired && (
                                        <span className="ml-auto text-[10px] text-[#ef4444] font-black uppercase tracking-tighter bg-[#fef2f2] px-2 py-0.5 rounded-md">
                                            {getMessage('expiredLabel')}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* No Cache Message */}
            {cacheStats && cacheStats.entries.length === 0 && (
                <div className="p-10 text-center bg-white border border-[#e2e8f0] border-dashed rounded-[20px] shadow-inner">
                    <p className="text-[13px] font-bold text-[#94a3b8] m-0">{getMessage('noCacheDataMessage')}</p>
                </div>
            )}

            {/* Loading State */}
            {!cacheStats && (
                <div className="p-6 text-center">
                    <div className="inline-block w-5 h-5 border-2 border-[#e2e8f0] border-t-[#3b82f6] rounded-full animate-spin mb-2"></div>
                    <p className="text-[12px] font-bold text-[#94a3b8] uppercase tracking-widest">{getMessage('loadingCacheInfoStatus')}</p>
                </div>
            )}

            {/* Progress Indicator */}
            <ProgressIndicator
                visible={isManagingCache}
                text={isManagingCache ? getMessage('processingCacheStatus') : ''}
                showSpinner={true}
            />

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3.5 mt-2">
                <button
                    className="flex items-center justify-center gap-2 py-3.5 px-3 bg-white border-2 border-[#f1f5f9] text-[#64748b] rounded-[16px] font-[800] text-[12px] hover:border-[#3b82f6] hover:text-[#2563eb] active:scale-[0.98] transition-all disabled:opacity-50"
                    disabled={isManagingCache}
                    onClick={onCleanupCache}
                >
                    <DatabaseIcon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{isManagingCache ? getMessage('cleaningStatus') : getMessage('cleanExpiredCacheButton')}</span>
                </button>

                <button
                    className="flex items-center justify-center gap-2 py-3.5 px-3 bg-white border-2 border-[#f1f5f9] text-[#ef4444] rounded-[16px] font-[800] text-[12px] hover:bg-[#fef2f2] hover:border-[#fecaca] active:scale-[0.98] transition-all disabled:opacity-50"
                    disabled={isManagingCache}
                    onClick={onClearAllCache}
                >
                    <TrashIcon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{isManagingCache ? getMessage('clearingStatus') : getMessage('clearAllCacheButton')}</span>
                </button>
            </div>
        </div>
    );
};

export default ModelCacheManagement;