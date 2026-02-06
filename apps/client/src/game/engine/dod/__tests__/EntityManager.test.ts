import { describe, it, expect, beforeEach } from 'vitest';
import { EntityManager, EntityHandle, entityManager } from '../EntityManager';

describe('EntityManager Generational Index', () => {
    let manager: EntityManager;

    beforeEach(() => {
        // Reset singleton (for testing only)
        (EntityManager as any).instance = null;
        manager = EntityManager.getInstance();
    });

    describe('createEntityHandle', () => {
        it('should return handle with index and generation', () => {
            const handle = manager.createEntityHandle();
            expect(handle).not.toBeNull();
            expect(handle!.index).toBeGreaterThanOrEqual(0);
            expect(handle!.generation).toBeGreaterThanOrEqual(0);
        });

        it('should return different indices for consecutive creates', () => {
            const h1 = manager.createEntityHandle();
            const h2 = manager.createEntityHandle();
            expect(h1!.index).not.toBe(h2!.index);
        });
    });

    describe('isValid', () => {
        it('should return true for valid handle', () => {
            const handle = manager.createEntityHandle()!;
            expect(manager.isValid(handle)).toBe(true);
        });

        it('should return false after entity is removed (ABA protection)', () => {
            const handle1 = manager.createEntityHandle()!;
            const index = handle1.index;

            manager.removeEntity(index);

            // Old handle should now be invalid
            expect(manager.isValid(handle1)).toBe(false);
        });

        it('should detect stale handle after entity reuse', () => {
            const handle1 = manager.createEntityHandle()!;
            const originalIndex = handle1.index;

            manager.removeEntity(originalIndex);

            // Create new entity - may reuse the same index
            const handle2 = manager.createEntityHandle()!;

            if (handle2.index === originalIndex) {
                // Same index but different generation
                expect(handle2.generation).toBeGreaterThan(handle1.generation);
                expect(manager.isValid(handle1)).toBe(false);
                expect(manager.isValid(handle2)).toBe(true);
            }
        });
    });

    describe('getGeneration', () => {
        it('should return current generation for index', () => {
            const handle = manager.createEntityHandle()!;
            const gen = manager.getGeneration(handle.index);
            expect(gen).toBe(handle.generation);
        });

        it('should increment generation on entity removal', () => {
            const handle = manager.createEntityHandle()!;
            const genBefore = manager.getGeneration(handle.index);

            manager.removeEntity(handle.index);

            const genAfter = manager.getGeneration(handle.index);
            expect(genAfter).toBe(genBefore + 1);
        });
    });

    describe('backward compatibility', () => {
        it('createEntity should still return number index', () => {
            const id = manager.createEntity();
            expect(typeof id).toBe('number');
            expect(id).toBeGreaterThanOrEqual(0);
        });
    });
});
