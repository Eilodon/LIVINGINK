export default `// GRADIENT SUBTRACTION SHADER (WGSL)

struct Uniforms {
    dt: f32,
    resolution: vec2<f32>,
    dissipation: f32,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var pressureTex: texture_2d<f32>;
@group(0) @binding(2) var velocityTex: texture_2d<f32>;
@group(0) @binding(3) var resultTex: texture_storage_2d<rgba16float, write>;
@group(0) @binding(4) var mySampler: sampler;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let id = vec2<i32>(global_id.xy);
    let size = textureDimensions(velocityTex);
    
    if (id.x >= i32(size.x) || id.y >= i32(size.y)) {
        return;
    }

    let uv = (vec2<f32>(id) + 0.5) / u.resolution;
    let texelSize = 1.0 / u.resolution;

    // Pressure Gradients
    let L = textureSampleLevel(pressureTex, mySampler, uv - vec2<f32>(texelSize.x, 0.0), 0.0).x;
    let R = textureSampleLevel(pressureTex, mySampler, uv + vec2<f32>(texelSize.x, 0.0), 0.0).x;
    let T = textureSampleLevel(pressureTex, mySampler, uv - vec2<f32>(0.0, texelSize.y), 0.0).x;
    let B = textureSampleLevel(pressureTex, mySampler, uv + vec2<f32>(0.0, texelSize.y), 0.0).x;

    // Current Velocity
    let velocity = textureSampleLevel(velocityTex, mySampler, uv, 0.0).xy;

    // Subtract Gradient
    let newVelocity = velocity - 0.5 * vec2<f32>(R - L, B - T);

    textureStore(resultTex, id, vec4<f32>(newVelocity, 0.0, 1.0));
}
`;
