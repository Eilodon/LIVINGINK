import { DatabaseService } from "../services/DatabaseService";
import { EconomySystem } from "./EconomySystem";
import { InventorySystem } from "./InventorySystem";

export class BattlePassSystem {
    private static instance: BattlePassSystem;
    private db: DatabaseService;
    private economy: EconomySystem;
    private inventory: InventorySystem;

    // Config (should be in DB or Config file)
    private readonly XP_PER_LEVEL = 100;
    private readonly MAX_LEVEL = 100;

    private constructor() {
        this.db = DatabaseService.getInstance();
        this.economy = EconomySystem.getInstance();
        this.inventory = InventorySystem.getInstance();
    }

    public static getInstance(): BattlePassSystem {
        if (!BattlePassSystem.instance) {
            BattlePassSystem.instance = new BattlePassSystem();
        }
        return BattlePassSystem.instance;
    }

    public async addXp(userId: string, amount: number): Promise<{ level: number, xp: number }> {
        if (amount <= 0) return { level: 0, xp: 0 };

        await this.db.connect();
        const prisma = this.db.client;

        // Get Active Season
        const season = await prisma.season.findFirst({
            where: { active: true }
        });

        if (!season) throw new Error("No Active Season");

        // Get or Create User BP
        let bp = await prisma.userBattlePass.findUnique({
            where: { userId } // One BP per user? Or per user+season? Schema said userId unique, needs fix if multi-season.
            // For MVP: One active BP per user (connected to current season or updated)
        });

        if (!bp) {
            // Check if schema handles creates.
            // Schema has userId marked @unique, meaning 1-to-1.
            // In real app, it should be compound unique (userId, seasonId).
            // For MVP, we assume we update the BP record for the new season or create if missing.
            bp = await prisma.userBattlePass.create({
                data: {
                    userId,
                    seasonId: season.id,
                    level: 1,
                    xp: 0,
                    claimed: []
                }
            });
        }

        // Logic
        let newXp = bp.xp + amount;
        let newLevel = bp.level;

        while (newXp >= this.XP_PER_LEVEL && newLevel < this.MAX_LEVEL) {
            newXp -= this.XP_PER_LEVEL;
            newLevel++;
        }

        // Update DB
        const result = await prisma.userBattlePass.update({
            where: { id: bp.id },
            data: {
                level: newLevel,
                xp: newXp
            }
        });

        return { level: result.level, xp: result.xp };
    }

    public async claimReward(userId: string, level: number, track: 'FREE' | 'PREMIUM'): Promise<boolean> {
        await this.db.connect();
        const prisma = this.db.client;

        const bp = await prisma.userBattlePass.findUnique({ where: { userId } });
        if (!bp) return false;

        if (track === 'PREMIUM' && !bp.isPremium) return false;
        if (bp.level < level) return false;

        // Check if already claimed
        // claimed stored as Json array of strings: "LEVEL_TRACK" e.g. "1_FREE", "5_PREMIUM"
        const claimKey = `${level}_${track}`;
        const claimedList = (bp.claimed as string[]) || []; // Safe cast if JSON

        if (claimedList.includes(claimKey)) return false; // Already claimed

        // Fetch Reward Definition
        // This requires querying the BattlePassTrack from DB
        const trackDef = await prisma.battlePassTrack.findFirst({
            where: { seasonId: bp.seasonId, type: track }
        });

        if (!trackDef) return false;

        // Parse rewards JSON
        // Assume rewards: [{ level: 1, type: "currency", id: "gold", amount: 100 }]
        const rewards = (trackDef.rewards as any[]).filter((r: any) => r.level === level);

        if (rewards.length === 0) return false; // No reward for this level

        // Grant Rewards
        for (const reward of rewards) {
            if (reward.type === 'currency') {
                await this.economy.addCurrency(userId, reward.id, reward.amount);
            } else if (reward.type === 'item') {
                await this.inventory.addItem(userId, reward.id, reward.amount);
            }
        }

        // Mark as Claimed
        await prisma.userBattlePass.update({
            where: { id: bp.id },
            data: {
                claimed: [...claimedList, claimKey]
            }
        });

        return true;
    }
}
