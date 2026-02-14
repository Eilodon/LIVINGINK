import React from 'react';
import { ELEMENTAL_PALETTE, TYPOGRAPHY } from '../theme/Theme';

interface LevelNodeProps {
    level: number;
    position: { x: number, y: number };
    isUnlocked: boolean;
    stars: number;
    element: string; // 'FIRE', 'WATER', etc.
    onClick: () => void;
}

export const LevelNode: React.FC<LevelNodeProps> = ({ level, position, isUnlocked, stars, element, onClick }) => {
    const theme = ELEMENTAL_PALETTE[element as keyof typeof ELEMENTAL_PALETTE] as any || ELEMENTAL_PALETTE.UI;
    const color = isUnlocked ? theme.primary : '#444';
    const glow = isUnlocked ? theme.glow : 'transparent';
    const stroke = isUnlocked ? theme.secondary : '#666';

    return (
        <g
            transform={`translate(${position.x}, ${position.y})`}
            style={{ cursor: isUnlocked ? 'pointer' : 'not-allowed', transition: 'all 0.3s' }}
            onClick={isUnlocked ? onClick : undefined}
            onMouseEnter={(e) => {
                if (isUnlocked) {
                    const circle = e.currentTarget.querySelector('circle');
                    if (circle) circle.setAttribute('r', '35');
                }
            }}
            onMouseLeave={(e) => {
                if (isUnlocked) {
                    const circle = e.currentTarget.querySelector('circle');
                    if (circle) circle.setAttribute('r', '30');
                }
            }}
        >
            {/* Outer Glow */}
            <circle r="30" fill={isUnlocked ? 'rgba(0,0,0,0.8)' : '#222'} stroke={stroke} strokeWidth="3" filter={`drop-shadow(0 0 10px ${glow})`} />

            {/* Inner Fill */}
            <circle r="25" fill={isUnlocked ? color : 'transparent'} opacity="0.2" />

            {/* Level Number */}
            <text
                x="0"
                y="5"
                textAnchor="middle"
                fill={isUnlocked ? '#FFF' : '#888'}
                style={{ fontFamily: TYPOGRAPHY.fontFamily, fontSize: '20px', fontWeight: 'bold' }}
            >
                {level}
            </text>

            {/* Stars */}
            {isUnlocked && stars > 0 && (
                <g transform="translate(0, 35)">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <path
                            key={i}
                            d="M0,-5 L1.5,-1.5 L5,-1.5 L2.5,1 L3.5,5 L0,2.5 L-3.5,5 L-2.5,1 L-5,-1.5 L-1.5,-1.5 Z"
                            fill={i < stars ? '#FFD700' : '#444'}
                            transform={`translate(${(i - 1) * 12}, 0) scale(0.8)`}
                        />
                    ))}
                </g>
            )}

            {/* Locked Icon */}
            {!isUnlocked && (
                <path d="M-6,-2 V-6 A6,6 0 0,1 6,-6 V-2 M-6,-2 H6 V8 H-6 Z" stroke="#666" fill="none" transform="scale(1.2)" />
            )}
        </g>
    );
};
