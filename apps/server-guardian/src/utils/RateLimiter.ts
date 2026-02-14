export class RateLimiter {
    private tokens: number;
    private maxTokens: number;
    private refillRate: number; // Tokens per second
    private lastRefillTimestamp: number;

    constructor(maxTokens: number, refillRate: number) {
        this.maxTokens = maxTokens;
        this.refillRate = refillRate;
        this.tokens = maxTokens;
        this.lastRefillTimestamp = Date.now();
    }

    public tryConsume(tokens = 1): boolean {
        this.refill();

        if (this.tokens >= tokens) {
            this.tokens -= tokens;
            return true;
        }

        return false;
    }

    private refill() {
        const now = Date.now();
        const elapsedSeconds = (now - this.lastRefillTimestamp) / 1000;

        if (elapsedSeconds > 0) {
            const newTokens = elapsedSeconds * this.refillRate;
            this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
            this.lastRefillTimestamp = now;
        }
    }
}
