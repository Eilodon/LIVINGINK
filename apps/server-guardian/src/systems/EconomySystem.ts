import { DatabaseService } from "../services/DatabaseService";

export class EconomySystem {
    private static instance: EconomySystem;
    private db: DatabaseService;

    private constructor() {
        this.db = DatabaseService.getInstance();
    }

    public static getInstance(): EconomySystem {
        if (!EconomySystem.instance) {
            EconomySystem.instance = new EconomySystem();
        }
        return EconomySystem.instance;
    }

    /**
     * Adds currency to a user's wallet.
     * @param userId The user ID
     * @param type 'gold' | 'gems'
     * @param amount Amount to add (must be positive)
     */
    public async addCurrency(userId: string, type: 'gold' | 'gems', amount: number): Promise<{ gold: number, gems: number }> {
        if (amount <= 0) throw new Error("Amount must be positive");

        await this.db.connect();

        try {
            const updatedWallet = await this.db.client.wallet.update({
                where: { userId },
                data: {
                    [type]: { increment: amount }
                }
            });
            return { gold: updatedWallet.gold, gems: updatedWallet.gems };
        } catch (error) {
            console.error(`EconomySystem: Failed to add ${type} to ${userId}`, error);
            throw new Error("Transaction Failed");
        }
    }

    /**
     * Subtracts currency from a user's wallet.
     * Throws error if insufficient funds.
     * @param userId The user ID
     * @param type 'gold' | 'gems'
     * @param amount Amount to subtract (must be positive)
     */
    public async subtractCurrency(userId: string, type: 'gold' | 'gems', amount: number): Promise<{ gold: number, gems: number }> {
        if (amount <= 0) throw new Error("Amount must be positive");

        await this.db.connect();
        const prisma = this.db.client;

        try {
            // Transactional check and update
            const result = await prisma.$transaction(async (tx) => {
                const wallet = await tx.wallet.findUnique({ where: { userId } });
                if (!wallet) throw new Error("Wallet not found");

                if (wallet[type] < amount) {
                    throw new Error("Insufficient Funds");
                }

                const updated = await tx.wallet.update({
                    where: { userId },
                    data: {
                        [type]: { decrement: amount }
                    }
                });
                return updated;
            });

            return { gold: result.gold, gems: result.gems };
        } catch (error: any) {
            console.error(`EconomySystem: Failed to subtract ${type} from ${userId}`, error);
            throw error; // Re-throw to let caller handle "Insufficient Funds"
        }
    }

    /**
     * Gets the current balance of a user.
     * @param userId The user ID
     */
    public async getBalance(userId: string): Promise<{ gold: number, gems: number }> {
        await this.db.connect();
        const wallet = await this.db.client.wallet.findUnique({
            where: { userId }
        });

        if (!wallet) return { gold: 0, gems: 0 };
        return { gold: wallet.gold, gems: wallet.gems };
    }
}
