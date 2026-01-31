import { useState, useCallback, useEffect } from 'react';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import { PREDEFINED_MODELS, ModelPreset, getCacheStats, clearModelCache, cleanupModelCache } from '@/utils/semantic-similarity-engine';

export interface StorageStats {
    indexedPages: number;
    totalDocuments: number;
    totalTabs: number;
    indexSize: number;
    isInitialized: boolean;
}

export function useLocalModel() {
    // Semantic Engine State
    const [semanticEngineStatus, setSemanticEngineStatus] = useState<'idle' | 'initializing' | 'ready' | 'error'>('idle');
    const [isSemanticEngineInitializing, setIsSemanticEngineInitializing] = useState(false);
    const [semanticEngineInitProgress, setSemanticEngineInitProgress] = useState('');
    const [semanticEngineLastUpdated, setSemanticEngineLastUpdated] = useState<number | null>(null);

    // Model State
    const [currentModel, setCurrentModel] = useState<string | null>(null);
    const [isModelSwitching, setIsModelSwitching] = useState(false);
    const [isModelDownloading, setIsModelDownloading] = useState(false);
    const [modelDownloadProgress, setModelDownloadProgress] = useState(0);
    const [modelInitializationStatus, setModelInitializationStatus] = useState<'idle' | 'downloading' | 'initializing' | 'ready' | 'error'>('idle');
    const [modelErrorMessage, setModelErrorMessage] = useState('');
    const [modelErrorType, setModelErrorType] = useState<'network' | 'file' | 'unknown' | ''>('');

    // Stats & Cache State
    const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
    const [cacheStats, setCacheStats] = useState<any>(null);
    const [isManagingCache, setIsManagingCache] = useState(false);
    const [isClearingData, setIsClearingData] = useState(false);
    const [clearDataProgress, setClearDataProgress] = useState('');
    const [showClearConfirmation, setShowClearConfirmation] = useState(false);

    // Derived
    const availableModels = Object.entries(PREDEFINED_MODELS).map(([key, value]) => ({
        preset: key,
        ...value,
        dimension: (value as any).dimension
    }));

    // Actions
    const fetchServerStatus = useCallback(async () => {
        try {
            const response = await chrome.runtime.sendMessage({ type: BACKGROUND_MESSAGE_TYPES.GET_MODEL_STATUS });
            if (response && response.success) {
                setSemanticEngineStatus(response.status || 'idle');
                setCurrentModel(response.currentModel || null);
                setSemanticEngineLastUpdated(response.lastUpdated || null);
                // If status is initializing/downloading/ready/error, mapping:
                // Note: response structure depends on background implementation. 
                // Assuming standard fields.
            }
        } catch (e) {
            console.error('Failed to fetch model status:', e);
        }
    }, []);

    const fetchStorageStats = useCallback(async () => {
        try {
            const response = await chrome.runtime.sendMessage({ type: BACKGROUND_MESSAGE_TYPES.GET_STORAGE_STATS });
            if (response && response.success) {
                setStorageStats(response.stats);
            }
        } catch (e) {
            console.error('Failed to fetch storage stats:', e);
        }
    }, []);

    const fetchCacheStats = useCallback(async () => {
        try {
            // Retrieve stats directly from utility (it might read indexedDB directly or via message)
            // The utility implementation reads local IndexedDB/Cache API so it should be fine to call from popup if allowed,
            // otherwise should go through background.
            // The original Vue code called `getCacheStats()` directly.
            const stats = await getCacheStats();
            setCacheStats(stats);
        } catch (e) {
            console.error('Failed to fetch cache stats:', e);
        }
    }, []);

    const initializeSemanticEngine = useCallback(async () => {
        setIsSemanticEngineInitializing(true);
        setSemanticEngineInitProgress('Starting initialization...');
        try {
            const response = await chrome.runtime.sendMessage({
                type: BACKGROUND_MESSAGE_TYPES.INITIALIZE_SEMANTIC_ENGINE
            });

            if (!response.success) {
                throw new Error(response.error || 'Initialization failed');
            }

            // Poll or listen for updates?
            // For now assume background sends updates or we refresh stats
            await fetchServerStatus();
        } catch (e) {
            console.error('Failed to initialize engine', e);
            setSemanticEngineStatus('error');
        } finally {
            setIsSemanticEngineInitializing(false);
        }
    }, [fetchServerStatus]);

    const switchModel = useCallback(async (preset: string) => {
        setIsModelSwitching(true);
        try {
            await chrome.runtime.sendMessage({
                type: BACKGROUND_MESSAGE_TYPES.SWITCH_SEMANTIC_MODEL,
                modelPreset: preset
            });
            await fetchServerStatus();
        } catch (e) {
            console.error('Failed to switch model', e);
        } finally {
            setIsModelSwitching(false);
        }
    }, [fetchServerStatus]);

    const retryModelInitialization = useCallback(() => {
        initializeSemanticEngine();
    }, [initializeSemanticEngine]);

    const handleCleanupCache = useCallback(async () => {
        setIsManagingCache(true);
        try {
            await cleanupModelCache();
            await fetchCacheStats();
        } catch (e) {
            console.error('Failed to cleanup cache', e);
        } finally {
            setIsManagingCache(false);
        }
    }, [fetchCacheStats]);

    const handleClearAllCache = useCallback(async () => {
        setIsManagingCache(true);
        try {
            await clearModelCache();
            await fetchCacheStats();
        } catch (e) {
            console.error('Failed to clear cache', e);
        } finally {
            setIsManagingCache(false);
        }
    }, [fetchCacheStats]);

    const confirmClearAllData = useCallback(async () => {
        setIsClearingData(true);
        setShowClearConfirmation(false);
        setClearDataProgress('Clearing data...');
        try {
            await chrome.runtime.sendMessage({ type: BACKGROUND_MESSAGE_TYPES.CLEAR_ALL_DATA });
            setClearDataProgress('Data cleared.');
            await fetchStorageStats();
        } catch (e) {
            console.error('Failed to clear data', e);
            setClearDataProgress('Error clearing data.');
        } finally {
            setTimeout(() => {
                setIsClearingData(false);
                setClearDataProgress('');
            }, 1500);
        }
    }, [fetchStorageStats]);


    // Listen for background events
    useEffect(() => {
        const listener = (message: any) => {
            if (message.type === BACKGROUND_MESSAGE_TYPES.UPDATE_MODEL_STATUS) {
                // Update status from background push
                if (message.status) setSemanticEngineStatus(message.status);
                if (message.progress) setModelDownloadProgress(message.progress);
                if (typeof message.isDownloading !== 'undefined') setIsModelDownloading(message.isDownloading);
            } else if (message.type === BACKGROUND_MESSAGE_TYPES.SERVER_STATUS_CHANGED) {
                fetchServerStatus();
            }
        };
        chrome.runtime.onMessage.addListener(listener);
        return () => chrome.runtime.onMessage.removeListener(listener);
    }, [fetchServerStatus]);

    // Initial Fetch
    useEffect(() => {
        fetchServerStatus();
        fetchStorageStats();
        fetchCacheStats();
    }, [fetchServerStatus, fetchStorageStats, fetchCacheStats]);

    return {
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
        showClearConfirmation,
        setShowClearConfirmation,

        initializeSemanticEngine,
        switchModel,
        retryModelInitialization,
        handleCleanupCache,
        handleClearAllCache,
        confirmClearAllData
    };
}
