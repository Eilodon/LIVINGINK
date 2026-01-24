
import React from 'react';
import { MutationTier, TattooId } from '../types';
import { TattooChoice } from '../services/cjr/tattoos';

interface TattooPickerProps {
    choices: TattooChoice[];
    onSelect: (id: TattooId) => void;
}

const tierColor = (tier: MutationTier) => {
    if (tier === MutationTier.Legendary) return 'text-yellow-300 border-yellow-500/50 shadow-yellow-500/20';
    if (tier === MutationTier.Epic) return 'text-purple-300 border-purple-500/50 shadow-purple-500/20';
    if (tier === MutationTier.Rare) return 'text-sky-300 border-sky-500/50 shadow-sky-500/20';
    return 'text-emerald-300 border-emerald-500/50 shadow-emerald-500/20';
};

const tierLabel = (tier: MutationTier) => {
    if (tier === MutationTier.Legendary) return 'Legendary';
    if (tier === MutationTier.Epic) return 'Epic';
    if (tier === MutationTier.Rare) return 'Rare';
    return 'Common';
};

const TATTOO_ICONS: Record<TattooId, string> = {
    [TattooId.FilterInk]: '🛡️',
    [TattooId.Overdrive]: '⚡',
    [TattooId.DepositShield]: '🔷',
    [TattooId.PigmentBomb]: '💥',
    [TattooId.PerfectMatch]: '⭐',
    [TattooId.CatalystSense]: '🌀',
    [TattooId.NeutralMastery]: '⚖️',
    [TattooId.SolventExpert]: '💧',
    [TattooId.CatalystEcho]: '🧪',
    [TattooId.PrismGuard]: '🔶',
    [TattooId.InkLeech]: '🩸',
    [TattooId.GrimHarvest]: '☠️',
};

const TattooPicker: React.FC<TattooPickerProps> = ({ choices, onSelect }) => {
    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-5xl px-6">
                <h2 className="ritual-title ritual-title-gradient text-center text-3xl sm:text-4xl mb-2">
                    INK YOUR DESTINY
                </h2>
                <p className="text-center text-[color:var(--mist-400)] mb-8 uppercase tracking-[0.3em] text-xs">Choose the mutation that defines your run</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {choices.map((choice) => (
                        <button
                            key={choice.id}
                            onClick={() => onSelect(choice.id)}
                            className={`group relative p-6 rounded-2xl border-2 text-left hover:scale-[1.03] transition-all duration-300 shadow-xl overflow-hidden
                bg-[linear-gradient(140deg,rgba(29,22,33,0.95),rgba(13,10,16,0.95))] border-[color:rgba(225,214,200,0.12)]
                ${tierColor(choice.tier)}`}
                        >
                            {/* Glow Effect */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-10 bg-current transition-opacity" />

                            <div className="relative z-10">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="text-2xl">{TATTOO_ICONS[choice.id] ?? '✦'}</div>
                                        <div className="text-xs font-bold uppercase tracking-widest border px-2 py-1 rounded bg-black/50">
                                            {tierLabel(choice.tier)}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-xl font-black text-white mb-3 group-hover:text-current transition-colors">
                                    {choice.name}
                                </div>

                                <div className="text-sm text-[color:var(--bone-200)] font-medium leading-relaxed">
                                    {choice.description}
                                </div>

                                <div className="mt-5 text-xs uppercase tracking-widest text-[color:var(--mist-400)] group-hover:text-current transition-colors">
                                    Select
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
                <div className="text-center text-xs text-[color:var(--mist-400)] mt-8 animate-pulse">
                    TAP TO SELECT
                </div>
            </div>
        </div>
    );
};

export default TattooPicker;
