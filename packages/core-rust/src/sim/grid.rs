use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use rand::{Rng, SeedableRng};
use rand_chacha::ChaCha8Rng;

// --- ĐỊNH NGHĨA VẬT CHẤT ---

// 0: Hư vô, 1-5: Ngũ Hành
#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum ElementType {
    Empty = 0,
    Metal = 1, // Kim - Trắng/Xám
    Wood = 2,  // Mộc - Xanh lá
    Water = 3, // Thủy - Xanh dương
    Fire = 4,  // Hỏa - Đỏ
    Earth = 5, // Thổ - Nâu/Vàng
    // Các loại đặc biệt (dành cho Boss mechanics sau này)
    Stone = 10, // Đá (Không thể phá hủy thường)
    Dark = 11,  // Hắc ám (Cần thanh tẩy)
}

// Cấu trúc Cell siêu gọn (2 bytes)
#[derive(Clone, Copy, Debug)]
#[repr(C)] // Đảm bảo layout bộ nhớ tương thích C để JS đọc an toàn
pub struct Cell {
    pub element: u8,
    pub flags: u8,   // Bitmask: 1=Frozen, 2=Burning, 4=Locked...
}

// --- CORE GRID STATE ---

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum MatchPattern {
    Line3,
    Line4,
    Line5,
    Cross, // T, L, +
    Area,  // 3x3 (Future use)
}

#[derive(Clone, Debug)]
pub struct MatchResult {
    pub pattern: MatchPattern,
    pub element: u8,
    pub cells: Vec<usize>,
    pub center_idx: usize,
}

#[wasm_bindgen]
pub struct GridState {
    width: usize,
    height: usize,
    cells: Vec<Cell>,
    
    // BUFFER SỰ KIỆN: Cầu nối tới WebGPU
    // Mỗi u32 là một gói tin nén: [Type(8) | X(8) | Y(8) | Intensity(8)]
    events: Vec<u32>,
    
    // GAMEPLAY STATE
    score: u32,
    match_queue: Vec<u8>, // Store matched element types for Cycle System

    // State tracking
    is_stable: bool, // True nếu không có gì đang rơi hoặc nổ
    pub auto_refill: bool,
    
    // RNG Deterministic
    rng: ChaCha8Rng,
    
    // Cycle System
    cycle: CycleState,
}

#[wasm_bindgen]
impl GridState {
    // 1. KHỞI TẠO
    pub fn new(width: usize, height: usize, seed: u64) -> Self {
        let mut grid = Self {
            width,
            height,
            cells: vec![Cell { element: 0, flags: 0 }; width * height],
            events: Vec::with_capacity(128), // Pre-allocate để tránh realloc liên tục
            score: 0,
            match_queue: Vec::with_capacity(64),
            is_stable: true,
            auto_refill: true,
            rng: ChaCha8Rng::seed_from_u64(seed),
            cycle: CycleState::new(),
        };
        grid.randomize(); // Khởi tạo ngẫu nhiên ban đầu
        grid
    }

    pub fn new_empty(width: usize, height: usize, seed: u64) -> Self {
        Self {
            width,
            height,
            cells: vec![Cell { element: 0, flags: 0 }; width * height],
            events: Vec::with_capacity(128),
            score: 0,
            match_queue: Vec::with_capacity(64),
            is_stable: true,
            auto_refill: true,
            rng: ChaCha8Rng::seed_from_u64(seed),
            cycle: CycleState::new(),
        }
    }

    // 2. API TRUY XUẤT MEMORY (ZERO-COPY)
    pub fn get_width(&self) -> usize { self.width }
    pub fn get_height(&self) -> usize { self.height }
    
    pub fn get_cells_ptr(&self) -> *const Cell {
        self.cells.as_ptr()
    }

    pub fn get_cells_len(&self) -> usize {
        self.cells.len()
    }

    pub fn get_events_ptr(&self) -> *const u32 {
        self.events.as_ptr()
    }

    pub fn get_events_len(&self) -> usize {
        self.events.len()
    }

    pub fn clear_events(&mut self) {
        self.events.clear();
    }

    pub fn get_score(&self) -> u32 {
        self.score
    }

    pub fn get_match_queue_ptr(&self) -> *const u8 {
        self.match_queue.as_ptr()
    }

    pub fn get_match_queue_len(&self) -> usize {
        self.match_queue.len()
    }

    pub fn clear_match_queue(&mut self) {
        self.match_queue.clear();
    }


    // --- BOSS API ---
    
    pub fn set_cell_element(&mut self, idx: usize, element: u8) {
        if idx < self.cells.len() {
            self.cells[idx].element = element;
            self.is_stable = false; // Interact -> Instability
        }
    }

    pub fn get_cell_element(&self, idx: usize) -> u8 {
         if idx < self.cells.len() {
             self.cells[idx].element
         } else {
             0
         }
    }

    pub fn set_cell_flag(&mut self, idx: usize, flag: u8) {
        if idx < self.cells.len() {
            self.cells[idx].flags |= flag;
        }
    }

    pub fn unset_cell_flag(&mut self, idx: usize, flag: u8) {
        if idx < self.cells.len() {
            self.cells[idx].flags &= !flag;
        }
    }

    pub fn get_cell_flag(&self, idx: usize) -> u8 {
        if idx < self.cells.len() { self.cells[idx].flags } else { 0 }
    }

    // Spawn special tiles (Ash, Stone) on random valid cells
    // count: number to spawn
    // element: target element type
    // flags: target flags to set
    // exclude_element: avoid replacing this element (e.g. don't replace Stone with Ash)
    pub fn spawn_special(&mut self, count: usize, element: u8, flags: u8, exclude_element: u8) -> Vec<usize> {
        let mut affected = Vec::new();
        let mut attempts = 0;
        let max_attempts = count * 5;
        let mut spawned = 0;

        while spawned < count && attempts < max_attempts {
            attempts += 1;            let idx = self.rng.gen_range(0..self.cells.len());
            
            if idx >= self.cells.len() { continue; }
            
            let cell = self.cells[idx];
            // Valid if: not locked (flag 4?), not the exclude element
            // Assuming Flag 4 is LOCK/IMMUNE. 
            // Let's assume we check if it is already the target.
            
            if cell.element != exclude_element && cell.element != element {
                // Apply
                self.cells[idx].element = element;
                self.cells[idx].flags |= flags;
                affected.push(idx);
                spawned += 1;
                self.is_stable = false;
            }
        }
        affected
    }

    // 3. LOGIC TƯƠNG TÁC (PLAYER SWAP)
    pub fn try_swap(&mut self, idx1: usize, idx2: usize) -> bool {
        // Validation
        if idx1 >= self.cells.len() || idx2 >= self.cells.len() { return false; }
        if idx1 == idx2 { return false; }

        let c1 = self.cells[idx1];
        let c2 = self.cells[idx2];

        // Không cho phép swap vật thể bị khóa (Stone)
        if c1.element == 10 || c2.element == 10 { return false; }

        // Thực hiện Swap
        self.cells.swap(idx1, idx2);

        // Kiểm tra Match ngay lập tức
        let has_match = self.check_matches_at(idx1) || self.check_matches_at(idx2);

        if has_match {
            // Nếu có match, trạng thái trở nên bất ổn để tick() xử lý tiếp
            self.is_stable = false;
            return true;
        } else {
            // Nếu không match, swap lại (Rollback)
            self.cells.swap(idx1, idx2);
            return false;
        }
    }

    // 4. LOGIC VÒNG LẶP (TICK)
    // Được gọi mỗi frame (16ms) từ JS
    pub fn tick(&mut self) {
        let mut movement = false;

        // BƯỚC 1: TRỌNG LỰC (Gravity)
        for x in 0..self.width {
            let mut write_y = self.height - 1;
            for y in (0..self.height).rev() {
                let read_idx = y * self.width + x;
                let cell = self.cells[read_idx];

                if cell.element == 10 { // Stone
                    if y > 0 { write_y = y - 1; }
                    continue;
                }

                if cell.element != 0 {
                    if y != write_y {
                        let write_idx = write_y * self.width + x;
                        self.cells[write_idx] = cell;
                        self.cells[read_idx] = Cell { element: 0, flags: 0 };
                        movement = true;
                    }
                    if write_y > 0 { write_y -= 1; }
                }
            }
             if self.auto_refill {
                 for y in 0..=write_y {
                     let idx = y * self.width + x;
                     if self.cells[idx].element == 0 {
                         // RNG
                         let seed = (self.events.len() + idx + self.rng.gen_range(0..100)) % 5;
                         self.cells[idx] = Cell {
                             element: (seed + 1) as u8,
                             flags: 0 
                         };
                         movement = true;
                         self.is_stable = false; 
                     }
                 }
             }
        }

        // BƯỚC 3: GIẢI QUYẾT MATCH VÀ TƯƠNG TÁC
        if !movement {
            let matches = self.find_all_matches();
            if !matches.is_empty() {
                let mut cells_to_clear = std::collections::HashSet::new();
                let mut bonus_score = 0;

                for m in matches {
                    // 1. Basic Match Clearing - Mark match cells for clearing first
                    for &idx in &m.cells {
                        cells_to_clear.insert(idx);
                        
                        // Basic match event (low intensity)
                        let (mx, my) = (idx % self.width, idx / self.width);
                        // Only emit basic event if no special interaction overrides it later?
                        // For now, let's rely on the special events to be the "Big Sound", 
                        // and basic match can just be popping.
                        // self.push_event(m.element, mx as u8, my as u8, 100); 
                    }

                    // 2. Advanced Interactions
                    let interaction = self.analyze_match_interaction(&m);
                    
                    match interaction {
                        InteractionType::Destruction(target_idxs) => {
                             // Effect: Destruction
                             // Visuals handled by events in tick, but here we just apply logic
                             for &t_idx in &target_idxs {
                                    cells_to_clear.insert(t_idx);
                                    let (tx, ty) = (t_idx % self.width, t_idx / self.width);
                                    // Different events based on element?
                                    // For MVP, generic "Destruction" event or specific if we passed it back
                                    self.push_event(21, tx as u8, ty as u8, 200); 
                             }
                             bonus_score += 300;
                        },
                        InteractionType::Generation(target_idxs) => {
                             // Effect: Generation
                             for &t_idx in &target_idxs {
                                 // Simple logic: Convert to next element or Special?
                                 // Implementation from before:
                                 // Wood feeds Fire -> Fire Spread (Convert to Fire)
                                 // Metal gens Water -> Water Spawn (Convert to Water)
                                 // Water nourishes Wood -> Growth (Power up)
                                 
                                 if m.element == 2 { // Wood -> Fire
                                     cells_to_clear.remove(&t_idx); // Don't clear!
                                     self.cells[t_idx].element = 4; // Fire
                                     let (tx, ty) = (t_idx % self.width, t_idx / self.width);
                                     self.push_event(32, tx as u8, ty as u8, 200);
                                 } else if m.element == 1 { // Metal -> Water
                                     // Convert neighbor
                                     self.cells[t_idx].element = 3;
                                     let (tx, ty) = (t_idx % self.width, t_idx / self.width);
                                     self.push_event(31, tx as u8, ty as u8, 200);
                                 } else if m.element == 3 { // Water -> Wood
                                      cells_to_clear.remove(&t_idx);
                                      self.cells[t_idx].element = 2;
                                      self.cells[t_idx].flags |= 1; // Power
                                      let (tx, ty) = (t_idx % self.width, t_idx / self.width);
                                      self.push_event(33, tx as u8, ty as u8, 200);
                                 }
                             }
                             bonus_score += 200;
                        },
                        InteractionType::None => {
                            // Normal match, already added to cells_to_clear
                        }
                    }
                    
                    self.match_queue.push(m.element);
                    
                    // --- PROCESS CYCLE ---
                    let (cycle_hit, mult) = self.cycle.process_match(m.element);
                    
                    // Base score = 100 * Multiplier
                    self.score += 100 * mult;
                    
                    // If Cycle Hit (Visual Feedback)
                    // We can emit a special event for cycle hit?
                    // Event Type 50 = Cycle Hit, 51 = Cycle Broken?
                    if cycle_hit {
                        // Element 255 = System Event? Or just reuse element type but with high intensity?
                        // Let's use Type 50 for "Cycle Progress"
                        let (cx, cy) = (m.center_idx % self.width, m.center_idx / self.width);
                        self.push_event(50, cx as u8, cy as u8, self.cycle.chain_length as u8);
                        
                        if self.cycle.chain_length == 5 {
                            // AVATAR STATE / FULL CYCLE
                            // Huge bonus or screen clear?
                            // For now, just a massive event
                            self.push_event(55, cx as u8, cy as u8, 255);
                        }
                    }
                }
                
                self.score += bonus_score;

                // Execute Clears
                for idx in cells_to_clear {
                    if self.cells[idx].element != 0 { // Check if already cleared
                        let (x, y) = (idx % self.width, idx / self.width);
                        // Emit default clear event if no special interaction covered it?
                        // We can just emit a "Pop" event (Type 0 or special 99?)
                        // Client can handle "Element 0 event" as "Pop".
                        // Use Type=0 for "Clear Poof"
                        self.push_event(self.cells[idx].element, x as u8, y as u8, 50); 
                        self.cells[idx] = Cell { element: 0, flags: 0 };
                    }
                }

                self.is_stable = false;
            } else {
                self.is_stable = true;
            }
        } else {
            self.is_stable = false;
        }
    }

    // --- INTERNAL HELPERS ---

    // --- INTERNAL HELPERS ---

    fn randomize(&mut self) {
        for i in 0..self.cells.len() {
            let val = self.rng.gen_range(1..=5);
            self.cells[i] = Cell { element: val, flags: 0 };
        }
        // Remove matches
        loop {
            let matches = self.find_all_matches();
            if matches.is_empty() { break; }
            for m in matches {
                for idx in m.cells {
                   // Deterministic shift
                   self.cells[idx].element = (self.cells[idx].element % 5) + 1;
                }
            }
        }
    }

    // Kiểm tra match tại 1 điểm (dùng cho swap check)
    fn check_matches_at(&self, idx: usize) -> bool {
        let x = idx % self.width;
        let y = idx / self.width;
        let element = self.cells[idx].element;
        if element == 0 { return false; }

        // Check Ngang
        let mut count_h = 1;
        // Trái
        let mut i = x;
        while i > 0 && self.cells[y * self.width + i - 1].element == element {
            count_h += 1; i -= 1;
        }
        // Phải
        let mut i = x;
        while i < self.width - 1 && self.cells[y * self.width + i + 1].element == element {
            count_h += 1; i += 1;
        }

        if count_h >= 3 { return true; }

        // Check Dọc
        let mut count_v = 1;
        // Lên
        let mut i = y;
        while i > 0 && self.cells[(i - 1) * self.width + x].element == element {
            count_v += 1; i -= 1;
        }
        // Xuống
        let mut i = y;
        while i < self.height - 1 && self.cells[(i + 1) * self.width + x].element == element {
            count_v += 1; i += 1;
        }

        count_v >= 3
    }

    // --- MATCHING SYSTEM ---

    // Tìm tất cả các cụm match (Connected Components)
    pub(crate) fn find_all_matches(&self) -> Vec<MatchResult> {
        let mut checked = vec![false; self.width * self.height];
        let mut results = Vec::new();

        // 1. Quét tìm tất cả các cặp match cơ bản (Horizontal & Vertical)
        let mut h_matches: Vec<Vec<usize>> = Vec::new();
        let mut v_matches: Vec<Vec<usize>> = Vec::new();

        // Check Ngang
        for y in 0..self.height {
            let mut x = 0;
            while x < self.width - 2 {
                let idx = y * self.width + x;
                let el = self.cells[idx].element;
                if el == 0 { x += 1; continue; }

                let mut k = x + 1;
                while k < self.width && self.cells[y * self.width + k].element == el {
                    k += 1;
                }
                
                if k - x >= 3 {
                    // Found match [x..k]
                    let mut match_idxs = Vec::new();
                    for i in x..k { match_idxs.push(y * self.width + i); }
                    h_matches.push(match_idxs);
                }
                x = k; // Jump
            }
        }

        // Check Dọc
        for x in 0..self.width {
            let mut y = 0;
            while y < self.height - 2 {
                let idx = y * self.width + x;
                let el = self.cells[idx].element;
                if el == 0 { y += 1; continue; }

                let mut k = y + 1;
                while k < self.height && self.cells[k * self.width + x].element == el {
                    k += 1;
                }

                if k - y >= 3 {
                    let mut match_idxs = Vec::new();
                    for i in y..k { match_idxs.push(i * self.width + x); }
                    v_matches.push(match_idxs);
                }
                y = k;
            }
        }

        // 2. Merge intersects (Graph Cluster)
        // Nếu 1 cell thuộc cả H-Match và V-Match -> Cross/T/L
        // Ta dùng Union-Find hoặc BFS đơn giản để gom cụm.
        
        if h_matches.is_empty() && v_matches.is_empty() {
             return results;
        }

        // Convert matches to a Map of Cell -> ClusterID
        let mut parent: Vec<usize> = (0..self.cells.len()).collect();
        let mut active_nodes = std::collections::HashSet::new();

        // Helper find root
        // Note: Rust ownership makes recursive closure tricky, using iterative
        // To simplify: we just build an adjacency list for cells involved in ANY match
        
        // Let's use a simpler approach:
        // Mark all matched cells with bitflags in a temp array saying "Part of H match" or "Part of V match"
        // Then run BFS on them to group connected components.
        
        let mut cell_flags = vec![0u8; self.width * self.height]; // 1=H, 2=V
        
        for m in &h_matches { for &idx in m { cell_flags[idx] |= 1; active_nodes.insert(idx); } }
        for m in &v_matches { for &idx in m { cell_flags[idx] |= 2; active_nodes.insert(idx); } }

        let mut visited = vec![false; self.width * self.height];

        for &start_idx in &active_nodes {
            if visited[start_idx] { continue; }
            
            // Start BFS for a new Cluster
            let mut cluster_cells = Vec::new();
            let mut queue = std::collections::VecDeque::new();
            queue.push_back(start_idx);
            visited[start_idx] = true;
            let element_type = self.cells[start_idx].element;

            let mut min_x = start_idx % self.width;
            let mut max_x = min_x;
            let mut min_y = start_idx / self.width;
            let mut max_y = min_y;

            let mut has_h = false;
            let mut has_v = false;

            while let Some(curr) = queue.pop_front() {
                cluster_cells.push(curr);
                
                let cx = curr % self.width;
                let cy = curr / self.width;

                if cx < min_x { min_x = cx; }
                if cx > max_x { max_x = cx; }
                if cy < min_y { min_y = cy; }
                if cy > max_y { max_y = cy; }

                if (cell_flags[curr] & 1) != 0 { has_h = true; }
                if (cell_flags[curr] & 2) != 0 { has_v = true; }

                // Neighbors (check if they are active_nodes AND same element - though Set ensures active)
                // Check Up/Down/Left/Right
                let neighbors = [
                    if cy > 0 { Some(curr - self.width) } else { None },
                    if cy < self.height - 1 { Some(curr + self.width) } else { None },
                    if cx > 0 { Some(curr - 1) } else { None },
                    if cx < self.width - 1 { Some(curr + 1) } else { None },
                ];

                for n in neighbors.iter().flatten() {
                    if active_nodes.contains(n) && !visited[*n] && self.cells[*n].element == element_type {
                        visited[*n] = true;
                        queue.push_back(*n);
                    }
                }
            }

            // Determine Pattern
            let width_span = max_x - min_x + 1;
            let height_span = max_y - min_y + 1;
            let count = cluster_cells.len();
            
            let pattern = if has_h && has_v {
                MatchPattern::Cross // Covers T, L, +
                // Could Refine: If width>=3 and height>=3 fully filled -> Area? 
                // For now, Cross is high priority
            } else if width_span >= 5 || height_span >= 5 {
                MatchPattern::Line5
            } else if width_span >= 4 || height_span >= 4 {
                MatchPattern::Line4
            } else {
                MatchPattern::Line3 // Simple 3 match
            };

            // Calculate Center (Geometric)
            let center_x = (min_x + max_x) / 2;
            let center_y = (min_y + max_y) / 2;
            let center_idx = center_y * self.width + center_x;

            results.push(MatchResult {
                pattern,
                element: element_type,
                cells: cluster_cells,
                center_idx,
            });
        }

        results
    }

    // --- BIT PACKING MAGIC ---
    // Đóng gói data sự kiện vào 1 số u32 duy nhất
    fn push_event(&mut self, type_id: u8, x: u8, y: u8, intensity: u8) {
        // Layout: [Type (8) | X (8) | Y (8) | Intensity (8)]
        // Ví dụ: Fire (4) tại (3,5) cường độ Max (255)
        // 0x040305FF
        let data: u32 = ((type_id as u32) << 24) 
                      | ((x as u32) << 16) 
                      | ((y as u32) << 8) 
                      | (intensity as u32);
        self.events.push(data);
    }
    // --- ANTI-CHEAT: DETERMINISTIC REPLAY ---
    
    // Static validation method
    // moves: [x1, y1, x2, y2, ...]
    pub fn validate_replay(width: usize, height: usize, seed: u64, moves: &[u8]) -> u32 {
        let mut grid = GridState::new(width, height, seed);
        
        let mut i = 0;
        while i < moves.len() {
             if i + 4 > moves.len() { break; }
             let x1 = moves[i] as usize;
             let y1 = moves[i+1] as usize;
             let x2 = moves[i+2] as usize;
             let y2 = moves[i+3] as usize;
             i += 4;
             
             let idx1 = y1 * width + x1;
             let idx2 = y2 * width + x2;
             
             // Try Swap
             if grid.try_swap(idx1, idx2) {
                 // If swap success (match made), Run simulation until stable
                 let mut ticks = 0;
                 let max_ticks = 1000; // prevents infinite loop
                 while !grid.is_stable && ticks < max_ticks {
                     grid.tick();
                     ticks += 1;
                 }
             }
         }
        
        grid.score
    }

    // --- CYCLE SYSTEM API ---

    pub fn get_cycle_target(&self) -> u8 {
        self.cycle.target
    }

    pub fn get_cycle_chain(&self) -> u32 {
        self.cycle.chain_length
    }

    pub fn get_cycle_multiplier(&self) -> u32 {
        self.cycle.multiplier
    }
}

// --- PREVIEW SYSTEM ---
#[derive(Debug)]
enum InteractionType {
    None,
    Destruction(Vec<usize>), // Affected cells
    Generation(Vec<usize>),  // Affected cells
}

impl GridState {
    fn analyze_match_interaction(&self, m: &MatchResult) -> InteractionType {
         // Identify Neighbors
         let mut neighbors = Vec::new();
         for &c_idx in &m.cells {
              let cx = c_idx % self.width;
              let cy = c_idx / self.width;
              let n_idxs = [
                 if cy > 0 { Some(c_idx - self.width) } else { None },
                 if cy < self.height - 1 { Some(c_idx + self.width) } else { None },
                 if cx > 0 { Some(c_idx - 1) } else { None },
                 if cx < self.width - 1 { Some(c_idx + 1) } else { None },
             ];
             for n in n_idxs.iter().flatten() {
                 if !m.cells.contains(n) && self.cells[*n].element != 0 && self.cells[*n].element != 10 { 
                     neighbors.push(*n);
                 }
             }
         }

         let mut affected = Vec::new();

         // 1. Metal (1) cuts Wood (2) -> Cross Clear
         if m.element == 1 && neighbors.iter().any(|&n| self.cells[n].element == 2) {
             let center_x = m.center_idx % self.width;
             let center_y = m.center_idx / self.width;
             for x in 0..self.width { affected.push(center_y * self.width + x); }
             for y in 0..self.height { affected.push(y * self.width + center_x); }
             return InteractionType::Destruction(affected);
         }
         
         // 2. Wood (2) breaks Earth (5) -> Line Clear (Row)
         if m.element == 2 && neighbors.iter().any(|&n| self.cells[n].element == 5) {
             let center_y = m.center_idx / self.width;
             for x in 0..self.width { affected.push(center_y * self.width + x); }
             return InteractionType::Destruction(affected);
         }

         // 3. Water (3) quenches Fire (4) -> Area Clear (3x3)
         if m.element == 3 && neighbors.iter().any(|&n| self.cells[n].element == 4) {
             let cx = (m.center_idx % self.width) as isize;
             let cy = (m.center_idx / self.width) as isize;
             for dy in -1..=1 {
                 for dx in -1..=1 {
                     let nx = cx + dx;
                     let ny = cy + dy;
                     if nx >= 0 && nx < self.width as isize && ny >= 0 && ny < self.height as isize {
                         affected.push((ny as usize) * self.width + (nx as usize));
                     }
                 }
             }
             return InteractionType::Destruction(affected);
         }

          // 4. Fire (4) melts Metal (1)
         if m.element == 4 && neighbors.iter().any(|&n| self.cells[n].element == 1) {
             for &n in &neighbors {
                 if self.cells[n].element == 1 { affected.push(n); }
             }
             return InteractionType::Destruction(affected);
         }

         // 5. Earth (5) absorbs Water (3)
         if m.element == 5 && neighbors.iter().any(|&n| self.cells[n].element == 3) {
             for &n in &neighbors {
                 if self.cells[n].element == 3 { affected.push(n); }
             }
             return InteractionType::Destruction(affected); // Or conversion? Let's classify as Destruction for now for red glow
         }

         // GENERATION
         // 6. Wood (2) -> Fire (4)
         if m.element == 2 && neighbors.iter().any(|&n| self.cells[n].element == 4) {
             for &c in &m.cells { affected.push(c); }
             return InteractionType::Generation(affected);
         }

         // 7. Metal (1) -> Water (3)
         if m.element == 1 && neighbors.iter().any(|&n| self.cells[n].element == 3) {
             for &n in &neighbors {
                 if self.cells[n].element != 3 && self.cells[n].element <= 5 { affected.push(n); }
             }
             return InteractionType::Generation(affected);
         }

         // 8. Water (3) -> Wood (2)
         if m.element == 3 && neighbors.iter().any(|&n| self.cells[n].element == 2) {
             affected.push(m.center_idx);
             return InteractionType::Generation(affected);
         }

         InteractionType::None
    }

    pub fn preview_swap(&mut self, idx1: usize, idx2: usize) -> Vec<u32> {
        // Return protocol: [CellIdx, Type, CellIdx, Type...]
        // Type: 1 = Destruction (Red), 2 = Generation (Green)
        
        if idx1 >= self.cells.len() || idx2 >= self.cells.len() { return vec![]; }
        if idx1 == idx2 { return vec![]; }
        
        let mut result = Vec::new();
        
        // 1. Temporarily Swap
        self.cells.swap(idx1, idx2);
        
        // 2. Find matches
        let matches = self.find_all_matches();
        
        // 3. Analyze
        for m in matches {
            let interaction = self.analyze_match_interaction(&m);
            match interaction {
                InteractionType::Destruction(idxs) => {
                    for idx in idxs {
                        result.push(idx as u32);
                        result.push(1); // Destruction
                    }
                },
                InteractionType::Generation(idxs) => {
                    for idx in idxs {
                        result.push(idx as u32);
                        result.push(2); // Generation
                    }
                },
                InteractionType::None => {}
            }
        }
        
        // 4. Swap Lock
        self.cells.swap(idx1, idx2);
        
        result
    }
}

// --- CYCLE SYSTEM LOGIC ---

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct CycleState {
    pub target: u8,        // ElementType (1-5)
    pub chain_length: u32,
    pub multiplier: u32,
}

impl CycleState {
    pub fn new() -> Self {
        Self {
            target: 3, // Start with WATER (3)
            chain_length: 0,
            multiplier: 1,
        }
    }

    // Check if match continues cycle
    // Returns: (is_success, multiplier_applied)
    pub fn process_match(&mut self, element: u8) -> (bool, u32) {
        if element == self.target {
            // SUCCESS
            self.chain_length += 1;
            self.multiplier += 1;
            
            // Advance Target: Water(3) -> Wood(2) -> Fire(4) -> Earth(5) -> Metal(1) -> Water(3)
            self.target = match self.target {
                3 => 2, // Water -> Wood
                2 => 4, // Wood -> Fire
                4 => 5, // Fire -> Earth
                5 => 1, // Earth -> Metal
                1 => 3, // Metal -> Water
                _ => 3, // Fallback
            };
            
            return (true, self.multiplier);
        } else {
            // BROKEN
            self.reset();
            return (false, 1);
        }
    }
    
    pub fn reset(&mut self) {
        self.chain_length = 0;
        self.multiplier = 1;
        self.target = 3; // Reset to Water
    }
}
