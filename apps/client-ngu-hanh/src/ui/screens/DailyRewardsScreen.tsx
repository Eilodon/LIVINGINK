import React, { useState, useEffect } from 'react';
import { ELEMENTAL_PALETTE, TYPOGRAPHY, SPACING } from '../theme/Theme';
import { UISystem } from '../../game/systems/UISystem';

interface DailyReward {
    day: number;
    reward: {
        type: 'coins' | 'powerup' | 'cosmetic';
        amount: number;
        icon: string;
        name: string;
    };
    claimed: boolean;
    available: boolean;
}

export const DailyRewardsScreen: React.FC = () => {
    const [currentStreak, setCurrentStreak] = useState(3);
    const [claimingDay, setClaimingDay] = useState<number | null>(null);

    // Mock daily rewards data
    const [rewards, setRewards] = useState<DailyReward[]>([
        {
            day: 1,
            reward: { type: 'coins', amount: 100, icon: '🪙', name: '100 Coins' },
            claimed: true,
            available: false
        },
        {
            day: 2,
            reward: { type: 'coins', amount: 150, icon: '🪙', name: '150 Coins' },
            claimed: true,
            available: false
        },
        {
            day: 3,
            reward: { type: 'powerup', amount: 2, icon: '💣', name: '2x Elemental Bombs' },
            claimed: false,
            available: true
        },
        {
            day: 4,
            reward: { type: 'coins', amount: 200, icon: '🪙', name: '200 Coins' },
            claimed: false,
            available: false
        },
        {
            day: 5,
            reward: { type: 'powerup', amount: 1, icon: '🔨', name: 'Mystic Hammer' },
            claimed: false,
            available: false
        },
        {
            day: 6,
            reward: { type: 'coins', amount: 300, icon: '🪙', name: '300 Coins' },
            claimed: false,
            available: false
        },
        {
            day: 7,
            reward: { type: 'cosmetic', amount: 1, icon: '🔥', name: 'Fire Trail Effect' },
            claimed: false,
            available: false
        }
    ]);

    useEffect(() => {
        const sys = UISystem.getInstance();
        const onUpdate = () => {
            // Update logic here if needed
        };
        sys.on('update', onUpdate);
        return () => { sys.off('update', onUpdate); }
    }, []);

    const handleClaimReward = async (day: number) => {
        setClaimingDay(day);
        
        // Simulate API call/processing
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setRewards(prev => prev.map(reward => 
            reward.day === day 
                ? { ...reward, claimed: true, available: false }
                : reward
        ));
        
        // Update next day's reward as available
        if (day < rewards.length) {
            setRewards(prev => prev.map(reward => 
                reward.day === day + 1 
                    ? { ...reward, available: true }
                    : reward
            ));
        }
        
        setCurrentStreak(prev => prev + 1);
        setClaimingDay(null);
    };

    const getDayStatus = (day: number) => {
        const reward = rewards.find(r => r.day === day);
        if (!reward) return 'locked';
        if (reward.claimed) return 'claimed';
        if (reward.available) return 'available';
        return 'locked';
    };

    const getDayTheme = (day: number) => {
        const status = getDayStatus(day);
        switch (status) {
            case 'claimed': return ELEMENTAL_PALETTE.UI.success;
            case 'available': return ELEMENTAL_PALETTE.UI.primary;
            default: return '#444';
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
            flexDirection: 'column',
            overflow: 'hidden'
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
                    DAILY REWARDS
                </h2>
                
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACING.sm,
                    padding: '8px 16px',
                    background: 'rgba(0,0,0,0.5)',
                    borderRadius: '20px',
                    border: `1px solid ${ELEMENTAL_PALETTE.UI.warning}`
                }}>
                    <span style={{ fontSize: '16px' }}>🔥</span>
                    <span style={{ fontFamily: TYPOGRAPHY.fontFamily, fontSize: TYPOGRAPHY.body }}>
                        {currentStreak} Day Streak
                    </span>
                </div>
            </div>

            {/* Streak Bonus Card */}
            <div style={{
                background: `linear-gradient(135deg, ${ELEMENTAL_PALETTE.FIRE.primary}, ${ELEMENTAL_PALETTE.FIRE.secondary})`,
                borderRadius: '16px',
                padding: SPACING.lg,
                marginBottom: SPACING.lg,
                textAlign: 'center',
                boxShadow: `0 0 30px ${ELEMENTAL_PALETTE.FIRE.glow}`,
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{
                    position: 'absolute',
                    top: '-50%',
                    left: '-50%',
                    width: '200%',
                    height: '200%',
                    background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
                    animation: 'pulse 3s ease-in-out infinite'
                }} />
                
                <h3 style={{ 
                    fontFamily: TYPOGRAPHY.fontFamily, 
                    fontSize: TYPOGRAPHY.h3, 
                    margin: 0,
                    color: '#FFF',
                    textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                }}>
                    STREAK MASTER BONUS
                </h3>
                <p style={{ 
                    fontSize: TYPOGRAPHY.body, 
                    margin: `${SPACING.sm} 0`,
                    color: 'rgba(255,255,255,0.9)' 
                }}>
                    Keep your daily streak alive for exclusive rewards!
                </p>
                <div style={{ 
                    fontSize: TYPOGRAPHY.caption, 
                    color: 'rgba(255,255,255,0.8)',
                    fontStyle: 'italic' 
                }}>
                    Next milestone: 7 days → Fire Trail Effect
                </div>
            </div>

            {/* Rewards Grid */}
            <div style={{ 
                flex: 1, 
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: SPACING.md,
                padding: SPACING.sm
            }}>
                {rewards.map(reward => {
                    const status = getDayStatus(reward.day);
                    const theme = getDayTheme(reward.day);
                    const isClaiming = claimingDay === reward.day;
                    
                    return (
                        <div
                            key={reward.day}
                            style={{
                                background: status === 'available' ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.4)',
                                border: `3px solid ${theme}`,
                                borderRadius: '16px',
                                padding: SPACING.md,
                                textAlign: 'center',
                                position: 'relative',
                                cursor: status === 'available' ? 'pointer' : 'default',
                                transition: 'all 0.3s',
                                transform: status === 'available' ? 'scale(1.05)' : 'scale(1)',
                                boxShadow: status === 'available' ? `0 0 20px ${theme}` : 'none'
                            }}
                            onClick={() => status === 'available' && handleClaimReward(reward.day)}
                        >
                            {/* Day Number */}
                            <div style={{
                                position: 'absolute',
                                top: '-10px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: theme,
                                color: '#FFF',
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontFamily: TYPOGRAPHY.fontFamily,
                                fontSize: TYPOGRAPHY.caption,
                                fontWeight: 'bold'
                            }}>
                                {reward.day}
                            </div>

                            {/* Reward Icon */}
                            <div style={{
                                fontSize: '32px',
                                marginBottom: SPACING.sm,
                                filter: status === 'claimed' ? 'grayscale(100%)' : 'none',
                                opacity: status === 'locked' ? 0.5 : 1
                            }}>
                                {reward.reward.icon}
                            </div>

                            {/* Reward Name */}
                            <div style={{
                                fontSize: TYPOGRAPHY.caption,
                                color: status === 'locked' ? ELEMENTAL_PALETTE.UI.textSecondary : ELEMENTAL_PALETTE.UI.text,
                                marginBottom: SPACING.sm,
                                minHeight: '32px'
                            }}>
                                {reward.reward.name}
                            </div>

                            {/* Status */}
                            {status === 'claimed' && (
                                <div style={{
                                    background: ELEMENTAL_PALETTE.UI.success,
                                    color: '#FFF',
                                    padding: '4px 8px',
                                    borderRadius: '12px',
                                    fontSize: '10px',
                                    fontFamily: TYPOGRAPHY.fontFamily,
                                    fontWeight: 'bold'
                                }}>
                                    ✓ CLAIMED
                                </div>
                            )}
                            
                            {status === 'available' && (
                                <button
                                    style={{
                                        background: ELEMENTAL_PALETTE.UI.primary,
                                        color: '#FFF',
                                        border: 'none',
                                        padding: '6px 12px',
                                        borderRadius: '12px',
                                        fontSize: '10px',
                                        fontFamily: TYPOGRAPHY.fontFamily,
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        width: '100%',
                                        transition: 'all 0.3s'
                                    }}
                                    disabled={isClaiming}
                                >
                                    {isClaiming ? 'CLAIMING...' : 'CLAIM'}
                                </button>
                            )}
                            
                            {status === 'locked' && (
                                <div style={{
                                    background: '#444',
                                    color: '#666',
                                    padding: '4px 8px',
                                    borderRadius: '12px',
                                    fontSize: '10px',
                                    fontFamily: TYPOGRAPHY.fontFamily
                                }}>
                                    🔒 LOCKED
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Bottom Info */}
            <div style={{
                textAlign: 'center',
                padding: SPACING.md,
                background: 'rgba(0,0,0,0.4)',
                borderRadius: '8px',
                marginTop: SPACING.md
            }}>
                <p style={{ 
                    fontSize: TYPOGRAPHY.caption, 
                    color: ELEMENTAL_PALETTE.UI.textSecondary,
                    margin: 0 
                }}>
                    Daily rewards reset every 24 hours. Come back tomorrow for your next reward!
                </p>
            </div>

            {/* Add keyframe animation */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 0.3; }
                    50% { opacity: 0.7; }
                }
            `}</style>
        </div>
    );
};
