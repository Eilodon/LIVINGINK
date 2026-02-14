export default `
struct Uniforms {
    uTime: f32,
    uDt: f32,
    uDissipation: f32,
    uSimRes: vec2f,
};

@group(0) @binding(0) var uVelocity: texture_2d<f32>;
@group(0) @binding(1) var uSource: texture_2d<f32>; // Quantity to advect (Density or Velocity)
@group(0) @binding(2) var uSampler: sampler;
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
    // 1. Get Velocity at current position
    let velocity = textureSample(uVelocity, uSampler, uv).xy;

    // 2. Backtrace
    // texelSize = 1.0 / uSimRes
    let texelSize = 1.0 / uniforms.uSimRes;
    
    // coord_back = uv - dt * velocity * texelSize
    // We assume velocity is in 'grid cells per second' or similar, scaled by resolution
    // Standard advection: pos - vel * dt
    let coord = uv - velocity * uniforms.uDt * texelSize;

    // 3. Sample Source at backtraced position
    let result = textureSample(uSource, uSampler, coord);

    // 4. Dissipation
    let decay = 1.0 / (1.0 + uniforms.uDissipation * uniforms.uDt);
    return result * decay;
}
`;
