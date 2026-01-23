
import React, { useState } from 'react';
import { ShapeId } from '../services/cjr/cjrTypes';

interface MainMenuProps {
  onStart: (name: string, shape: ShapeId) => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onStart }) => {
  const [name, setName] = useState('');
  const [shape, setShape] = useState<ShapeId>('circle');

  const handleStart = () => {
    if (!name.trim()) return;
    onStart(name, shape);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white">
      <h1 className="text-6xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-500">
        COLOR JELLY RUSH
      </h1>

      <div className="bg-slate-800 p-8 rounded-xl shadow-2xl w-96">
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2 text-slate-400">YOUR NAME</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded p-3 text-white focus:outline-none focus:border-pink-500"
            placeholder="Enter name..."
          />
        </div>

        <div className="mb-8">
          <label className="block text-sm font-medium mb-2 text-slate-400">CHOOSE SHAPE</label>
          <div className="flex gap-2">
            {(['circle', 'square', 'triangle', 'hex'] as ShapeId[]).map((s) => (
              <button
                key={s}
                onClick={() => setShape(s)}
                className={`flex-1 p-3 rounded border capitalize ${shape === s
                    ? 'bg-pink-600 border-pink-400 text-white'
                    : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'
                  }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={!name.trim()}
          className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${name.trim()
              ? 'bg-gradient-to-r from-pink-500 to-violet-600 hover:scale-105 shadow-glow'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
        >
          PLAY NOW
        </button>
      </div>
    </div>
  );
};

export default MainMenu;
