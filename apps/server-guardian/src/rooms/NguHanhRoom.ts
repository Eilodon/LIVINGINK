import { Room, Client } from "colyseus";
import { Schema, type, MapSchema } from "@colyseus/schema";

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
    @type("number") time: number = 0;
    @type({ map: EntityState }) entities = new MapSchema<EntityState>();
}

// @ts-ignore
export class NguHanhRoom extends Room<NguHanhState> {
    private simulation: any; // Rust Simulation instance

    onCreate(options: any) {
        console.log("NguHanhRoom created!", options);
        this.setState(new NguHanhState());

        // Initialize Rust Core
        this.simulation = new Simulation();
        console.log("Rust Core Simulation initialized on Server!");

        // Set Simulation Loop (20Hz = 50ms)
        this.setSimulationInterval((dt) => this.update(dt), 50);

        this.onMessage("input", (client, message) => {
            console.log("Received input:", message);
            // TODO: fast-forward simulation with input
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
    }

    onDispose() {
        console.log("room", this.roomId, "disposing...");
        if (this.simulation) {
            this.simulation.free();
        }
    }
}
