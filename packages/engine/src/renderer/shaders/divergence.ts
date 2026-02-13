export default `// DIVERGENCE SHADER (WGSL)

struct Uniforms {
    dt: f32,
    resolution: vec2<f32>,
    dissipation: f32,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var velocityTex: texture_2d<f32>;
@group(0) @binding(2) var divergenceTex: texture_storage_2d<rgba16float, write>;
@group(0) @binding(3) var mySampler: sampler;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let id = vec2<i32>(global_id.xy);
    let size = textureDimensions(velocityTex);
    
    if (id.x >= i32(size.x) || id.y >= i32(size.y)) {
        return;
    }

    let uv = (vec2<f32>(id) + 0.5) / u.resolution;
    let texelSize = 1.0 / u.resolution;

    // Sample neighbors
    let L = textureSampleLevel(velocityTex, mySampler, uv - vec2<f32>(texelSize.x, 0.0), 0.0).x;
    let R = textureSampleLevel(velocityTex, mySampler, uv + vec2<f32>(texelSize.x, 0.0), 0.0).x;
    let T = textureSampleLevel(velocityTex, mySampler, uv - vec2<f32>(0.0, texelSize.y), 0.0).y;
    let B = textureSampleLevel(velocityTex, mySampler, uv + vec2<f32>(0.0, texelSize.y), 0.0).y;

    let div = 0.5 * (R - L + B - T);

    textureStore(divergenceTex, id, vec4<f32>(div, 0.0, 0.0, 1.0));
}
`;
