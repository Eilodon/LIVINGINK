
// Bridge between ECS and React
import { WorldState } from '@cjr/engine';
import { EventEmitter } from 'eventemitter3';

export interface GameUIState {
    bossHP: number;
    bossMaxHP: number;
    bossState: 'IDLE' | 'WARNING' | 'ATTACK' | 'COOLDOWN';
    bossIntentTimer: number;
    levelStatus: 'PLAYING' | 'VICTORY' | 'DEFEAT';
    score: number;
    movesLeft: number;
    currentScreen: 'LEVEL_SELECT' | 'GAME';
    selectedLevelId: number;
    ashPercentage: number;
    stoneCount: number;
}

export class UISystem extends EventEmitter {
    private static instance: UISystem;

    // Simple state store
    public state: GameUIState = {
        bossHP: 1000,
        bossMaxHP: 1000,
        bossState: 'IDLE',
        bossIntentTimer: 0,
        levelStatus: 'PLAYING',
        score: 0,
        movesLeft: 20,
        currentScreen: 'LEVEL_SELECT', // Start at Level Select 
        selectedLevelId: 1,
        ashPercentage: 0,
        stoneCount: 0
    };

    private constructor() {
        super();
    }

    public static getInstance(): UISystem {
        if (!UISystem.instance) {
            UISystem.instance = new UISystem();
        }
        return UISystem.instance;
    }

    // Called by Game Loop (e.g. NguHanhModule or GameHost)
    public update(world: WorldState, bossData: any, levelData: any, boardStats: any) {
        let changed = false;

        // Sync Boss Data
        if (bossData) {
            if (this.state.bossHP !== bossData.hp) {
                this.state.bossHP = bossData.hp;
                changed = true;
            }
            if (this.state.bossMaxHP !== bossData.maxHP) {
                this.state.bossMaxHP = bossData.maxHP;
                changed = true;
            }
            // Map numeric state to string for UI
            const stateMap = ['IDLE', 'WARNING', 'ATTACK', 'COOLDOWN'];
            const stateStr = stateMap[bossData.state] || 'IDLE';
            if (this.state.bossState !== stateStr) {
                this.state.bossState = stateStr as any;
                changed = true;
            }
        }

        // Sync Level Data
        if (levelData) {
            if (this.state.score !== levelData.score) {
                this.state.score = levelData.score;
                changed = true;
            }
            if (this.state.movesLeft !== levelData.movesLeft) {
                this.state.movesLeft = levelData.movesLeft;
                changed = true;
            }
            if (levelData.status && this.state.levelStatus !== levelData.status) {
                this.state.levelStatus = levelData.status;
                changed = true;
            }
        }

        // Sync Board Stats (Ash/Stone)
        if (boardStats) {
            if (this.state.ashPercentage !== boardStats.ashPercentage) {
                this.state.ashPercentage = boardStats.ashPercentage;
                changed = true;
            }
            if (this.state.stoneCount !== boardStats.stoneCount) {
                this.state.stoneCount = boardStats.stoneCount;
                changed = true;
            }
        }

        if (changed) {
            this.emit('update', this.state);
        }
    }

    public setLevelStatus(status: 'PLAYING' | 'VICTORY' | 'DEFEAT') {
        if (this.state.levelStatus !== status) {
            this.state.levelStatus = status;
            this.emit('update', this.state);
        }
    }

    public switchScreen(screen: 'LEVEL_SELECT' | 'GAME') {
        this.state.currentScreen = screen;
        this.emit('update', this.state);
    }

    public selectLevel(levelId: number) {
        this.state.selectedLevelId = levelId;
        this.emit('update', this.state);
        this.emit('start_level', levelId); // Helper event
    }
}
