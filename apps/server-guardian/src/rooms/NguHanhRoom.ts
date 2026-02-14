import { Room, Client, ServerError } from "colyseus";
import { Schema, type, MapSchema } from "@colyseus/schema";
import { AuthSystem } from "../systems/AuthSystem";
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
    @type(PositionState) vel = new PositionState(); // Using same structure for velocity
}

export class NguHanhState extends Schema {
    @type("string") status: string = "waiting";
    @type("string") seed: string = "0";
    @type("number") time: number = 0;
    @type({ map: EntityState }) entities = new MapSchema<EntityState>();
}

// @ts-ignore
export class NguHanhRoom extends Room<NguHanhState> {
    private simulation: any; // Rust Simulation instance
    private rateLimiters = new Map<string, RateLimiter>();

    async onAuth(client: Client, options: any) {
        const auth = AuthSystem.getInstance();
        const profile = await auth.authenticate(client, options.token);

        // Store profile in client metadata for easy access
        // @ts-ignore
        client.userData = profile;
        console.log(`Client ${client.sessionId} authenticated as ${profile.name} (${profile.id})`);

        // Init Rate Limiter for this client (10 actions/sec, bucket size 20)
        this.rateLimiters.set(client.sessionId, new RateLimiter(20, 10));

        return true;
    }

    onCreate(options: any) {
        console.log("NguHanhRoom created!", options);
        const state = new NguHanhState();

        // Generate Secure Seed
        // Use crypto if available (Node 19+ has global crypto, or require it)
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

        // Initialize Rust Core (Deterministic)
        // Simulation(width, height, seed)
        this.simulation = new Simulation(8, 8, seedVal);
        console.log(`Rust Core Simulation initialized on Server! Seed: ${seedVal}`);

        // Set Simulation Loop (20Hz = 50ms)
        this.setSimulationInterval((dt) => this.update(dt), 50);

        this.onMessage("input", (client, message) => {
            // 1. Rate Limiting
            const limiter = this.rateLimiters.get(client.sessionId);
            if (!limiter || !limiter.tryConsume(1)) {
                console.warn(`Rate limit exceeded for client ${client.sessionId}`);
                return; // Silently drop or send error
            }

            // 2. Input Validation
            const validation = PayloadSchema.safeParse(message);
            if (!validation.success) {
                console.error(`Invalid input from ${client.sessionId}:`, validation.error);
                return;
            }

            const payload = validation.data;
            // console.log("Received valid input:", payload);

            // 3. Process Input
            if (payload.type === 'move') {
                // Forward to Rust simulation
                // this.simulation.queue_input(client.userData.id, payload.data);
            }
        });
    }

    update(dt: number) {
        // Rust Core Tick
        if (this.simulation) {
            this.simulation.update(dt);

            // Sync State
            const rawState = this.simulation.get_state();
            this.state.time = rawState.time;

            // Sync entities
            // For MVP, we iterate raw entities and update map
            // Ideally we use patch-based approach or binary
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
                // Sync velocity if needed
            });
        }
    }

    onJoin(client: Client, options: any) {
        console.log(client.sessionId, "joined!");
    }

    onLeave(client: Client, consented?: boolean) {
        console.log(client.sessionId, "left!", consented);
        this.rateLimiters.delete(client.sessionId);
    }

    onDispose() {
        console.log("room", this.roomId, "disposing...");
        if (this.simulation) {
            this.simulation.free();
        }
    }
}
