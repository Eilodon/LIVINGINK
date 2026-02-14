import React from 'react';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { ELEMENTAL_PALETTE } from '../theme/Theme';

interface LayoutProps {
    children: React.ReactNode;
}

export const LayoutContainer: React.FC<LayoutProps> = ({ children }) => {
    const layout = useResponsiveLayout();

    const containerStyle: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: ELEMENTAL_PALETTE.UI.background,
        color: ELEMENTAL_PALETTE.UI.text,
        fontFamily: '"Cinzel", serif',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        // Safe Area handling
        paddingTop: `${layout.safeAreaTop}px`,
        paddingBottom: `${layout.safeAreaBottom}px`,
    };

    const contentStyle: React.CSSProperties = {
        position: 'relative',
        width: '100%',
        height: '100%',
        maxWidth: layout.isPortrait ? '600px' : '1200px', // constrain content on large screens
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${layout.hudScale})`, // Optional: global scaling
        transformOrigin: 'center center',
    };

    return (
        <div style={containerStyle}>
            <div className="layout-content" style={contentStyle}>
                {children}
            </div>
        </div>
    );
};
