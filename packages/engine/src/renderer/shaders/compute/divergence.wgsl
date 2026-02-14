struct Uniforms {
    dt: f32, // Unused but kept for alignment/padding potential
    width: f32,
    height: f32,
    padding: f32,
};

@group(0) @binding(0) var<uniform> params: Uniforms;
@group(0) @binding(1) var velocityInput: texture_2d<f32>;
@group(0) @binding(2) var divergenceOutput: texture_storage_2d<rgba32float, write>;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let id = vec2<i32>(global_id.xy);
    let size = vec2<i32>(i32(params.width), i32(params.height));

    if (id.x >= size.x || id.y >= size.y) {
        return;
    }

    let L = textureLoad(velocityInput, clamp(id - vec2<i32>(1, 0), vec2<i32>(0), size - 1), 0).x;
    let R = textureLoad(velocityInput, clamp(id + vec2<i32>(1, 0), vec2<i32>(0), size - 1), 0).x;
    let B = textureLoad(velocityInput, clamp(id - vec2<i32>(0, 1), vec2<i32>(0), size - 1), 0).y;
    let T = textureLoad(velocityInput, clamp(id + vec2<i32>(0, 1), vec2<i32>(0), size - 1), 0).y;

    let div = 0.5 * (R - L + T - B);
    
    textureStore(divergenceOutput, id, vec4<f32>(div, 0.0, 0.0, 1.0));
}
