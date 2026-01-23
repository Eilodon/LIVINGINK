
import React from 'react';
import { MutationTier, TattooId } from '../types';
import { TattooChoice } from '../services/cjr/tattoos';

interface TattooPickerProps {
    choices: TattooChoice[];
    onSelect: (id: TattooId) => void;
}

const tierColor = (tier: MutationTier) => {
    if (tier === MutationTier.Legendary) return 'text-yellow-400 border-yellow-500/50 shadow-yellow-500/20';
    if (tier === MutationTier.Epic) return 'text-purple-400 border-purple-500/50 shadow-purple-500/20';
    if (tier === MutationTier.Rare) return 'text-blue-400 border-blue-500/50 shadow-blue-500/20';
    return 'text-emerald-400 border-emerald-500/50 shadow-emerald-500/20';
};

const TattooPicker: React.FC<TattooPickerProps> = ({ choices, onSelect }) => {
    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-4xl px-6">
                <h2 className="text-center text-4xl font-black text-white mb-2 tracking-widest uppercase"
                    style={{ textShadow: '0 0 20px rgba(255,255,255,0.5)' }}>
                    INK YOUR DESTINY
                </h2>
                <p className="text-center text-slate-400 mb-8 font-mono">Select a Tattoo to evolve</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {choices.map((choice) => (
                        <button
                            key={choice.id}
                            onClick={() => onSelect(choice.id)}
                            className={`group relative p-6 rounded-xl bg-slate-900/80 border-2 text-left 
                hover:scale-105 transition-all duration-300 shadow-xl overflow-hidden
                ${tierColor(choice.tier)}`}
                        >
                            {/* Glow Effect */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-10 bg-current transition-opacity" />

                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="text-xs font-bold uppercase tracking-widest border px-2 py-1 rounded bg-black/50">
                                        {choice.tier}
                                    </div>
                                </div>

                                <div className="text-xl font-black text-white mb-3 group-hover:text-current transition-colors">
                                    {choice.name}
                                </div>

                                <div className="text-sm text-slate-300 font-medium leading-relaxed">
                                    {choice.description}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
                <div className="text-center text-xs text-slate-500 mt-8 animate-pulse">
                    TAP TO SELECT
                </div>
            </div>
        </div>
    );
};

export default TattooPicker;
