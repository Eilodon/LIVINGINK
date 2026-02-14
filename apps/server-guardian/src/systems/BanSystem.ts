/**
 * BanSystem — Hệ Thống Xử Phạt Lũy Tiến
 * 
 * Quy tắc:
 *   Lần 1-2: WARNING → log vào DB
 *   Lần 3:   TEMP_BAN 24h → ngắt kết nối
 *   Lần 4+:  PERM_BAN → cấm vĩnh viễn
 * 
 * Dùng Prisma BanRecord model.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type BanType = 'WARNING' | 'TEMP_BAN' | 'PERM_BAN';

export interface BanAction {
    type: BanType;
    expiresAt: Date | null;
    message: string;
}

export class BanSystem {
    private static instance: BanSystem;

    private constructor() { }

    static getInstance(): BanSystem {
        if (!BanSystem.instance) {
            BanSystem.instance = new BanSystem();
        }
        return BanSystem.instance;
    }

    /**
     * Đếm số lần vi phạm trong quá khứ
     */
    async getWarningCount(userId: string): Promise<number> {
        return prisma.banRecord.count({
            where: { userId }
        });
    }

    /**
     * Kiểm tra user có đang bị ban không
     */
    async isBanned(userId: string): Promise<boolean> {
        const activeBan = await prisma.banRecord.findFirst({
            where: {
                userId,
                type: { in: ['TEMP_BAN', 'PERM_BAN'] },
                OR: [
                    { expiresAt: null },           // Perm ban — không có ngày hết hạn
                    { expiresAt: { gt: new Date() } } // Temp ban chưa hết hạn
                ]
            }
        });
        return activeBan !== null;
    }

    /**
     * Xử phạt lũy tiến dựa trên lịch sử
     */
    async punish(userId: string, reason: string, evidence: any): Promise<BanAction> {
        const priorCount = await this.getWarningCount(userId);

        let type: BanType;
        let expiresAt: Date | null = null;
        let message: string;

        if (priorCount < 2) {
            // Lần 1-2: Warning
            type = 'WARNING';
            message = `⚠️ Cảnh cáo lần ${priorCount + 1}: ${reason}`;
        } else if (priorCount === 2) {
            // Lần 3: Temp ban 24h
            type = 'TEMP_BAN';
            expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            message = `🔒 Tạm khoá 24h do vi phạm nhiều lần: ${reason}`;
        } else {
            // Lần 4+: Perm ban
            type = 'PERM_BAN';
            message = `🚫 Khoá vĩnh viễn do tái phạm: ${reason}`;
        }

        // Ghi vào DB
        await prisma.banRecord.create({
            data: {
                userId,
                type,
                reason,
                evidence: evidence ?? undefined,
                expiresAt
            }
        });

        console.log(`[BanSystem] ${type} for user ${userId}: ${reason}`);

        return { type, expiresAt, message };
    }
}
