// ADVECTION SHADER (WGSL)
// Moves quantities (density, velocity) along the velocity field.

struct Uniforms {
    dt: f32,
    resolution: vec2<f32>,
    dissipation: f32,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var velocityTex: texture_2d<f32>;
@group(0) @binding(2) var sourceTex: texture_2d<f32>; // Quantity to advect (Density or Velocity)
@group(0) @binding(3) var resultTex: texture_storage_2d<rgba16float, write>;
@group(0) @binding(4) var mySampler: sampler;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let id = vec2<i32>(global_id.xy);
    let size = textureDimensions(sourceTex);
    
    if (id.x >= i32(size.x) || id.y >= i32(size.y)) {
        return;
    }

    let coords = vec2<f32>(id) + 0.5;
    let uv = coords / u.resolution;

    // 1. Sample Velocity at current position
    let velocity = textureSampleLevel(velocityTex, mySampler, uv, 0.0).xy;

    // 2. Backtrace: "Where was this particle dt seconds ago?"
    let previousPos = coords - velocity * u.dt * 10.0; // Scale factor for visual speed
    let previousUV = previousPos / u.resolution;

    // 3. Sample the quantity from that previous position (Semi-Lagrangian)
    let advectedValue = textureSampleLevel(sourceTex, mySampler, previousUV, 0.0);

    // 4. Apply Dissipation (Fade out over time)
    let result = advectedValue * u.dissipation;

    textureStore(resultTex, id, result);
}
