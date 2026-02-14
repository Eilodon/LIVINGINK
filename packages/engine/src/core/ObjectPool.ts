/**
 * Generic Object Pool
 * Reduces GC pressure for frequently created/destroyed objects.
 */
export class ObjectPool<T> {
    private pool: T[] = [];
    private factory: () => T;
    private reset?: (obj: T) => void;

    constructor(factory: () => T, reset?: (obj: T) => void, initialSize: number = 0) {
        this.factory = factory;
        this.reset = reset;

        for (let i = 0; i < initialSize; i++) {
            this.pool.push(factory());
        }
    }

    get(): T {
        if (this.pool.length > 0) {
            return this.pool.pop()!;
        }
        return this.factory();
    }

    release(obj: T) {
        if (this.reset) {
            this.reset(obj);
        }
        this.pool.push(obj);
    }

    clear() {
        this.pool = [];
    }

    get size(): number {
        return this.pool.length;
    }
}
