import { Room, Client, ServerError } from "colyseus";
import { Schema, type, MapSchema } from "@colyseus/schema";
import { AuthSystem, UserProfile } from "../systems/AuthSystem.js";
import { EconomySystem } from "../systems/EconomySystem.js";
import { InventorySystem } from "../systems/InventorySystem.js";
import { BattlePassSystem } from "../systems/BattlePassSystem.js";
import { RateLimiter } from "../utils/RateLimiter.js";
import { PayloadSchema, LevelCompleteSchema } from "../schemas/InputSchemas.js";
import { GameValidator, Move } from "../systems/GameValidator.js";
import { BanSystem } from "../systems/BanSystem.js";
import { BehavioralAnalyzer, TimestampedMove } from "../systems/BehavioralAnalyzer.js";

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

    // Anti-Cheat
    private validator = GameValidator.getInstance();
    private banSystem = BanSystem.getInstance();
    private analyzer = BehavioralAnalyzer.getInstance();
    private moveLog: Map<string, Move[]> = new Map();
    private timestampedMoves: Map<string, TimestampedMove[]> = new Map();
    private tickCount: number = 0;

    // Systems
    private economy = EconomySystem.getInstance();
    private inventory = InventorySystem.getInstance();
    private battlePass = BattlePassSystem.getInstance();

    async onAuth(client: Client, options: any) {
        const auth = AuthSystem.getInstance();
        const profile = await auth.authenticate(client, options.token);

        // Kiểm tra ban status
        if (await this.banSystem.isBanned(profile.id)) {
            throw new ServerError(403, "Tài khoản bị khoá.");
        }

        // Store profile in client metadata
        client.userData = profile;
        console.log(`Client ${client.sessionId} authenticated as ${profile.name} (${profile.id})`);

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

        // --- INPUT HANDLER ---
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
                    const { x1, y1, x2, y2 } = payload.data;

                    // Forward tới Rust simulation
                    this.simulation.swap(x1, y1, x2, y2);
                    this.simulation.tick_grid();

                    // Log move cho anti-cheat validation
                    const sessionMoves = this.moveLog.get(client.sessionId) || [];
                    sessionMoves.push({ tick: this.tickCount, x1, y1, x2, y2 });
                    this.moveLog.set(client.sessionId, sessionMoves);

                    // Log timestamped move cho behavioral analysis
                    const tsMoves = this.timestampedMoves.get(client.sessionId) || [];
                    tsMoves.push({ tick: this.tickCount, timestamp: Date.now(), x1, y1, x2, y2 });
                    this.timestampedMoves.set(client.sessionId, tsMoves);
                }
                else if (payload.type === 'purchase') {
                    const success = await this.inventory.purchaseItem(user.id, payload.data.itemId, 'gold', 100);
                    if (success) {
                        this.syncPlayerState(client);
                        client.send("notification", { type: "success", message: `Purchased ${payload.data.itemId}` });
                    } else {
                        client.send("notification", { type: "error", message: "Purchase failed" });
                    }
                }
                else if (payload.type === 'claim_reward') {
                    const success = true; // Mock — full tracks chưa có trong DB
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

        // --- LEVEL COMPLETE HANDLER ---
        this.onMessage("level_complete", async (client, message) => {
            const user = client.userData as UserProfile;
            const validation = LevelCompleteSchema.safeParse(message);
            if (!validation.success) {
                console.error(`Invalid level_complete from ${client.sessionId}`);
                return;
            }

            const { score, checksum } = validation.data;
            const moves = this.moveLog.get(client.sessionId) || [];
            const tsMoves = this.timestampedMoves.get(client.sessionId) || [];
            const seed = BigInt(this.state.seed);

            // 1. Deterministic Replay Validation
            const result = this.validator.validateLevelCompletion(
                8, 8, seed, moves, score, checksum
            );
            console.log(`[GameValidator] User ${user.id}: valid=${result.isValid}, ` +
                `server=${result.serverScore} vs client=${score}, replay=${result.replayTimeMs}ms`);

            // 2. Behavioral Analysis
            const autoPlay = this.analyzer.detectAutoPlay(tsMoves);
            if (autoPlay.isBot) {
                console.warn(`[BehavioralAnalyzer] Bot detected: ${user.id}`, autoPlay.reasons);
            }

            // 3. Suspicion Score
            const suspicion = this.analyzer.calculateSuspicionScore(
                autoPlay, result.serverChecksum === checksum, result.serverScore >= score
            );

            // 4. Xử phạt nếu cần
            if (!result.isValid || suspicion >= 0.7) {
                const action = await this.banSystem.punish(
                    user.id,
                    `Suspicion=${suspicion.toFixed(2)}, anomalies=${result.anomalies.length}`,
                    { anomalies: result.anomalies, autoPlay, suspicion }
                );
                client.send("notification", { type: "warning", message: action.message });

                if (action.type === 'TEMP_BAN' || action.type === 'PERM_BAN') {
                    client.leave(4000); // Kick
                }
            } else {
                // Score hợp lệ → ghi điểm, thưởng XP
                await this.battlePass.addXp(user.id, Math.floor(result.serverScore / 10));
                this.syncPlayerState(client);
                client.send("level_result", {
                    valid: true,
                    score: result.serverScore
                });
            }

            // 5. Cleanup session data
            this.moveLog.delete(client.sessionId);
            this.timestampedMoves.delete(client.sessionId);
        });
    }

    update(dt: number) {
        this.tickCount++;
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
        // Cleanup anti-cheat data
        this.moveLog.delete(client.sessionId);
        this.timestampedMoves.delete(client.sessionId);
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
