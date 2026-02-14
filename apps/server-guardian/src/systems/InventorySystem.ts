import { DatabaseService } from "../services/DatabaseService";
import { EconomySystem } from "./EconomySystem";

export class InventorySystem {
    private static instance: InventorySystem;
    private db: DatabaseService;
    private economy: EconomySystem;

    private constructor() {
        this.db = DatabaseService.getInstance();
        this.economy = EconomySystem.getInstance();
    }

    public static getInstance(): InventorySystem {
        if (!InventorySystem.instance) {
            InventorySystem.instance = new InventorySystem();
        }
        return InventorySystem.instance;
    }

    public async addItem(userId: string, itemId: string, quantity: number = 1): Promise<void> {
        if (quantity <= 0) return;

        await this.db.connect();

        // Upsert logic: if item exists in inventory, increment quantity. If not, create.
        const existing = await this.db.client.inventoryItem.findFirst({
            where: { userId, itemId }
        });

        if (existing) {
            await this.db.client.inventoryItem.update({
                where: { id: existing.id },
                data: { quantity: { increment: quantity } }
            });
        } else {
            // Check if Item exists in Definition (optional but good practice)
            // For MVP we assume itemId is valid or we create a dummy Item if needed.
            // But strict FK requires Item to exist.
            // We assume seeding script populated Items.

            await this.db.client.inventoryItem.create({
                data: {
                    userId,
                    itemId,
                    quantity
                }
            });
        }
    }

    public async hasItem(userId: string, itemId: string): Promise<boolean> {
        await this.db.connect();
        const item = await this.db.client.inventoryItem.findFirst({
            where: { userId, itemId, quantity: { gt: 0 } }
        });
        return !!item;
    }

    public async getInventory(userId: string): Promise<any[]> {
        await this.db.connect();
        return this.db.client.inventoryItem.findMany({
            where: { userId },
            include: { item: true }
        });
    }

    /**
     * Atomic Purchase Transaction
     */
    public async purchaseItem(userId: string, itemId: string, costType: 'gold' | 'gems', costAmount: number): Promise<boolean> {
        await this.db.connect();
        const prisma = this.db.client;

        try {
            await prisma.$transaction(async (tx) => {
                // 1. Deduct Currency (throws if insufficient)
                const wallet = await tx.wallet.findUnique({ where: { userId } });
                if (!wallet || wallet[costType] < costAmount) {
                    throw new Error("Insufficient Funds");
                }

                await tx.wallet.update({
                    where: { userId },
                    data: { [costType]: { decrement: costAmount } }
                });

                // 2. Add Item
                const existing = await tx.inventoryItem.findFirst({
                    where: { userId, itemId }
                });

                if (existing) {
                    await tx.inventoryItem.update({
                        where: { id: existing.id },
                        data: { quantity: { increment: 1 } }
                    });
                } else {
                    await tx.inventoryItem.create({
                        data: { userId, itemId, quantity: 1 }
                    });
                }
            });

            return true;
        } catch (error) {
            console.error(`InventorySystem: Purchase failed for ${userId}`, error);
            return false;
        }
    }
}
