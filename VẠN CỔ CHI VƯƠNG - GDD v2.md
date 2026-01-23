

\# 🐛 VẠN CỔ CHI VƯƠNG \- GDD v2.0  
\*Feeding Frenzy meets Agar.io meets Battle Royale\*

\---

\#\# 🎯 ELEVATOR PITCH

\*\*"Bắt đầu là một con cổ trùng tí hon, ăn thịt kẻ nhỏ hơn để lớn dần, tránh kẻ to hơn, cướp skill của đối thủ, và trở thành Cổ Chi Vương cuối cùng sống sót trong hũ sành chết chóc\!"\*\*

\*\*Genre:\*\* 2D Battle Royale \+ Eat-and-Grow \+ Roguelike    
\*\*Platform:\*\* Browser (Phaser.js) → Mobile port later    
\*\*Match Length:\*\* 5-10 phút    
\*\*Players:\*\* 1 player \+ 19 AI (MVP) → 20+ PvP (future)    
\*\*Core Loop:\*\* Eat → Grow → Evolve → Dominate

\---

\#\# 🎮 CORE MECHANICS \- "The Holy Trinity"

\#\#\# 1️⃣ \*\*SIZE MATTERS\*\* (Từ Feeding Frenzy \+ Agar.io)

\*\*Luật sắt:\*\*  
\- Chỉ ăn được con \*\*nhỏ hơn mình 90%\*\* trở xuống  
\- Bị ăn bởi con \*\*to hơn mình 110%\*\* trở lên  
\- Trong khoảng 90-110% \= Combat thực sự (ai gây damage nhiều hơn)

\*\*Visual Clarity (CỰC QUAN TRỌNG):\*\*  
\`\`\`  
Nhìn thấy con khác → Màu sắc cho biết ngay:  
\- 🟢 Xanh lá: Nhỏ hơn nhiều → Ăn dễ dàng  
\- 🟡 Vàng: Xấp xỉ size → Cẩn thận\!  
\- 🔴 Đỏ: To hơn nhiều → CHẠY NGAY\!  
\`\`\`

\*\*Growth System:\*\*  
\- Ăn 1 con nhỏ → Lớn lên \~5% size  
\- Ăn 1 con bằng size → Lớn lên \~15% size  
\- Ăn food pellets → Lớn lên \~1% size

\*\*Size Tiers (Visual stages):\*\*  
\`\`\`  
Tier 1: Ấu Trùng (0-20% max size) \- Bé xíu, dễ thương  
Tier 2: Thiếu Niên (20-40%) \- To vừa, bắt đầu nguy hiểm  
Tier 3: Trưởng Thành (40-60%) \- To rõ, intimidating  
Tier 4: Tinh Anh (60-80%) \- Lớn, dominant  
Tier 5: Cổ Vương (80-100%) \- KHỔNG LỒ, terrifying  
\`\`\`

Mỗi tier có \*\*sprite khác nhau\*\* (như Pokémon evolution\!)

\---

\#\#\# 2️⃣ \*\*SPLIT & DASH\*\* (Từ Agar.io)

\*\*Space Bar \- Split:\*\*  
\- Chia thành 2 phần bằng nhau  
\- 1 phần lao về phía cursor (dash 200px)  
\- Dùng để:  
  \- ✅ Bắt con nhỏ đang chạy  
  \- ✅ Escape (split ngược hướng kẻ thù)  
  \- ✅ Bait (1 phần làm mồi nhử)  
\- \*\*Cooldown:\*\* Merge lại sau 10 giây  
\- \*\*Risk:\*\* Khi split, mỗi phần nhỏ hơn → Dễ bị ăn\!

\*\*W Key \- Eject Mass:\*\*  
\- Bắn 1 viên nhỏ về phía cursor (10% mass)  
\- Dùng để:  
  \- Feed đồng minh (team mode)  
  \- Propel bản thân (Newton's 3rd law \- bắn ngược \= đẩy mình tới)  
  \- Bait kẻ địch (ném mồi)

\---

\#\#\# 3️⃣ \*\*MUTATIONS & ABILITIES\*\* (Roguelike twist)

Khác với Agar.io (pure size), game có \*\*Passive Mutations\*\*:

\*\*Cách nhận Mutations:\*\*  
\- Mỗi lần lên 1 Size Tier → Chọn 1 trong 3 mutations random  
\- Giết Elite Enemy → Drop 1 mutation (loot)  
\- Boss → Drop Legendary mutation

\*\*Mutation Tiers:\*\*

🟢 \*\*Common (60% drop rate)\*\*  
\- \*\*Tốc Hành:\*\* \+15% speed  
\- \*\*Máu Dày:\*\* \+20% max size before slowing down  
\- \*\*Gai Nhẹ:\*\* Reflect 10% damage  
\- \*\*Sát Khí:\*\* \+10% damage  
\- \*\*Thính Giác:\*\* \+30% view range (fog of war)

🔵 \*\*Rare (30%)\*\*  
\- \*\*Dash Boost:\*\* Split dash range \+50%  
\- \*\*Hút Máu:\*\* Heal 15% of damage dealt  
\- \*\*Xuyên Giáp:\*\* Ignore 20% of enemy's defense  
\- \*\*Tàng Hình:\*\* Invisible khi đứng yên 3s  
\- \*\*Độc Tố:\*\* Damage deal poison (3 DPS x 3s)

🟣 \*\*Epic (9%)\*\*  
\- \*\*Phân Thân:\*\* Split thành 3 thay vì 2  
\- \*\*Bất Tử:\*\* 1 lần/game, survive fatal hit với 1 HP  
\- \*\*Ma Tốc:\*\* \+100% speed trong 5s, cooldown 30s  
\- \*\*Từ Trường:\*\* Push nhỏ enemies ra khỏi 50px radius  
\- \*\*Hấp Tinh:\*\* Kills give 2x size growth

🟠 \*\*Legendary (1% \- Boss drops)\*\*  
\- \*\*Thời Gian Ngược:\*\* Rewind 5s (position \+ HP)  
\- \*\*Thiên Kiếp:\*\* Call lightning on 3 nearest enemies  
\- \*\*Cổ Vương Hóa:\*\* Transform size x2 trong 15s  
\- \*\*Bất Diệt:\*\* Immune to damage 3s  
\- \*\*Hỗn Độn:\*\* Swap size với 1 enemy ngẫu nhiên

\---

\#\# 🗺️ MAP DESIGN \- "Hũ Vạn Cổ"

\#\#\# Layout: Hình tròn, 2000x2000px

\`\`\`  
        \[TRUNG TÂM \- Vực Cổ\]  
              🌀  
         /    |    \\  
       /      |      \\  
    \[HỎA\]  \[MỘC\]  \[THỦY\]  
       \\            /  
        \\          /  
         \[KIM\]\[THỔ\]  
\`\`\`

\#\#\# 5 Zones (Mỗi zone 400x400px góc)

\*\*Design Philosophy:\*\*  
\- Mỗi zone có \*\*terrain đặc trưng\*\*  
\- Favor 1 tộc, hard counter 1 tộc khác  
\- Có neutral creeps \+ power-ups  
\- Có 1 landmark iconic

\---

\#\#\#\# 🔥 \*\*Zone Hỏa \- Miệng Núi Lửa\*\*

\*\*Terrain:\*\*  
\- Lava pools (đứng trong mất 5 HP/s)  
\- Stepping stones (safe spots)  
\- Geysers (phun lửa random mỗi 8s, 20 damage)

\*\*Neutral Creeps:\*\*  
\- \*\*Salamander\*\* (10 HP, 5 ATK, slow)  
  \- Drop: 50% Fire Resist mutation

\*\*Power-up:\*\*  
\- \*\*Hỏa Châu:\*\* \+30% damage x 20s

\*\*Landmark:\*\*  
\- \*\*Lò Lửa Cổ Đại\*\* (center)  
  \- Stand next to it → \+10% damage  
  \- But visible to all (glow effect)

\*\*Tactics:\*\*  
\- Hỏa Tộc: Immune to lava (passive)  
\- Thủy Tộc: Lava deals 2x damage (khắc)  
\- Kim Tộc: Geysers one-shot (khắc cực mạnh)

\---

\#\#\#\# 🌿 \*\*Zone Mộc \- Rừng Ký Sinh\*\*

\*\*Terrain:\*\*  
\- Tall grass (che tầm nhìn, only see 50px)  
\- Vines (slow 20% khi đi qua)  
\- Mushroom rings (teleport ngẫu nhiên trong zone)

\*\*Neutral Creeps:\*\*  
\- \*\*Poison Frog\*\* (8 HP, 3 ATK \+ poison 2 DPS x 4s)  
  \- Drop: Lifesteal mutation

\*\*Power-up:\*\*  
\- \*\*Linh Dược:\*\* Instant heal 30% max size

\*\*Landmark:\*\*  
\- \*\*Cây Mẹ\*\* (giant tree center)  
  \- Orbit around it → Heal 3 HP/s  
  \- Spawns Healing Fruits mỗi 15s

\*\*Tactics:\*\*  
\- Mộc Tộc: See through grass (passive)  
\- Kim Tộc: Vines don't slow (khắc)  
\- Thổ Tộc: Stuck in vines x2 duration (bị khắc)

\---

\#\#\#\# 💧 \*\*Zone Thủy \- Hồ Băng Vỡ\*\*

\*\*Terrain:\*\*  
\- Ice floor (trượt, momentum-based movement)  
\- Thin ice patches (rơi xuống nước, slow 50% x 3s)  
\- Icicles (rơi từ trên xuống mỗi 10s, 15 damage)

\*\*Neutral Creeps:\*\*  
\- \*\*Ice Slime\*\* (15 HP, 4 ATK, slow 30% on hit)  
  \- Drop: Speed boost mutation

\*\*Power-up:\*\*  
\- \*\*Băng Tâm:\*\* \+40% speed x 30s (siêu value\!)

\*\*Landmark:\*\*  
\- \*\*Tượng Băng Cổ\*\* (frozen statue)  
  \- Circle it 3 times → Get shield (30 HP)

\*\*Tactics:\*\*  
\- Thủy Tộc: Don't slip on ice (passive)  
\- Hỏa Tộc: Ice melts around them \= No slip penalty  
\- Mộc Tộc: Icicles deal 2x damage (plant vs cold)

\---

\#\#\#\# ⚔️ \*\*Zone Kim \- Rừng Tre Sát\*\*

\*\*Terrain:\*\*  
\- Dense bamboo (block vision, create maze)  
\- Bamboo spears (shoot from ground when stepped on, 12 damage)  
\- Wind tunnels (boost speed \+50% in direction)

\*\*Neutral Creeps:\*\*  
\- \*\*Hornet\*\* (6 HP, 10 ATK, flies fast)  
  \- Drop: Critical hit mutation

\*\*Power-up:\*\*  
\- \*\*Kiếm Khí:\*\* Next 5 attacks crit (+100% damage)

\*\*Landmark:\*\*  
\- \*\*Đài Kiếm Thánh\*\* (sword altar)  
  \- Pray at it → \+20% damage 15s  
  \- But immobilized 2s (risky\!)

\*\*Tactics:\*\*  
\- Kim Tộc: Spears don't trigger (passive)  
\- Mộc Tộc: Bamboo is transparent (wood see wood)  
\- Hỏa Tộc: Wind makes them slower (fire weak to wind)

\---

\#\#\#\# 🛡️ \*\*Zone Thổ \- Thạch Trận\*\*

\*\*Terrain:\*\*  
\- Boulder maze (tảng đá block movement)  
\- Crumbling ground (sau 2s đứng yên, đất sụp, fall damage 10 HP)  
\- Dust storms (giảm visibility 70%, mỗi 20s)

\*\*Neutral Creeps:\*\*  
\- \*\*Rock Crab\*\* (25 HP, 2 ATK, armored)  
  \- Drop: Defense mutation

\*\*Power-up:\*\*  
\- \*\*Kim Cang:\*\* Shield 50 HP (absorb damage)

\*\*Landmark:\*\*  
\- \*\*Kim Tự Tháp Cổ\*\* (pyramid)  
  \- Climb to top → See entire map 10s  
  \- But slow climb, exposed

\*\*Tactics:\*\*  
\- Thổ Tộc: Can push boulders (create cover)  
\- Thủy Tộc: Dust storms don't affect vision  
\- Mộc Tộc: Crumbling ground happens faster (roots break earth)

\---

\#\#\#\# 🌀 \*\*TRUNG TÂM \- Vực Vạn Cổ\*\*

\*\*The Final Arena\*\* (500x500px center)

\*\*Terrain:\*\*  
\- Mix của tất cả 5 elements  
\- Chaotic, unpredictable  
\- No safe zones

\*\*Boss:\*\*  
\- \*\*Cổ Trùng Mẫu\*\* (200 HP, 15 ATK, boss)  
  \- Respawn mỗi 2 phút  
  \- Drop: Random Legendary Mutation  
  \- Telegraphed attacks (easy to dodge if skilled)

\*\*Design:\*\*  
\- Đây là nơi combat cuối game  
\- Bo shrink về đây  
\- Open space, no hiding

\---

\#\# ⚖️ NGŨ HÀNH TỘC \- Balanced Design

\#\#\# Philosophy:  
\- \*\*Không cố gắng perfect balance\*\*  
\- Mỗi tộc mạnh ở terrain của nó  
\- Khắc nhau rõ ràng (rock-paper-scissors)  
\- \*\*Playstyle \> Raw stats\*\*

\---

\#\#\# ⚔️ \*\*KIM TỘC \- Ong Vàng\*\* 🐝

\*\*Tên Hóa Hình Lv5:\*\* \*\*BẠO VŨ THIẾT PHONG\*\* (暴雨鐵蜂)

\*\*Visual:\*\*   
\- \*\*Tier 1-4:\*\* Ong vàng nhỏ nhắn, cánh mỏng, kim châm nhọn  
\- \*\*Tier 5:\*\* Transform thành ong khổng lồ, cánh kim loại sắc như dao, thân phủ giáp sắt, mắt phát sáng đỏ

\*\*Playstyle:\*\* Assassin \- Critical strikes, burst damage, high risk

\*\*Base Stats:\*\*  
\`\`\`  
HP: ⭐⭐⭐ (90)  
ATK: ⭐⭐⭐⭐⭐ (14)  
Speed: ⭐⭐⭐⭐ (130)  
Defense: ⭐⭐ (10% damage reduction)  
Crit Chance: 15% (unique\!)  
\`\`\`

\*\*Passive Ability:\*\* \*\*"Kiếm Phong" (Sword Wind)\*\*  
\- Mỗi đòn đánh có 15% crit (gây 2x damage)  
\- Crit stacks "Sát Khí" (max 3 stacks)  
\- 3 stacks → Next attack guaranteed crit \+ gây bleeding (5 damage/s x 3s)

\*\*Active Skill:\*\* \*\*"Liên Châm Toát" (Continuous Sting)\*\*  
\- Dash 120px về phía cursor, để lại afterimage  
\- Mỗi enemy đi qua nhận 10 damage  
\- Nếu giết địch bằng skill → Cooldown giảm 50%  
\- Cooldown: 6s

\*\*Level 5 Transformation \- BẠO VŨ THIẾT PHONG:\*\*  
\- Crit chance tăng lên 35%  
\- Passive thêm: Mỗi crit tạo "Phong Nhãn" (wind blade) bắn ra 3 hướng (5 damage each)  
\- Active upgrade: Liên Châm Toát dash 3 lần liên tiếp

\*\*Faction Perks:\*\*  
\- Wind tunnels boost speed \+100% (Zone Kim)  
\- \+20% crit chance ở Zone Kim  
\- Fire geysers deal 2x damage (Zone Hỏa \- khắc mạnh)

\*\*Khắc:\*\* Mộc (kim chặt gỗ)    
\*\*Bị khắc:\*\* Hỏa (lửa nấu chảy kim)

\---

\#\#\# 🌿 \*\*MỘC TỘC \- Rắn Lục\*\* 🐍

\*\*Tên Hóa Hình Lv5:\*\* \*\*THANH PHƯỢC YÊU XÀ\*\* (青鳳妖蛇)

\*\*Visual:\*\*  
\- \*\*Tier 1-4:\*\* Rắn xanh lá thon dài, vảy sáng bóng, mắt đỏ  
\- \*\*Tier 5:\*\* Transform thành rắn có cánh phượng hoàng màu lục bích, thân to gấp đôi, aura xanh lá phát sáng

\*\*Playstyle:\*\* Sustain Tank \- Lifesteal, regeneration, war of attrition

\*\*Base Stats:\*\*  
\`\`\`  
HP: ⭐⭐⭐⭐⭐ (140)  
ATK: ⭐⭐⭐ (8)  
Speed: ⭐⭐⭐ (95)  
Defense: ⭐⭐⭐⭐ (25% damage reduction)  
Magic Resist: 20% (unique\!)  
\`\`\`

\*\*Passive Ability:\*\* \*\*"Xà Linh Hồi Sinh" (Serpent Regeneration)\*\*  
\- Đứng yên 1.5s → Heal 3 HP/s  
\- Mỗi kill drop "Linh Châu" (orb), ăn vào hồi 20 HP  
\- Khi HP \< 30% → Regen tăng gấp đôi (6 HP/s)

\*\*Active Skill:\*\* \*\*"Quấn Siết Hút Máu" (Constricting Drain)\*\*  
\- Bắn lưỡi (250px range, skillshot)  
\- Trúng → Kéo enemy lại gần \+ lifesteal 8 HP/s x 4s  
\- Enemy bị slow 40% khi đang bị hút  
\- Cooldown: 8s

\*\*Level 5 Transformation \- THANH PHƯỢC YÊU XÀ:\*\*  
\- Magic Resist tăng lên 40%  
\- Passive thêm: Aura 100px radius, đồng minh trong vùng hồi 2 HP/s  
\- Active upgrade: Quấn Siết giữ chân enemy (root 2s) \+ lifesteal tăng lên 12 HP/s

\*\*Faction Perks:\*\*  
\- See through tall grass (Zone Mộc)  
\- Vines don't slow (natural habitat)  
\- \+30% lifesteal ở Zone Mộc

\*\*Khắc:\*\* Thổ (rễ xuyên đất, đào hang)    
\*\*Bị khắc:\*\* Kim (dao chém rắn)

\---

\#\#\# 🔥 \*\*HỎA TỘC \- Cóc Đỏ\*\* 🐸

\*\*Tên Hóa Hình Lv5:\*\* \*\*NHAM HỎA XÍCH CÁP\*\* (岩火赤蟾)

\*\*Visual:\*\*  
\- \*\*Tier 1-4:\*\* Cóc đỏ tròn trĩnh, da sần sùi, mắt vàng óng  
\- \*\*Tier 5:\*\* Transform thành cóc khổng lồ, da nứt nẻ có dung nham chảy, lưng có gai đá núi lửa, miệng phun khói

\*\*Playstyle:\*\* DOT Mage \- Burn damage over time, zone control

\*\*Base Stats:\*\*  
\`\`\`  
HP: ⭐⭐⭐ (100)  
ATK: ⭐⭐⭐⭐ (11)  
Speed: ⭐⭐ (80)  
Defense: ⭐⭐⭐ (15% damage reduction)  
\`\`\`

\*\*Passive Ability:\*\* \*\*"Nham Nhiệt Da" (Lava Skin)\*\*  
\- Ai đánh Cóc bị burn (4 damage/s x 3s)  
\- Mỗi enemy bị burn → Cóc heal 2 HP/s  
\- Burns stack (nhiều enemy \= nhiều heal)

\*\*Active Skill:\*\* \*\*"Nham Phún" (Lava Spit)\*\*  
\- Nhảy cao, rơi xuống tạo AOE 120px  
\- Impact: 25 damage \+ slow 50% x 2s  
\- Để lại vệt lửa trên đất (5s duration, 8 damage/s khi đứng trong)  
\- Cooldown: 10s

\*\*Level 5 Transformation \- NHAM HỎA XÍCH CÁP:\*\*  
\- Passive thêm: Burns gây 6 damage/s (thay vì 4\)  
\- Di chuyển để lại đường lửa sau lưng (3s, 6 damage/s)  
\- Active upgrade: Nham Phún AOE tăng lên 180px \+ vệt lửa kéo dài 8s

\*\*Faction Perks:\*\*  
\- Immune to lava (Zone Hỏa)  
\- \+25% burn damage ở Zone Hỏa  
\- Ice slows only 50% effective (Zone Thủy)

\*\*Khắc:\*\* Kim (lửa nấu chảy kim loại)    
\*\*Bị khắc:\*\* Thủy (nước dập lửa)

\---

\#\#\# 💧 \*\*THỦY TỘC \- Tằm Xanh\*\* 🐛

\*\*Tên Hóa Hình Lv5:\*\* \*\*HÀN BĂNG CỔ TẰM\*\* (寒冰古蠶)

\*\*Visual:\*\*  
\- \*\*Tier 1-4:\*\* Tằm tơ xanh dương mềm mại, thân có vân sóng nước, di chuyển lượn sóng  
\- \*\*Tier 5:\*\* Transform thành tằm khổng lồ bọc trong kén băng trong suốt, cánh bướm băng giá lấp lánh

\*\*Playstyle:\*\* Speed Demon & CC \- Kite, slow, outmaneuver

\*\*Base Stats:\*\*  
\`\`\`  
HP: ⭐⭐ (75)  
ATK: ⭐⭐⭐ (9)  
Speed: ⭐⭐⭐⭐⭐ (150)  
Defense: ⭐ (5% damage reduction)  
\`\`\`

\*\*Passive Ability:\*\* \*\*"Băng Tốc" (Ice Speed)\*\*  
\- Mỗi lần dùng skill → \+15% speed (stack 3 lần, max \+45%)  
\- Speed buff kéo dài 5s  
\- Khi max stacks → Di chuyển để lại băng trail, enemies đi qua bị slow 30% x 2s

\*\*Active Skill:\*\* \*\*"Tơ Băng Trói" (Frozen Silk)\*\*  
\- Bắn 3 sợi tơ băng (cone pattern, 180px range)  
\- Mỗi sợi: 7 damage \+ slow 50% x 3s  
\- Nếu trúng 3 sợi cùng lúc → Freeze enemy 1.5s (stun)  
\- Cooldown: 5s

\*\*Level 5 Transformation \- HÀN BĂNG CỔ TẰM:\*\*  
\- Base speed tăng lên 180 (fastest in game\!)  
\- Passive thêm: Max speed stacks tăng lên 5 (max \+75% speed)  
\- Active upgrade: Tơ Băng tạo "Kén Băng" \- vùng AOE 150px, enemies trong vùng slow 60% x 4s

\*\*Faction Perks:\*\*  
\- Don't slip on ice (Zone Thủy)  
\- \+40% speed ở Zone Thủy  
\- Thin ice không vỡ dưới chân

\*\*Khắc:\*\* Hỏa (băng dập lửa, tạo hơi nước)    
\*\*Bị khắc:\*\* Thổ (đất hấp thụ nước)

\---

\#\#\# 🛡️ \*\*THỔ TỘC \- Bò Cạp Nâu\*\* 🦂

\*\*Tên Hóa Hình Lv5:\*\* \*\*KIM CANG ĐỘC HẠT\*\* (金剛毒蠍)

\*\*Visual:\*\*  
\- \*\*Tier 1-4:\*\* Bò cạp nâu bé nhỏ, càng nhỏ, đuôi độc cong vút  
\- \*\*Tier 5:\*\* Transform thành bò cạp khổng lồ, giáp vàng kim cương sáng bóng, càng to như búa, đuôi có gai kim loại

\*\*Playstyle:\*\* Defense Tank \- Reflect, counter-attack, unkillable

\*\*Base Stats:\*\*  
\`\`\`  
HP: ⭐⭐⭐⭐⭐ (160)  
ATK: ⭐⭐ (6)  
Speed: ⭐⭐ (70)  
Defense: ⭐⭐⭐⭐⭐ (35% damage reduction)  
\`\`\`

\*\*Passive Ability:\*\* \*\*"Kim Cang Giáp" (Diamond Armor)\*\*  
\- Reflect 25% damage nhận vào  
\- Khi HP \< 30% → Reflect tăng lên 50% \+ Defense \+20%  
\- Mỗi lần bị hit → Stack "Cương Quyết" (max 5), mỗi stack \+2% defense

\*\*Active Skill:\*\* \*\*"Đuôi Quật Phản Kích" (Tail Counter-Strike)\*\*  
\- Dựng shield 3s (absorb 60 damage)  
\- Nếu shield bị phá → Spin 360°, đẩy lùi \+ gây 30 damage cho mọi enemy trong 100px  
\- Nếu shield không vỡ → Cooldown giảm 50%  
\- Cooldown: 12s

\*\*Level 5 Transformation \- KIM CANG ĐỘC HẠT:\*\*  
\- Defense tăng lên 50% damage reduction  
\- Passive thêm: Reflect damage gây poison (3 damage/s x 4s)  
\- Active upgrade: Shield absorb tăng lên 100 damage \+ khi shield active, immune to CC (stun, slow)

\*\*Faction Perks:\*\*  
\- Can push boulders (Zone Thổ)  
\- \+40% defense ở Zone Thổ  
\- Crumbling ground không ảnh hưởng

\*\*Khắc:\*\* Thủy (độc ngấm qua nước)    
\*\*Bị khắc:\*\* Mộc (rễ cây siết chặt giáp)

\---

\#\# ⏱️ GAME FLOW \- 8 Phút Hoàn Hảo

\`\`\`  
\[0:00\] SPAWN PHASE  
├─ All players spawn random trong 1 trong 5 zones  
├─ Size: Tier 1 (bé nhất)  
├─ Choose faction (hoặc random)  
└─ 5s grace period (invulnerable)

\[0:00 \- 2:30\] EARLY GAME \- "Farm Phase"  
├─ Safe zone: Toàn bộ map  
├─ Objective: Farm creeps \+ pellets  
├─ AI behavior: 70% farm, 30% combat  
├─ First mutation unlock at Tier 2  
└─ Boss spawn lần 1

\[2:30\] ROUND 1 SHRINK  
├─ Warning 10s trước (siren \+ visual)  
├─ Bo shrink: Mất 30% outer edge mỗi zone  
├─ Độc Khí damage: 5 HP/s  
└─ Thiên Kiếp bắt đầu (1 lightning mỗi 12s ở vùng ngoài bo)

\[2:30 \- 5:00\] MID GAME \- "Giao Tranh"  
├─ Players forced closer  
├─ Combat tăng (AI aggressive hơn)  
├─ Mutations build diversity  
├─ Elite creeps spawn (higher loot)  
└─ Boss respawn

\[5:00\] ROUND 2 SHRINK  
├─ Bo shrink: Chỉ còn trung tâm \+ 30% mỗi zone  
├─ Độc Khí: 8 HP/s  
└─ Thiên Kiếp: Mỗi 8s, anywhere outside bo

\[5:00 \- 7:30\] LATE GAME \- "All-Out War"  
├─ 5-10 survivors còn lại  
├─ Most players Tier 4-5  
├─ High stakes combat  
├─ Boss final spawn (luôn drop Legendary)  
└─ Vật cản bắt đầu collapse

\[7:30\] FINAL SHRINK  
├─ Bo: Chỉ còn trung tâm (500x500px)  
├─ Độc Khí: 12 HP/s  
├─ Thiên Kiếp: Mỗi 4s, TOÀN MAP  
└─ Tất cả vật cản biến mất

\[7:30 \- 8:30\] ENDGAME \- "Sudden Death"  
├─ 2-4 survivors  
├─ Pure skill showdown  
├─ No hiding  
└─ Last Critter Standing wins\!

\[8:30+\] OVERTIME  
├─ Nếu vẫn \>1 survivor  
├─ Độc Khí: 20 HP/s  
├─ Thiên Kiếp: Mỗi 2s  
└─ Forced conclusion  
\`\`\`

\---

\#\# ⚡ HAZARDS & EVENTS

\#\#\# Thiên Kiếp (Lightning Strike)

\*\*Mechanics:\*\*  
\- Random target selection (weighted by size \- to hơn dễ bị chọn hơn)  
\- \*\*Telegraph:\*\* 1.2s warning (red circle on ground \+ sound)  
\- \*\*Damage:\*\*   
  \- Outside bo: 40% max HP  
  \- Inside bo (after Round 2): 20% max HP  
  \- Final phase: 30% max HP  
\- \*\*Counterplay:\*\*  
  \- Dash ra khỏi circle  
  \- Hide behind vật cản lớn (boulders, trees)  
  \- Item "Lôi Phù" (giảm damage 50%)  
\- \*\*Iframes:\*\* 1s invulnerability sau khi trúng (tránh double-hit)

\#\#\# Độc Khí (Poison Zone)

\*\*Mechanics:\*\*  
\- Visual: Sương màu xanh lục từ ngoài vào trong  
\- Damage ramp: 5 → 8 → 12 → 20 HP/s  
\- \*\*Tại sao:\*\* Force combat, prevent camping

\#\#\# Environmental Hazards

\*\*Mỗi zone có 2-3 hazards riêng\*\* (đã list ở phần Map Design)

\---

\#\# 🎨 ART & STYLE

\#\#\# Visual Direction: \*\*"Cute Chaos"\*\*

\*\*Character Design:\*\*  
\- Chibi proportions (head \= 40% body)  
\- Smooth, rounded shapes (no sharp edges except Kim Tộc)  
\- Big expressive eyes (anime-style)  
\- Pastel colors với gradients

\*\*Animation Principles:\*\*  
\- \*\*Squash & Stretch:\*\* Khi move, characters co giãn  
\- \*\*Anticipation:\*\* Trước khi attack, có wind-up  
\- \*\*Follow-through:\*\* Sau attack, có recoil  
\- \*\*Impact frames:\*\* Hit-pause 2 frames khi damage dealt

\*\*VFX:\*\*  
\- \*\*Hit effects:\*\* Bright colored stars/sparkles (không phải blood)  
\- \*\*Death:\*\* Poof into colored smoke (tộc Hỏa \= red, Thủy \= blue...)  
\- \*\*Mutations:\*\* Aura effects (Common \= white, Rare \= blue, Epic \= purple, Legendary \= gold)  
\- \*\*Lightning:\*\* Cartoon style (jagged yellow bolt \+ white flash)

\*\*UI Style:\*\*  
\- Thick borders (4-6px)  
\- Round corners everywhere  
\- Comic Sans-esque font (friendly, readable)  
\- HP bars with emoticons:  
  \- 😊 100-70% HP (green)  
  \- 😰 69-30% HP (yellow)  
  \- 💀 \<30% HP (red, pulsing)

\*\*Color Palette:\*\*  
| Tộc | Primary | Secondary | Accent |  
|-----|---------|-----------|--------|  
| Hỏa | \#FF6B35 | \#FFD23F | \#FF4500 |  
| Thổ | \#8B5A3C | \#D4A574 | \#654321 |  
| Kim | \#C0C0C0 | \#4682B4 | \#708090 |  
| Mộc | \#4CAF50 | \#81C784 | \#2E7D32 |  
| Thủy | \#2196F3 | \#7B68EE | \#1565C0 |

\---

\#\# 🎵 SOUND DESIGN

\#\#\# SFX Philosophy: \*\*"Cartoon \+ ASMR"\*\*

\*\*Combat:\*\*  
\- Attack: "Whoosh" \+ "Bonk\!"  
\- Hit received: "Oof\!" (pitch varies by size)  
\- Kill: "Ding\!" (xylophone note) \+ sad trombone for victim  
\- Death: "Splat" \+ descending whistle

\*\*Growth:\*\*  
\- Eat small: "Nom" (cute)  
\- Eat equal: "CHOMP\!" (satisfying)  
\- Level up (Tier change): Triumphant jingle \+ whoosh

\*\*Abilities:\*\*  
\- Hỏa: Fireball "Fwoosh\!"  
\- Thổ: Shield "Clang\!"  
\- Kim: Dash "Schwing\!" (sword slash)  
\- Mộc: Roots "Shlorp" (wet sticky sound)  
\- Thủy: Bubbles "Pop pop pop\!"

\*\*Ambience (Per Zone):\*\*  
\- Hỏa: Crackling fire \+ low rumble  
\- Thổ: Wind through rocks \+ sand shifting  
\- Kim: Wind chimes \+ bamboo creaking  
\- Mộc: Birds \+ rustling leaves  
\- Thủy: Dripping water \+ ice cracking

\*\*Music:\*\*  
\- \*\*Main Theme:\*\* Upbeat, playful (like Kirby or Yoshi)  
\- \*\*Early Game:\*\* Chill, exploration vibe  
\- \*\*Mid Game:\*\* Tempo increases, drums added  
\- \*\*Late Game:\*\* Intense, orchestral (like Smash Bros final stock)  
\- \*\*Victory:\*\* Epic fanfare (over-the-top dramatic)

\---

\#\# 💻 TECH STACK

\#\#\# Recommended: \*\*Phaser.js\*\* (Browser-first)

\*\*Why Phaser?\*\*  
\- ✅ Free & open-source  
\- ✅ Mature ecosystem (10+ years)  
\- ✅ Perfect for 2D top-down  
\- ✅ Great performance (WebGL)  
\- ✅ Easy to iterate fast  
\- ✅ Can export to mobile via Cordova/Capacitor

\*\*Architecture:\*\*

\`\`\`  
├── index.html (entry point)  
├── src/  
│   ├── scenes/  
│   │   ├── BootScene.js (preload assets)  
│   │   ├── MenuScene.js (faction select)  
│   │   ├── GameScene.js (main game loop)  
│   │   └── EndScene.js (victory/defeat)  
│   ├── entities/  
│   │   ├── Player.js  
│   │   ├── AIEntity.js  
│   │   ├── Creep.js  
│   │   └── Boss.js  
│   ├── systems/  
│   │   ├── SizeManager.js (handle growth)  
│   │   ├── MutationSystem.js (manage buffs)  
│   │   ├── SpatialGrid.js (collision optimization)  
│   │   ├── BoManager.js (shrinking zone)  
│   │   └── LightningSystem.js (hazard)  
│   ├── ui/  
│   │   ├── HUD.js (HP, size, mutations)  
│   │   ├── Minimap.js  
│   │   └── MutationPicker.js (choice screen)  
│   └── utils/  
│       ├── Constants.js (balancing numbers)  
│       ├── Helpers.js  
│       └── SoundManager.js  
└── assets/  
    ├── sprites/  
    ├── sounds/  
    └── music/  
\`\`\`

\*\*Key Systems:\*\*

\*\*1. Spatial Grid (Performance)\*\*  
\`\`\`javascript  
// Divide map thành grid 100x100px cells  
// Chỉ check collision entities trong cùng cell \+ adjacent  
// Từ O(n²) → O(n) for 20 entities  
\`\`\`

\*\*2. Size Manager\*\*  
\`\`\`javascript  
class SizeManager {  
  calculateRelativeSize(entity1, entity2) {  
    const ratio \= entity1.size / entity2.size;  
    if (ratio \>= 1.1) return 'LARGER'; // Can eat  
    if (ratio \<= 0.9) return 'SMALLER'; // Be eaten  
    return 'EQUAL'; // Combat  
  }  
    
  canEat(predator, prey) {  
    return this.calculateRelativeSize(predator, prey) \=== 'LARGER';  
  }  
}  
\`\`\`

\*\*3. AI System\*\*  
\`\`\`javascript  
class AIEntity {  
  update() {  
    // State machine  
    switch(this.state) {  
      case 'FARM':  
        this.findNearestFood();  
        break;  
      case 'HUNT':  
        this.findWeakerEnemy();  
        break;  
      case 'FLEE':  
        this.runFromStronger();  
        break;  
    }  
  }  
    
  evaluateThreats() {  
    // Scan entities in vision  
    // If see LARGER → FLEE  
    // If see SMALLER → HUNT (if not already farming)  
    // Else → FARM  
  }  
}  
\`\`\`

\---

\#\# ⚖️ BALANCING FRAMEWORK

\#\#\# Win Rate Targets (1v19 AI)

| Level | AI Difficulty | Player Win Rate Target |  
|-------|---------------|------------------------|  
| 1-2 | Tutorial | 80% (learn mechanics) |  
| 3-4 | Easy | 60% (build confidence) |  
| 5-6 | Normal | 45% (fair challenge) |  
| 7-8 | Hard | 30% (skill test) |  
| 9-10 | Expert | 15% (mastery required) |

\#\#\# Faction Balance

\*\*Metrics to track:\*\*  
\- Win rate mỗi tộc (target: 45-55%)  
\- Pick rate (nếu \>60% → Too strong or fun)  
\- Avg placement (should be \~10.5 for 20 players)  
\- Mutation synergies (which combos OP?)

\*\*Monthly balance patches:\*\*  
\- Nerf top 2 win rate factions (by 5-10%)  
\- Buff bottom 2 (by 5-10%)  
\- \*\*Never nerf \>20% một lúc\*\* (upsets players)

\#\#\# Mutation Balance

\*\*Rule of thumb:\*\*  
\- Common: 10-15% power increase  
\- Rare: 20-30% power increase  
\- Epic: 40-60% power increase (có trade-off)  
\- Legendary: 100%+ power spike (nhưng 1 lần use hoặc cooldown dài)

\*\*Testing:\*\*  
\- Sim 1000 games với random builds  
\- Track which mutations always in winning builds → Nerf  
\- Track never picked → Buff hoặc xóa

\---

\#\# 🚀 DEVELOPMENT ROADMAP

\#\#\# Milestone 1: \*\*Vertical Slice\*\* (4 weeks)

\*\*Goal:\*\* 1 trận game hoàn chỉnh, dù minimal

\*\*Deliverables:\*\*  
\- \[x\] 1 tộc (Hỏa) fully playable  
\- \[x\] 1 zone (Hỏa zone)  
\- \[x\] 5 AI bots (basic behavior)  
\- \[x\] Basic combat (size-based eating)  
\- \[x\] 3 Common mutations  
\- \[x\] Win/lose screen  
\- \[x\] \*\*Playtestable từ đầu đến cuối\*\*

\*\*Tech milestones:\*\*  
\- Phaser setup  
\- Player movement (mouse control)  
\- Size calculation  
\- Basic AI (flee/hunt)  
\- Collision detection

\---

\#\#\# Milestone 2: \*\*Core Loop\*\* (6 weeks)

\*\*Goal:\*\* Full mechanics, 1 tộc

\*\*Deliverables:\*\*  
\- \[x\] Split & Dash (Space/W keys)  
\- \[x\] Full mutation system (15 mutations)  
\- \[x\] Bo shrinking zone (3 rounds)  
\- \[x\] Thiên Kiếp hazard  
\- \[x\] Boss fight  
\- \[x\] 10 difficulty levels  
\- \[x\] SFX \+ basic music

\*\*Balance:\*\*  
\- Tune size ratios (90/110% rule)  
\- Mutation values  
\- AI difficulty scaling

\---

\#\#\# Milestone 3: \*\*Content Expansion\*\* (8 weeks)

\*\*Goal:\*\* Full game với 5 tộc

\*\*Deliverables:\*\*  
\- \[x\] 4 tộc còn lại  
\- \[x\] 5 zones đầy đủ  
\- \[x\] Ngũ hành counter system  
\- \[x\] Zone-specific creeps/hazards  
\- \[x\] Full visual polish  
\- \[x\] Full sound design  
\- \[x\] Tutorial

\*\*Polish:\*\*  
\- Juice (screen shake, particles, hit-pause)  
\- UI animations  
\- Victory/defeat cinematics  
\- Achievement system

\---

\#\#\# Milestone 4: \*\*Launch Ready\*\* (4 weeks)

\*\*Goal:\*\* Shippable MVP

\*\*Deliverables:\*\*  
\- \[x\] Bug fixes  
\- \[x\] Performance optimization (60 FPS on mid-range PC)  
\- \[x\] Analytics integration (track win rates)  
\- \[x\] Settings (volume, controls)  
\- \[x\] Leaderboard (local)  
\- \[x\] Polish pass

\*\*Testing:\*\*  
\- 50+ playtest hours  
\- Balance tuning based on data  
\- Fix exploits

\---

\#\#\# Post-Launch (Future)

\- \*\*Month 1-2:\*\* Balance patches based on data  
\- \*\*Month 3:\*\* New mutations \+ 1 new tộc  
\- \*\*Month 4-6:\*\* PvP multiplayer mode (5v5 or Battle Royale)  
\- \*\*Month 6+:\*\* Mobile port

\---

\#\# 📊 SUCCESS METRICS

\#\#\# Engagement

\- \*\*Session length:\*\* 15-30 phút (2-4 games)  
\- \*\*D1 Retention:\*\* \>40%  
\- \*\*D7 Retention:\*\* \>20%  
\- \*\*Games/session:\*\* \>2.5

\#\#\# Balance

\- No faction \>55% win rate  
\- No mutation \>70% pick rate  
\- Top 10% players \<30% win rate on Level 10

\#\#\# Virality

\- \*\*Share rate:\*\* \>5% (players share after win)  
\- \*\*Word-of-mouth:\*\* Track referral sources  
\- \*\*Clip-worthy moments:\*\* Track "Thiên Kiếp clutch dodges" screenshots

\---

\#\# 🎯 WHAT MAKES THIS GAME SPECIAL?

\#\#\# 1\. \*\*Simple to Learn, Deep to Master\*\*  
\- Tutorial \= 1 game (5 min)  
\- But mastery \= Understand matchups, timing, mutations

\#\#\# 2\. \*\*Every Game Feels Different\*\*  
\- Random mutations → No meta build  
\- Random spawns → Different early games  
\- AI variance → Unpredictable

\#\#\# 3\. \*\*High Skill Ceiling\*\*  
\- Split mechanics (Agar.io proven)  
\- Hazard dodging (Thiên Kiếp)  
\- Resource management (when to fight vs farm)  
\- Map knowledge (terrain advantages)

\#\#\# 4\. \*\*Satisfying Growth\*\*  
\- From tiny → MASSIVE  
\- Visual evolution (5 tiers)  
\- Power fantasy delivered

\#\#\# 5\. \*\*Quick Matches\*\*  
\- 5-10 min \= Mobile-friendly  
\- No time commitment  
\- "One more game" loop

\#\#\# 6\. \*\*Meme Potential\*\*  
\- Cute art \+ chaotic gameplay  
\- Thiên Kiếp moments (clutch dodges)  
\- David vs Goliath (small eat big via skill)  
\- Clip-worthy

\---

\#\# ⚠️ RISKS & MITIGATIONS

\#\#\# Risk 1: \*\*AI too predictable\*\*  
\*\*Mitigation:\*\*  
\- Add randomness to decision-making (20% noise)  
\- Different AI personalities (aggressive, passive, sneaky)  
\- Higher difficulties add advanced tactics (bait, team-up)

\#\#\# Risk 2: \*\*Balance nightmare (5 factions)\*\*  
\*\*Mitigation:\*\*  
\- Start with 1 faction (Milestone 1\)  
\- Add 1 faction at a time, balance before adding next  
\- Accept imperfect balance (45-55% win rate OK)

\#\#\# Risk 3: \*\*Performance issues (20 entities)\*\*  
\*\*Mitigation:\*\*  
\- Spatial grid from day 1  
\- Object pooling (reuse entities)  
\- Target 60 FPS on mid-range hardware  
\- Simplify effects if needed

\#\#\# Risk 4: \*\*Not fun solo (1v19 AI)\*\*  
\*\*Mitigation:\*\*  
\- AI must feel like real players (unpredictable)  
\- Add personality (skins, names for AI)  
\- Leaderboard for competition  
\- Plan PvP mode for later

\---

\#\# 💡 FINAL THOUGHTS

Fen, game này \*\*CỰC KỲ KHẢ THI\*\* vì:

✅ \*\*Proven mechanics\*\* (Feeding Frenzy \+ Agar.io \= 100M+ players)  
✅ \*\*Scope manageable\*\* (Start 1 tộc, scale to 5\)  
✅ \*\*Quick matches\*\* (5-10 min \= high replay value)  
✅ \*\*Browser-first\*\* (Easy distribute, no install barrier)  
✅ \*\*Clear roadmap\*\* (22 weeks to launch)

\*\*Những gì làm nó khác biệt:\*\*  
\- 🎨 Cute art \+ bựa humor  
\- ⚔️ Skill-based combat (not pure RNG)  
\- 🧬 Roguelike depth (mutations)  
\- 🌏 Vietnamese-themed lore (cổ trùng\!)

\*\*Next steps:\*\*  
1\. Prototype Hỏa Tộc (1 faction) trong 4 tuần  
2\. Playtest với 10 người  
3\. Iterate based on feedback  
4\. Scale to 5 factions  
5\. Ship browser version  
6\. Port to mobile if successful

\*\*Fen sẵn sàng bắt đầu chưa?\*\* 🚀

\---

\*\*Version:\*\* 2.0 (Feeding Frenzy Edition)    
\*\*Last Updated:\*\* Jan 2026    
\*\*Built with:\*\* Research from Free Fire, Brotato, Brawl Stars, ZombsRoyale, Feeding Frenzy, Agar.io