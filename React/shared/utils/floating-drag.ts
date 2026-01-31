/**
 * Floating Element Drag Utility
 *
 * Provides smooth dragging functionality for floating UI elements like the
 * Sidepanel Navigator or Quick Panel handles.
 *
 * Support:
 * - Handle vs Target separation
 * - Viewport clamping with margin
 * - Drag vs Click detection
 * - Position change callbacks
 */

export interface FloatingPosition {
    left: number;
    top: number;
}

export interface FloatingDragOptions {
    /** The element that triggers the drag */
    handleEl: HTMLElement;
    /** The element that is moved */
    targetEl: HTMLElement;
    /** Callback whenever position changes */
    onPositionChange: (pos: FloatingPosition) => void;
    /** Margin to keep from viewport edges. Default: 12 */
    clampMargin?: number;
    /** Threshold for distinguishing click vs drag in ms. Default: 150 */
    clickThresholdMs?: number;
    /** Movement threshold in px before drag starts. Default: 5 */
    moveThresholdPx?: number;
}

/**
 * Install floating drag handlers on an element.
 * returns a cleanup function.
 */
export function installFloatingDrag(options: FloatingDragOptions): () => void {
    const {
        handleEl,
        targetEl,
        onPositionChange,
        clampMargin = 12,
        clickThresholdMs = 150,
        moveThresholdPx = 5,
    } = options;

    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let isDragging = false;
    let startTime = 0;

    const onMouseDown = (e: MouseEvent) => {
        // Only primary button
        if (e.button !== 0) return;

        startX = e.clientX;
        startY = e.clientY;

        const rect = targetEl.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;

        startTime = Date.now();
        isDragging = false;

        document.addEventListener('mousemove', onMouseMove, { passive: true });
        document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (!isDragging) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            const duration = Date.now() - startTime;

            if (distance > moveThresholdPx && duration > 50) {
                isDragging = true;
                handleEl.dataset.dragging = 'true';
            } else {
                return;
            }
        }

        let left = startLeft + dx;
        let top = startTop + dy;

        // Clamping
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const targetWidth = targetEl.offsetWidth;
        const targetHeight = targetEl.offsetHeight;

        const maxLeft = Math.max(clampMargin, viewportWidth - targetWidth - clampMargin);
        const maxTop = Math.max(clampMargin, viewportHeight - targetHeight - clampMargin);

        left = Math.min(Math.max(clampMargin, left), maxLeft);
        top = Math.min(Math.max(clampMargin, top), maxTop);

        // Apply styles directly for immediate feedback
        targetEl.style.left = `${left}px`;
        targetEl.style.top = `${top}px`;
        targetEl.style.right = 'auto';
        targetEl.style.bottom = 'auto';

        onPositionChange({ left, top });
    };

    const onMouseUp = (e: MouseEvent) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        if (isDragging) {
            handleEl.dataset.dragging = 'false';
            // Prevent the click event if we were dragging
            const stopClick = (ev: MouseEvent) => {
                ev.stopImmediatePropagation();
                ev.preventDefault();
            };
            handleEl.addEventListener('click', stopClick, { once: true, capture: true });

            // Reset dragging state shortly after to allow CSS transitions if needed
            setTimeout(() => {
                delete handleEl.dataset.dragging;
            }, 0);
        }
    };

    handleEl.addEventListener('mousedown', onMouseDown);

    return () => {
        handleEl.removeEventListener('mousedown', onMouseDown);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
}
