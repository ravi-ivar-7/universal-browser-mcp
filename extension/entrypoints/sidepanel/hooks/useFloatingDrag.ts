/**
 * React hook for floating drag functionality.
 * Wraps the installFloatingDrag utility for use in React components.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
    installFloatingDrag,
    type FloatingPosition,
} from '@/shared/utils/floating-drag';

const STORAGE_KEY = 'sidepanel_navigator_position';

export interface UseFloatingDragOptions {
    /** Storage key for position persistence */
    storageKey?: string;
    /** Margin from viewport edges in pixels */
    clampMargin?: number;
    /** Threshold for distinguishing click vs drag (ms) */
    clickThresholdMs?: number;
    /** Movement threshold for drag activation (px) */
    moveThresholdPx?: number;
    /** Default position calculator (called when no saved position exists) */
    getDefaultPosition?: () => FloatingPosition;
}

export interface UseFloatingDragReturn {
    /** Current position (state) */
    position: FloatingPosition;
    /** Whether dragging is in progress */
    isDragging: boolean;
    /** Reset position to default */
    resetToDefault: () => void;
    /** Computed style object for binding */
    positionStyle: { left: string; top: string };
}

/**
 * Calculate default position (bottom-right corner with margin)
 */
function getDefaultBottomRightPosition(
    buttonSize: number = 40,
    margin: number = 12,
): FloatingPosition {
    if (typeof window === 'undefined') return { left: 0, top: 0 };
    return {
        left: window.innerWidth - buttonSize - margin,
        top: window.innerHeight - buttonSize - margin,
    };
}

/**
 * Load position from chrome.storage.local
 */
async function loadPosition(storageKey: string): Promise<FloatingPosition | null> {
    try {
        const result = await chrome.storage.local.get(storageKey);
        const saved = result[storageKey];
        if (
            saved &&
            typeof saved.left === 'number' &&
            typeof saved.top === 'number' &&
            Number.isFinite(saved.left) &&
            Number.isFinite(saved.top)
        ) {
            return saved as FloatingPosition;
        }
    } catch (e) {
        console.warn('Failed to load navigator position:', e);
    }
    return null;
}

/**
 * Save position to chrome.storage.local
 */
async function savePosition(storageKey: string, position: FloatingPosition): Promise<void> {
    try {
        await chrome.storage.local.set({ [storageKey]: position });
    } catch (e) {
        console.warn('Failed to save navigator position:', e);
    }
}

/**
 * React hook for making an element draggable with position persistence.
 */
export function useFloatingDrag(
    handleRef: React.RefObject<HTMLElement>,
    targetRef: React.RefObject<HTMLElement>,
    options: UseFloatingDragOptions = {},
): UseFloatingDragReturn {
    const {
        storageKey = STORAGE_KEY,
        clampMargin = 12,
        clickThresholdMs = 150,
        moveThresholdPx = 5,
        getDefaultPosition = () => getDefaultBottomRightPosition(40, clampMargin),
    } = options;

    const [position, setPosition] = useState<FloatingPosition>(() => getDefaultPosition());
    const [isDragging, setIsDragging] = useState(false);

    // Use references to keep track of cleanup and observers
    const cleanupRef = useRef<(() => void) | null>(null);
    const observerRef = useRef<MutationObserver | null>(null);

    const resetToDefault = useCallback(() => {
        const defaultPos = getDefaultPosition();
        setPosition(defaultPos);
        savePosition(storageKey, defaultPos);
    }, [getDefaultPosition, storageKey]);

    useEffect(() => {
        // Initial load from storage
        const init = async () => {
            const saved = await loadPosition(storageKey);
            if (saved) {
                // Validate position is within current viewport
                const maxLeft = window.innerWidth - 40 - clampMargin;
                const maxTop = window.innerHeight - 40 - clampMargin;
                setPosition({
                    left: Math.min(Math.max(clampMargin, saved.left), maxLeft),
                    top: Math.min(Math.max(clampMargin, saved.top), maxTop),
                });
            } else {
                setPosition(getDefaultPosition());
            }
        };
        init();
    }, [storageKey, clampMargin, getDefaultPosition]);

    useEffect(() => {
        // Setup drag logic once refs are available
        if (!handleRef.current || !targetRef.current) return;

        cleanupRef.current?.();

        cleanupRef.current = installFloatingDrag({
            handleEl: handleRef.current,
            targetEl: targetRef.current,
            onPositionChange: (pos) => {
                setPosition(pos);
                savePosition(storageKey, pos);
            },
            clampMargin,
            clickThresholdMs,
            moveThresholdPx,
        });

        // Monitor dragging state via data attribute (if relying on attributes changed by utility)
        // Or we could update `isDragging` in the callback if the utility supported it.
        // For now, let's observe the data attribute as the Vue version did.
        observerRef.current?.disconnect();
        observerRef.current = new MutationObserver(() => {
            setIsDragging(handleRef.current?.dataset.dragging === 'true');
        });

        observerRef.current.observe(handleRef.current, {
            attributes: true,
            attributeFilter: ['data-dragging']
        });

        return () => {
            cleanupRef.current?.();
            observerRef.current?.disconnect();
        };
    }, [
        handleRef.current, // careful with ref.current dependency, usually discouraged but needed here for init
        targetRef.current,
        storageKey,
        clampMargin,
        clickThresholdMs,
        moveThresholdPx
    ]);

    const positionStyle = {
        left: `${position.left}px`,
        top: `${position.top}px`,
    };

    return {
        position,
        isDragging,
        resetToDefault,
        positionStyle,
    };
}
