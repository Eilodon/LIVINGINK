import Redis from 'ioredis';

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

// Lua script for atomic token bucket operations
const script = `
local tokens_key = KEYS[1]
local timestamp_key = KEYS[2]
local rate = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local fill_time = capacity / rate
local ttl = math.floor(fill_time * 2)

local last_tokens = tonumber(redis.call("get", tokens_key))
if last_tokens == nil then
  last_tokens = capacity
end

local last_refill = tonumber(redis.call("get", timestamp_key))
if last_refill == nil then
  last_refill = 0
end

local delta = math.max(0, now - last_refill)
local filled_tokens = math.min(capacity, last_tokens + (delta * rate))
local allowed = filled_tokens >= requested
local new_tokens = filled_tokens

if allowed then
  new_tokens = filled_tokens - requested
end

redis.call("setex", tokens_key, ttl, new_tokens)
redis.call("setex", timestamp_key, ttl, now)

return allowed
`;

export class RateLimiter {
    private maxTokens: number;
    private refillRate: number; // Tokens per second
    private client: Redis | null;

    constructor(maxTokens: number, refillRate: number) {
        this.maxTokens = maxTokens;
        this.refillRate = refillRate;
        this.client = redis; // Shared client instance
    }

    // In-memory fallback if Redis is not connected
    private memoryTokens: number = 0;
    private lastRefillTimestamp: number = Date.now();

    public async tryConsume(key: string, tokens = 1): Promise<boolean> {
        if (!this.client) {
            return this.tryConsumeMemory(tokens);
        }

        try {
            const now = Date.now() / 1000;
            const result = await this.client.eval(
                script,
                2,
                `ratelimit:${key}:tokens`,
                `ratelimit:${key}:ts`,
                this.refillRate,
                this.maxTokens,
                now,
                tokens
            );
            return result === 1;
        } catch (e) {
            console.error("Redis RateLimit Error:", e);
            return this.tryConsumeMemory(tokens); // Fallback to safe
        }
    }

    // Fallback logic (Token Bucket)
    private tryConsumeMemory(tokens: number): boolean {
        // Simple fallback implementation, per-instance (not distributed)
        // Since we are creating a new RateLimiter per connection in NguHanhRoom, 
        // this fallback works per-user but won't scale across server instances if used for global limits.
        // For per-user limits, it is fine as long as user is sticky to one server (Colyseus default).

        // Refill
        const now = Date.now();
        const elapsed = (now - this.lastRefillTimestamp) / 1000;
        if (elapsed > 0) {
            this.memoryTokens = Math.min(this.maxTokens, this.memoryTokens + (elapsed * this.refillRate));
            this.lastRefillTimestamp = now;
        }

        if (this.memoryTokens >= tokens) {
            this.memoryTokens -= tokens;
            return true;
        }
        return false;
    }
}

