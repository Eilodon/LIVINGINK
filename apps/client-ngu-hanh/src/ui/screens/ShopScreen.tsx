import React, { useState, useEffect } from 'react';
import { ELEMENTAL_PALETTE, TYPOGRAPHY, SPACING } from '../theme/Theme';
import { UISystem } from '../../game/systems/UISystem';

interface ShopItem {
    id: string;
    name: string;
    description: string;
    cost: number;
    element: Exclude<keyof typeof ELEMENTAL_PALETTE, 'UI'>;
    type: 'powerup' | 'cosmetic' | 'boost';
    owned: number;
    icon: string;
}

export const ShopScreen: React.FC = () => {
    const [uiState, setUiState] = useState(UISystem.getInstance().state);
    const [selectedTab, setSelectedTab] = useState<'powerups' | 'cosmetics' | 'boosts'>('powerups');
    // const [playerCoins, setPlayerCoins] = useState(2500); // REPLACED by UISystem

    useEffect(() => {
        const sys = UISystem.getInstance();
        const onUpdate = (s: any) => setUiState({ ...s });
        sys.on('update', onUpdate);
        return () => { sys.off('update', onUpdate); }
    }, []);

    const shopItems: ShopItem[] = [
        // Power-ups
        { id: 'bomb', name: 'Elemental Bomb', description: 'Clear 3x3 area', cost: 100, element: 'FIRE', type: 'powerup', owned: 3, icon: '💣' },
        { id: 'hammer', name: 'Mystic Hammer', description: 'Destroy single tile', cost: 50, element: 'METAL', type: 'powerup', owned: 5, icon: '🔨' },
        { id: 'shuffle', name: 'Chaos Shuffle', description: 'Rearrange board', cost: 150, element: 'WATER', type: 'powerup', owned: 2, icon: '🔄' },
        { id: 'time', name: 'Time Freeze', description: 'Pause timer for 30s', cost: 200, element: 'EARTH', type: 'powerup', owned: 1, icon: '⏰' },

        // Cosmetics
        { id: 'fire_trail', name: 'Fire Trail', description: 'Leave fire particles', cost: 500, element: 'FIRE', type: 'cosmetic', owned: 0, icon: '🔥' },
        { id: 'water_ripple', name: 'Water Ripple', description: 'Water match effects', cost: 500, element: 'WATER', type: 'cosmetic', owned: 0, icon: '💧' },
        { id: 'earth_glow', name: 'Earth Glow', description: 'Glowing earth tiles', cost: 500, element: 'EARTH', type: 'cosmetic', owned: 0, icon: '✨' },

        // Boosts
        { id: 'double_score', name: 'Double Score', description: '2x score for 5 minutes', cost: 300, element: 'METAL', type: 'boost', owned: 0, icon: '×2' },
        { id: 'extra_moves', name: '+10 Moves', description: 'Add 10 moves to current level', cost: 250, element: 'WOOD', type: 'boost', owned: 0, icon: '➕' },
    ];

    const filteredItems = shopItems.filter(item => {
        if (selectedTab === 'powerups') return item.type === 'powerup';
        if (selectedTab === 'cosmetics') return item.type === 'cosmetic';
        if (selectedTab === 'boosts') return item.type === 'boost';
        return true;
    });

    const handlePurchase = (item: ShopItem) => {
        if (UISystem.getInstance().spendCoins(item.cost)) {
            // Coin deduction handled in UISystem
            console.log(`Purchased ${item.name}`);
            // TODO: Update inventory in ECS/Backend
        }
    };

    return (
        <div style={{
            width: '100%',
            height: '100%',
            background: `linear-gradient(135deg, ${ELEMENTAL_PALETTE.UI.background}, ${ELEMENTAL_PALETTE.UI.surface})`,
            color: ELEMENTAL_PALETTE.UI.text,
            padding: SPACING.md,
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg }}>
                <button
                    onClick={() => UISystem.getInstance().switchScreen('MAIN_MENU')}
                    style={{
                        background: 'transparent',
                        border: `1px solid ${ELEMENTAL_PALETTE.UI.textSecondary}`,
                        color: ELEMENTAL_PALETTE.UI.textSecondary,
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontFamily: TYPOGRAPHY.fontFamily
                    }}
                >
                    ← BACK
                </button>

                <h2 style={{
                    fontFamily: TYPOGRAPHY.fontFamily,
                    fontSize: TYPOGRAPHY.h2,
                    color: ELEMENTAL_PALETTE.UI.primary,
                    textShadow: `0 0 10px ${ELEMENTAL_PALETTE.UI.primary}`
                }}>
                    ELEMENTAL SHOP
                </h2>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACING.sm,
                    padding: '8px 16px',
                    background: 'rgba(0,0,0,0.5)',
                    borderRadius: '20px',
                    border: `1px solid ${ELEMENTAL_PALETTE.UI.primary}`
                }}>
                    <span style={{ fontSize: '20px' }}>🪙</span>
                    <span style={{ fontFamily: TYPOGRAPHY.fontFamily, fontWeight: 'bold' }}>
                        {uiState.playerCoins.toLocaleString()}
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: SPACING.sm, marginBottom: SPACING.lg, justifyContent: 'center' }}>
                {(['powerups', 'cosmetics', 'boosts'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setSelectedTab(tab)}
                        style={{
                            padding: `${SPACING.sm} ${SPACING.lg}`,
                            background: selectedTab === tab ? ELEMENTAL_PALETTE.UI.primary : 'transparent',
                            border: `1px solid ${ELEMENTAL_PALETTE.UI.primary}`,
                            color: selectedTab === tab ? ELEMENTAL_PALETTE.UI.background : ELEMENTAL_PALETTE.UI.primary,
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontFamily: TYPOGRAPHY.fontFamily,
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                            fontSize: TYPOGRAPHY.caption,
                            transition: 'all 0.3s'
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Shop Items Grid */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: SPACING.md,
                padding: SPACING.sm
            }}>
                {filteredItems.map(item => {
                    const theme = ELEMENTAL_PALETTE[item.element];
                    const canAfford = uiState.playerCoins >= item.cost;

                    return (
                        <div
                            key={item.id}
                            style={{
                                background: 'rgba(0,0,0,0.6)',
                                border: `2px solid ${theme.primary}`,
                                borderRadius: '12px',
                                padding: SPACING.md,
                                backdropFilter: 'blur(10px)',
                                transition: 'all 0.3s',
                                cursor: canAfford ? 'pointer' : 'not-allowed',
                                opacity: canAfford ? 1 : 0.6
                            }}
                            onMouseEnter={(e) => {
                                if (canAfford) {
                                    e.currentTarget.style.transform = 'scale(1.05)';
                                    e.currentTarget.style.boxShadow = `0 0 20px ${theme.glow}`;
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            {/* Item Header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    background: `${theme.primary}20`,
                                    border: `1px solid ${theme.primary}`,
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '20px'
                                }}>
                                    {item.icon}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{
                                        fontFamily: TYPOGRAPHY.fontFamily,
                                        fontSize: TYPOGRAPHY.h3,
                                        margin: 0,
                                        color: theme.primary
                                    }}>
                                        {item.name}
                                    </h3>
                                    <p style={{
                                        fontSize: TYPOGRAPHY.caption,
                                        margin: 0,
                                        color: ELEMENTAL_PALETTE.UI.textSecondary
                                    }}>
                                        {item.description}
                                    </p>
                                </div>
                            </div>

                            {/* Item Stats */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.sm }}>
                                <div style={{ fontSize: TYPOGRAPHY.caption }}>
                                    {item.owned > 0 && (
                                        <span style={{ color: ELEMENTAL_PALETTE.UI.success }}>
                                            Owned: {item.owned}
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => handlePurchase(item)}
                                    disabled={!canAfford}
                                    style={{
                                        padding: '6px 12px',
                                        background: canAfford ? theme.primary : '#333',
                                        border: 'none',
                                        color: canAfford ? '#FFF' : '#666',
                                        borderRadius: '6px',
                                        cursor: canAfford ? 'pointer' : 'not-allowed',
                                        fontFamily: TYPOGRAPHY.fontFamily,
                                        fontSize: TYPOGRAPHY.caption,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <span>🪙</span>
                                    {item.cost}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
