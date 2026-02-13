/*
 * INJECTION SHADER
 * Injects gameplay events (explosions, movements) into the fluid simulation.
 * Updates Velocity and Density textures.
 */

struct FluidEvent {
    x: f32,
    y: f32,
    element: u32,  // 1=Metal, 2=Wood, 3=Water, 4=Fire, 5=Earth
    intensity: f32,
}

struct Uniforms {
    dt: f32,
    resX: f32,
    resY: f32,
    damping: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var velocityTex: texture_storage_2d<rgba16float, write>; // or read_write if supported, but usually ping-pong
@group(0) @binding(2) var densityTex: texture_storage_2d<rgba16float, write>;
// We need to READ current state to add to it? 
// Actually, standard fluid sims add to 'source' or 'density' field.
// If we can't read_write, we might need a separate pass or use the 'read' texture from previous step?
// FluidRenderer uses ping-pong. 
// Let's assume we are writing to the "write" texture, adding to what's already there?
// No, standard compute shader replaces check.
// Better approach: We bind the 'Read' texture as input, and 'Write' as output.
// But we want to ADD to the advected field?
// Typically: Advect -> Inject -> Diffuse -> Project.
// So Inject takes Advected(Read) and writes to (Write)?
// Or Inject is just "Add Force" step.
// Let's try to bind:
// 1: Velocity Read (texture_2d<f32>)
// 2: Density Read (texture_2d<f32>)
// 3: Velocity Write (texture_storage_2d)
// 4: Density Write (texture_storage_2d)
// ... and Events buffer.

// But wait, we can't have too many storage textures?
// Let's simplify. We can use `textureLoad` from Read and `textureStore` to Write.

@group(0) @binding(1) var velocityRead: texture_2d<f32>;
@group(0) @binding(2) var densityRead: texture_2d<f32>;
@group(0) @binding(3) var velocityWrite: texture_storage_2d<rgba16float, write>;
@group(0) @binding(4) var densityWrite: texture_storage_2d<rgba16float, write>;

struct EventBuffer {
    count: u32,
    events: array<FluidEvent>,
}

@group(0) @binding(5) var<storage, read> eventData: EventBuffer;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let pos = vec2<i32>(id.xy);
    let uv = vec2<f32>(pos) / vec2<f32>(uniforms.resX, uniforms.resY);
    
    if (f32(pos.x) >= uniforms.resX || f32(pos.y) >= uniforms.resY) {
        return;
    }

    // Load current state
    var vel = textureLoad(velocityRead, pos, 0).xy;
    var dens = textureLoad(densityRead, pos, 0);

    // Process Events
    let count = eventData.count; // Wait, struct alignment?
    // Rust FluidEvent is { x, y, element, intensity }.
    // We need to ensure alignment in Rust matches WGSL.
    // u32 is 4 bytes. f32 is 4 bytes.
    // Struct is 16 bytes.
    // EventBuffer { count (4), padding(12?), events array... }
    // Let's assume we pass raw array of floats and manual parse or proper buffer layout.
    // For MVP, let's assume we pass a mapped buffer matching this struct.

    for (var i = 0u; i < count; i++) {
        let evt = eventData.events[i];
        
        // Convert Grid Coords (0..W, 0..H) to Pixel Coords?
        // Rust sends Grid Coords (e.g. 3, 4).
        // Uniforms.resX is pixel resolution (e.g. 800).
        // We need Grid Dimensions in Uniforms or Hardcoded?
        // Let's assume 8x8 grid for now or pass in uniform.
        // Or assume Rust sends Normalized coords (0..1)?
        // Ref: GridSystem said "let's store grid coords as f32".
        // Let's map Grid Coords to UV.
        // 8x8 Grid.
        let gridW = 8.0; 
        let gridH = 8.0;
        
        // Distance check in Normalized space?
        let cellUV = vec2<f32>(evt.x + 0.5, evt.y + 0.5) / vec2<f32>(gridW, gridH);
        
        let dist = distance(uv, cellUV); // 0..1 distance
        
        // Radius of influence (one cell size approx 1/8 = 0.125)
        let radius = 0.15 * evt.intensity;

        if (dist < radius) {
            let falloff = 1.0 - (dist / radius);
            let force = falloff * evt.intensity;

            // Apply Elemental Effects
            if (evt.element == 4u) { // FIRE
                // Red color, Upward velocity
                dens = dens + vec4<f32>(1.0, 0.2, 0.1, 0.0) * force * 2.0;
                vel = vel + vec2<f32>(0.0, -1.0) * force * 5.0; // Up
            }
            else if (evt.element == 3u) { // WATER
                // Blue color, Implosion/Swirl?
                dens = dens + vec4<f32>(0.1, 0.2, 1.0, 0.0) * force * 2.0;
                // Swirl
                let dir = normalize(uv - cellUV);
                let tangent = vec2<f32>(-dir.y, dir.x);
                vel = vel + tangent * force * 5.0;
            }
            else if (evt.element == 1u) { // METAL
                // Gold/Silver, Heavy?
                dens = dens + vec4<f32>(0.8, 0.8, 0.9, 0.0) * force * 2.0;
                // No velocity change, just density? Or heavy (down)?
                vel = vel + vec2<f32>(0.0, 1.0) * force * 2.0;
            }
            else if (evt.element == 2u) { // WOOD
                // Green, Static?
                dens = dens + vec4<f32>(0.1, 0.8, 0.2, 0.0) * force * 2.0;
            }
            else if (evt.element == 5u) { // EARTH
                // Brown, Shockwave (Outward)
                dens = dens + vec4<f32>(0.6, 0.4, 0.2, 0.0) * force * 2.0;
                let dir = normalize(uv - cellUV);
                vel = vel + dir * force * 10.0;
            }
        }
    }

    // Write back
    textureStore(velocityWrite, pos, vec4<f32>(vel, 0.0, 0.0));
    textureStore(densityWrite, pos, dens);
}
