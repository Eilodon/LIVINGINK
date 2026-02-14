export default `
struct Uniforms {
    uSimRes: vec2f,
};

@group(0) @binding(0) var uPressure: texture_2d<f32>;
@group(0) @binding(1) var uVelocity: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
    let texelSize = 1.0 / uniforms.uSimRes;

    let L = textureSample(uPressure, uSampler, uv - vec2f(texelSize.x, 0.0)).x;
    let R = textureSample(uPressure, uSampler, uv + vec2f(texelSize.x, 0.0)).x;
    let T = textureSample(uPressure, uSampler, uv + vec2f(0.0, texelSize.y)).x;
    let B = textureSample(uPressure, uSampler, uv - vec2f(0.0, texelSize.y)).x;

    let vOld = textureSample(uVelocity, uSampler, uv).xy;

    // Subtract gradient of pressure
    // vNew = vOld - 0.5 * vec2(R-L, T-B)
    let grad = vec2f(R - L, T - B) * 0.5;
    let vNew = vOld - grad;

    return vec4f(vNew, 0.0, 1.0);
}
`;
