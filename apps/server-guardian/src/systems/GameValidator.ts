/**
 * GameValidator — Server-Side Deterministic Replay Validation
 * 
 * Nguyên lý: Server tạo Simulation mới từ cùng seed,
 * replay từng move theo thứ tự, so sánh checksum + score.
 * Nếu client gian lận → checksum sẽ khác.
 * 
 * Chi phí: O(n) với n = số moves. Chạy bất đồng bộ post-game.
 */

// Rust WASM (Node target)
const { Simulation } = require("core-rust");

// --- TYPES ---

export interface Move {
    tick: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export interface ValidationResult {
    isValid: boolean;
    serverScore: number;
    serverChecksum: number;
    clientScore: number;
    clientChecksum: number;
    anomalies: CheatDetection[];
    replayTimeMs: number;
}

export interface CheatDetection {
    type: 'IMPOSSIBLE_SCORE' | 'CHECKSUM_MISMATCH' | 'SPEED_HACK' | 'INVALID_MOVE';
    confidence: number;  // 0.0 - 1.0
    evidence: string;
}

// --- VALIDATOR ---

export class GameValidator {
    private static instance: GameValidator;

    private constructor() { }

    static getInstance(): GameValidator {
        if (!GameValidator.instance) {
            GameValidator.instance = new GameValidator();
        }
        return GameValidator.instance;
    }

    /**
     * Validate hoàn chỉnh 1 lượt chơi.
     * 
     * Server replay toàn bộ moves từ seed gốc,
     * so sánh score + checksum cuối cùng.
     */
    validateLevelCompletion(
        width: number,
        height: number,
        seed: bigint,
        moves: Move[],
        claimedScore: number,
        claimedChecksum: number
    ): ValidationResult {
        const startTime = Date.now();
        const anomalies: CheatDetection[] = [];

        let sim: any;
        try {
            // 1. Tạo Simulation mới từ seed gốc (deterministic)
            sim = new Simulation(width, height, seed);
        } catch (e) {
            return {
                isValid: false,
                serverScore: 0,
                serverChecksum: 0,
                clientScore: claimedScore,
                clientChecksum: claimedChecksum,
                anomalies: [{
                    type: 'IMPOSSIBLE_SCORE',
                    confidence: 1.0,
                    evidence: `Failed to initialize simulation: ${e}`
                }],
                replayTimeMs: Date.now() - startTime
            };
        }

        // 2. Sắp xếp moves theo tick (đề phòng client gửi không đúng thứ tự)
        const sortedMoves = [...moves].sort((a, b) => a.tick - b.tick);

        // 3. Replay từng move
        let lastTick = 0;
        for (const move of sortedMoves) {
            // Validate move bounds
            if (
                move.x1 < 0 || move.x1 >= width ||
                move.y1 < 0 || move.y1 >= height ||
                move.x2 < 0 || move.x2 >= width ||
                move.y2 < 0 || move.y2 >= height
            ) {
                anomalies.push({
                    type: 'INVALID_MOVE',
                    confidence: 1.0,
                    evidence: `Out of bounds: (${move.x1},${move.y1}) → (${move.x2},${move.y2})`
                });
                continue; // Skip invalid move, nhưng vẫn tiếp tục replay
            }

            // Validate adjacency (chỉ cho swap 1 ô kề nhau)
            const dx = Math.abs(move.x1 - move.x2);
            const dy = Math.abs(move.y1 - move.y2);
            if (dx + dy !== 1) {
                anomalies.push({
                    type: 'INVALID_MOVE',
                    confidence: 1.0,
                    evidence: `Non-adjacent swap: (${move.x1},${move.y1}) → (${move.x2},${move.y2}), distance=${dx + dy}`
                });
                continue;
            }

            // Kiểm tra speed hack: tick lùi hoặc quá nhanh
            if (move.tick < lastTick) {
                anomalies.push({
                    type: 'SPEED_HACK',
                    confidence: 0.8,
                    evidence: `Tick went backwards: ${move.tick} < ${lastTick}`
                });
            }
            lastTick = move.tick;

            // Advance simulation tới tick tương ứng
            // Mỗi tick = 1 lần gọi tick_grid()
            sim.swap(move.x1, move.y1, move.x2, move.y2);
            sim.tick_grid();
        }

        // 4. Lấy kết quả cuối từ server simulation
        const serverScore = sim.get_score();
        const serverChecksum = sim.get_checksum();

        // 5. So sánh
        if (serverChecksum !== claimedChecksum) {
            anomalies.push({
                type: 'CHECKSUM_MISMATCH',
                confidence: 0.95,
                evidence: `Server: ${serverChecksum} vs Client: ${claimedChecksum}`
            });
        }

        if (claimedScore > serverScore * 1.1) {
            // Cho phép sai lệch 10% do timing differences
            anomalies.push({
                type: 'IMPOSSIBLE_SCORE',
                confidence: 0.9,
                evidence: `Client claims ${claimedScore}, server computed ${serverScore} (${((claimedScore / serverScore - 1) * 100).toFixed(1)}% higher)`
            });
        }

        // 6. Giải phóng WASM memory
        try {
            sim.free();
        } catch (_) {
            // Ignore — some WASM builds don't expose free()
        }

        const replayTimeMs = Date.now() - startTime;

        // 7. Quyết định valid hay không
        const hasCriticalAnomaly = anomalies.some(a =>
            a.confidence >= 0.9 &&
            (a.type === 'CHECKSUM_MISMATCH' || a.type === 'IMPOSSIBLE_SCORE')
        );

        return {
            isValid: !hasCriticalAnomaly,
            serverScore,
            serverChecksum,
            clientScore: claimedScore,
            clientChecksum: claimedChecksum,
            anomalies,
            replayTimeMs
        };
    }
}
