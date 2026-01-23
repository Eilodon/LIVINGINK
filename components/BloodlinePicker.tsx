/**
 * GU-KING BLOODLINE PICKER
 *
 * Character selection screen with:
 * - Visual bloodline cards
 * - Faction grouping
 * - Stats preview
 * - Unlock status
 *
 * UI/UX inspired by: Hades character select, Vampire Survivors selection
 */

import React, { useState, useMemo } from 'react';
import {
  BloodlineId,
  BLOODLINES,
  getBloodlinesByFaction,
  isBloodlineUnlocked,
  getBloodlineDisplayInfo,
} from '../services/bloodlines';
import { Faction } from '../types';
import { FACTION_CONFIG } from '../constants';

// ============================================
// TYPES
// ============================================

interface BloodlinePickerProps {
  profile: {
    gamesPlayed: number;
    totalKills: number;
    highScore: number;
  };
  onSelect: (bloodlineId: BloodlineId) => void;
  onBack: () => void;
}

// ============================================
// FACTION TAB COMPONENT
// ============================================

const FactionTab: React.FC<{
  faction: Faction;
  isActive: boolean;
  onClick: () => void;
}> = ({ faction, isActive, onClick }) => {
  const config = FACTION_CONFIG[faction];

  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2 rounded-t-lg font-bold text-sm transition-all duration-200
        ${isActive
          ? 'bg-slate-800 text-white border-b-2'
          : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
        }
      `}
      style={{
        borderColor: isActive ? config.color : 'transparent',
      }}
    >
      <span className="mr-2">{config.icon}</span>
      {config.name}
    </button>
  );
};

// ============================================
// BLOODLINE CARD COMPONENT
// ============================================

const BloodlineCard: React.FC<{
  bloodlineId: BloodlineId;
  isUnlocked: boolean;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ bloodlineId, isUnlocked, isSelected, onSelect }) => {
  const info = getBloodlineDisplayInfo(bloodlineId);
  if (!info) return null;

  const bloodline = BLOODLINES[bloodlineId];

  return (
    <button
      onClick={() => isUnlocked && onSelect()}
      disabled={!isUnlocked}
      className={`
        relative w-full p-4 rounded-lg border-2 transition-all duration-200 text-left
        ${isUnlocked
          ? isSelected
            ? 'border-white bg-slate-700 scale-105 shadow-lg'
            : 'border-slate-600 bg-slate-800 hover:border-slate-400 hover:bg-slate-700'
          : 'border-slate-700 bg-slate-900 opacity-50 cursor-not-allowed'
        }
      `}
    >
      {/* Lock overlay */}
      {!isUnlocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 rounded-lg">
          <div className="text-center">
            <span className="text-2xl">🔒</span>
            <p className="text-xs text-slate-400 mt-1">
              {bloodline.unlockRequirement?.gamesPlayed
                ? `${bloodline.unlockRequirement.gamesPlayed} games`
                : bloodline.unlockRequirement?.totalKills
                  ? `${bloodline.unlockRequirement.totalKills} kills`
                  : `${bloodline.unlockRequirement?.highScore} score`
              }
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-3xl">{info.icon}</span>
        <div>
          <h3 className="font-bold text-white">{info.name}</h3>
          <p className="text-xs text-slate-400">{info.title}</p>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-slate-300 mb-3">{info.description}</p>

      {/* Passive */}
      <div
        className="p-2 rounded bg-slate-900 border-l-2"
        style={{ borderColor: info.factionColor }}
      >
        <p className="text-xs font-bold text-slate-400 mb-1">PASSIVE: {info.passiveName}</p>
        <p className="text-xs text-slate-300">{info.passiveDescription}</p>
      </div>

      {/* Stats preview */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <StatBadge
          label="HP"
          value={bloodline.stats.healthMultiplier}
          color={bloodline.stats.healthMultiplier > 1 ? '#22c55e' : '#ef4444'}
        />
        <StatBadge
          label="DMG"
          value={bloodline.stats.damageMultiplier}
          color={bloodline.stats.damageMultiplier > 1 ? '#22c55e' : '#ef4444'}
        />
        <StatBadge
          label="SPD"
          value={bloodline.stats.speedMultiplier}
          color={bloodline.stats.speedMultiplier > 1 ? '#22c55e' : '#ef4444'}
        />
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2">
          <span className="text-xl">✓</span>
        </div>
      )}
    </button>
  );
};

// ============================================
// STAT BADGE COMPONENT
// ============================================

const StatBadge: React.FC<{
  label: string;
  value: number;
  color: string;
}> = ({ label, value, color }) => {
  const displayValue = value === 1
    ? '='
    : value > 1
      ? `+${Math.round((value - 1) * 100)}%`
      : `${Math.round((value - 1) * 100)}%`;

  return (
    <div className="flex items-center justify-center gap-1 px-2 py-1 rounded bg-slate-950">
      <span className="text-slate-400">{label}</span>
      <span style={{ color }}>{displayValue}</span>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const BloodlinePicker: React.FC<BloodlinePickerProps> = ({
  profile,
  onSelect,
  onBack,
}) => {
  const [activeFaction, setActiveFaction] = useState<Faction>(Faction.Fire);
  const [selectedBloodline, setSelectedBloodline] = useState<BloodlineId | null>(null);

  const factions = useMemo(() => Object.values(Faction), []);

  const bloodlinesForFaction = useMemo(
    () => getBloodlinesByFaction(activeFaction),
    [activeFaction]
  );

  const handleConfirm = () => {
    if (selectedBloodline) {
      onSelect(selectedBloodline);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-white">CHỌN HUYẾT MẠCH</h1>
          <div className="w-20" />
        </div>
      </div>

      {/* Faction tabs */}
      <div className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-4xl mx-auto flex gap-1 px-4">
          {factions.map((faction) => (
            <FactionTab
              key={faction}
              faction={faction}
              isActive={activeFaction === faction}
              onClick={() => setActiveFaction(faction)}
            />
          ))}
        </div>
      </div>

      {/* Bloodline grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {bloodlinesForFaction.map((bloodline) => (
            <BloodlineCard
              key={bloodline.id}
              bloodlineId={bloodline.id}
              isUnlocked={isBloodlineUnlocked(bloodline.id, profile)}
              isSelected={selectedBloodline === bloodline.id}
              onSelect={() => setSelectedBloodline(bloodline.id)}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="text-sm text-slate-400">
            <span className="font-bold text-white">
              {Object.values(BLOODLINES).filter((b) => isBloodlineUnlocked(b.id, profile)).length}
            </span>
            <span> / {Object.keys(BLOODLINES).length} unlocked</span>
          </div>

          <button
            onClick={handleConfirm}
            disabled={!selectedBloodline}
            className={`
              px-8 py-3 rounded-lg font-bold text-lg transition-all duration-200
              ${selectedBloodline
                ? 'bg-white text-black hover:bg-slate-200'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }
            `}
          >
            {selectedBloodline ? 'START GAME' : 'Select a Bloodline'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BloodlinePicker;
