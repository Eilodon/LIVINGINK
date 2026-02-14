import React, { useEffect, useState } from 'react';
import { NetworkManager } from '../network/NetworkManager';

export const BattlePassUI: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [level, setLevel] = useState(1);
    const [xp, setXp] = useState(0);
    const [isPremium, setIsPremium] = useState(false);

    useEffect(() => {
        const net = NetworkManager.getInstance();
        setLevel(net.battlePass.level);
        setXp(net.battlePass.xp);
        setIsPremium(net.battlePass.isPremium);

        const onUpdate = (l: number, x: number, p: boolean) => {
            setLevel(l);
            setXp(x);
            setIsPremium(p);
        };
        net.onBattlePassUpdate = onUpdate;
        return () => { net.onBattlePassUpdate = null; };
    }, []);

    const levels = Array.from({ length: 10 }, (_, i) => i + 1);
    // Mock progress calculation for UI strip
    const progress = level + (xp / 100);

    const claimReward = (lvl: number, track: 'FREE' | 'PREMIUM') => {
        NetworkManager.getInstance().sendAction('claim_reward', { level: lvl, track });
    };

    return (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[600px] bg-slate-900/90 border border-slate-700 rounded-xl p-4 text-white z-20 backdrop-blur-md">
            <button
                onClick={onClose}
                className="absolute -top-3 -right-3 w-8 h-8 bg-slate-800 border border-slate-600 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
                ✕
            </button>
            <div className="flex justify-between items-center mb-2">
                <div className="font-bold text-yellow-500 font-serif tracking-widest">SEASON 1: AWAKENING</div>
                <div className="text-xs text-slate-400">Level {level} • {xp}/100 XP</div>
            </div>

            {/* Track Container */}
            <div className="relative w-full overflow-x-auto pb-4 custom-scrollbar">
                <div className="flex space-x-4 min-w-max px-2">
                    {levels.map((lvl) => {
                        const isUnlocked = lvl <= level;
                        const isNext = lvl === level + 1;

                        return (
                            <div key={lvl} className="flex flex-col space-y-2 w-20 flex-shrink-0">
                                {/* Free Tier */}
                                <div
                                    onClick={() => isUnlocked && claimReward(lvl, 'FREE')}
                                    className={`h-20 rounded-lg border-2 flex items-center justify-center relative cursor-pointer hover:bg-slate-800 transition-colors
                                    ${isUnlocked ? 'border-slate-500 bg-slate-800' : 'border-slate-800 bg-slate-900/50'}
                                `}>
                                    <div className="text-xs text-slate-500 absolute top-1 left-2">Free</div>
                                    <div className="text-2xl">🪙</div>
                                    {isUnlocked && <div className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>}
                                </div>

                                {/* Premium Tier */}
                                <div
                                    onClick={() => isUnlocked && isPremium && claimReward(lvl, 'PREMIUM')}
                                    className={`h-20 rounded-lg border-2 flex items-center justify-center relative shadow-lg cursor-pointer hover:bg-yellow-900/30 transition-colors
                                    ${isUnlocked ? 'border-yellow-600 bg-yellow-900/20' : 'border-slate-800 bg-slate-900/50'}
                                    ${!isPremium ? 'opacity-50 grayscale' : ''}
                                `}>
                                    <div className="text-xs text-yellow-600 absolute top-1 left-2">VIP</div>
                                    <div className="text-2xl">💎</div>
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-950 px-2 text-xs font-bold rounded border border-slate-700">
                                        LVL {lvl}
                                    </div>
                                    {isUnlocked && isPremium && <div className="absolute top-1 right-1 w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="mt-2 text-center text-xs text-slate-500">
                {!isPremium ? (
                    <span>Upgrade to Premium for <span className="text-yellow-500 font-bold">Exotic Skins</span> & <span className="text-purple-500 font-bold">Effect Trails</span></span>
                ) : (
                    <span className="text-yellow-500 font-bold">PREMIUM ACTIVE</span>
                )}
            </div>
        </div>
    );
};
