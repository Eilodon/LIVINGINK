import { PrismaClient } from '@prisma/client';

export class DatabaseService {
    private static instance: DatabaseService;
    public client: PrismaClient;

    private constructor() {
        this.client = new PrismaClient();
    }

    public static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    public async connect() {
        try {
            await this.client.$connect();
            console.log('Database connected successfully.');
        } catch (error) {
            console.error('Database connection failed:', error);
            process.exit(1);
        }
    }

    public async disconnect() {
        await this.client.$disconnect();
    }
}
