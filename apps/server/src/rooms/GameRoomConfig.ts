/**
 * GameRoom Configuration Constants
 * Extracted from hardcoded values for centralized management
 */

export const GAME_ROOM_CONFIG = {
    // Networking
    SNAPSHOT_INTERVAL: 60,           // Force full snapshot every 1s (60 ticks)
    RATE_LIMIT_WINDOW: 1000,         // 1 second window
    RATE_LIMIT_MAX: 60,              // Max messages per window
    MAX_MESSAGE_SIZE: 1024,          // 1KB max payload

    // Security
    SECURITY_MAX_DT_SEC: 0.2,        // Max delta time for physics validation
    SPEED_VALIDATION_TOLERANCE: 1.15, // 15% tolerance for speed checks
    MAX_ENTITIES_PER_CLIENT: 5,      // Entity pool DoS protection
    ROOM_RATE_LIMIT_WINDOW: 60000,   // 1 minute for room creation
    ROOM_RATE_LIMIT_MAX: 5,          // Max rooms per minute per IP

    // Physics
    MAX_SPEED_BASE: 150,             // Base movement speed

    // Client
    MAX_CLIENTS: 50,                 // Max players per room
} as const;

export type GameRoomConfigType = typeof GAME_ROOM_CONFIG;
