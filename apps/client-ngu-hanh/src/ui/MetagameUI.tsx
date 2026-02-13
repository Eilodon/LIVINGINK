
import React, { useEffect, useState } from 'react';
import { UISystem, GameUIState } from '../game/systems/UISystem';

export const MetagameUI: React.FC = () => {
    const [state, setState] = useState<GameUIState>(UISystem.getInstance().state);

    useEffect(() => {
        const uiSystem = UISystem.getInstance();
        const onUpdate = (newState: GameUIState) => setState({ ...newState });
        uiSystem.on('update', onUpdate);
        return () => {
            uiSystem.off('update', onUpdate);
        };
    }, []);

    // Helper to reload page (restart level) for MVP
    const restart = () => {
        window.location.reload();
    };

    if (state.levelStatus === 'PLAYING') return null;

    const overlayStyle: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        color: 'white',
        zIndex: 1000,
    };

    const buttonStyle: React.CSSProperties = {
        marginTop: '20px',
        padding: '10px 20px',
        fontSize: '1.2em',
        cursor: 'pointer',
        background: '#4ade80',
        border: 'none',
        borderRadius: '5px',
    };

    const isVictory = state.levelStatus === 'VICTORY';
    const color = isVictory ? '#4ade80' : '#ef4444';
    const title = isVictory ? 'VICTORY!' : 'DEFEAT';
    const message = isVictory
        ? 'The Phoenix has been quelled.'
        : 'The ecosystem collapsed.';

    return (
        <div style={overlayStyle}>
            <h1 style={{ fontSize: '4em', color, margin: 0 }}>{title}</h1>
            <p style={{ fontSize: '1.5em' }}>{message}</p>
            <p>Score: {state.score}</p>

            <button style={buttonStyle} onClick={restart}>
                {isVictory ? 'Next Level' : 'Try Again'}
            </button>
        </div>
    );
};
