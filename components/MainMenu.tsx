import React, { useState } from 'react';
import { Faction, PlayerProfile } from '../types';
import { FACTION_CONFIG } from '../constants';

interface MainMenuProps {
  onStart: (name: string, faction: Faction) => void;
  profile: PlayerProfile;
  totalMutations: number;
}

const MainMenu: React.FC<MainMenuProps> = ({ onStart, profile, totalMutations }) => {
  const [name, setName] = useState('');
  const [selectedFaction, setSelectedFaction] = useState<Faction>(Faction.Metal);
  const mutationProgress = totalMutations > 0
    ? Math.round((profile.unlockedMutations.length / totalMutations) * 100)
    : 0;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900 bg-opacity-95 z-50 text-white">
      <div className="max-w-4xl w-full p-8 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700">
        <h1 className="text-5xl font-fantasy text-center mb-2 text-yellow-500 tracking-wider">
          GU KING
        </h1>
        <h2 className="text-xl text-center mb-8 text-slate-400">Vạn Cổ Chi Vương - Ngũ Độc Chiến</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: Input */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Tên Cổ Sư (Character Name)</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Nhập tên của bạn..."
                className="w-full px-4 py-3 bg-slate-700 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none transition"
              />
            </div>
            
            <div>
               <label className="block text-sm font-medium text-slate-400 mb-3">Chọn Cổ Trùng (Select Tribe)</label>
               <div className="grid grid-cols-5 gap-2">
                 {Object.values(Faction).map((f) => (
                   <button
                    key={f}
                    onClick={() => setSelectedFaction(f)}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center border-2 transition-all ${
                      selectedFaction === f 
                        ? 'border-white bg-opacity-20 bg-white scale-110 shadow-lg' 
                        : 'border-transparent hover:bg-slate-700 opacity-60'
                    }`}
                    style={{ backgroundColor: selectedFaction === f ? FACTION_CONFIG[f].color : undefined }}
                   >
                     <span className="text-2xl">{FACTION_CONFIG[f].icon}</span>
                   </button>
                 ))}
               </div>
            </div>

            <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
              <h3 className="text-lg font-bold" style={{ color: FACTION_CONFIG[selectedFaction].color }}>
                {FACTION_CONFIG[selectedFaction].name}
              </h3>
              <p className="text-sm text-slate-300 mt-1 italic">{FACTION_CONFIG[selectedFaction].desc}</p>
              <div className="mt-4 border-t border-slate-700 pt-2">
                 <p className="text-xs text-yellow-500 font-bold mb-1">TUYỆT KỸ: {FACTION_CONFIG[selectedFaction].skillName}</p>
              </div>
            </div>

            <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
              <h3 className="text-sm font-bold text-yellow-400 mb-3 uppercase tracking-widest">Meta Progress</h3>
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                <div>
                  <div className="text-slate-500 uppercase tracking-wide">Games</div>
                  <div className="text-white font-bold">{profile.gamesPlayed}</div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase tracking-wide">Total Kills</div>
                  <div className="text-white font-bold">{profile.totalKills}</div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase tracking-wide">High Score</div>
                  <div className="text-white font-bold">{profile.highScore.toFixed(0)}</div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase tracking-wide">Mutations</div>
                  <div className="text-white font-bold">
                    {profile.unlockedMutations.length}/{totalMutations}
                  </div>
                </div>
              </div>
              <div className="mt-3 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 via-yellow-400 to-orange-400"
                  style={{ width: `${mutationProgress}%` }}
                ></div>
              </div>
              <div className="mt-2 text-[10px] text-slate-500">
                Unlock more mutations by playing and getting kills.
              </div>
            </div>
          </div>

          {/* Right: Tutorial / Lore */}
          <div className="bg-slate-900 rounded-xl p-6 border border-slate-700 text-sm leading-relaxed text-slate-300">
             <h3 className="text-white font-bold text-lg mb-4">Pháp Tắc Sinh Tồn</h3>
             <ul className="space-y-3">
               <li className="flex items-start gap-2">
                 <span className="text-yellow-500 mt-1">●</span>
                 <span><strong className="text-white">Cá Lớn Nuốt Cá Bé:</strong> Ăn kẻ nhỏ hơn mình (Size &lt; 90%).</span>
               </li>
               <li className="flex items-start gap-2">
                 <span className="text-red-500 mt-1">●</span>
                 <span><strong className="text-white">Tránh Kẻ Mạnh:</strong> Chạy ngay khi gặp kẻ lớn hơn (Size &gt; 110%).</span>
               </li>
               <li className="flex items-start gap-2">
                 <span className="text-blue-500 mt-1">●</span>
                 <span><strong className="text-white">Ngũ Hành Chiến:</strong> Khi ngang cơ (90-110%), hệ khắc chế sẽ thắng.</span>
               </li>
               <li className="flex items-start gap-2">
                 <span className="text-purple-500 mt-1">●</span>
                 <span><strong className="text-white">Vòng Bo Độc:</strong> Ở trong vòng an toàn hoặc bị trúng độc chết dần.</span>
               </li>
             </ul>

             <button 
              onClick={() => name && onStart(name, selectedFaction)}
              disabled={!name}
              className="w-full mt-8 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white font-bold py-4 rounded-lg shadow-lg transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
             >
               BẮT ĐẦU LUYỆN CỔ
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
