/**
 * @cjr/engine - Unit Tests: EventRingBuffer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    EventRingBuffer,
    EngineEventType,
    TEXT_IDS,
    type IEngineEvent,
} from '../events/EventRingBuffer.js';

describe('EventRingBuffer', () => {
    let buffer: EventRingBuffer;

    beforeEach(() => {
        buffer = new EventRingBuffer(10);
    });

    describe('push', () => {
        it('should add events to buffer', () => {
            const result = buffer.push(EngineEventType.PARTICLE_BURST, 1, 100, 200, 0xff0000);

            expect(result).toBe(true);
            expect(buffer.getCount()).toBe(1);
        });

        it('should return false on overflow', () => {
            // Fill buffer to capacity
            for (let i = 0; i < 10; i++) {
                buffer.push(EngineEventType.EXPLODE, i, i * 10, i * 10, 0);
            }

            // Attempt to add one more
            const result = buffer.push(EngineEventType.EXPLODE, 11, 110, 110, 0);

            expect(result).toBe(false);
            expect(buffer.getCount()).toBe(10);
            expect(buffer.getOverflowCount()).toBe(1);
        });
    });

    describe('drain', () => {
        it('should process all events and clear buffer', () => {
            buffer.push(EngineEventType.FLOATING_TEXT, 1, 10, 20, TEXT_IDS.CATALYST);
            buffer.push(EngineEventType.SHOCKWAVE, 2, 30, 40, 100);

            const events: IEngineEvent[] = [];
            buffer.drain((e) => events.push({ ...e }));

            expect(events.length).toBe(2);
            expect(buffer.getCount()).toBe(0);

            expect(events[0].type).toBe(EngineEventType.FLOATING_TEXT);
            expect(events[0].entityId).toBe(1);
            expect(events[0].data).toBe(TEXT_IDS.CATALYST);

            expect(events[1].type).toBe(EngineEventType.SHOCKWAVE);
            expect(events[1].entityId).toBe(2);
        });

        it('should clear overflow count after drain', () => {
            // Fill and overflow
            for (let i = 0; i < 12; i++) {
                buffer.push(EngineEventType.EXPLODE, i, 0, 0, 0);
            }

            expect(buffer.getOverflowCount()).toBe(2);

            buffer.drain(() => { });

            expect(buffer.getOverflowCount()).toBe(0);
        });
    });

    describe('clear', () => {
        it('should clear all events without processing', () => {
            buffer.push(EngineEventType.RING_COMMIT, 1, 0, 0, 2);
            buffer.push(EngineEventType.TATTOO_ACTIVATE, 2, 0, 0, 0);

            buffer.clear();

            expect(buffer.getCount()).toBe(0);
        });
    });

    describe('hasEvents', () => {
        it('should return false for empty buffer', () => {
            expect(buffer.hasEvents()).toBe(false);
        });

        it('should return true when events exist', () => {
            buffer.push(EngineEventType.SCREEN_SHAKE, 0, 0, 0, 50);
            expect(buffer.hasEvents()).toBe(true);
        });
    });

    describe('getEvents (allocating)', () => {
        it('should return array copy and clear buffer', () => {
            buffer.push(EngineEventType.ENTITY_DEATH, 5, 500, 600, 0x00ff00);

            const events = buffer.getEvents();

            expect(events.length).toBe(1);
            expect(events[0].type).toBe(EngineEventType.ENTITY_DEATH);
            expect(events[0].entityId).toBe(5);
            expect(events[0].x).toBe(500);
            expect(events[0].y).toBe(600);
            expect(buffer.getCount()).toBe(0);
        });
    });
});

describe('EngineEventType', () => {
    it('should have distinct values', () => {
        const types = [
            EngineEventType.NONE,
            EngineEventType.RING_COMMIT,
            EngineEventType.TATTOO_ACTIVATE,
            EngineEventType.SCREEN_SHAKE,
            EngineEventType.PARTICLE_BURST,
            EngineEventType.ENTITY_DEATH,
            EngineEventType.FLOATING_TEXT,
            EngineEventType.SHOCKWAVE,
            EngineEventType.EXPLODE,
        ];

        const unique = new Set(types);
        expect(unique.size).toBe(types.length);
    });
});

describe('TEXT_IDS', () => {
    it('should have zero for NONE', () => {
        expect(TEXT_IDS.NONE).toBe(0);
    });

    it('should have distinct values', () => {
        const ids = Object.values(TEXT_IDS);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
    });
});
