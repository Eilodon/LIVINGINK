use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

// PCG32 Implementation
// State: 64-bit
// Output: 32-bit
// Period: 2^64
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct Pcg32 {
    state: u64,
    inc: u64,
}

impl Pcg32 {
    pub fn new(seed: u64, seq: u64) -> Self {
        let mut rng = Self {
            state: 0,
            inc: (seq << 1) | 1,
        };
        rng.next_u32();
        rng.state = rng.state.wrapping_add(seed);
        rng.next_u32();
        rng
    }

    pub fn seed_from_u64(seed: u64) -> Self {
        Self::new(seed, 0xda3e39cb94b95bdb)
    }

    pub fn next_u32(&mut self) -> u32 {
        let oldstate = self.state;
        // Advance internal state
        self.state = oldstate.wrapping_mul(6364136223846793005).wrapping_add(self.inc);
        // Calculate output function (XSH-RR), uses old state for max ILP
        let xorshifted = (((oldstate >> 18) ^ oldstate) >> 27) as u32;
        let rot = (oldstate >> 59) as u32;
        xorshifted.rotate_right(rot)
    }

    pub fn next_u64(&mut self) -> u64 {
        let lo = self.next_u32() as u64;
        let hi = self.next_u32() as u64;
        (hi << 32) | lo
    }

    // Range [min, max)
    pub fn gen_range(&mut self, range: std::ops::Range<usize>) -> usize {
        let min = range.start as u32;
        let max = range.end as u32;
        if min >= max { return min as usize; }
        
        // Simple modulo for now, assuming range is small compared to u32
        // For distinct uniformity we would use rejection sampling, but for game logic standard modulo is often acceptable if range is small.
        // However, standard Pcg methods exist.
        // Let's use a simple bound method to be safe.
        let distinct_range = max - min;
        let threshold = (0u32.wrapping_sub(distinct_range)) % distinct_range;
        
        loop {
            let r = self.next_u32();
            if r >= threshold {
                return (min + (r % distinct_range)) as usize;
            }
        }
    }
    
    // Float 0.0..1.0
    pub fn gen_float(&mut self) -> f32 {
         (self.next_u32() >> 8) as f32 * (1.0 / 16777216.0)
    }
}
