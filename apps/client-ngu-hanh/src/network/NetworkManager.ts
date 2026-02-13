import { Client, Room } from "colyseus.js";

export class NetworkManager {
    private client: Client;
    private room: Room | null = null;
    public entities: Map<number, any> = new Map();
    public onEntityAdd: ((id: number, data: any) => void) | null = null;
    public onEntityRemove: ((id: number) => void) | null = null;

    constructor() {
        this.client = new Client("ws://localhost:2567");
    }

    async connect() {
        try {
            this.room = await this.client.joinOrCreate("ngu_hanh");
            console.log("Joined room!", this.room.sessionId);

            this.room.state.entities.onAdd((entity: any, key: string) => {
                console.log("Entity added server-side:", entity);
                this.entities.set(entity.id, entity);
                if (this.onEntityAdd) this.onEntityAdd(entity.id, entity);

                // Listen for changes
                entity.pos.onChange(() => {
                    // console.log("Entity moved", entity.id, entity.pos.x, entity.pos.y);
                });
            });

            this.room.state.entities.onRemove((entity: any, key: string) => {
                console.log("Entity removed server-side:", entity);
                this.entities.delete(entity.id);
                if (this.onEntityRemove) this.onEntityRemove(entity.id);
            });

        } catch (e) {
            console.error("Join failed", e);
        }
    }
}
