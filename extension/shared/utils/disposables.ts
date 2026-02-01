/**
 * Utility for managing resource cleanup.
 *
 * Collectors cleanup functions (callbacks, event listeners, etc.)
 * and executes them all at once when dispose() is called.
 */
export class Disposer {
    private disposables: (() => void)[] = [];

    /**
     * Add a cleanup function to the disposer.
     */
    add(disposable: (() => void)): void {
        this.disposables.push(disposable);
    }

    /**
     * Helper to add an event listener and record its removal.
     */
    listen(
        target: EventTarget,
        type: string,
        listener: any,
        options?: boolean | AddEventListenerOptions,
    ): void {
        target.addEventListener(type, listener, options);
        this.add(() => target.removeEventListener(type, listener, options));
    }

    /**
     * Run all recorded cleanup functions and clear the list.
     * Disposables are called in reverse order of addition (LIFO).
     */
    dispose(): void {
        // Run in reverse order of addition
        while (this.disposables.length > 0) {
            const d = this.disposables.pop();
            try {
                if (typeof d === 'function') {
                    d();
                }
            } catch (err) {
                console.error('[Disposer] Cleanup error:', err);
            }
        }
    }
}
