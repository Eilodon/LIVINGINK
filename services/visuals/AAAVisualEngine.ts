/**
 * AAA VISUAL ENGINE
 * GPU-accelerated particle systems, post-processing, dynamic lighting
 */

export interface VisualEffect {
  id: string;
  type: 'explosion' | 'impact' | 'trail' | 'aura' | 'shockwave' | 'lightning';
  position: { x: number; y: number; z: number };
  intensity: number;
  duration: number;
  color: { r: number; g: number; b: number; a: number };
  parameters: Record<string, any>;
}

export interface PostProcessingEffect {
  type: 'bloom' | 'motionBlur' | 'colorGrading' | 'vignette' | 'chromaticAberration';
  intensity: number;
  enabled: boolean;
  parameters: Record<string, number>;
}

export interface DynamicLight {
  id: string;
  position: { x: number; y: number; z: number };
  color: { r: number; g: number; b: number };
  intensity: number;
  radius: number;
  type: 'point' | 'spot' | 'directional';
  castsShadows: boolean;
  animated: boolean;
}

export interface ParticleSystemConfig {
  maxParticles: number;
  emissionRate: number;
  particleLifetime: number;
  startSize: number;
  endSize: number;
  startVelocity: { x: number; y: number; z: number };
  acceleration: { x: number; y: number; z: number };
  colorOverLifetime: { r: number; g: number; b: number; a: number }[];
  texture?: string;
  blending: 'additive' | 'alpha' | 'multiply';
  sorting: 'backToFront' | 'frontToBack';
}

export class AAAVisualEngine {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private particleSystems: Map<string, ParticleSystem> = new Map();
  private dynamicLights: DynamicLight[] = [];
  private postProcessingEffects: PostProcessingEffect[] = [];
  private activeEffects: VisualEffect[] = [];
  private renderTargets: WebGLTexture[] = [];
  private shaders: Map<string, WebGLProgram> = new Map();
  private qualityLevel: 'low' | 'medium' | 'high' | 'ultra' = 'high';
  private frameCount = 0;
  private lastFrameTime = 0;
  private fps = 60;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2') || canvas.getContext('webgl')!;
    this.initializeWebGL();
    this.initializeShaders();
    this.initializePostProcessing();
    this.initializeParticleSystems();
  }

  private initializeWebGL() {
    const gl = this.gl;
    
    // Enable WebGL features
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    // Set up viewport
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    
    // Create render targets for post-processing
    this.createRenderTargets();
    
    console.log('🎨 AAA Visual Engine initialized with WebGL');
  }

  private createRenderTargets() {
    const gl = this.gl;
    
    // Create color buffer
    const colorTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, colorTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.canvas.width, this.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    // Create depth buffer
    const depthTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, depthTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, this.canvas.width, this.canvas.height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
    
    this.renderTargets.push(colorTexture, depthTexture);
  }

  private initializeShaders() {
    // Particle shader
    this.createShader('particle', `
      attribute vec3 aPosition;
      attribute vec4 aColor;
      attribute float aSize;
      attribute float aLife;
      
      uniform mat4 uProjectionMatrix;
      uniform mat4 uViewMatrix;
      uniform float uTime;
      
      varying vec4 vColor;
      varying float vLife;
      
      void main() {
        vec3 pos = aPosition;
        pos.y += sin(uTime * 2.0 + aPosition.x) * 0.1;
        
        gl_Position = uProjectionMatrix * uViewMatrix * vec4(pos, 1.0);
        gl_PointSize = aSize * (1.0 - aLife);
        vColor = aColor;
        vLife = aLife;
      }
    `, `
      precision mediump float;
      
      varying vec4 vColor;
      varying float vLife;
      
      uniform sampler2D uTexture;
      
      void main() {
        vec2 texCoord = gl_PointCoord;
        vec4 texColor = texture2D(uTexture, texCoord);
        
        gl_FragColor = vColor * texColor * (1.0 - vLife);
      }
    `);

    // Post-processing shaders
    this.createShader('bloom', `
      varying vec2 vTexCoord;
      
      void main() {
        gl_Position = vec4(vTexCoord * 2.0 - 1.0, 0.0, 1.0);
        vTexCoord = vTexCoord;
      }
    `, `
      precision mediump float;
      
      varying vec2 vTexCoord;
      uniform sampler2D uTexture;
      uniform float uIntensity;
      
      void main() {
        vec4 color = texture2D(uTexture, vTexCoord);
        
        // Bloom effect
        float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
        if (brightness > 0.8) {
          color.rgb *= (brightness - 0.8) * uIntensity;
        }
        
        gl_FragColor = color;
      }
    `);

    this.createShader('motionBlur', `
      varying vec2 vTexCoord;
      
      void main() {
        gl_Position = vec4(vTexCoord * 2.0 - 1.0, 0.0, 1.0);
        vTexCoord = vTexCoord;
      }
    `, `
      precision mediump float;
      
      varying vec2 vTexCoord;
      uniform sampler2D uTexture;
      uniform float uIntensity;
      uniform vec2 uVelocity;
      
      void main() {
        vec4 color = vec4(0.0);
        float total = 0.0;
        
        for (float i = 0.0; i < 10.0; i++) {
          float weight = 1.0 - i / 10.0;
          vec2 offset = uVelocity * i * uIntensity * 0.01;
          color += texture2D(uTexture, vTexCoord + offset) * weight;
          total += weight;
        }
        
        gl_FragColor = color / total;
      }
    `);
  }

  private createShader(name: string, vertexSource: string, fragmentSource: string) {
    const gl = this.gl;
    
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);
    
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, fragmentSource);
    gl.compileShader(fragmentShader);
    
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    this.shaders.set(name, program);
  }

  private initializePostProcessing() {
    this.postProcessingEffects = [
      { type: 'bloom', intensity: 0.5, enabled: true, parameters: { threshold: 0.8, strength: 1.0 } },
      { type: 'motionBlur', intensity: 0.3, enabled: true, parameters: { samples: 10, strength: 0.5 } },
      { type: 'colorGrading', intensity: 1.0, enabled: true, parameters: { contrast: 1.1, saturation: 1.2, brightness: 1.05 } },
      { type: 'vignette', intensity: 0.4, enabled: true, parameters: { strength: 0.5, radius: 0.8 } },
      { type: 'chromaticAberration', intensity: 0.1, enabled: false, parameters: { strength: 2.0 } },
    ];
  }

  private initializeParticleSystems() {
    // Explosion particle system
    this.createParticleSystem('explosion', {
      maxParticles: 500,
      emissionRate: 100,
      particleLifetime: 2.0,
      startSize: 8.0,
      endSize: 1.0,
      startVelocity: { x: 0, y: 0, z: 0 },
      acceleration: { x: 0, y: -9.8, z: 0 },
      colorOverLifetime: [
        { r: 1.0, g: 0.8, b: 0.2, a: 1.0 },  // Yellow-orange
        { r: 1.0, g: 0.4, b: 0.1, a: 0.8 },  // Orange-red
        { r: 0.8, g: 0.2, b: 0.1, a: 0.4 },  // Dark red
        { r: 0.3, g: 0.1, b: 0.05, a: 0.0 },  // Dark brown
      ],
      blending: 'additive',
      sorting: 'backToFront',
    });

    // Impact particle system
    this.createParticleSystem('impact', {
      maxParticles: 200,
      emissionRate: 50,
      particleLifetime: 1.0,
      startSize: 4.0,
      endSize: 0.5,
      startVelocity: { x: 0, y: 0, z: 0 },
      acceleration: { x: 0, y: -4.9, z: 0 },
      colorOverLifetime: [
        { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },  // White
        { r: 0.8, g: 0.8, b: 1.0, a: 0.6 },  // Light blue
        { r: 0.4, g: 0.4, b: 0.8, a: 0.2 },  // Blue
        { r: 0.1, g: 0.1, b: 0.3, a: 0.0 },  // Dark blue
      ],
      blending: 'additive',
      sorting: 'backToFront',
    });

    // Trail particle system
    this.createParticleSystem('trail', {
      maxParticles: 100,
      emissionRate: 20,
      particleLifetime: 0.5,
      startSize: 3.0,
      endSize: 1.0,
      startVelocity: { x: 0, y: 0, z: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
      colorOverLifetime: [
        { r: 0.2, g: 0.8, b: 1.0, a: 0.8 },  // Cyan
        { r: 0.1, g: 0.4, b: 0.8, a: 0.4 },  // Blue
        { r: 0.05, g: 0.2, b: 0.4, a: 0.0 },  // Dark blue
      ],
      blending: 'additive',
      sorting: 'backToFront',
    });
  }

  private createParticleSystem(name: string, config: ParticleSystemConfig) {
    const system = new ParticleSystem(this.gl, config);
    this.particleSystems.set(name, system);
  }

  // Visual effects API
  createVisualEffect(type: VisualEffect['type'], position: VisualEffect['position'], options: Partial<VisualEffect> = {}): VisualEffect {
    const effect: VisualEffect = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      position,
      intensity: options.intensity || 1.0,
      duration: options.duration || 2.0,
      color: options.color || { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
      parameters: options.parameters || {},
      ...options,
    };

    this.activeEffects.push(effect);
    this.triggerParticleSystem(type, position, effect);

    return effect;
  }

  private triggerParticleSystem(type: string, position: { x: number; y: number; z: number }, effect: VisualEffect) {
    const system = this.particleSystems.get(type);
    if (system) {
      system.emit(position, effect.intensity, effect.color);
    }

    // Trigger screen shake for explosions
    if (type === 'explosion') {
      this.triggerScreenShake(effect.intensity * 0.5);
    }

    // Create dynamic light for bright effects
    if (effect.intensity > 0.7) {
      this.createDynamicLight({
        id: `light_${effect.id}`,
        position,
        color: effect.color,
        intensity: effect.intensity * 2.0,
        radius: 200,
        type: 'point',
        castsShadows: false,
        animated: true,
      });
    }
  }

  private triggerScreenShake(intensity: number) {
    // This would interface with the game's camera system
    console.log(`📳 Screen shake triggered with intensity: ${intensity}`);
  }

  private createDynamicLight(light: DynamicLight) {
    this.dynamicLights.push(light);
    
    // Remove light after duration
    setTimeout(() => {
      this.dynamicLights = this.dynamicLights.filter(l => l.id !== light.id);
    }, 3000);
  }

  // Post-processing control
  setPostProcessingEffect(type: PostProcessingEffect['type'], enabled: boolean, intensity?: number) {
    const effect = this.postProcessingEffects.find(e => e.type === type);
    if (effect) {
      effect.enabled = enabled;
      if (intensity !== undefined) {
        effect.intensity = intensity;
      }
    }
  }

  // Quality management
  setQualityLevel(level: 'low' | 'medium' | 'high' | 'ultra') {
    this.qualityLevel = level;
    
    // Adjust particle counts based on quality
    const qualityMultipliers = {
      low: 0.25,
      medium: 0.5,
      high: 1.0,
      ultra: 1.5,
    };

    const multiplier = qualityMultipliers[level];
    
    this.particleSystems.forEach(system => {
      system.setMaxParticles(Math.floor(system.config.maxParticles * multiplier));
    });

    // Enable/disable effects based on quality
    this.setPostProcessingEffect('chromaticAberration', level === 'ultra');
    this.setPostProcessingEffect('motionBlur', level !== 'low');
    this.setPostProcessingEffect('bloom', level !== 'low');

    console.log(`🎨 Visual quality set to ${level}`);
  }

  // Main render loop
  render(deltaTime: number) {
    const gl = this.gl;
    const now = performance.now();
    
    // Calculate FPS
    this.frameCount++;
    if (now - this.lastFrameTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFrameTime = now;
    }

    // Clear screen
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // Render particle systems
    this.renderParticleSystems(deltaTime);
    
    // Apply post-processing
    this.applyPostProcessing();
    
    // Update active effects
    this.updateEffects(deltaTime);
  }

  private renderParticleSystems(deltaTime: number) {
    const gl = this.gl;
    const shader = this.shaders.get('particle');
    
    if (!shader) return;
    
    gl.useProgram(shader);
    
    // Set uniforms
    const timeLocation = gl.getUniformLocation(shader, 'uTime');
    gl.uniform1f(timeLocation, performance.now() / 1000);
    
    // Render each particle system
    this.particleSystems.forEach(system => {
      system.render(gl, shader, deltaTime);
    });
  }

  private applyPostProcessing() {
    const gl = this.gl;
    
    // Render to texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
    // Apply each enabled post-processing effect
    this.postProcessingEffects
      .filter(effect => effect.enabled)
      .forEach(effect => {
        this.applyPostEffect(effect);
      });
  }

  private applyPostEffect(effect: PostProcessingEffect) {
    const gl = this.gl;
    const shader = this.shaders.get(effect.type);
    
    if (!shader) return;
    
    gl.useProgram(shader);
    
    // Set effect-specific uniforms
    const intensityLocation = gl.getUniformLocation(shader, 'uIntensity');
    gl.uniform1f(intensityLocation, effect.intensity);
    
    // Draw full-screen quad
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private updateEffects(deltaTime: number) {
    this.activeEffects = this.activeEffects.filter(effect => {
      effect.duration -= deltaTime;
      return effect.duration > 0;
    });
  }

  // Performance monitoring
  getPerformanceMetrics() {
    return {
      fps: this.fps,
      activeEffects: this.activeEffects.length,
      particleCount: Array.from(this.particleSystems.values()).reduce((sum, system) => sum + system.getParticleCount(), 0),
      dynamicLights: this.dynamicLights.length,
      postProcessingEffects: this.postProcessingEffects.filter(e => e.enabled).length,
      qualityLevel: this.qualityLevel,
    };
  }

  // Cleanup
  dispose() {
    this.particleSystems.forEach(system => system.dispose());
    this.shaders.forEach(shader => this.gl.deleteProgram(shader));
    this.renderTargets.forEach(texture => this.gl.deleteTexture(texture));
  }
}

class ParticleSystem {
  public config: ParticleSystemConfig;
  private particles: Particle[] = [];
  private gl: WebGLRenderingContext;
  private vertexBuffer: WebGLBuffer;
  private maxParticles: number;

  constructor(gl: WebGLRenderingContext, config: ParticleSystemConfig) {
    this.gl = gl;
    this.config = config;
    this.maxParticles = config.maxParticles;
    this.particles = [];
    this.vertexBuffer = gl.createBuffer()!;
  }

  emit(position: { x: number; y: number; z: number }, intensity: number, color: { r: number; g: number; b: number; a: number }) {
    const particlesToEmit = Math.floor(this.config.emissionRate * intensity);
    
    for (let i = 0; i < particlesToEmit && this.particles.length < this.maxParticles; i++) {
      const particle = new Particle();
      particle.position = { ...position };
      particle.velocity = {
        x: (Math.random() - 0.5) * this.config.startVelocity.x * 10,
        y: (Math.random() - 0.5) * this.config.startVelocity.y * 10,
        z: (Math.random() - 0.5) * this.config.startVelocity.z * 10,
      };
      particle.color = { ...color };
      particle.life = 1.0;
      particle.size = this.config.startSize;
      
      this.particles.push(particle);
    }
  }

  render(gl: WebGLRenderingContext, shader: WebGLProgram, deltaTime: number) {
    // Update particles
    this.particles = this.particles.filter(particle => {
      particle.life -= deltaTime / this.config.particleLifetime;
      
      if (particle.life <= 0) return false;
      
      // Update position
      particle.position.x += particle.velocity.x * deltaTime;
      particle.position.y += particle.velocity.y * deltaTime;
      particle.position.z += particle.velocity.z * deltaTime;
      
      // Update velocity (acceleration)
      particle.velocity.x += this.config.acceleration.x * deltaTime;
      particle.velocity.y += this.config.acceleration.y * deltaTime;
      particle.velocity.z += this.config.acceleration.z * deltaTime;
      
      // Update size
      particle.size = this.config.startSize + (this.config.endSize - this.config.startSize) * (1.0 - particle.life);
      
      return true;
    });

    // Render particles
    if (this.particles.length === 0) return;

    const vertices: number[] = [];
    
    this.particles.forEach(particle => {
      vertices.push(
        particle.position.x, particle.position.y, particle.position.z,
        particle.color.r, particle.color.g, particle.color.b, particle.color.a,
        particle.size, particle.life
      );
    });

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);

    // Set up attributes
    const positionLoc = gl.getAttribLocation(shader, 'aPosition');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 36, 0);

    const colorLoc = gl.getAttribLocation(shader, 'aColor');
    gl.enableVertexAttribArray(colorLoc);
    gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 36, 12);

    const sizeLoc = gl.getAttribLocation(shader, 'aSize');
    gl.enableVertexAttribArray(sizeLoc);
    gl.vertexAttribPointer(sizeLoc, 1, gl.FLOAT, false, 36, 28);

    const lifeLoc = gl.getAttribLocation(shader, 'aLife');
    gl.enableVertexAttribArray(lifeLoc);
    gl.vertexAttribPointer(lifeLoc, 1, gl.FLOAT, false, 36, 32);

    // Draw particles
    gl.drawArrays(gl.POINTS, 0, this.particles.length);
  }

  getParticleCount(): number {
    return this.particles.length;
  }

  setMaxParticles(max: number) {
    this.maxParticles = max;
    this.config.maxParticles = max;
  }

  dispose() {
    this.gl.deleteBuffer(this.vertexBuffer);
  }
}

class Particle {
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  color: { r: number; g: number; b: number; a: number };
  life: number;
  size: number;

  constructor() {
    this.position = { x: 0, y: 0, z: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.color = { r: 1, g: 1, b: 1, a: 1 };
    this.life = 1.0;
    this.size = 1.0;
  }
}

export const aaaVisualEngine = { AAAVisualEngine };
