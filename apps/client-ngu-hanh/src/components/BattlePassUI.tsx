import React from 'react';

export const BattlePassUI = () => {
    const levels = Array.from({ length: 10 }, (_, i) => i + 1);
    const progress = 35; // Mock progress (Level 3.5)

    return (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[600px] bg-slate-900/90 border border-slate-700 rounded-xl p-4 text-white z-20 backdrop-blur-md">
            <div className="flex justify-between items-center mb-2">
                <div className="font-bold text-yellow-500 font-serif tracking-widest">SEASON 1: AWAKENING</div>
                <div className="text-xs text-slate-400">Ends in 24d</div>
            </div>

            {/* Track Container */}
            <div className="relative w-full overflow-x-auto pb-4 custom-scrollbar">
                <div className="flex space-x-4 min-w-max px-2">
                    {levels.map((lvl) => {
                        const isUnlocked = lvl <= Math.ceil(progress / 10);
                        const isClaimed = lvl < 3; // Mock claimed state

                        return (
                            <div key={lvl} className="flex flex-col space-y-2 w-20 flex-shrink-0">
                                {/* Free Tier */}
                                <div className={`h-20 rounded-lg border-2 flex items-center justify-center relative
                                    ${isUnlocked ? 'border-slate-500 bg-slate-800' : 'border-slate-800 bg-slate-900/50'}
                                `}>
                                    <div className="text-xs text-slate-500 absolute top-1 left-2">Free</div>
                                    <div className="text-2xl">🪙</div>
                                    {isClaimed && <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-green-500 font-bold">✓</div>}
                                </div>

                                {/* Connector Line (Visual only, ideally absolute behind) */}

                                {/* Premium Tier */}
                                <div className={`h-20 rounded-lg border-2 flex items-center justify-center relative shadow-lg
                                    ${isUnlocked ? 'border-yellow-600 bg-yellow-900/20' : 'border-slate-800 bg-slate-900/50'}
                                `}>
                                    <div className="text-xs text-yellow-600 absolute top-1 left-2">VIP</div>
                                    <div className="text-2xl">💎</div>
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-950 px-2 text-xs font-bold rounded border border-slate-700">
                                        LVL {lvl}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="mt-2 text-center text-xs text-slate-500">
                Upgrade to Premium for <span className="text-yellow-500 font-bold">Exotic Skins</span> & <span className="text-purple-500 font-bold">Effect Trails</span>
            </div>
        </div>
    );
};
