import React from 'react';
import { MutationChoice, MutationTier } from '../types';

interface MutationPickerProps {
  choices: MutationChoice[];
  onSelect: (id: string) => void;
}

const tierColor = (tier: MutationTier) => {
  if (tier === MutationTier.Legendary) return 'text-yellow-400';
  if (tier === MutationTier.Epic) return 'text-purple-400';
  if (tier === MutationTier.Rare) return 'text-blue-400';
  return 'text-emerald-400';
};

const MutationPicker: React.FC<MutationPickerProps> = ({ choices, onSelect }) => {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-4xl px-6">
        <h2 className="text-center text-3xl font-fantasy text-yellow-400 mb-6">CHỌN MUTATION</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {choices.map((choice) => (
            <button
              key={choice.id}
              onClick={() => onSelect(choice.id)}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-700 text-left hover:scale-[1.02] transition-transform"
            >
              <div className={`text-xs uppercase tracking-widest mb-2 ${tierColor(choice.tier)}`}>
                {choice.tier}
              </div>
              <div className="text-lg font-bold text-white mb-2">{choice.name}</div>
              <div className="text-sm text-slate-300">{choice.description}</div>
            </button>
          ))}
        </div>
        <div className="text-center text-xs text-slate-400 mt-6">Chọn 1 trong 3 để tiếp tục</div>
      </div>
    </div>
  );
};

export default MutationPicker;
