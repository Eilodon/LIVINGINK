struct Uniforms {
    dt: f32,
    width: f32,
    height: f32,
    dissipation: f32,
};

@group(0) @binding(0) var<uniform> params: Uniforms;
@group(0) @binding(1) var velocityInput: texture_2d<f32>;
@group(0) @binding(2) var sourceInput: texture_2d<f32>; // Quantity to advect (Density or Velocity)
@group(0) @binding(3) var outputTex: texture_storage_2d<rgba32float, write>;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let id = vec2<i32>(global_id.xy);
    let size = vec2<i32>(i32(params.width), i32(params.height));

    if (id.x >= size.x || id.y >= size.y) {
        return;
    }

    let uv = vec2<f32>(id) + 0.5;
    
    // Sample velocity at current position
    // Note: textures in compute shaders are not directly sampleable with bilinear filtering usually
    // unless we use a sampler and texture_sample_level. 
    // Here we might just load nearest or do manual bilinear if needed.
    // For simplicity in MVP, we might use textureLoad and simple logic, 
    // but Advection NEEDS backtracing.
    
    // Backtrace
    // We need to read from velocityInput as a sampled texture for smooth simulation
    // Ideally velocityInput is binding type texture_2d<f32> and we use a sampler.
    // BUT we defined it as texture_2d without sampler binding in code above?
    // Let's assume we can fetch. Reading directly is integer coord.
    
    let vel = textureLoad(velocityInput, id, 0).xy;
    let backtracedPos = uv - params.dt * vel;
    
    // Manual Bilinear Interpolation for backtraced value
    // (Since compute shaders + texture_sample_level requires float texture and sampler)
    // Writing manual bilinear for robustness:
    
    let center = backtracedPos - 0.5;
    let base = floor(center);
    let f = center - base;
    
    let baseI = vec2<i32>(base);
    
    let bl = textureLoad(sourceInput, clamp(baseI, vec2<i32>(0), size - 1), 0);
    let br = textureLoad(sourceInput, clamp(baseI + vec2<i32>(1, 0), vec2<i32>(0), size - 1), 0);
    let tl = textureLoad(sourceInput, clamp(baseI + vec2<i32>(0, 1), vec2<i32>(0), size - 1), 0);
    let tr = textureLoad(sourceInput, clamp(baseI + vec2<i32>(1, 1), vec2<i32>(0), size - 1), 0);
    
    let b = mix(bl, br, f.x);
    let t = mix(tl, tr, f.x);
    let newVal = mix(b, t, f.y);
    
    // Dissipation
    let finalVal = newVal * params.dissipation;
    
    textureStore(outputTex, id, finalVal);
}
