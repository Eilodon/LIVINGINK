import { useState, useEffect } from 'react';

export interface LayoutConfig {
    canvasSize: { width: number; height: number };
    hudScale: number;
    fontSize: { small: number; medium: number; large: number };
    buttonSize: number;
    spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
    isPortrait: boolean;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    safeAreaTop: number;
    safeAreaBottom: number;
}

const getScreenSize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    return {
        width,
        height,
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024
    };
};

const getOrientation = () => window.innerWidth < window.innerHeight ? 'PORTRAIT' : 'LANDSCAPE';

export const useResponsiveLayout = (): LayoutConfig => {
    const [config, setConfig] = useState<LayoutConfig>({
        canvasSize: { width: 800, height: 800 },
        hudScale: 1,
        fontSize: { small: 12, medium: 16, large: 24 },
        buttonSize: 48,
        spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
        isPortrait: false,
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        safeAreaTop: 0,
        safeAreaBottom: 0,
    });

    useEffect(() => {
        const updateLayout = () => {
            const screenSize = getScreenSize();
            const { width, height, isMobile, isTablet, isDesktop } = screenSize;
            const orientation = getOrientation();
            const isPortrait = orientation === 'PORTRAIT';

            // Calculate scale factor based on screen size
            const scale = Math.min(width / (isPortrait ? 800 : 1600), height / (isPortrait ? 1200 : 900));
            
            // Canvas sizing strategy
            let canvasWidth: number, canvasHeight: number;
            
            if (isMobile) {
                if (isPortrait) {
                    canvasWidth = Math.min(width * 0.9, 400);
                    canvasHeight = canvasWidth; // Keep square for match-3
                } else {
                    canvasWidth = Math.min(width * 0.6, 600);
                    canvasHeight = canvasWidth;
                }
            } else if (isTablet) {
                canvasWidth = Math.min(width * 0.7, 700);
                canvasHeight = canvasWidth;
            } else {
                canvasWidth = Math.min(width * 0.6, 800);
                canvasHeight = canvasWidth;
            }

            // Font sizes
            const baseFontSize = isMobile ? 12 : isTablet ? 14 : 16;
            const fontScale = Math.min(1.5, width / 1024);

            // Button sizes (minimum 44px for touch targets)
            const buttonSize = isMobile ? 44 : isTablet ? 48 : 56;

            // Spacing system
            const baseSpacing = isMobile ? 4 : 8;
            const spacingScale = Math.min(2, width / 768);

            setConfig({
                canvasSize: { width: canvasWidth, height: canvasHeight },
                hudScale: Math.max(0.6, Math.min(scale, 1.5)),
                fontSize: {
                    small: Math.round(baseFontSize * fontScale),
                    medium: Math.round(baseFontSize * 1.2 * fontScale),
                    large: Math.round(baseFontSize * 1.5 * fontScale)
                },
                buttonSize,
                spacing: {
                    xs: Math.round(baseSpacing * spacingScale),
                    sm: Math.round(baseSpacing * 2 * spacingScale),
                    md: Math.round(baseSpacing * 4 * spacingScale),
                    lg: Math.round(baseSpacing * 6 * spacingScale),
                    xl: Math.round(baseSpacing * 8 * spacingScale)
                },
                isPortrait,
                isMobile,
                isTablet,
                isDesktop,
                safeAreaTop: (window as unknown as { safeAreaInsets?: { top: number } }).safeAreaInsets?.top || 0,
                safeAreaBottom: (window as unknown as { safeAreaInsets?: { bottom: number } }).safeAreaInsets?.bottom || 0
            });
        };

        updateLayout();
        window.addEventListener('resize', updateLayout);
        window.addEventListener('orientationchange', () => {
            setTimeout(updateLayout, 100); // Delay for accurate dimensions
        });
        
        return () => {
            window.removeEventListener('resize', updateLayout);
            window.removeEventListener('orientationchange', updateLayout);
        };
    }, []);

    return config;
};

// Helper hook for responsive values
export const useResponsiveValue = <T>(
    values: { mobile?: T; tablet?: T; desktop: T }
): T => {
    const [screenSize, setScreenSize] = useState(getScreenSize());

    useEffect(() => {
        const updateScreenSize = () => {
            setScreenSize(getScreenSize());
        };

        updateScreenSize();
        window.addEventListener('resize', updateScreenSize);
        window.addEventListener('orientationchange', updateScreenSize);

        return () => {
            window.removeEventListener('resize', updateScreenSize);
            window.removeEventListener('orientationchange', updateScreenSize);
        };
    }, []);

    if (screenSize.isMobile && values.mobile !== undefined) {
        return values.mobile;
    } else if (screenSize.isTablet && values.tablet !== undefined) {
        return values.tablet;
    } else {
        return values.desktop;
    }
};

// CSS-in-JS responsive styles helper
export const createResponsiveStyles = (layoutConfig: LayoutConfig) => {
    return {
        canvas: {
            width: `${layoutConfig.canvasSize.width}px`,
            height: `${layoutConfig.canvasSize.height}px`,
            maxWidth: '90vw',
            maxHeight: layoutConfig.isPortrait ? '40vh' : '70vh'
        },
        hud: {
            transform: `scale(${layoutConfig.hudScale})`,
            transformOrigin: 'top left'
        },
        button: {
            minWidth: `${layoutConfig.buttonSize}px`,
            minHeight: `${layoutConfig.buttonSize}px`,
            fontSize: `${layoutConfig.fontSize.medium}px`,
            padding: `${layoutConfig.spacing.sm}px ${layoutConfig.spacing.md}px`,
            borderRadius: `${layoutConfig.spacing.xs}px`
        },
        text: {
            small: { fontSize: `${layoutConfig.fontSize.small}px` },
            medium: { fontSize: `${layoutConfig.fontSize.medium}px` },
            large: { fontSize: `${layoutConfig.fontSize.large}px` }
        },
        spacing: layoutConfig.spacing
    };
};
