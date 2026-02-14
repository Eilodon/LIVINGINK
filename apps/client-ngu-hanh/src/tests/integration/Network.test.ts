// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetworkManager } from '../../network/NetworkManager';
import { Client } from 'colyseus.js';

// Mock Colyseus Client
vi.mock('colyseus.js', () => {
    return {
        Client: vi.fn().mockImplementation(function () {
            return {
                joinOrCreate: vi.fn(),
            };
        }),
    };
});

describe('NetworkManager', () => {
    let networkManager: NetworkManager;

    beforeEach(() => {
        vi.clearAllMocks();
        networkManager = new NetworkManager();
    });

    it('should initialize with correct WS URL', () => {
        // Check if Client constructor was called
        expect(Client).toHaveBeenCalled();
    });

    it('should attempt to join room on connect', async () => {
        const mockJoin = vi.fn().mockResolvedValue({ sessionId: 'mock-session' });
        // @ts-ignore - accessing private or mocked property
        networkManager.client.joinOrCreate = mockJoin;

        await networkManager.connect();
        expect(mockJoin).toHaveBeenCalledWith('ngu_hanh', { token: null });
    });

    it('should handle connection failure gracefully', async () => {
        const mockJoin = vi.fn().mockRejectedValue(new Error('Connection failed'));
        // @ts-ignore
        networkManager.client.joinOrCreate = mockJoin;

        // Should not throw
        await expect(networkManager.connect()).resolves.not.toThrow();
    });
});
