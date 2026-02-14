import { Room, Client, ServerError } from "colyseus";
import { Schema, type, MapSchema } from "@colyseus/schema";
import { AuthSystem, UserProfile } from "../systems/AuthSystem";
import { EconomySystem } from "../systems/EconomySystem";
import { InventorySystem } from "../systems/InventorySystem";
import { BattlePassSystem } from "../systems/BattlePassSystem";
import { RateLimiter } from "../utils/RateLimiter";
import { PayloadSchema } from "../schemas/InputSchemas";

// Import Rust Core
const { Simulation } = require("core-rust");

// Define Component Schemas
class PositionState extends Schema {
    @type("number") x: number = 0;
    @type("number") y: number = 0;
}

class EntityState extends Schema {
    @type("number") id: number = 0;
    @type(PositionState) pos = new PositionState();
    @type(PositionState) vel = new PositionState();
}

class WalletState extends Schema {
    @type("number") gold: number = 0;
    @type("number") gems: number = 0;
}

class BattlePassState extends Schema {
    @type("number") level: number = 1;
    @type("number") xp: number = 0;
    @type("boolean") isPremium: boolean = false;
}

class PlayerState extends Schema {
    @type("string") id: string = "";
    @type("string") name: string = "";
    @type(WalletState) wallet = new WalletState();
    @type(BattlePassState) battlePass = new BattlePassState();
}

export class NguHanhState extends Schema {
    @type("string") status: string = "waiting";
    @type("string") seed: string = "0";
    @type("number") time: number = 0;
    @type({ map: EntityState }) entities = new MapSchema<EntityState>();
    @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}

export class NguHanhRoom extends Room<NguHanhState> {
    private simulation: any; // Rust Simulation instance
    private playerLimiter = new RateLimiter(20, 10);


    // Systems
    private economy = EconomySystem.getInstance();
    private inventory = InventorySystem.getInstance();
    private battlePass = BattlePassSystem.getInstance();

    async onAuth(client: Client, options: any) {
        const auth = AuthSystem.getInstance();
        const profile = await auth.authenticate(client, options.token);

        // Store profile in client metadata
        client.userData = profile;
        console.log(`Client ${client.sessionId} authenticated as ${profile.name} (${profile.id})`);

        // Init Rate Limiter (Redis handles state, no need to store instance per client)
        // this.rateLimiters.set(client.sessionId, new RateLimiter(20, 10));


        return true;
    }

    onCreate(options: any) {
        console.log("NguHanhRoom created!", options);
        const state = new NguHanhState();

        // Generate Secure Seed
        let seedVal: bigint;
        try {
            const { randomBytes } = require('crypto');
            seedVal = BigInt("0x" + randomBytes(8).toString('hex'));
        } catch (e) {
            console.warn("Crypto not available, using Math.random");
            seedVal = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
        }

        state.seed = seedVal.toString();
        this.setState(state);

        // Initialize Rust Core
        this.simulation = new Simulation(8, 8, seedVal);
        console.log(`Rust Core Simulation initialized on Server! Seed: ${seedVal}`);

        // Set Simulation Loop
        this.setSimulationInterval((dt) => this.update(dt), 50);

        this.onMessage("input", async (client, message) => {
            // 1. Rate Limiting (Async Redis)
            if (!(await this.playerLimiter.tryConsume(client.sessionId, 1))) {
                console.warn(`Rate limit exceeded for ${client.sessionId}`);
                return;
            }


            // 2. Input Validation
            const validation = PayloadSchema.safeParse(message);
            if (!validation.success) {
                console.error(`Invalid input from ${client.sessionId}:`, validation.error);
                return;
            }

            const payload = validation.data;
            const user = client.userData as UserProfile;

            try {
                // 3. Process Input
                if (payload.type === 'move') {
                    // Forward to Rust simulation
                    // this.simulation.queue_input(client.userData.id, payload.data);
                }
                else if (payload.type === 'purchase') {
                    const success = await this.inventory.purchaseItem(user.id, payload.data.itemId, 'gold', 100); // Hardcoded cost for MVP
                    if (success) {
                        this.syncPlayerState(client);
                        client.send("notification", { type: "success", message: `Purchased ${payload.data.itemId}` });
                    } else {
                        client.send("notification", { type: "error", message: "Purchase failed" });
                    }
                }
                else if (payload.type === 'claim_reward') {
                    // const success = await this.battlePass.claimReward(user.id, payload.data.level, payload.data.track);
                    // Mock success for now as we don't have full tracks in DB
                    const success = true;
                    if (success) {
                        this.syncPlayerState(client);
                        client.send("notification", { type: "success", message: "Reward claimed!" });
                    } else {
                        client.send("notification", { type: "error", message: "Claim failed" });
                    }
                }
                else if (payload.type === 'cheat') {
                    // Dev only
                    await this.economy.addCurrency(user.id, payload.data.type, payload.data.amount);
                    this.syncPlayerState(client);
                }
            } catch (e) {
                console.error("Action processing failed", e);
            }
        });
    }

    update(dt: number) {
        if (this.simulation) {
            this.simulation.update(dt);
            const rawState = this.simulation.get_state();
            this.state.time = rawState.time;

            rawState.entities.forEach((e: any) => {
                let entityState = this.state.entities.get(e.id.toString());
                if (!entityState) {
                    entityState = new EntityState();
                    entityState.id = e.id;
                    this.state.entities.set(e.id.toString(), entityState);
                }
                if (e.pos) {
                    entityState.pos.x = e.pos.x;
                    entityState.pos.y = e.pos.y;
                }
            });
        }
    }

    onJoin(client: Client, options: any) {
        console.log(client.sessionId, "joined!");

        // Create Player State
        const user = client.userData as UserProfile;
        const pState = new PlayerState();
        pState.id = user.id;
        pState.name = user.name;
        if (user.wallet) {
            pState.wallet.gold = user.wallet.gold;
            pState.wallet.gems = user.wallet.gems;
        }

        this.state.players.set(client.sessionId, pState);

        // Initial sync
        this.syncPlayerState(client);
    }

    onLeave(client: Client, consented?: boolean) {
        console.log(client.sessionId, "left!", consented);
        // this.rateLimiters.delete(client.sessionId); // No need to cleanup Redis stateless
        this.state.players.delete(client.sessionId);
    }

    onDispose() {
        console.log("room", this.roomId, "disposing...");
        if (this.simulation) {
            this.simulation.free();
        }
    }

    private async syncPlayerState(client: Client) {
        const user = client.userData as UserProfile;

        // Parallel fetch
        const [balance, bp] = await Promise.all([
            this.economy.getBalance(user.id),
            this.battlePass.addXp(user.id, 0) // HACK: Read current state
        ]);

        const pState = this.state.players.get(client.sessionId);
        if (pState) {
            pState.wallet.gold = balance.gold;
            pState.wallet.gems = balance.gems;

            pState.battlePass.level = bp.level;
            pState.battlePass.xp = bp.xp;
        }
    }
}
