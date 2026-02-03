/**
 * @eidolon/engine - LevelValidator
 *
 * Validates level blueprints against schema.
 * Ensures JSON from Level Editor is safe to load.
 */

/**
 * Raw level blueprint from JSON
 */
export interface LevelBlueprint {
    id: number;
    name: string;
    thresholds: {
        ring2: number;
        ring3: number;
        win: number;
    };
    winHoldSeconds: number;
    timeLimit: number;
    waveIntervals: {
        ring1: number;
        ring2: number;
        ring3: number;
    };
    burstSizes: {
        ring1: number;
        ring2: number;
        ring3: number;
    };
    spawnWeights: {
        pigment: number;
        neutral: number;
        special: number;
    };
    botCount: number;
    boss: {
        boss1Enabled: boolean;
        boss2Enabled: boolean;
        boss1Time: number;
        boss2Time: number;
        boss1Health: number;
        boss2Health: number;
    };
    pity: {
        stuckThreshold: number;
        duration: number;
        multiplier: number;
    };
    ring3Debuff: {
        enabled: boolean;
        threshold: number;
        duration: number;
        speedMultiplier: number;
    };
    rushWindowDuration: number;
    winCondition?: 'hold_center' | 'default';
}

/**
 * Validation result
 */
export interface ValidationResult<T> {
    valid: boolean;
    data?: T;
    errors?: string[];
}

/**
 * Validate a level blueprint object
 *
 * @param data Raw JSON data
 * @returns Validation result with typed data if valid
 */
export function validateLevelBlueprint(
    data: unknown
): ValidationResult<LevelBlueprint> {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['Data must be an object'] };
    }

    const obj = data as Record<string, unknown>;

    // Required fields
    const requiredFields = [
        'id',
        'name',
        'thresholds',
        'winHoldSeconds',
        'timeLimit',
        'waveIntervals',
        'burstSizes',
        'spawnWeights',
        'botCount',
        'boss',
        'pity',
        'ring3Debuff',
        'rushWindowDuration',
    ];

    for (const field of requiredFields) {
        if (!(field in obj)) {
            errors.push(`Missing required field: ${field}`);
        }
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    // Validate types and ranges
    validateNumber(obj.id, 'id', errors, 1, 100);
    validateString(obj.name, 'name', errors);

    // Validate thresholds
    if (obj.thresholds && typeof obj.thresholds === 'object') {
        const t = obj.thresholds as Record<string, unknown>;
        validateNumber(t.ring2, 'thresholds.ring2', errors, 0, 1);
        validateNumber(t.ring3, 'thresholds.ring3', errors, 0, 1);
        validateNumber(t.win, 'thresholds.win', errors, 0, 1);

        // Check ordering: ring2 < ring3 < win
        if (
            typeof t.ring2 === 'number' &&
            typeof t.ring3 === 'number' &&
            typeof t.win === 'number'
        ) {
            if (!(t.ring2 < t.ring3 && t.ring3 < t.win)) {
                errors.push('thresholds must satisfy: ring2 < ring3 < win');
            }
        }
    }

    // Validate spawnWeights sum to 1
    if (obj.spawnWeights && typeof obj.spawnWeights === 'object') {
        const w = obj.spawnWeights as Record<string, unknown>;
        validateNumber(w.pigment, 'spawnWeights.pigment', errors, 0, 1);
        validateNumber(w.neutral, 'spawnWeights.neutral', errors, 0, 1);
        validateNumber(w.special, 'spawnWeights.special', errors, 0, 1);

        const sum =
            (typeof w.pigment === 'number' ? w.pigment : 0) +
            (typeof w.neutral === 'number' ? w.neutral : 0) +
            (typeof w.special === 'number' ? w.special : 0);

        if (Math.abs(sum - 1) > 0.01) {
            errors.push(`spawnWeights must sum to 1 (got ${sum.toFixed(2)})`);
        }
    }

    // Validate botCount
    validateNumber(obj.botCount, 'botCount', errors, 0, 50);

    // Validate boss config
    if (obj.boss && typeof obj.boss === 'object') {
        const b = obj.boss as Record<string, unknown>;
        validateBoolean(b.boss1Enabled, 'boss.boss1Enabled', errors);
        validateBoolean(b.boss2Enabled, 'boss.boss2Enabled', errors);
        validateNumber(b.boss1Time, 'boss.boss1Time', errors, 0, 600);
        validateNumber(b.boss2Time, 'boss.boss2Time', errors, 0, 600);
        validateNumber(b.boss1Health, 'boss.boss1Health', errors, 1, 10000);
        validateNumber(b.boss2Health, 'boss.boss2Health', errors, 1, 10000);
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    return { valid: true, data: obj as unknown as LevelBlueprint };
}

// Helper validation functions
function validateNumber(
    value: unknown,
    field: string,
    errors: string[],
    min?: number,
    max?: number
): void {
    if (typeof value !== 'number') {
        errors.push(`${field} must be a number`);
        return;
    }

    if (min !== undefined && value < min) {
        errors.push(`${field} must be >= ${min}`);
    }

    if (max !== undefined && value > max) {
        errors.push(`${field} must be <= ${max}`);
    }
}

function validateString(value: unknown, field: string, errors: string[]): void {
    if (typeof value !== 'string' || value.length === 0) {
        errors.push(`${field} must be a non-empty string`);
    }
}

function validateBoolean(value: unknown, field: string, errors: string[]): void {
    if (typeof value !== 'boolean') {
        errors.push(`${field} must be a boolean`);
    }
}
