
import React from 'react';

interface BossUIProps {
    hp: number;
    maxHp: number;
}

export const BossUI: React.FC<BossUIProps> = ({ hp, maxHp }) => {
    // Calculate percentage
    const percent = Math.max(0, Math.min(100, (hp / maxHp) * 100));

    return (
        <div style={{
            position: 'absolute',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '400px',
            height: '40px',
            backgroundColor: '#333',
            border: '2px solid #555',
            borderRadius: '5px',
            overflow: 'hidden',
            boxShadow: '0 0 10px rgba(0,0,0,0.5)'
        }}>
            {/* Health Bar Fill */}
            <div style={{
                width: `${percent}%`,
                height: '100%',
                backgroundColor: '#D32F2F', // Red
                transition: 'width 0.2s ease-out'
            }} />

            {/* Text Overlay */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                color: 'white',
                fontWeight: 'bold',
                fontFamily: 'monospace',
                textShadow: '1px 1px 2px black'
            }}>
                BOSS HP: {Math.ceil(hp)} / {maxHp}
            </div>
        </div>
    );
};
