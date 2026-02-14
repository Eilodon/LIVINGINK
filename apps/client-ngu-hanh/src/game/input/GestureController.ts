export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface GestureCallbacks {
    onTap: (x: number, y: number) => void;
    onSwipe: (direction: Direction, startX: number, startY: number) => void;
    onHover: (x: number, y: number) => void;
    onLongPress?: (x: number, y: number) => void;
    onPinch?: (scale: number, centerX: number, centerY: number) => void;
}

export class GestureController {
    private canvas: HTMLCanvasElement;
    private callbacks: GestureCallbacks;

    // State
    private startX: number = 0;
    private startY: number = 0;
    private startTime: number = 0;
    private isDragging: boolean = false;
    private longPressTimer: NodeJS.Timeout | null = null;
    private initialPinchDistance: number = 0;

    // Config
    private readonly SWIPE_THRESHOLD = 30; // pixels
    private readonly TAP_TIMEOUT = 250; // ms
    private readonly LONG_PRESS_TIMEOUT = 500; // ms

    constructor(canvas: HTMLCanvasElement, callbacks: GestureCallbacks) {
        this.canvas = canvas;
        this.callbacks = callbacks;
        this.bindEvents();
    }

    private bindEvents() {
        this.canvas.addEventListener('pointerdown', this.onPointerDown);
        this.canvas.addEventListener('pointermove', this.onPointerMove);
        this.canvas.addEventListener('pointerup', this.onPointerUp);
        this.canvas.addEventListener('pointerleave', this.onPointerUp);
        this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
        this.canvas.addEventListener('touchend', this.onTouchEnd, { passive: false });
        // Prevent default touch actions (scrolling)
        this.canvas.style.touchAction = 'none';
    }

    public destroy() {
        this.canvas.removeEventListener('pointerdown', this.onPointerDown);
        this.canvas.removeEventListener('pointermove', this.onPointerMove);
        this.canvas.removeEventListener('pointerup', this.onPointerUp);
        this.canvas.removeEventListener('pointerleave', this.onPointerUp);
        this.canvas.removeEventListener('touchstart', this.onTouchStart);
        this.canvas.removeEventListener('touchmove', this.onTouchMove);
        this.canvas.removeEventListener('touchend', this.onTouchEnd);
        
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
        }
    }

    private onPointerDown = (e: PointerEvent) => {
        // e.preventDefault(); // Prevent focus stealing if needed
        const { x, y } = this.getCanvasCoordinates(e);
        this.startX = x;
        this.startY = y;
        this.startTime = Date.now();
        this.isDragging = true;
        
        // Start long press timer
        if (this.callbacks.onLongPress) {
            this.longPressTimer = setTimeout(() => {
                this.callbacks.onLongPress?.(x, y);
                this.longPressTimer = null;
            }, this.LONG_PRESS_TIMEOUT);
        }
    };

    private onPointerMove = (e: PointerEvent) => {
        const { x, y } = this.getCanvasCoordinates(e);

        // Always report hover
        this.callbacks.onHover(x, y);

        if (!this.isDragging) return;

        // Cancel long press if moved
        if (this.longPressTimer) {
            const deltaX = Math.abs(x - this.startX);
            const deltaY = Math.abs(y - this.startY);
            if (deltaX > 10 || deltaY > 10) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
        }

        // Optional: Real-time drag feedback could go here
    };

    private onPointerUp = (e: PointerEvent) => {
        if (!this.isDragging) return;
        this.isDragging = false;

        // Clear long press timer
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }

        const { x, y } = this.getCanvasCoordinates(e);
        const deltaX = x - this.startX;
        const deltaY = y - this.startY;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        const duration = Date.now() - this.startTime;

        // Check for Swipe
        if (Math.max(absX, absY) > this.SWIPE_THRESHOLD) {
            // It's a swipe
            if (absX > absY) {
                this.callbacks.onSwipe(deltaX > 0 ? 'RIGHT' : 'LEFT', this.startX, this.startY);
            } else {
                this.callbacks.onSwipe(deltaY > 0 ? 'DOWN' : 'UP', this.startX, this.startY);
            }
        } else if (duration < this.TAP_TIMEOUT) {
            // It's a tap
            this.callbacks.onTap(this.startX, this.startY);
        }
    };

    // Touch events for pinch zoom
    private onTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            this.initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
        }
    };

    private onTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 2 && this.callbacks.onPinch) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const currentDistance = Math.sqrt(dx * dx + dy * dy);
            
            if (this.initialPinchDistance > 0) {
                const scale = currentDistance / this.initialPinchDistance;
                const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                this.callbacks.onPinch(scale, centerX, centerY);
            }
        }
    };

    private onTouchEnd = (e: TouchEvent) => {
        if (e.touches.length < 2) {
            this.initialPinchDistance = 0;
        }
    };

    // Normalize coordinates to Canvas Space (0,0 at top-left of canvas element)
    private getCanvasCoordinates(e: PointerEvent) {
        const rect = this.canvas.getBoundingClientRect();
        // Handle scaling if CSS width != internal width
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }
}
