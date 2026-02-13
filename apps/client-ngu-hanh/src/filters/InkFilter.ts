
import { Filter, GlProgram, GpuProgram } from 'pixi.js';

const vertexShader = `
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat3 projectionMatrix;

varying vec2 vTextureCoord;

void main(void) {
    gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
    vTextureCoord = aTextureCoord;
}
`;

// Simple FBM/Noise based Ink Shader
const fragmentShader = `
precision mediump float;

varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uTime;
uniform vec2 uResolution;

// Hash/Noise function
float random (in vec2 _st) {
    return fract(sin(dot(_st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

// 2D Noise
float noise (in vec2 _st) {
    vec2 i = floor(_st);
    vec2 f = fract(_st);

    // Four corners in 2D of a tile
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) +
            (c - a)* u.y * (1.0 - u.x) +
            (d - b) * u.x * u.y;
}

#define NUM_OCTAVES 5

float fbm ( in vec2 _st) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    // Rotate to reduce axial bias
    mat2 rot = mat2(cos(0.5), sin(0.5),
                    -sin(0.5), cos(0.50));
    for (int i = 0; i < NUM_OCTAVES; ++i) {
        v += a * noise(_st);
        _st = rot * _st * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

void main() {
    vec2 st = vTextureCoord;
    // Aspect ratio correction if needed, but texture coord is usually 0-1
    
    vec3 color = vec3(0.0);

    vec2 q = vec2(0.);
    q.x = fbm( st + 0.00*uTime);
    q.y = fbm( st + vec2(1.0));

    vec2 r = vec2(0.);
    r.x = fbm( st + 1.0*q + vec2(1.7,9.2)+ 0.15*uTime );
    r.y = fbm( st + 1.0*q + vec2(8.3,2.8)+ 0.126*uTime);

    float f = fbm(st+r);

    // Ink Color Palette (Dark/Mystical)
    vec3 c1 = vec3(0.1, 0.1, 0.1); // Deep Black/Grey
    vec3 c2 = vec3(0.2, 0.25, 0.3); // Slight Blue tint
    vec3 c3 = vec3(0.0, 0.0, 0.0); // Pure Black
    
    // Mix based on noise 'f'
    color = mix(c1, c2, clamp((f*f)*4.0,0.0,1.0));

    color = mix(color, c3, clamp(length(q),0.0,1.0));

    color = mix(color, vec3(0.1,0.1,0.1), clamp(length(r.x),0.0,1.0));

    // Output final color with alpha
    // We want the ink to be the background, so alpha 1.0 mostly
    // But let's allow some transparency if used as overlay
    
    gl_FragColor = vec4((f*f*f+.6*f*f+.5*f)*color,1.);
}
`;


export class InkFilter extends Filter {
    constructor() {
        super({
            glProgram: new GlProgram({
                vertex: vertexShader,
                fragment: fragmentShader,
            }),
            resources: {
                uTime: 0.0,
                uResolution: [800, 600]
            }
        });
    }

    // Update uniform each frame
    updateTime(dt: number) {
        this.resources.uTime += dt * 0.01;
    }
}
