export type TattooSynergyEffect = {
    id: string;
    synergyId: string;
    elapsed: number;
    duration: number;
    tier: 'basic' | 'advanced' | 'master' | 'legendary';
};

export class SynergyComponent {
    entityId: string;
    activeEffects: TattooSynergyEffect[];
    cooldowns: Map<string, number>;
    stats: Map<string, number>;
    discovered: Set<string>;

    constructor(entityId: string) {
        this.entityId = entityId;
        this.activeEffects = [];
        this.cooldowns = new Map();
        this.stats = new Map();
        this.discovered = new Set();
    }
}
