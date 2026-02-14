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

// Mock LocalStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
            store[key] = value.toString();
        },
        clear: () => {
            store = {};
        },
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
});

describe('NetworkManager Auth', () => {
    let networkManager: NetworkManager;

    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
        networkManager = new NetworkManager();
    });

    it('should send token if exists in localStorage', async () => {
        window.localStorage.setItem('ngu_hanh_token', 'test-token-123');

        // @ts-ignore
        const mockJoin = vi.fn().mockResolvedValue({ sessionId: 'session-id' });
        // @ts-ignore
        networkManager.client.joinOrCreate = mockJoin;

        await networkManager.connect();

        expect(mockJoin).toHaveBeenCalledWith('ngu_hanh', { token: 'test-token-123' });
    });

    it('should send undefined token if not in localStorage', async () => {
        // @ts-ignore
        const mockJoin = vi.fn().mockResolvedValue({ sessionId: 'session-id' });
        // @ts-ignore
        networkManager.client.joinOrCreate = mockJoin;

        await networkManager.connect();

        expect(mockJoin).toHaveBeenCalledWith('ngu_hanh', { token: null });
    });
});
