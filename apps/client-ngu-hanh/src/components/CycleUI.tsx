
import React from 'react';

// Element Colors (matching GameHost for consistency)
const ELEMENT_COLORS = [
    '#E0E0E0', // Metal
    '#4CAF50', // Wood
    '#2196F3', // Water
    '#F44336', // Fire
    '#795548'  // Earth
];

const ELEMENT_NAMES = [
    'METAL',
    'WOOD',
    'WATER',
    'FIRE',
    'EARTH'
];

interface CycleUIProps {
    target: number;
    multiplier: number;
    chainLength: number;
}

export const CycleUI: React.FC<CycleUIProps> = ({ target, multiplier, chainLength }) => {
    return (
        <div style={{
            position: 'absolute',
            top: 20,
            right: 20,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: '15px',
            borderRadius: '10px',
            color: 'white',
            fontFamily: 'monospace',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            minWidth: '200px',
            border: '1px solid #333'
        }}>
            <div style={{ fontSize: '1.2em', fontWeight: 'bold', borderBottom: '1px solid #555', paddingBottom: '5px' }}>
                ELEMENTAL CYCLE
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>TARGET:</span>
                <div style={{
                    color: ELEMENT_COLORS[target] || 'white',
                    fontWeight: 'bold',
                    fontSize: '1.2em'
                }}>
                    {ELEMENT_NAMES[target] || 'NONE'}
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>MULTIPLIER:</span>
                <span style={{ color: '#FFD700', fontWeight: 'bold' }}>x{multiplier}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>CHAIN:</span>
                <span>{chainLength}</span>
            </div>

            <div style={{ fontSize: '0.8em', color: '#888', marginTop: '5px' }}>
                Matches must follow cycle:<br />
                Water {'>'} Wood {'>'} Fire {'>'} Earth {'>'} Metal {'>'} Water
            </div>
        </div>
    );
};
