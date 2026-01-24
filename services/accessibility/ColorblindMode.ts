/**
 * COLORBLIND ACCESSIBILITY SYSTEM
 * Patterns and icons for color vision deficiency
 */

export interface ColorblindType {
  type: 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia';
  name: string;
  description: string;
}

export interface ColorPattern {
  id: string;
  name: string;
  pattern: 'dots' | 'stripes' | 'crosshatch' | 'circles' | 'triangles' | 'squares';
  color: string;
  size: number;
  opacity: number;
}

export interface ColorblindConfig {
  enabled: boolean;
  type: ColorblindType['type'] | 'off';
  showPatterns: boolean;
  showIcons: boolean;
  intensity: number;
}

export class ColorblindMode {
  private static readonly PATTERNS: Record<string, ColorPattern> = {
    red: {
      id: 'red',
      name: 'Red Pattern',
      pattern: 'stripes',
      color: '#FF0000',
      size: 4,
      opacity: 0.6
    },
    green: {
      id: 'green',
      name: 'Green Pattern',
      pattern: 'dots',
      color: '#00FF00',
      size: 3,
      opacity: 0.5
    },
    blue: {
      id: 'blue',
      name: 'Blue Pattern',
      pattern: 'circles',
      color: '#0000FF',
      size: 5,
      opacity: 0.4
    },
    yellow: {
      id: 'yellow',
      name: 'Yellow Pattern',
      pattern: 'crosshatch',
      color: '#FFFF00',
      size: 6,
      opacity: 0.5
    },
    purple: {
      id: 'purple',
      name: 'Purple Pattern',
      pattern: 'triangles',
      color: '#FF00FF',
      size: 4,
      opacity: 0.6
    },
    orange: {
      id: 'orange',
      name: 'Orange Pattern',
      pattern: 'squares',
      color: '#FFA500',
      size: 5,
      opacity: 0.5
    }
  };

  private static readonly ICONS: Record<string, string> = {
    red: '◆',
    green: '●',
    blue: '■',
    yellow: '▲',
    purple: '★',
    orange: '♦'
  };

  private static readonly COLOR_MAPPING: Record<ColorblindType['type'], Record<string, string>> = {
    protanopia: {
      '#FF0000': '#8B0000',  // Dark red
      '#00FF00': '#006400',  // Dark green
      '#0000FF': '#000080',  // Dark blue
      '#FFFF00': '#BDB76B',  // Dark khaki
      '#FF00FF': '#8B008B',  // Dark magenta
      '#FFA500': '#8B4513'   // Saddle brown
    },
    deuteranopia: {
      '#FF0000': '#A52A2A',  // Brown
      '#00FF00': '#2F4F4F',  // Dark gray
      '#0000FF': '#0000CD',  // Medium blue
      '#FFFF00': '#DAA520',  // Goldenrod
      '#FF00FF': '#9370DB',  // Medium purple
      '#FFA500': '#CD853F'   // Peru
    },
    tritanopia: {
      '#FF0000': '#DC143C',  // Crimson
      '#00FF00': '#4682B4',  // Steel blue
      '#0000FF': '#191970',  // Midnight blue
      '#FFFF00': '#F0E68C',  // Khaki
      '#FF00FF': '#8B7D6B',  // Burlywood
      '#FFA500': '#BC8F8F'   // Rosy brown
    },
    achromatopsia: {
      '#FF0000': '#808080',  // Gray
      '#00FF00': '#A9A9A9',  // Dark gray
      '#0000FF': '#696969',  // Dim gray
      '#FFFF00': '#D3D3D3',  // Light gray
      '#FF00FF': '#C0C0C0',  // Silver
      '#FFA500': '#808080'   // Gray
    }
  };

  /**
   * Get dominant color from RGB values
   */
  static getDominantColor(r: number, g: number, b: number): string {
    const hex = this.rgbToHex(r, g, b);
    
    // Simple color dominance detection
    if (r > g && r > b) return 'red';
    if (g > r && g > b) return 'green';
    if (b > r && b > g) return 'blue';
    if (r > 0.8 && g > 0.8) return 'yellow';
    if (r > 0.8 && b > 0.8) return 'purple';
    if (r > 0.8 && g > 0.5) return 'orange';
    
    return 'blue'; // Default
  }

  /**
   * Convert RGB to hex
   */
  static rgbToHex(r: number, g: number, b: number): string {
    const toHex = (c: number) => {
      const hex = Math.floor(Math.max(0, Math.min(1, c)) * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Get colorblind-friendly color
   */
  static getColorblindColor(
    r: number, 
    g: number, 
    b: number, 
    colorblindType: ColorblindType['type']
  ): string {
    const hex = this.rgbToHex(r, g, b);
    const mapping = this.COLOR_MAPPING[colorblindType];
    return mapping[hex] || hex;
  }

  /**
   * Get pattern for color
   */
  static getPatternForColor(colorName: string): ColorPattern {
    return this.PATTERNS[colorName] || this.PATTERNS.blue;
  }

  /**
   * Get icon for color
   */
  static getIconForColor(colorName: string): string {
    return this.ICONS[colorName] || this.ICONS.blue;
  }

  /**
   * Generate SVG pattern
   */
  static generateSVGPattern(pattern: ColorPattern): string {
    const { pattern: patternType, color, size, opacity } = pattern;
    
    let patternDef = '';
    
    switch (patternType) {
      case 'dots':
        patternDef = `
          <pattern id="${pattern.id}" x="0" y="0" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
            <circle cx="${size/2}" cy="${size/2}" r="${size/4}" fill="${color}" opacity="${opacity}"/>
          </pattern>
        `;
        break;
        
      case 'stripes':
        patternDef = `
          <pattern id="${pattern.id}" x="0" y="0" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="${size/2}" height="${size}" fill="${color}" opacity="${opacity}"/>
          </pattern>
        `;
        break;
        
      case 'crosshatch':
        patternDef = `
          <pattern id="${pattern.id}" x="0" y="0" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
            <path d="M0,0 L${size},${size} M${size},0 L0,${size}" stroke="${color}" stroke-width="1" opacity="${opacity}"/>
          </pattern>
        `;
        break;
        
      case 'circles':
        patternDef = `
          <pattern id="${pattern.id}" x="0" y="0" width="${size * 2}" height="${size * 2}" patternUnits="userSpaceOnUse">
            <circle cx="${size}" cy="${size}" r="${size/3}" fill="none" stroke="${color}" stroke-width="1" opacity="${opacity}"/>
          </pattern>
        `;
        break;
        
      case 'triangles':
        patternDef = `
          <pattern id="${pattern.id}" x="0" y="0" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
            <path d="M${size/2},0 L${size},${size} L0,${size} Z" fill="${color}" opacity="${opacity}"/>
          </pattern>
        `;
        break;
        
      case 'squares':
        patternDef = `
          <pattern id="${pattern.id}" x="0" y="0" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
            <rect x="${size/4}" y="${size/4}" width="${size/2}" height="${size/2}" fill="${color}" opacity="${opacity}"/>
          </pattern>
        `;
        break;
        
      default:
        patternDef = '';
    }
    
    return patternDef;
  }

  /**
   * Apply colorblind mode to canvas context
   */
  static applyColorblindMode(
    ctx: CanvasRenderingContext2D,
    config: ColorblindConfig,
    r: number,
    g: number,
    b: number
  ): { color: string; pattern?: string; icon?: string } {
    if (!config.enabled || config.type === 'off') {
      return { color: this.rgbToHex(r, g, b) };
    }

    const colorName = this.getDominantColor(r, g, b);
    const colorblindColor = this.getColorblindColor(r, g, b, config.type);
    
    const result: { color: string; pattern?: string; icon?: string } = {
      color: colorblindColor
    };

    if (config.showPatterns) {
      const pattern = this.getPatternForColor(colorName);
      result.pattern = `url(#${pattern.id})`;
    }

    if (config.showIcons) {
      result.icon = this.getIconForColor(colorName);
    }

    return result;
  }

  /**
   * Get all colorblind types
   */
  static getColorblindTypes(): ColorblindType[] {
    return [
      {
        type: 'protanopia',
        name: 'Protanopia (Red-Blind)',
        description: 'Difficulty distinguishing red colors'
      },
      {
        type: 'deuteranopia',
        name: 'Deuteranopia (Green-Blind)',
        description: 'Difficulty distinguishing green colors'
      },
      {
        type: 'tritanopia',
        name: 'Tritanopia (Blue-Blind)',
        description: 'Difficulty distinguishing blue colors'
      },
      {
        type: 'achromatopsia',
        name: 'Achromatopsia (Color-Blind)',
        description: 'Complete inability to see colors'
      }
    ];
  }

  /**
   * Test colorblind mode
   */
  static testColorblindMode(
    r: number, 
    g: number, 
    b: number, 
    colorblindType: ColorblindType['type']
  ): {
    original: string;
    modified: string;
    pattern: ColorPattern;
    icon: string;
  } {
    const colorName = this.getDominantColor(r, g, b);
    const original = this.rgbToHex(r, g, b);
    const modified = this.getColorblindColor(r, g, b, colorblindType);
    const pattern = this.getPatternForColor(colorName);
    const icon = this.getIconForColor(colorName);

    return {
      original,
      modified,
      pattern,
      icon
    };
  }

  /**
   * Generate accessibility CSS
   */
  static generateAccessibilityCSS(config: ColorblindConfig): string {
    if (!config.enabled || config.type === 'off') {
      return '';
    }

    let css = `
      .colorblind-mode {
        --colorblind-intensity: ${config.intensity};
      }
    `;

    // Generate pattern definitions
    Object.values(this.PATTERNS).forEach(pattern => {
      css += this.generateSVGPattern(pattern);
    });

    return css;
  }
}

export const colorblindMode = ColorblindMode;
