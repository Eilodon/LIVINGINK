export default `
struct Uniforms {
    uSimRes: vec2f,
};

@group(0) @binding(0) var uVelocity: texture_2d<f32>;
@group(0) @binding(1) var uSampler: sampler;
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
    let texelSize = 1.0 / uniforms.uSimRes;

    // Standard central difference
    let L = textureSample(uVelocity, uSampler, uv - vec2f(texelSize.x, 0.0)).x;
    let R = textureSample(uVelocity, uSampler, uv + vec2f(texelSize.x, 0.0)).x;
    let T = textureSample(uVelocity, uSampler, uv + vec2f(0.0, texelSize.y)).y;
    let B = textureSample(uVelocity, uSampler, uv - vec2f(0.0, texelSize.y)).y;

    // 0.5 * (R - L + T - B)
    let div = 0.5 * (R - L + T - B);

    return vec4f(div, 0.0, 0.0, 1.0);
}
`;
