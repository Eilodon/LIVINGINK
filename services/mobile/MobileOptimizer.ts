/**
 * MOBILE EXPERIENCE OPTIMIZER
 * Touch controls, haptic feedback, gesture recognition
 */

export interface TouchGesture {
  type: 'tap' | 'doubleTap' | 'swipe' | 'pinch' | 'longPress';
  startPoint: { x: number; y: number };
  endPoint?: { x: number; y: number };
  duration: number;
  distance?: number;
  scale?: number;
}

export interface HapticPattern {
  pattern: number[];
  intensity: 'light' | 'medium' | 'heavy';
}

export class MobileOptimizer {
  private isMobile = false;
  private touchStartPoints: Map<number, { x: number; y: number; time: number }> = new Map();
  private lastTapTime = 0;
  private gestureCallbacks: Map<string, (gesture: TouchGesture) => void> = new Map();
  private hapticEnabled = true;
  private touchSensitivity = 1.0;
  private gestureThresholds = {
    tapTime: 300,
    doubleTapTime: 300,
    swipeDistance: 50,
    longPressTime: 500,
    pinchScale: 0.1,
  };

  constructor() {
    this.detectMobileDevice();
    this.setupTouchListeners();
  }

  private detectMobileDevice() {
    this.isMobile = 'ontouchstart' in window || 
                   navigator.maxTouchPoints > 0 || 
                   /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (this.isMobile) {
      document.body.classList.add('mobile-device');
      console.log('📱 Mobile device detected - Optimizing experience');
    }
  }

  private setupTouchListeners() {
    if (!this.isMobile) return;

    const element = document.documentElement;
    
    element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    element.addEventListener('touchcancel', this.handleTouchCancel.bind(this));
  }

  private handleTouchStart(e: TouchEvent) {
    e.preventDefault();
    
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      this.touchStartPoints.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      });
    }
  }

  private handleTouchMove(e: TouchEvent) {
    e.preventDefault();
    
    // Handle multi-touch gestures
    if (e.touches.length === 2) {
      this.handlePinchGesture(e.touches[0], e.touches[1]);
    }
  }

  private handleTouchEnd(e: TouchEvent) {
    e.preventDefault();
    
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const startPoint = this.touchStartPoints.get(touch.identifier);
      
      if (startPoint) {
        const endPoint = { x: touch.clientX, y: touch.clientY };
        const duration = Date.now() - startPoint.time;
        const distance = Math.sqrt(
          Math.pow(endPoint.x - startPoint.x, 2) + 
          Math.pow(endPoint.y - startPoint.y, 2)
        );

        this.analyzeGesture({
          type: 'tap', // Will be updated by analysis
          startPoint: { x: startPoint.x, y: startPoint.y },
          endPoint,
          duration,
          distance,
        });

        this.touchStartPoints.delete(touch.identifier);
      }
    }
  }

  private handleTouchCancel(e: TouchEvent) {
    this.touchStartPoints.clear();
  }

  private analyzeGesture(gesture: TouchGesture) {
    const { duration, distance } = gesture;
    
    // Tap detection
    if (duration < this.gestureThresholds.tapTime && (distance || 0) < 10) {
      const now = Date.now();
      
      // Double tap detection
      if (now - this.lastTapTime < this.gestureThresholds.doubleTapTime) {
        gesture.type = 'doubleTap';
        this.triggerHaptic('medium');
        this.executeGestureCallback('doubleTap', gesture);
      } else {
        gesture.type = 'tap';
        this.triggerHaptic('light');
        this.executeGestureCallback('tap', gesture);
      }
      
      this.lastTapTime = now;
    }
    // Swipe detection
    else if (duration < 500 && (distance || 0) > this.gestureThresholds.swipeDistance) {
      gesture.type = 'swipe';
      this.triggerHaptic('light');
      this.executeGestureCallback('swipe', gesture);
    }
    // Long press detection
    else if (duration > this.gestureThresholds.longPressTime && (distance || 0) < 10) {
      gesture.type = 'longPress';
      this.triggerHaptic('heavy');
      this.executeGestureCallback('longPress', gesture);
    }
  }

  private handlePinchGesture(touch1: Touch, touch2: Touch) {
    const currentDistance = Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) + 
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );

    // This is a simplified pinch detection
    // In production, you'd track distance changes over time
    if (currentDistance > 100) {
      this.triggerHaptic('medium');
      this.executeGestureCallback('pinch', {
        type: 'pinch',
        startPoint: { x: touch1.clientX, y: touch1.clientY },
        duration: 0,
        scale: currentDistance / 100,
      });
    }
  }

  private executeGestureCallback(type: string, gesture: TouchGesture) {
    const callback = this.gestureCallbacks.get(type);
    if (callback) {
      callback(gesture);
    }
  }

  // Haptic feedback system
  triggerHaptic(intensity: 'light' | 'medium' | 'heavy', pattern?: number[]) {
    if (!this.hapticEnabled || !this.isMobile) return;

    if ('vibrate' in navigator) {
      if (pattern) {
        navigator.vibrate(pattern);
      } else {
        const durations = {
          light: [10],
          medium: [20],
          heavy: [50],
        };
        navigator.vibrate(durations[intensity]);
      }
    }
  }

  // Advanced haptic patterns for different game events
  triggerGameHaptic(event: 'skill' | 'hit' | 'levelUp' | 'achievement' | 'death') {
    const patterns: Record<string, HapticPattern> = {
      skill: { pattern: [10, 50, 10], intensity: 'medium' },
      hit: { pattern: [5, 10, 5], intensity: 'light' },
      levelUp: { pattern: [50, 30, 50, 30, 100], intensity: 'heavy' },
      achievement: { pattern: [100, 50, 100, 50, 200], intensity: 'heavy' },
      death: { pattern: [200, 100, 200], intensity: 'heavy' },
    };

    const haptic = patterns[event];
    if (haptic) {
      this.triggerHaptic(haptic.intensity, haptic.pattern);
    }
  }

  // Gesture registration system
  onGesture(type: string, callback: (gesture: TouchGesture) => void) {
    this.gestureCallbacks.set(type, callback);
  }

  removeGestureListener(type: string) {
    this.gestureCallbacks.delete(type);
  }

  // Touch sensitivity adjustment
  setTouchSensitivity(sensitivity: number) {
    this.touchSensitivity = Math.max(0.5, Math.min(2.0, sensitivity));
    this.gestureThresholds.swipeDistance = 50 / this.touchSensitivity;
    this.gestureThresholds.tapTime = 300 / this.touchSensitivity;
  }

  // Haptic control
  setHapticEnabled(enabled: boolean) {
    this.hapticEnabled = enabled;
  }

  isHapticSupported(): boolean {
    return 'vibrate' in navigator;
  }

  // Mobile-specific optimizations
  optimizeForMobile() {
    if (!this.isMobile) return;

    // Prevent default touch behaviors
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    
    // Prevent double-tap zoom
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, false);

    // Prevent context menu
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // Optimize viewport
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
      );
    }

    console.log('📱 Mobile optimizations applied');
  }

  // Get device capabilities
  getDeviceCapabilities() {
    return {
      isMobile: this.isMobile,
      touchSupported: 'ontouchstart' in window,
      hapticSupported: this.isHapticSupported(),
      maxTouchPoints: navigator.maxTouchPoints,
      devicePixelRatio: window.devicePixelRatio || 1,
      screenWidth: screen.width,
      screenHeight: screen.height,
    };
  }

  // Performance profiling for mobile
  profileMobilePerformance() {
    if (!this.isMobile) return null;

    const capabilities = this.getDeviceCapabilities();
    const memory = (performance as any).memory;
    
    return {
      ...capabilities,
      memoryUsage: memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : 'unknown',
      batteryLevel: 'getBattery' in navigator ? 'supported' : 'unsupported',
      connectionType: 'connection' in navigator ? 
        (navigator as any).connection?.effectiveType || 'unknown' : 'unknown',
    };
  }
}

export const mobileOptimizer = new MobileOptimizer();
