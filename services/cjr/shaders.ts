
// SHADER COMPONENT - JELLY EFFECT
// Vertex Shader: Wobbles vertices based on time and position (Soft Body simulation)
// Fragment Shader: Simple color + rim lighting

export const JELLY_VERTEX = `
  precision mediump float;

  attribute vec2 aVertexPosition;
  attribute vec2 aUvs;

  uniform mat3 translationMatrix;
  uniform mat3 projectionMatrix;

  uniform float uTime;
  uniform float uWobble;
  uniform float uSquish;

  varying vec2 vUvs;

  void main() {
    vUvs = aUvs;
    
    // Normalize position relative to center (assuming 0,0 center in local space)
    vec2 pos = aVertexPosition;
    
    // 1. Wobble Effect (Sine wave on radius)
    float angle = atan(pos.y, pos.x);
    float dist = length(pos);
    
    float wave = sin(angle * 5.0 + uTime * 5.0) * uWobble * dist;
    
    // 2. Squish Effect (Velocity stretch)
    // Simple mock: stretch X, squash Y (rotated by container in JS)
    pos.x *= (1.0 + uSquish);
    pos.y *= (1.0 - uSquish);
    
    // Apply wobble
    pos += vec2(cos(angle), sin(angle)) * wave;

    gl_Position = vec4((projectionMatrix * translationMatrix * vec3(pos, 1.0)).xy, 0.0, 1.0);
  }
`;

export const JELLY_FRAGMENT = `
  precision mediump float;

  varying vec2 vUvs;

  uniform vec3 uColor; // RGB 0..1
  uniform float uAlpha;
  uniform vec3 uBorderColor;

  void main() {
    // Circle distance from center (UV 0.5, 0.5)
    vec2 center = vec2(0.5);
    float dist = distance(vUvs, center) * 2.0; // 0..1
    
    // Soft edge (Anti-aliasing)
    float alpha = 1.0 - smoothstep(0.9, 1.0, dist);
    
    // Rim lighting (Inner glow)
    float rim = smoothstep(0.7, 0.95, dist) * 0.5;
    
    vec3 color = uColor + rim;
    
    // Border
    // float border = smoothstep(0.85, 0.9, dist);
    // color = mix(color, uBorderColor, border);

    gl_FragColor = vec4(color, alpha * uAlpha);
  }
`;
