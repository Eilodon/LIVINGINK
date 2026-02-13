// Unity-style HLSL shader for PixiJS WebGL
export const InkBleedShader = `
precision mediump float;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform float uTime;
uniform float uIntensity;
uniform vec4 uInkColor;

varying vec2 vTexCoord;

// Simple fluid simulation
vec4 FluidSimulation(vec2 uv) {
    vec4 color = texture2D(uTexture, uv);
    
    // Diffusion
    vec4 diffusion = vec4(0.0);
    // GLSL 100 ES compatible array kernel is tricky. 
    // We'll use manual expanded sampling for compatibility if needed.
    // But assuming WebGL 2 or sufficient extension support for array constructors.
    // If it fails, we will rewrite.
    // For now using provided code.
    float kernel[9];
    kernel[0] = 0.0; kernel[1] = 0.2; kernel[2] = 0.0;
    kernel[3] = 0.2; kernel[4] = 0.2; kernel[5] = 0.2;
    kernel[6] = 0.0; kernel[7] = 0.2; kernel[8] = 0.0;
    
    for(int i = 0; i < 9; i++) {
        // float(int) cast requires strictness in some versions
        vec2 offset = vec2(float(i - 3 * (i / 3) - 1), float(i / 3 - 1)) / uResolution;
        diffusion += texture2D(uTexture, uv + offset) * kernel[i];
    }
    
    // Bleed effect
    float bleed = sin(uTime * 2.0 + uv.x * 10.0 + uv.y * 10.0) * 0.1;
    vec4 bledColor = mix(color, uInkColor, bleed * uIntensity);
    
    return bledColor;
}

void main() {
    vec2 uv = vTexCoord;
    gl_FragColor = FluidSimulation(uv);
}
`;
