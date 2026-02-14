import React, { useState, useEffect } from 'react';
import { ELEMENTAL_PALETTE, TYPOGRAPHY, SPACING } from '../theme/Theme';
import { UISystem } from '../../game/systems/UISystem';
import { LevelNode } from '../components/LevelNode';

const WORLDS = ['EARTH', 'FIRE', 'WATER', 'WOOD', 'METAL'] as const;
const LEVELS_PER_WORLD = 4; // 5 Worlds * 4 Levels = 20 Levels Total

export const WorldMapScreen: React.FC = () => {
    const [uiState, setUiState] = useState(UISystem.getInstance().state);
    const [selectedWorldIdx, setSelectedWorldIdx] = useState(0);

    useEffect(() => {
        const sys = UISystem.getInstance();
        const onUpdate = (s: any) => setUiState({ ...s });
        sys.on('update', onUpdate);

        // Auto-select world based on unlocked level
        const currentWorld = Math.floor((sys.state.unlockedLevelMax - 1) / LEVELS_PER_WORLD);
        setSelectedWorldIdx(Math.min(currentWorld, WORLDS.length - 1));

        return () => { sys.off('update', onUpdate); }
    }, []);

    const currentWorldName = WORLDS[selectedWorldIdx];
    const theme = ELEMENTAL_PALETTE[currentWorldName];

    // Calculate progress for this world
    const worldStartLevel = selectedWorldIdx * LEVELS_PER_WORLD + 1;
    const worldEndLevel = worldStartLevel + LEVELS_PER_WORLD - 1;
    const unlockedInWorld = Math.max(0, Math.min(LEVELS_PER_WORLD, uiState.unlockedLevelMax - worldStartLevel + 1));

    // Virtual resolution for SVG map
    const V_WIDTH = 600;
    const V_HEIGHT = 800;

    // Generate Path Nodes
    // Coords in Virtual Space
    const positions = [
        { x: V_WIDTH * 0.5, y: V_HEIGHT * 0.8 }, // Start bottom center
        { x: V_WIDTH * 0.2, y: V_HEIGHT * 0.6 }, // Left
        { x: V_WIDTH * 0.8, y: V_HEIGHT * 0.4 }, // Right
        { x: V_WIDTH * 0.5, y: V_HEIGHT * 0.2 }, // Top Center
    ];

    return (
        <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: `linear-gradient(to bottom, ${ELEMENTAL_PALETTE.UI.background}, ${theme.accent} 150%)`,
            color: ELEMENTAL_PALETTE.UI.text,
            padding: SPACING.md
        }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: SPACING.lg }}>
                <h2 style={{ fontFamily: TYPOGRAPHY.fontFamily, fontSize: TYPOGRAPHY.h2, color: theme.primary, textShadow: `0 0 10px ${theme.glow}` }}>
                    WORLD {selectedWorldIdx + 1}: {currentWorldName}
                </h2>
                {/* Progress Bar */}
                <div style={{ width: '200px', height: '6px', background: '#333', margin: '0 auto', borderRadius: '3px' }}>
                    <div style={{
                        width: `${(unlockedInWorld / LEVELS_PER_WORLD) * 100}%`,
                        height: '100%',
                        background: theme.primary,
                        borderRadius: '3px',
                        transition: 'width 0.5s ease'
                    }} />
                </div>
            </div>

            {/* Map Area */}
            <div style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center' }}>
                <svg
                    width="100%"
                    height="100%"
                    viewBox={`0 0 ${V_WIDTH} ${V_HEIGHT}`}
                    preserveAspectRatio="xMidYMid meet"
                    style={{ maxWidth: '600px', maxHeight: '800px', overflow: 'visible' }}
                >
                    {/* Path */}
                    <path
                        d={`M${positions[0].x},${positions[0].y} Q${positions[1].x},${positions[0].y} ${positions[1].x},${positions[1].y} T${positions[2].x},${positions[2].y} T${positions[3].x},${positions[3].y}`}
                        fill="none"
                        stroke={theme.secondary}
                        strokeWidth="4"
                        strokeDasharray="10,10"
                        opacity="0.5"
                    />

                    {/* Nodes */}
                    {Array.from({ length: LEVELS_PER_WORLD }).map((_, i) => {
                        const levelNum = worldStartLevel + i;
                        const isUnlocked = levelNum <= uiState.unlockedLevelMax;
                        return (
                            <LevelNode
                                key={levelNum}
                                level={levelNum}
                                position={positions[i]}
                                isUnlocked={isUnlocked}
                                stars={isUnlocked ? (Math.random() > 0.5 ? 2 : 3) : 0} // Mock stars
                                element={currentWorldName}
                                onClick={() => {
                                    UISystem.getInstance().selectLevel(levelNum);
                                    UISystem.getInstance().switchScreen('GAME');
                                }}
                            />
                        );
                    })}
                </svg>
            </div>

            {/* Navigation Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: SPACING.md }}>
                <button
                    disabled={selectedWorldIdx === 0}
                    onClick={() => setSelectedWorldIdx(i => i - 1)}
                    style={{ background: 'transparent', border: 'none', color: theme.secondary, fontSize: '24px', cursor: 'pointer', opacity: selectedWorldIdx === 0 ? 0.3 : 1 }}
                >
                    ◀
                </button>
                <button
                    onClick={() => UISystem.getInstance().switchScreen('MAIN_MENU')}
                    style={{ background: theme.glow, border: `1px solid ${theme.primary}`, padding: '8px 16px', color: theme.primary, fontFamily: TYPOGRAPHY.fontFamily, cursor: 'pointer' }}
                >
                    BACK
                </button>
                <button
                    disabled={selectedWorldIdx === WORLDS.length - 1}
                    onClick={() => setSelectedWorldIdx(i => i + 1)}
                    style={{ background: 'transparent', border: 'none', color: theme.secondary, fontSize: '24px', cursor: 'pointer', opacity: selectedWorldIdx === WORLDS.length - 1 ? 0.3 : 1 }}
                >
                    ▶
                </button>
            </div>
        </div>
    );
};
