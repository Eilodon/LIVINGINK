import { Client } from "colyseus";
import { v4 as uuidv4 } from "uuid";

interface UserProfile {
    id: string;
    isGuest: boolean;
    name: string;
}

export class AuthSystem {
    private static instance: AuthSystem;
    private sessions: Map<string, UserProfile> = new Map();

    private constructor() { }

    public static getInstance(): AuthSystem {
        if (!AuthSystem.instance) {
            AuthSystem.instance = new AuthSystem();
        }
        return AuthSystem.instance;
    }

    public async authenticate(client: Client, token?: string): Promise<UserProfile> {
        // Simple token logic for now: if token exists in map, return user.
        // real world: jwt verify

        if (token && this.sessions.has(token)) {
            return this.sessions.get(token)!;
        }

        // Guest logic
        const newId = uuidv4();
        const profile: UserProfile = {
            id: newId,
            isGuest: true,
            name: `Guest-${newId.substring(0, 6)}`
        };

        // In real app, we return a signed token here. 
        // For now, we trust the 'id' as the token for session persistence slightly
        this.sessions.set(newId, profile);
        return profile;
    }
}
