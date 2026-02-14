import React, { useState, useEffect } from 'react';
import { ELEMENTAL_PALETTE, TYPOGRAPHY, SPACING } from '../theme/Theme';
import { UISystem } from '../../game/systems/UISystem';
import { ParticleBackground } from '../components/ParticleBackground';

export const MainMenuScreen: React.FC = () => {
    // Determine which element is "active" or just cycle through them for the background
    const [activeElement, setActiveElement] = useState<Exclude<keyof typeof ELEMENTAL_PALETTE, 'UI'>>('FIRE');

    // Simple cycle effect for the background
    useEffect(() => {
        const elements = Object.keys(ELEMENTAL_PALETTE).filter(k => k !== 'UI') as Array<Exclude<keyof typeof ELEMENTAL_PALETTE, 'UI'>>;
        let idx = 0;
        const interval = setInterval(() => {
            idx = (idx + 1) % elements.length;
            setActiveElement(elements[idx]);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const currentTheme = ELEMENTAL_PALETTE[activeElement] as { primary: string, secondary: string, accent: string, glow: string };

    return (
        <div style={{
            position: 'relative',
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            background: ELEMENTAL_PALETTE.UI.background // Fallback
        }}>
            {/* S-Tier Particle Background */}
            <ParticleBackground element={activeElement} />

            {/* Gradient Overlay for Text Readability */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: `radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.8) 100%)`,
                pointerEvents: 'none'
            }} />

            {/* Content Container (Z-Index above particles) */}
            <div style={{ zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* Title */}
                <h1 style={{
                    fontFamily: TYPOGRAPHY.fontFamily,
                    fontSize: TYPOGRAPHY.h1,
                    color: ELEMENTAL_PALETTE.UI.text,
                    textShadow: `0 0 20px ${currentTheme.primary}, 0 0 40px ${currentTheme.glow}`,
                    marginBottom: SPACING.xs,
                    textAlign: 'center',
                    letterSpacing: '8px',
                    transition: 'text-shadow 1s ease'
                }}>
                    NGŨ HÀNH
                </h1>
                <p style={{
                    fontFamily: TYPOGRAPHY.fontFamily,
                    fontSize: TYPOGRAPHY.body,
                    color: ELEMENTAL_PALETTE.UI.textSecondary,
                    letterSpacing: '6px',
                    marginBottom: SPACING.xxl,
                    textTransform: 'uppercase',
                    opacity: 0.8
                }}>
                    Elemental Convergence
                </p>

                {/* Primary Action */}
                <button
                    onClick={() => UISystem.getInstance().switchScreen('LEVEL_SELECT')}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.1)';
                        e.currentTarget.style.boxShadow = `0 0 40px ${currentTheme.primary}`;
                        e.currentTarget.style.background = currentTheme.glow;
                        e.currentTarget.style.borderColor = '#FFF';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = `0 0 20px ${currentTheme.primary}`;
                        e.currentTarget.style.background = 'rgba(0,0,0,0.6)';
                        e.currentTarget.style.borderColor = currentTheme.primary;
                    }}
                    style={{
                        padding: `${SPACING.md} ${SPACING.xl}`,
                        fontSize: TYPOGRAPHY.h3,
                        fontFamily: TYPOGRAPHY.fontFamily,
                        background: 'rgba(0,0,0,0.6)',
                        border: `2px solid ${currentTheme.primary}`,
                        color: '#FFF',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: `0 0 20px ${currentTheme.primary}`,
                        marginBottom: SPACING.xl,
                        borderRadius: '4px',
                        backdropFilter: 'blur(5px)'
                    }}
                >
                    BEGIN JOURNEY
                </button>

                {/* Secondary Nav */}
                <div style={{ display: 'flex', gap: SPACING.lg }}>
                    <button 
                        onClick={() => UISystem.getInstance().switchScreen('SHOP')}
                        style={{
                            padding: SPACING.sm,
                            border: 'none',
                            background: 'transparent',
                            color: ELEMENTAL_PALETTE.UI.textSecondary,
                            fontFamily: TYPOGRAPHY.fontFamily,
                            fontSize: TYPOGRAPHY.caption,
                            cursor: 'pointer',
                            letterSpacing: '2px',
                            transition: 'color 0.3s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#FFF'}
                        onMouseLeave={e => e.currentTarget.style.color = ELEMENTAL_PALETTE.UI.textSecondary}
                    >
                        SHOP
                    </button>
                    <button 
                        onClick={() => UISystem.getInstance().switchScreen('PROFILE')}
                        style={{
                            padding: SPACING.sm,
                            border: 'none',
                            background: 'transparent',
                            color: ELEMENTAL_PALETTE.UI.textSecondary,
                            fontFamily: TYPOGRAPHY.fontFamily,
                            fontSize: TYPOGRAPHY.caption,
                            cursor: 'pointer',
                            letterSpacing: '2px',
                            transition: 'color 0.3s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#FFF'}
                        onMouseLeave={e => e.currentTarget.style.color = ELEMENTAL_PALETTE.UI.textSecondary}
                    >
                        PROFILE
                    </button>
                    <button 
                        onClick={() => UISystem.getInstance().switchScreen('SETTINGS')}
                        style={{
                            padding: SPACING.sm,
                            border: 'none',
                            background: 'transparent',
                            color: ELEMENTAL_PALETTE.UI.textSecondary,
                            fontFamily: TYPOGRAPHY.fontFamily,
                            fontSize: TYPOGRAPHY.caption,
                            cursor: 'pointer',
                            letterSpacing: '2px',
                            transition: 'color 0.3s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#FFF'}
                        onMouseLeave={e => e.currentTarget.style.color = ELEMENTAL_PALETTE.UI.textSecondary}
                    >
                        SETTINGS
                    </button>
                </div>
            </div>
        </div>
    );
};
