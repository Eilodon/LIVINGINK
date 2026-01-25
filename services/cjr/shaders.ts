// Basic Wobble Vertex Shader
export const JELLY_VERTEX = `
  precision mediump float;
  attribute vec2 aVertexPosition;
  attribute vec2 aTextureCoord;
  
  uniform mat3 translationMatrix;
  uniform mat3 projectionMatrix;
  
  uniform float uTime;
  uniform float uSpeed;
  uniform float uWobble;

  varying vec2 vTextureCoord;

  void main() {
    vTextureCoord = aTextureCoord;
    
    vec2 pos = aVertexPosition;
    
    // Simple wobble based on Time + Position Y
    float wave = sin(uTime * 10.0 + pos.y * 0.1) * uWobble * 5.0;
    pos.x += wave;
    
    vec3 v = translationMatrix * vec3(pos, 1.0);
    gl_Position = vec4((projectionMatrix * v).xy, 0.0, 1.0);
  }
`;

// Membrane Pulse Fragment Shader
export const MEMBRANE_FRAG = `
  precision mediump float;
  varying vec2 vTextureCoord;
  
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uAlpha;
  
  void main() {
    // Distance from center of UV (assuming quad is 0..1)
    vec2 center = vec2(0.5);
    float dist = distance(vTextureCoord, center) * 2.0; // 0..1
    
    // Ring effect
    float ringWidth = 0.1;
    float ringRadius = 0.8 + sin(uTime * 3.0) * 0.05;
    
    float alpha = 0.0;
    
    // Soft outer glow
    if (dist > ringRadius - ringWidth && dist < ringRadius + ringWidth) {
        float d = abs(dist - ringRadius);
        alpha = 1.0 - smoothstep(0.0, ringWidth, d);
    }
    
    gl_FragColor = vec4(uColor, alpha * uAlpha);
  }
`;
