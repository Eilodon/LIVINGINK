// packages/engine/scripts/schema.config.js
/**
 * EIDOLON-V SCHEMA DEFINITION
 * The Single Source of Truth for game data structures.
 * 
 * This schema is used to generate:
 * - TypedArray stores (WorldState)
 * - Network packing/unpacking code
 * - Type definitions
 * 
 * Field types:
 * - 'f32': Float32 (4 bytes)
 * - 'u8':  Uint8 (1 byte)
 * - 'u16': Uint16 (2 bytes)
 * - 'u32': Uint32 (4 bytes)
 * - 'i32': Int32 (4 bytes)
 */

const SCHEMA = {
    Transform: {
        id: 1, // Packet ID for Network
        fields: {
            x: { type: 'f32', default: 0 },
            y: { type: 'f32', default: 0 },
            rotation: { type: 'f32', default: 0 },
            scale: { type: 'f32', default: 1 },
            prevX: { type: 'f32', default: 0 },      // For interpolation
            prevY: { type: 'f32', default: 0 },      // For interpolation
            prevRotation: { type: 'f32', default: 0 }, // For interpolation
            _pad: { type: 'f32', default: 0 },       // Padding for alignment
        }
    },
    Physics: {
        id: 2,
        fields: {
            vx: { type: 'f32', default: 0 },
            vy: { type: 'f32', default: 0 },
            vRotation: { type: 'f32', default: 0 },
            mass: { type: 'f32', default: 1 },
            radius: { type: 'f32', default: 10 },
            restitution: { type: 'f32', default: 0.5 },
            friction: { type: 'f32', default: 0.9 },
            _pad: { type: 'f32', default: 0 },
        }
    },
    Pigment: {
        id: 3,
        fields: {
            r: { type: 'f32', default: 1 },
            g: { type: 'f32', default: 1 },
            b: { type: 'f32', default: 1 },
            targetR: { type: 'f32', default: 1 },
            targetG: { type: 'f32', default: 1 },
            targetB: { type: 'f32', default: 1 },
            matchPercent: { type: 'f32', default: 0 },
            colorInt: { type: 'f32', default: 0 }, // Cached RGB as int
        }
    },
    Stats: {
        id: 4,
        fields: {
            hp: { type: 'f32', default: 100 },
            maxHp: { type: 'f32', default: 100 },
            score: { type: 'f32', default: 0 },
            matchPercent: { type: 'f32', default: 0 },
            defense: { type: 'f32', default: 1 },
            damageMultiplier: { type: 'f32', default: 1 },
            _pad1: { type: 'f32', default: 0 },
            _pad2: { type: 'f32', default: 0 },
        }
    },
    Input: {
        id: 5,
        fields: {
            targetX: { type: 'f32', default: 0 },
            targetY: { type: 'f32', default: 0 },
            actions: { type: 'u32', default: 0 }, // EIDOLON-V FIX: Uint32 for accurate bitmask
            _pad: { type: 'f32', default: 0 },
        }
    },
    Skill: {
        id: 6,
        fields: {
            cooldown: { type: 'f32', default: 0 },
            maxCooldown: { type: 'f32', default: 0 },
            activeTimer: { type: 'f32', default: 0 },
            shapeId: { type: 'f32', default: 0 },
        }
    },
    Config: {
        id: 7,
        fields: {
            magneticRadius: { type: 'f32', default: 0 },
            damageMult: { type: 'f32', default: 1 },
            speedMult: { type: 'f32', default: 1 },
            pickupRange: { type: 'f32', default: 0 },
            visionRange: { type: 'f32', default: 0 },
            maxSpeed: { type: 'f32', default: 200 },  // EIDOLON-V: Added maxSpeed field
            _pad1: { type: 'f32', default: 0 },
            _pad2: { type: 'f32', default: 0 },
        }
    },
    Projectile: {
        id: 8,
        fields: {
            ownerId: { type: 'f32', default: 0 },
            damage: { type: 'f32', default: 0 },
            duration: { type: 'f32', default: 0 },
            typeId: { type: 'f32', default: 0 },
        }
    },
    Tattoo: {
        id: 9,
        fields: {
            flags: { type: 'u8', default: 0 },      // Tattoo-specific bitmask flags
            _pad1: { type: 'u8', default: 0 },      // Padding for alignment
            _pad2: { type: 'u8', default: 0 },      // Padding for alignment
            _pad3: { type: 'u8', default: 0 },      // Padding for alignment (4-byte aligned now)
            timer1: { type: 'f32', default: 0 },
            timer2: { type: 'f32', default: 0 },
            procChance: { type: 'f32', default: 0 },
            _pad4: { type: 'f32', default: 0 },
        }
    },
};

// Calculate stride and byte offsets for each component
function calculateLayout(schema) {
    const result = {};

    for (const [name, component] of Object.entries(schema)) {
        const fields = Object.entries(component.fields);
        const stride = fields.length;
        const offsets = {};

        fields.forEach(([fieldName, _], index) => {
            offsets[fieldName] = index;
        });

        result[name] = {
            id: component.id,
            stride,
            offsets,
            fields: component.fields,
        };
    }

    return result;
}

export const schemaConfig = {
    SCHEMA,
    LAYOUT: calculateLayout(SCHEMA),
};

export { SCHEMA, calculateLayout };
export default schemaConfig;
