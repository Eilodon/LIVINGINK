
import React, { useEffect, useState } from 'react';
import { UISystem, GameUIState } from '../game/systems/UISystem';

export const LevelSelect: React.FC = () => {
    const [state, setState] = useState<GameUIState>(UISystem.getInstance().state);

    useEffect(() => {
        const uiSystem = UISystem.getInstance();
        const onUpdate = (newState: GameUIState) => setState({ ...newState });
        uiSystem.on('update', onUpdate);
        return () => {
            uiSystem.off('update', onUpdate);
        };
    }, []);

    const selectLevel = (level: number) => {
        // For MVP, just switch screen and reload/reset game 
        // Real impl would pass level config to NguHanhModule
        console.log(`Selected Level ${level}`);
        UISystem.getInstance().switchScreen('GAME');
    };

    const containerStyle: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: '#1a1a1a',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px',
        zIndex: 2000, // Top most
    };

    const gridStyle: React.CSSProperties = {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px',
        marginTop: '20px',
        maxWidth: '800px',
        width: '100%',
    };

    const levelButtonStyle = (level: number): React.CSSProperties => ({
        padding: '20px',
        fontSize: '1.5em',
        background: level === 1 ? '#4ade80' : '#333',
        border: '2px solid #555',
        borderRadius: '8px',
        cursor: level === 1 ? 'pointer' : 'not-allowed',
        opacity: level === 1 ? 1 : 0.5,
        textAlign: 'center',
    });

    if (state.currentScreen !== 'LEVEL_SELECT') return null;

    return (
        <div style={containerStyle}>
            <h1>SELECT LEVEL</h1>
            <div style={gridStyle}>
                {Array.from({ length: 20 }, (_, i) => i + 1).map((level) => (
                    <div
                        key={level}
                        style={levelButtonStyle(level)}
                        onClick={() => level === 1 && selectLevel(level)}
                    >
                        {level}
                    </div>
                ))}
            </div>
        </div>
    );
};
