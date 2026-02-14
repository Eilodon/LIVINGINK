export default `
struct Uniforms {
    uSimRes: vec2f,
    uAlpha: f32, // -dx^2 
    uBeta: f32,  // 4
};

@group(0) @binding(0) var uPressure: texture_2d<f32>;   // Previous iteration/Guess
@group(0) @binding(1) var uDivergence: texture_2d<f32>; // b
@group(0) @binding(2) var uSampler: sampler;
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
    let texelSize = 1.0 / uniforms.uSimRes;

    let L = textureSample(uPressure, uSampler, uv - vec2f(texelSize.x, 0.0)).x;
    let R = textureSample(uPressure, uSampler, uv + vec2f(texelSize.x, 0.0)).x;
    let T = textureSample(uPressure, uSampler, uv + vec2f(0.0, texelSize.y)).x;
    let B = textureSample(uPressure, uSampler, uv - vec2f(0.0, texelSize.y)).x;
    
    let bC = textureSample(uDivergence, uSampler, uv).x;

    // Jacobi iteration: (L + R + T + B + alpha * b) / beta
    let pNew = (L + R + T + B + uniforms.uAlpha * bC) * (1.0 / uniforms.uBeta);

    return vec4f(pNew, 0.0, 0.0, 1.0);
}
`;
