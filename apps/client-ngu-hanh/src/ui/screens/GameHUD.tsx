import React, { useState, useEffect } from 'react';
import { ELEMENTAL_PALETTE, TYPOGRAPHY, SPACING } from '../theme/Theme';
import { UISystem, GameUIState } from '../../game/systems/UISystem';

// --- SUB-COMPONENTS ---

const StatBox: React.FC<{ label: string, value: string | number, color?: string }> = ({ label, value, color = '#FFF' }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ fontSize: '10px', color: '#888', letterSpacing: '1px' }}>{label}</span>
        <span style={{ fontSize: '20px', fontFamily: TYPOGRAPHY.fontFamily, color: color, fontWeight: 'bold' }}>{value}</span>
    </div>
);

const ProgressBar: React.FC<{ current: number, max: number, color: string, height?: string }> = ({ current, max, color, height = '4px' }) => (
    <div style={{ width: '100%', height, background: '#333', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, (current / max) * 100)}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
    </div>
);

// --- MAIN HUD ---

export const GameHUD: React.FC = () => {
    const [uiState, setUiState] = useState<GameUIState>(UISystem.getInstance().state);

    useEffect(() => {
        const sys = UISystem.getInstance();
        const onUpdate = (s: GameUIState) => setUiState({ ...s });
        sys.on('update', onUpdate);
        return () => { sys.off('update', onUpdate); }
    }, []);

    const theme = ELEMENTAL_PALETTE.UI; // Base UI theme

    // Derived or mocked for now
    const cycleElement = 'FIRE'; // TODO: Get from game state
    // Cast to ensure TS knows we are accessing an Element theme, not the UI theme object
    const elemTheme = ELEMENTAL_PALETTE[cycleElement as keyof typeof ELEMENTAL_PALETTE] as { primary: string, secondary: string, accent: string, glow: string };

    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none', // Allow clicks closely to pass through to canvas
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
        }}>
            {/* TOP BAR */}
            <div style={{
                padding: SPACING.md,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                pointerEvents: 'auto'
            }}>
                {/* Score */}
                <StatBox label="SCORE" value={uiState.score.toLocaleString()} color={theme.primary} />

                {/* Boss Bar (Centered) */}
                <div style={{ flex: 1, margin: `0 ${SPACING.lg}`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {uiState.bossState !== 'IDLE' && (
                        <>
                            <span style={{ fontSize: '12px', color: theme.error, marginBottom: '4px', textShadow: '0 0 5px red' }}>
                                BOSS: {uiState.bossState}
                            </span>
                            <div style={{ width: '100%', maxWidth: '300px' }}>
                                <ProgressBar current={uiState.bossHP} max={uiState.bossMaxHP} color={theme.error} height="12px" />
                            </div>
                            <span style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>{uiState.bossHP} / {uiState.bossMaxHP}</span>
                        </>
                    )}
                </div>

                {/* Elemental Cycle Indicator */}
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: `2px solid ${elemTheme.primary}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', boxShadow: `0 0 10px ${elemTheme.glow}` }}>
                    <div style={{ width: '20px', height: '20px', background: elemTheme.primary, borderRadius: '50%' }} />
                </div>
            </div>

            {/* BOTTOM BAR */}
            <div style={{
                padding: SPACING.md,
                background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                pointerEvents: 'auto'
            }}>
                {/* Moves */}
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
                    <div style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '12px',
                        border: `2px solid ${uiState.movesLeft < 5 ? theme.error : theme.secondary}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#111',
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: uiState.movesLeft < 5 ? theme.error : '#FFF'
                    }}>
                        {uiState.movesLeft}
                    </div>
                    <span style={{ fontSize: '12px', color: '#888' }}>MOVES</span>
                </div>

                {/* Power Ups (Enhanced) */}
                <div style={{ display: 'flex', gap: SPACING.md }}>
                    <button 
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            border: '1px solid #444',
                            background: '#222',
                            color: '#666',
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'all 0.3s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.1)';
                            e.currentTarget.style.borderColor = theme.primary;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.borderColor = '#444';
                        }}
                    >
                        💣
                        <span style={{
                            position: 'absolute',
                            bottom: '-5px',
                            right: '-5px',
                            background: theme.primary,
                            color: '#FFF',
                            fontSize: '10px',
                            padding: '2px 4px',
                            borderRadius: '8px',
                            fontWeight: 'bold'
                        }}>3</span>
                    </button>
                    <button 
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            border: '1px solid #444',
                            background: '#222',
                            color: '#666',
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'all 0.3s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.1)';
                            e.currentTarget.style.borderColor = theme.primary;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.borderColor = '#444';
                        }}
                    >
                        🔨
                        <span style={{
                            position: 'absolute',
                            bottom: '-5px',
                            right: '-5px',
                            background: theme.primary,
                            color: '#FFF',
                            fontSize: '10px',
                            padding: '2px 4px',
                            borderRadius: '8px',
                            fontWeight: 'bold'
                        }}>5</span>
                    </button>
                    <button 
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            border: '1px solid #444',
                            background: '#222',
                            color: '#666',
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'all 0.3s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.1)';
                            e.currentTarget.style.borderColor = theme.primary;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.borderColor = '#444';
                        }}
                    >
                        🔄
                        <span style={{
                            position: 'absolute',
                            bottom: '-5px',
                            right: '-5px',
                            background: theme.primary,
                            color: '#FFF',
                            fontSize: '10px',
                            padding: '2px 4px',
                            borderRadius: '8px',
                            fontWeight: 'bold'
                        }}>2</span>
                    </button>
                </div>

                {/* Menu/Settings */}
                <button
                    onClick={() => UISystem.getInstance().switchScreen('LEVEL_SELECT')}
                    style={{
                        background: 'transparent',
                        border: `1px solid ${theme.textSecondary}`,
                        padding: '8px',
                        borderRadius: '4px',
                        color: theme.textSecondary,
                        cursor: 'pointer'
                    }}
                >
                    EXIT
                </button>
            </div>
        </div>
    );
};
