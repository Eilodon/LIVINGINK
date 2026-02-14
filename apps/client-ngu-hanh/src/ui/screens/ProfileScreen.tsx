import React, { useState, useEffect } from 'react';
import { ELEMENTAL_PALETTE, TYPOGRAPHY, SPACING } from '../theme/Theme';
import { UISystem } from '../../game/systems/UISystem';

interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    unlocked: boolean;
    progress: number;
    maxProgress: number;
    element: Exclude<keyof typeof ELEMENTAL_PALETTE, 'UI'>;
}

interface PlayerStats {
    level: number;
    totalScore: number;
    gamesPlayed: number;
    winRate: number;
    favoriteElement: Exclude<keyof typeof ELEMENTAL_PALETTE, 'UI'>;
    achievementsUnlocked: number;
    totalAchievements: number;
}

// Extract components outside render
const StatCard: React.FC<{
    icon: string;
    value: string | number;
    label: string;
    color?: string;
}> = ({ icon, value, label, color = ELEMENTAL_PALETTE.UI.primary }) => (
    <div style={{
        background: 'rgba(0,0,0,0.4)',
        padding: SPACING.md,
        borderRadius: '8px',
        textAlign: 'center'
    }}>
        <div style={{ fontSize: '32px', marginBottom: SPACING.sm }}>{icon}</div>
        <div style={{
            fontSize: TYPOGRAPHY.h3,
            color: color,
            fontFamily: TYPOGRAPHY.fontFamily
        }}>
            {value}
        </div>
        <div style={{
            fontSize: TYPOGRAPHY.caption,
            color: ELEMENTAL_PALETTE.UI.textSecondary
        }}>
            {label}
        </div>
    </div>
);

const AchievementCard: React.FC<{
    achievement: Achievement;
}> = ({ achievement }) => {
    const theme = ELEMENTAL_PALETTE[achievement.element];
    const progress = (achievement.progress / achievement.maxProgress) * 100;

    return (
        <div style={{
            background: achievement.unlocked ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)',
            border: `2px solid ${achievement.unlocked ? theme.primary : '#444'}`,
            borderRadius: '12px',
            padding: SPACING.md,
            backdropFilter: 'blur(10px)',
            opacity: achievement.unlocked ? 1 : 0.7
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    background: achievement.unlocked ? `${theme.primary}20` : '#333',
                    border: `1px solid ${achievement.unlocked ? theme.primary : '#444'}`,
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px'
                }}>
                    {achievement.icon}
                </div>
                <div style={{ flex: 1 }}>
                    <h4 style={{
                        fontFamily: TYPOGRAPHY.fontFamily,
                        fontSize: TYPOGRAPHY.body,
                        margin: 0,
                        color: achievement.unlocked ? theme.primary : ELEMENTAL_PALETTE.UI.textSecondary
                    }}>
                        {achievement.name}
                    </h4>
                    <p style={{
                        fontSize: TYPOGRAPHY.caption,
                        margin: 0,
                        color: ELEMENTAL_PALETTE.UI.textSecondary
                    }}>
                        {achievement.description}
                    </p>
                </div>
            </div>

            {!achievement.unlocked && (
                <div style={{ marginTop: SPACING.sm }}>
                    <div style={{
                        width: '100%',
                        height: '4px',
                        background: '#333',
                        borderRadius: '2px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${progress}%`,
                            height: '100%',
                            background: theme.primary,
                            transition: 'width 0.3s'
                        }} />
                    </div>
                    <div style={{
                        fontSize: TYPOGRAPHY.caption,
                        color: ELEMENTAL_PALETTE.UI.textSecondary,
                        textAlign: 'center',
                        marginTop: '2px'
                    }}>
                        {achievement.progress}/{achievement.maxProgress}
                    </div>
                </div>
            )}
        </div>
    );
};

export const ProfileScreen: React.FC = () => {
    const [selectedTab, setSelectedTab] = useState<'stats' | 'achievements' | 'collection'>('stats');

    // Mock player data - in real app, this would come from game state
    const [playerStats] = useState<PlayerStats>({
        level: 12,
        totalScore: 15420,
        gamesPlayed: 47,
        winRate: 73.4,
        favoriteElement: 'FIRE',
        achievementsUnlocked: 8,
        totalAchievements: 15
    });

    const achievements: Achievement[] = [
        {
            id: 'first_win',
            name: 'First Victory',
            description: 'Win your first level',
            icon: '🏆',
            unlocked: true,
            progress: 1,
            maxProgress: 1,
            element: 'METAL'
        },
        {
            id: 'combo_master',
            name: 'Combo Master',
            description: 'Achieve 10x combo',
            icon: '⚡',
            unlocked: true,
            progress: 10,
            maxProgress: 10,
            element: 'FIRE'
        },
        {
            id: 'elemental_expert',
            name: 'Elemental Expert',
            description: 'Master all 5 elements',
            icon: '🌟',
            unlocked: false,
            progress: 3,
            maxProgress: 5,
            element: 'WATER'
        },
        {
            id: 'speed_demon',
            name: 'Speed Demon',
            description: 'Complete a level in under 30 seconds',
            icon: '⚡',
            unlocked: true,
            progress: 1,
            maxProgress: 1,
            element: 'FIRE'
        },
        {
            id: 'perfectionist',
            name: 'Perfectionist',
            description: 'Get 3 stars on 10 levels',
            icon: '💎',
            unlocked: false,
            progress: 6,
            maxProgress: 10,
            element: 'EARTH'
        },
        {
            id: 'persistent',
            name: 'Persistent',
            description: 'Play 7 days in a row',
            icon: '📅',
            unlocked: true,
            progress: 7,
            maxProgress: 7,
            element: 'WOOD'
        }
    ];

    useEffect(() => {
        const sys = UISystem.getInstance();
        const onUpdate = () => {
            // Update logic here if needed
        };
        sys.on('update', onUpdate);
        return () => { sys.off('update', onUpdate); }
    }, []);

    const getElementIcon = (element: Exclude<keyof typeof ELEMENTAL_PALETTE, 'UI'>) => {
        const icons = {
            FIRE: '🔥',
            WATER: '💧',
            WOOD: '🌲',
            EARTH: '🪨',
            METAL: '⚙️'
        };
        return icons[element] || '✨';
    };

    const uiTheme = ELEMENTAL_PALETTE.UI;

    return (
        <div style={{
            width: '100%',
            height: '100%',
            background: `linear-gradient(135deg, ${uiTheme.background}, ${uiTheme.surface})`,
            color: uiTheme.text,
            padding: SPACING.md,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg }}>
                <button
                    onClick={() => UISystem.getInstance().switchScreen('MAIN_MENU')}
                    style={{
                        background: 'transparent',
                        border: `1px solid ${uiTheme.textSecondary}`,
                        color: uiTheme.textSecondary,
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
                    color: uiTheme.primary,
                    textShadow: `0 0 10px ${uiTheme.primary}`
                }}>
                    PLAYER PROFILE
                </h2>

                <div style={{
                    width: '80px',
                    height: '80px',
                    background: `linear-gradient(135deg, ${ELEMENTAL_PALETTE[playerStats.favoriteElement].primary}, ${ELEMENTAL_PALETTE[playerStats.favoriteElement].secondary})`,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    border: `2px solid ${uiTheme.primary}`,
                    boxShadow: `0 0 20px ${ELEMENTAL_PALETTE[playerStats.favoriteElement].primary}`
                }}>
                    {getElementIcon(playerStats.favoriteElement as Exclude<keyof typeof ELEMENTAL_PALETTE, 'UI'>)}
                </div>
            </div>

            {/* Player Info Card */}
            <div style={{
                background: 'rgba(0,0,0,0.6)',
                border: `2px solid ${uiTheme.primary}`,
                borderRadius: '12px',
                padding: SPACING.lg,
                marginBottom: SPACING.lg,
                backdropFilter: 'blur(10px)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ fontFamily: TYPOGRAPHY.fontFamily, fontSize: TYPOGRAPHY.h3, margin: 0 }}>
                            Level {playerStats.level}
                        </h3>
                        <p style={{ color: uiTheme.textSecondary, margin: '4px 0' }}>
                            Elemental Convergence Master
                        </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: TYPOGRAPHY.h3, color: uiTheme.primary }}>
                            {playerStats.totalScore.toLocaleString()}
                        </div>
                        <div style={{ fontSize: TYPOGRAPHY.caption, color: uiTheme.textSecondary }}>
                            Total Score
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: SPACING.sm, marginBottom: SPACING.lg, justifyContent: 'center' }}>
                {(['stats', 'achievements', 'collection'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setSelectedTab(tab)}
                        style={{
                            padding: `${SPACING.sm} ${SPACING.lg}`,
                            background: selectedTab === tab ? uiTheme.primary : 'transparent',
                            border: `1px solid ${uiTheme.primary}`,
                            color: selectedTab === tab ? uiTheme.background : uiTheme.primary,
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

            {/* Tab Content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {selectedTab === 'stats' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: SPACING.md }}>
                        <StatCard icon="🎮" value={playerStats.gamesPlayed} label="Games Played" />
                        <StatCard icon="📊" value={`${playerStats.winRate}%`} label="Win Rate" color={uiTheme.success} />
                        <StatCard icon="🏆" value={`${playerStats.achievementsUnlocked}/${playerStats.totalAchievements}`} label="Achievements" color={uiTheme.warning} />
                    </div>
                )}

                {selectedTab === 'achievements' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: SPACING.md }}>
                        {achievements.map(achievement => (
                            <AchievementCard key={achievement.id} achievement={achievement} />
                        ))}
                    </div>
                )}

                {selectedTab === 'collection' && (
                    <div style={{ textAlign: 'center', padding: SPACING.xl }}>
                        <div style={{ fontSize: '48px', marginBottom: SPACING.md }}>🎨</div>
                        <h3 style={{ fontFamily: TYPOGRAPHY.fontFamily, fontSize: TYPOGRAPHY.h3, margin: 0 }}>
                            Coming Soon
                        </h3>
                        <p style={{ color: uiTheme.textSecondary, marginTop: SPACING.sm }}>
                            Your cosmetic collection will appear here
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
