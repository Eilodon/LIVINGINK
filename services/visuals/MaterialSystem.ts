/**
 * PHYSICALLY-BASED MATERIAL SYSTEM
 * PBR rendering, material properties, texture management
 */

export interface MaterialProperties {
  albedo: { r: number; g: number; b: number; a: number };
  metallic: number;
  roughness: number;
  normal: { x: number; y: number; z: number };
  ao: number; // Ambient occlusion
  emission: { r: number; g: number; b: number };
  transparency: number;
  refraction: number;
}

export interface Texture {
  id: string;
  url: string;
  type: 'albedo' | 'normal' | 'metallic' | 'roughness' | 'ao' | 'emission';
  width: number;
  height: number;
  format: number;
  data: ArrayBufferView;
}

export interface Material {
  id: string;
  name: string;
  properties: MaterialProperties;
  textures: Map<string, Texture>;
  shader: string;
  transparent: boolean;
  doubleSided: boolean;
}

export class MaterialSystem {
  private materials: Map<string, Material> = new Map();
  private textures: Map<string, Texture> = new Map();
  private shaderPrograms: Map<string, WebGLProgram> = new Map();
  private gl: WebGLRenderingContext;
  private textureUnits: number = 0;

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
    this.initializeDefaultMaterials();
    this.createPBRShaders();
  }

  private initializeDefaultMaterials() {
    // Jelly material - translucent, waxy appearance
    this.createMaterial('jelly_default', {
      name: 'Default Jelly',
      properties: {
        albedo: { r: 0.8, g: 0.9, b: 1.0, a: 0.8 },
        metallic: 0.1,
        roughness: 0.3,
        normal: { x: 0, y: 0, z: 1 },
        ao: 0.2,
        emission: { r: 0, g: 0, b: 0 },
        transparency: 0.2,
        refraction: 1.3,
      },
      textures: new Map(),
      shader: 'pbr_translucent',
      transparent: true,
      doubleSided: true,
    });

    // Metal material - for special effects
    this.createMaterial('metal_shiny', {
      name: 'Shiny Metal',
      properties: {
        albedo: { r: 0.9, g: 0.9, b: 0.95, a: 1.0 },
        metallic: 0.9,
        roughness: 0.1,
        normal: { x: 0, y: 0, z: 1 },
        ao: 0.1,
        emission: { r: 0, g: 0, b: 0 },
        transparency: 0,
        refraction: 0,
      },
      textures: new Map(),
      shader: 'pbr_metal',
      transparent: false,
      doubleSided: false,
    });

    // Energy material - glowing, emissive
    this.createMaterial('energy_glow', {
      name: 'Energy Glow',
      properties: {
        albedo: { r: 0.3, g: 0.8, b: 1.0, a: 0.9 },
        metallic: 0.2,
        roughness: 0.2,
        normal: { x: 0, y: 0, z: 1 },
        ao: 0.0,
        emission: { r: 0.2, g: 0.6, b: 1.0 },
        transparency: 0.1,
        refraction: 0,
      },
      textures: new Map(),
      shader: 'pbr_emissive',
      transparent: true,
      doubleSided: true,
    });

    // Shadow material - dark, absorbing
    this.createMaterial('shadow_dark', {
      name: 'Dark Shadow',
      properties: {
        albedo: { r: 0.05, g: 0.05, b: 0.1, a: 0.9 },
        metallic: 0.0,
        roughness: 0.9,
        normal: { x: 0, y: 0, z: 1 },
        ao: 0.8,
        emission: { r: 0, g: 0, b: 0 },
        transparency: 0.3,
        refraction: 0,
      },
      textures: new Map(),
      shader: 'pbr_shadow',
      transparent: true,
      doubleSided: false,
    });

    // Cosmic material - iridescent, special
    this.createMaterial('cosmic_iridescent', {
      name: 'Cosmic Iridescent',
      properties: {
        albedo: { r: 0.7, g: 0.5, b: 1.0, a: 0.85 },
        metallic: 0.4,
        roughness: 0.15,
        normal: { x: 0, y: 0, z: 1 },
        ao: 0.15,
        emission: { r: 0.3, g: 0.1, b: 0.5 },
        transparency: 0.15,
        refraction: 1.5,
      },
      textures: new Map(),
      shader: 'pbr_iridescent',
      transparent: true,
      doubleSided: true,
    });
  }

  private createPBRShaders() {
    // Standard PBR shader
    this.createShader('pbr_standard', `
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      attribute vec2 aTexCoord;
      attribute vec4 aTangent;
      
      uniform mat4 uModelMatrix;
      uniform mat4 uViewMatrix;
      uniform mat4 uProjectionMatrix;
      uniform mat3 uNormalMatrix;
      
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec2 vTexCoord;
      varying vec3 vTangent;
      varying vec3 vBitangent;
      
      void main() {
        vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
        vWorldPosition = worldPos.xyz;
        vWorldNormal = normalize(uNormalMatrix * aNormal);
        vTexCoord = aTexCoord;
        vTangent = normalize(uNormalMatrix * aTangent.xyz);
        vBitangent = cross(vWorldNormal, vTangent) * aTangent.w;
        
        gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
      }
    `, `
      precision mediump float;
      
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec2 vTexCoord;
      varying vec3 vTangent;
      varying vec3 vBitangent;
      
      uniform Material {
        vec4 albedo;
        float metallic;
        float roughness;
        float ao;
        vec3 emission;
        float transparency;
      } uMaterial;
      
      uniform sampler2D uAlbedoMap;
      uniform sampler2D uNormalMap;
      uniform sampler2D uMetallicMap;
      uniform sampler2D uRoughnessMap;
      uniform sampler2D uAOMap;
      uniform sampler2D uEmissionMap;
      
      uniform vec3 uCameraPosition;
      uniform vec3 uLightPositions[4];
      uniform vec3 uLightColors[4];
      uniform float uLightIntensities[4];
      
      const float PI = 3.14159265359;
      
      // Distribution function
      float DistributionGGX(vec3 N, vec3 H, float roughness) {
        float a = roughness * roughness;
        float a2 = a * a;
        float NdotH = max(dot(N, H), 0.0);
        float NdotH2 = NdotH * NdotH;
        
        float num = a2;
        float denom = (NdotH2 * (a2 - 1.0) + 1.0);
        denom = PI * denom * denom;
        
        return num / denom;
      }
      
      // Geometry function
      float GeometrySchlickGGX(float NdotV, float roughness) {
        float r = (roughness + 1.0);
        float k = (r * r) / 8.0;
        
        float num = NdotV;
        float denom = NdotV * (1.0 - k) + k;
        
        return num / denom;
      }
      
      float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
        float NdotV = max(dot(N, V), 0.0);
        float NdotL = max(dot(N, L), 0.0);
        float ggx2 = GeometrySchlickGGX(NdotV, roughness);
        float ggx1 = GeometrySchlickGGX(NdotL, roughness);
        
        return ggx1 * ggx2;
      }
      
      // Fresnel function
      vec3 FresnelSchlick(float cosTheta, vec3 F0) {
        return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
      }
      
      void main() {
        vec3 albedo = pow(texture2D(uAlbedoMap, vTexCoord).rgb, vec3(2.2)) * uMaterial.albedo.rgb;
        float metallic = texture2D(uMetallicMap, vTexCoord).r * uMaterial.metallic;
        float roughness = texture2D(uRoughnessMap, vTexCoord).r * uMaterial.roughness;
        float ao = texture2D(uAOMap, vTexCoord).r * uMaterial.ao;
        vec3 emission = texture2D(uEmissionMap, vTexCoord).rgb * uMaterial.emission;
        
        // Normal mapping
        vec3 normal = texture2D(uNormalMap, vTexCoord).rgb * 2.0 - 1.0;
        normal = normalize(normal.x * vTangent + normal.y * vBitangent + normal.z * vWorldNormal);
        
        vec3 N = normal;
        vec3 V = normalize(uCameraPosition - vWorldPosition);
        vec3 R = reflect(-V, N);
        
        // Calculate reflectance at normal incidence
        vec3 F0 = mix(vec3(0.04), albedo, metallic);
        
        // Light calculation
        vec3 Lo = vec3(0.0);
        
        for(int i = 0; i < 4; i++) {
          vec3 L = normalize(uLightPositions[i] - vWorldPosition);
          vec3 H = normalize(V + L);
          float distance = length(uLightPositions[i] - vWorldPosition);
          float attenuation = 1.0 / (distance * distance);
          vec3 radiance = uLightColors[i] * uLightIntensities[i] * attenuation;
          
          // Cook-Torrance BRDF
          float NDF = DistributionGGX(N, H, roughness);
          float G = GeometrySmith(N, V, L, roughness);
          vec3 F = FresnelSchlick(max(dot(H, V), 0.0), F0);
          
          vec3 kS = F;
          vec3 kD = vec3(1.0) - kS;
          kD *= 1.0 - metallic;
          
          vec3 numerator = NDF * G * F;
          float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
          vec3 specular = numerator / denominator;
          
          float NdotL = max(dot(N, L), 0.0);
          Lo += (kD * albedo / PI + specular) * radiance * NdotL;
        }
        
        vec3 ambient = vec3(0.03) * albedo * ao;
        vec3 color = ambient + Lo + emission;
        
        // HDR tonemapping
        color = color / (color + vec3(1.0));
        // Gamma correction
        color = pow(color, vec3(1.0/2.2));
        
        gl_FragColor = vec4(color, uMaterial.albedo.a);
      }
    `);

    // Translucent PBR shader
    this.createShader('pbr_translucent', `
      // Same vertex shader as standard
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      attribute vec2 aTexCoord;
      
      uniform mat4 uModelMatrix;
      uniform mat4 uViewMatrix;
      uniform mat4 uProjectionMatrix;
      uniform mat3 uNormalMatrix;
      
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec2 vTexCoord;
      
      void main() {
        vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
        vWorldPosition = worldPos.xyz;
        vWorldNormal = normalize(uNormalMatrix * aNormal);
        vTexCoord = aTexCoord;
        
        gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
      }
    `, `
      precision mediump float;
      
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec2 vTexCoord;
      
      uniform Material {
        vec4 albedo;
        float metallic;
        float roughness;
        float ao;
        vec3 emission;
        float transparency;
        float refraction;
      } uMaterial;
      
      uniform vec3 uCameraPosition;
      uniform vec3 uLightPositions[4];
      uniform vec3 uLightColors[4];
      
      void main() {
        vec3 albedo = uMaterial.albedo.rgb;
        vec3 normal = normalize(vWorldNormal);
        vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
        
        // Subsurface scattering simulation
        vec3 scatterColor = albedo * 0.8;
        float scatterStrength = uMaterial.transparency;
        
        // Simple lighting
        vec3 color = vec3(0.0);
        
        for(int i = 0; i < 4; i++) {
          vec3 lightDir = normalize(uLightPositions[i] - vWorldPosition);
          float NdotL = max(dot(normal, lightDir), 0.0);
          
          // Diffuse
          vec3 diffuse = albedo * NdotL * uLightColors[i];
          
          // Subsurface scattering
          float backLight = max(dot(-normal, lightDir), 0.0);
          vec3 scatter = scatterColor * backLight * scatterStrength;
          
          color += diffuse + scatter;
        }
        
        // Add emission
        color += uMaterial.emission;
        
        // Simple transparency
        float alpha = uMaterial.albedo.a * (1.0 - uMaterial.transparency * 0.5);
        
        gl_FragColor = vec4(color, alpha);
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
    
    this.shaderPrograms.set(name, program);
  }

  createMaterial(id: string, material: Omit<Material, 'id'>): Material {
    const newMaterial: Material = {
      id,
      ...material,
    };
    
    this.materials.set(id, newMaterial);
    return newMaterial;
  }

  getMaterial(id: string): Material | undefined {
    return this.materials.get(id);
  }

  // Dynamic material creation based on game state
  createJellyMaterial(pigment: { r: number; g: number; b: number }, emotion: string): Material {
    const baseMaterial = this.getMaterial('jelly_default')!;
    const material = { ...baseMaterial };
    
    // Adjust albedo based on pigment
    material.properties.albedo = {
      r: pigment.r,
      g: pigment.g,
      b: pigment.b,
      a: 0.8,
    };
    
    // Adjust properties based on emotion
    switch (emotion) {
      case 'happy':
        material.properties.roughness = 0.2;
        material.properties.emission = { r: 0.1, g: 0.1, b: 0.2 };
        break;
      case 'angry':
        material.properties.metallic = 0.3;
        material.properties.emission = { r: 0.3, g: 0.1, b: 0.1 };
        break;
      case 'excited':
        material.properties.emission = { r: 0.2, g: 0.3, b: 0.4 };
        material.properties.transparency = 0.15;
        break;
      case 'scared':
        material.properties.roughness = 0.5;
        material.properties.transparency = 0.3;
        break;
      default:
        // Use default properties
        break;
    }
    
    return material;
  }

  // Material animation
  animateMaterial(material: Material, time: number): Material {
    const animated = { ...material };
    
    // Animate emission for glowing materials
    if (material.properties.emission.r > 0 || 
        material.properties.emission.g > 0 || 
        material.properties.emission.b > 0) {
      const pulse = Math.sin(time * 2) * 0.5 + 0.5;
      animated.properties.emission = {
        r: material.properties.emission.r * (0.5 + pulse * 0.5),
        g: material.properties.emission.g * (0.5 + pulse * 0.5),
        b: material.properties.emission.b * (0.5 + pulse * 0.5),
      };
    }
    
    return animated;
  }

  // Apply material to WebGL context
  applyMaterial(material: Material, shaderProgram: WebGLProgram) {
    const gl = this.gl;
    gl.useProgram(shaderProgram);
    
    // Set material properties
    const albedoLoc = gl.getUniformLocation(shaderProgram, 'uMaterial.albedo');
    gl.uniform4f(albedoLoc, 
      material.properties.albedo.r,
      material.properties.albedo.g,
      material.properties.albedo.b,
      material.properties.albedo.a
    );
    
    const metallicLoc = gl.getUniformLocation(shaderProgram, 'uMaterial.metallic');
    gl.uniform1f(metallicLoc, material.properties.metallic);
    
    const roughnessLoc = gl.getUniformLocation(shaderProgram, 'uMaterial.roughness');
    gl.uniform1f(roughnessLoc, material.properties.roughness);
    
    const aoLoc = gl.getUniformLocation(shaderProgram, 'uMaterial.ao');
    gl.uniform1f(aoLoc, material.properties.ao);
    
    const emissionLoc = gl.getUniformLocation(shaderProgram, 'uMaterial.emission');
    gl.uniform3f(emissionLoc,
      material.properties.emission.r,
      material.properties.emission.g,
      material.properties.emission.b
    );
    
    const transparencyLoc = gl.getUniformLocation(shaderProgram, 'uMaterial.transparency');
    gl.uniform1f(transparencyLoc, material.properties.transparency);
    
    // Bind textures
    let textureUnit = 0;
    material.textures.forEach((texture, type) => {
      gl.activeTexture(gl.TEXTURE0 + textureUnit);
      gl.bindTexture(gl.TEXTURE_2D, this.getWebGLTexture(texture));
      
      const uniformName = `u${type.charAt(0).toUpperCase() + type.slice(1)}Map`;
      const loc = gl.getUniformLocation(shaderProgram, uniformName);
      gl.uniform1i(loc, textureUnit);
      
      textureUnit++;
    });
    
    // Set blending for transparent materials
    if (material.transparent) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    } else {
      gl.disable(gl.BLEND);
    }
  }

  private getWebGLTexture(texture: Texture): WebGLTexture {
    // In a real implementation, this would cache and return WebGL textures
    // For now, we'll create a simple texture
    const gl = this.gl;
    const webglTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, webglTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texture.width, texture.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, texture.data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return webglTexture;
  }

  // Get shader program
  getShader(name: string): WebGLProgram | undefined {
    return this.shaderPrograms.get(name);
  }

  // Material presets for different game elements
  getMaterialPreset(type: 'jelly' | 'food' | 'projectile' | 'effect', variant?: string): Material {
    switch (type) {
      case 'jelly':
        return this.getMaterial('jelly_default')!;
      case 'food':
        return this.getMaterial('energy_glow')!;
      case 'projectile':
        return this.getMaterial('metal_shiny')!;
      case 'effect':
        return variant === 'shadow' ? 
          this.getMaterial('shadow_dark')! : 
          this.getMaterial('cosmic_iridescent')!;
      default:
        return this.getMaterial('jelly_default')!;
    }
  }

  // Cleanup
  dispose() {
    this.shaderPrograms.forEach(program => this.gl.deleteProgram(program));
    this.textures.forEach(texture => {
      // Clean up WebGL textures
    });
  }
}

export const materialSystem = { MaterialSystem };
