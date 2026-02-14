/**
 * BehavioralAnalyzer — Phân Tích Hành Vi Input
 * 
 * Phân tích DẠNG Colyseus messages (không phải raw mouse):
 *   - Khoảng cách thời gian giữa các move
 *   - Độ lệch chuẩn (σ) — bot có σ cực thấp
 *   - Tần suất move bất thường
 * 
 * Không dùng AI/ML — dùng thống kê đơn giản,
 * nhanh, deterministic, dễ debug.
 */

export interface TimestampedMove {
    tick: number;
    timestamp: number; // Date.now() khi server nhận message
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export interface TimingResult {
    avgIntervalMs: number;      // Trung bình khoảng cách giữa các move
    stdDevMs: number;           // Độ lệch chuẩn
    minIntervalMs: number;      // Khoảng cách ngắn nhất
    maxIntervalMs: number;      // Khoảng cách dài nhất
    totalMoves: number;
    movesPerSecond: number;
    isSuspicious: boolean;
}

export interface AutoPlayDetection {
    isBot: boolean;
    confidence: number;     // 0.0 - 1.0
    reasons: string[];
}

export class BehavioralAnalyzer {
    private static instance: BehavioralAnalyzer;

    // Ngưỡng — conservative để tránh false positive
    private static readonly MIN_HUMAN_STD_DEV_MS = 50;      // Con người có σ >= 50ms
    private static readonly MIN_HUMAN_INTERVAL_MS = 100;     // < 100ms between moves = bất thường
    private static readonly MAX_MOVES_PER_SECOND = 5;        // Không ai swipe > 5 lần/giây liên tục

    private constructor() { }

    static getInstance(): BehavioralAnalyzer {
        if (!BehavioralAnalyzer.instance) {
            BehavioralAnalyzer.instance = new BehavioralAnalyzer();
        }
        return BehavioralAnalyzer.instance;
    }

    /**
     * Phân tích khoảng cách thời gian giữa các move
     */
    analyzeTimingPattern(moves: TimestampedMove[]): TimingResult {
        if (moves.length < 2) {
            return {
                avgIntervalMs: 0,
                stdDevMs: 0,
                minIntervalMs: 0,
                maxIntervalMs: 0,
                totalMoves: moves.length,
                movesPerSecond: 0,
                isSuspicious: false
            };
        }

        // Tính intervals
        const intervals: number[] = [];
        for (let i = 1; i < moves.length; i++) {
            intervals.push(moves[i].timestamp - moves[i - 1].timestamp);
        }

        // Thống kê
        const sum = intervals.reduce((a, b) => a + b, 0);
        const avg = sum / intervals.length;
        const variance = intervals.reduce((s, v) => s + (v - avg) ** 2, 0) / intervals.length;
        const stdDev = Math.sqrt(variance);
        const min = Math.min(...intervals);
        const max = Math.max(...intervals);

        // Tổng thời gian chơi
        const totalTimeMs = moves[moves.length - 1].timestamp - moves[0].timestamp;
        const movesPerSecond = totalTimeMs > 0 ? (moves.length / (totalTimeMs / 1000)) : 0;

        const isSuspicious =
            stdDev < BehavioralAnalyzer.MIN_HUMAN_STD_DEV_MS ||
            min < BehavioralAnalyzer.MIN_HUMAN_INTERVAL_MS ||
            movesPerSecond > BehavioralAnalyzer.MAX_MOVES_PER_SECOND;

        return {
            avgIntervalMs: avg,
            stdDevMs: stdDev,
            minIntervalMs: min,
            maxIntervalMs: max,
            totalMoves: moves.length,
            movesPerSecond,
            isSuspicious
        };
    }

    /**
     * Phát hiện auto-play (bot) dựa trên timing
     */
    detectAutoPlay(moves: TimestampedMove[]): AutoPlayDetection {
        const timing = this.analyzeTimingPattern(moves);
        const reasons: string[] = [];
        let score = 0; // 0 = chắc chắn human, 1 = chắc chắn bot

        if (moves.length < 10) {
            // Không đủ data để phân tích
            return { isBot: false, confidence: 0, reasons: ['Insufficient data'] };
        }

        // 1. Timing quá đều (σ < 50ms) — bot nhấn đều tay
        if (timing.stdDevMs < BehavioralAnalyzer.MIN_HUMAN_STD_DEV_MS) {
            score += 0.4;
            reasons.push(`σ=${timing.stdDevMs.toFixed(1)}ms (< ${BehavioralAnalyzer.MIN_HUMAN_STD_DEV_MS}ms threshold)`);
        }

        // 2. Interval min quá thấp (< 100ms) — siêu nhân
        if (timing.minIntervalMs < BehavioralAnalyzer.MIN_HUMAN_INTERVAL_MS) {
            score += 0.3;
            reasons.push(`Min interval=${timing.minIntervalMs}ms (< ${BehavioralAnalyzer.MIN_HUMAN_INTERVAL_MS}ms)`);
        }

        // 3. Tần suất quá cao (> 5 moves/sec liên tục)
        if (timing.movesPerSecond > BehavioralAnalyzer.MAX_MOVES_PER_SECOND) {
            score += 0.3;
            reasons.push(`${timing.movesPerSecond.toFixed(1)} moves/sec (> ${BehavioralAnalyzer.MAX_MOVES_PER_SECOND})`);
        }

        return {
            isBot: score >= 0.6,
            confidence: Math.min(1, score),
            reasons
        };
    }

    /**
     * Tính điểm nghi ngờ tổng hợp từ timing + validation
     * Range: 0.0 (sạch) → 1.0 (chắc chắn gian lận)
     */
    calculateSuspicionScore(
        autoPlay: AutoPlayDetection,
        checksumValid: boolean,
        scoreValid: boolean
    ): number {
        let score = autoPlay.confidence * 0.4; // 40% weight cho behavioral

        if (!checksumValid) score += 0.4;      // 40% weight cho checksum
        if (!scoreValid) score += 0.2;         // 20% weight cho score

        return Math.min(1, score);
    }
}
