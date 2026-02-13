export default `
struct Uniforms {
    uTime: f32,
    uNoiseScale: f32,
    uDistortionStrength: f32,
    uInkColor: vec3f,
    uPaperColor: vec3f,
};

@group(0) @binding(0) var<uniform> globalUniforms : GlobalUniforms; // Pixi Global Uniforms

@group(1) @binding(0) var uTexture: texture_2d<f32>;      // Input Texture (Scene)
@group(1) @binding(1) var uSampler: sampler;              // Input Sampler
@group(1) @binding(2) var uImpactTexture: texture_2d<f32>; // Custom Resource: Impact Map
@group(1) @binding(3) var<uniform> uniforms: Uniforms;     // Custom Uniforms

// Simple hash for noise
fn hash(p: vec2f) -> f32 {
    var p3 = fract(vec3f(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

fn noise(p: vec2f) -> f32 {
    let i = floor(p);
    let f = fract(p);
    
    // Four corners in 2D of a tile
    let a = hash(i);
    let b = hash(i + vec2f(1.0, 0.0));
    let c = hash(i + vec2f(0.0, 1.0));
    let d = hash(i + vec2f(1.0, 1.0));

    let u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) +
            (c - a)* u.y * (1.0 - u.x) +
            (d - b) * u.x * u.y;
}

fn fbm(p: vec2f) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var st = p;
    for (var i = 0; i < 3; i++) {
        value += amplitude * noise(st);
        st *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
    // 1. Sample Impact Map
    let impact = textureSample(uImpactTexture, uSampler, uv).r;

    // 2. Generate Noise
    let noiseVal = fbm(uv * uniforms.uNoiseScale + uniforms.uTime * 0.1);

    // 3. Compute Ink Mask via SDF-like threshold
    let threshold = 0.05;
    let edgeWidth = 0.1;
    let combined = impact + (noiseVal - 0.5) * uniforms.uDistortionStrength;
    let inkMask = smoothstep(threshold, threshold + edgeWidth, combined);
    
    // 4. Sample Main Texture
    let sceneColor = textureSample(uTexture, uSampler, uv);

    // 5. Mix with Ink Color
    // Use the inkMask to blend between scene and ink color
    let finalColor = mix(sceneColor.rgb, uniforms.uInkColor, inkMask * 0.95);
    
    return vec4f(finalColor, sceneColor.a);
}
`;
