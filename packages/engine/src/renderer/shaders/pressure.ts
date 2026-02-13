export default `// PRESSURE SOLVER SHADER (WGSL) - Jacobi Iteration

struct Uniforms {
    dt: f32,
    resolution: vec2<f32>,
    dissipation: f32,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var pressureTex: texture_2d<f32>;     // Previous pressure state
@group(0) @binding(2) var divergenceTex: texture_2d<f32>;   // Divergence field
@group(0) @binding(3) var resultTex: texture_storage_2d<rgba16float, write>; // New pressure state
@group(0) @binding(4) var mySampler: sampler;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let id = vec2<i32>(global_id.xy);
    let size = textureDimensions(pressureTex);
    
    if (id.x >= i32(size.x) || id.y >= i32(size.y)) {
        return;
    }

    let uv = (vec2<f32>(id) + 0.5) / u.resolution;
    let texelSize = 1.0 / u.resolution;

    // Divergence at center
    let div = textureSampleLevel(divergenceTex, mySampler, uv, 0.0).x;

    // Pressure Neighbors
    let L = textureSampleLevel(pressureTex, mySampler, uv - vec2<f32>(texelSize.x, 0.0), 0.0).x;
    let R = textureSampleLevel(pressureTex, mySampler, uv + vec2<f32>(texelSize.x, 0.0), 0.0).x;
    let T = textureSampleLevel(pressureTex, mySampler, uv - vec2<f32>(0.0, texelSize.y), 0.0).x; // Note: Y-axis flip conventions may vary
    let B = textureSampleLevel(pressureTex, mySampler, uv + vec2<f32>(0.0, texelSize.y), 0.0).x;

    // Poisson equation solution for this iteration
    let newPressure = (L + R + T + B - div) * 0.25;

    textureStore(resultTex, id, vec4<f32>(newPressure, 0.0, 0.0, 1.0));
}
`;
