import { Client } from "colyseus";
import { v4 as uuidv4 } from "uuid";
import { DatabaseService } from "../services/DatabaseService";

export interface UserProfile {
    id: string;
    isGuest: boolean;
    name: string;
    wallet?: {
        gold: number;
        gems: number;
    };
}

export class AuthSystem {
    private static instance: AuthSystem;
    private db: DatabaseService;

    private constructor() {
        this.db = DatabaseService.getInstance();
    }

    public static getInstance(): AuthSystem {
        if (!AuthSystem.instance) {
            AuthSystem.instance = new AuthSystem();
        }
        return AuthSystem.instance;
    }

    public async authenticate(client: Client, token?: string): Promise<UserProfile> {
        await this.db.connect();
        const prisma = this.db.client;

        // 1. Try to find existing user by ID (assuming token IS the ID for this MVP phase)
        // In production, token should be a JWT, verifying ID.
        if (token) {
            const user = await prisma.user.findUnique({
                where: { id: token },
                include: { wallet: true }
            });

            if (user) {
                return {
                    id: user.id,
                    isGuest: false,
                    name: user.username,
                    wallet: user.wallet ? { gold: user.wallet.gold, gems: user.wallet.gems } : { gold: 0, gems: 0 }
                };
            }
        }

        // 2. Create Guest/New User
        // For MVP, we auto-create a user if not found or no token.
        // In real app, separate login vs register.

        const newId = uuidv4();
        const username = `Guest-${newId.substring(0, 6)}`;

        try {
            const user = await prisma.user.create({
                data: {
                    id: newId,
                    username: username,
                    wallet: {
                        create: {
                            gold: 100, // Starter Gold
                            gems: 10   // Starter Gems
                        }
                    }
                },
                include: { wallet: true }
            });

            return {
                id: user.id,
                isGuest: true, // It is a new account, effectively guest until bound
                name: user.username,
                wallet: { gold: user.wallet!.gold, gems: user.wallet!.gems }
            };
        } catch (e) {
            console.error("Failed to create user", e);
            throw new Error("Auth Failed");
        }
    }
}
