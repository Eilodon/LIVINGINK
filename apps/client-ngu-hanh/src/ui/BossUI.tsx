
import React, { useEffect, useState } from 'react';
import { UISystem, GameUIState } from '../game/systems/UISystem';

export const BossUI: React.FC = () => {
    const [state, setState] = useState<GameUIState>(UISystem.getInstance().state);

    useEffect(() => {
        const uiSystem = UISystem.getInstance();
        const onUpdate = (newState: GameUIState) => setState({ ...newState });
        uiSystem.on('update', onUpdate);
        return () => {
            uiSystem.off('update', onUpdate);
        };
    }, []);

    const hpPercent = Math.max(0, Math.min(100, (state.bossHP / state.bossMaxHP) * 100));

    // Simple styles for MVP
    const containerStyle: React.CSSProperties = {
        position: 'absolute',
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '400px',
        padding: '10px',
        background: 'rgba(0, 0, 0, 0.6)',
        borderRadius: '8px',
        color: 'white',
        textAlign: 'center',
        fontFamily: 'monospace',
    };

    const barContainer: React.CSSProperties = {
        width: '100%',
        height: '20px',
        background: '#444',
        borderRadius: '10px',
        overflow: 'hidden',
        marginTop: '5px',
    };

    const barFill: React.CSSProperties = {
        width: `${hpPercent}%`,
        height: '100%',
        background: hpPercent < 30 ? '#ef4444' : '#fbbf24', // Red if low, else yellow
        transition: 'width 0.3s ease-out',
    };

    return (
        <div style={containerStyle}>
            <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>BOSS: CHU TƯỚC (Fire Phoenix)</div>
            <div style={{ fontSize: '0.9em', color: '#ccc' }}>State: {state.bossState}</div>

            <div style={barContainer}>
                <div style={barFill} />
            </div>
            <div style={{ fontSize: '0.8em', marginTop: '2px' }}>
                {state.bossHP} / {state.bossMaxHP} HP
            </div>

            <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-around', fontSize: '0.8em' }}>
                <div style={{ color: state.ashPercentage > 30 ? '#ef4444' : '#ccc' }}>
                    Ash Spread: {state.ashPercentage}% ⚠️
                </div>
                <div style={{ color: state.stoneCount > 5 ? '#fbbf24' : '#ccc' }}>
                    Stones: {state.stoneCount} 🪨
                </div>
            </div>
        </div>
    );
};
