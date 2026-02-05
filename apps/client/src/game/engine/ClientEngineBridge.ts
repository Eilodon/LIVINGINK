/**
 * ClientEngineBridge
 * 
 * Bridges the headless @cjr/engine to client-side VFX systems.
 * Drains engine events and translates them to PixiJS VFX calls.
 */

import {
    eventBuffer,
    EngineEventType,
    TEXT_IDS,
    type IEngineEvent
} from '@cjr/engine';
import { vfxBuffer, VFX_TYPES, packHex } from './VFXRingBuffer';
import { EntityLookup } from '@cjr/engine';
import type { RingId } from '../cjr/cjrTypes';

// Text lookup table for floating text events
const TEXT_STRINGS: Record<number, { text: string; color: string }> = {
    [TEXT_IDS.NONE]: { text: '', color: '#ffffff' },
    [TEXT_IDS.CATALYST]: { text: 'CATALYST!', color: '#00ffff' },
    [TEXT_IDS.SHIELD]: { text: 'SHIELD!', color: '#4488ff' },
    [TEXT_IDS.CLEANSE]: { text: 'CLEANSE', color: '#88ff88' },
    [TEXT_IDS.MASS]: { text: '+MASS', color: '#ffff00' },
    [TEXT_IDS.BOSS_SLAIN]: { text: 'BOSS SLAIN!', color: '#ffcc00' },
    [TEXT_IDS.RING_2]: { text: 'RING 2!', color: '#3b82f6' },
    [TEXT_IDS.RING_3]: { text: 'RING 3!', color: '#ef4444' },
    [TEXT_IDS.RING_1]: { text: 'RING 1', color: '#475569' },
    [TEXT_IDS.CANDY_VEIN]: { text: 'CANDY VEIN!', color: '#ff00ff' },
    [TEXT_IDS.MUTATION]: { text: 'MUTATION!', color: '#9333ea' },
    [TEXT_IDS.OVERDRIVE]: { text: 'OVERDRIVE!', color: '#FF5722' },
    [TEXT_IDS.INKED]: { text: 'INKED!', color: '#ff66cc' },
};

export class ClientEngineBridge {
    private vfxEnabled = true;

    /**
     * Enable/disable VFX processing
     */
    setVFXEnabled(enabled: boolean): void {
        this.vfxEnabled = enabled;
    }

    /**
     * Drain all engine events and translate to VFX calls
     * Call this after engine.update() each frame
     */
    drainEvents(): void {
        if (!this.vfxEnabled) {
            eventBuffer.clear();
            return;
        }

        eventBuffer.drain((event: IEngineEvent) => this.handleEngineEvent(event));
    }

    /**
     * Handle individual engine event
     */
    private handleEngineEvent(event: IEngineEvent): void {
        switch (event.type) {
            case EngineEventType.PARTICLE_BURST:
                vfxBuffer.push(
                    event.x,
                    event.y,
                    event.data, // Color packed as int
                    VFX_TYPES.PARTICLE_BURST,
                    10 // Particle count
                );
                break;

            case EngineEventType.SHOCKWAVE:
                vfxBuffer.push(
                    event.x,
                    event.y,
                    0xff00ff, // Magenta
                    VFX_TYPES.SHOCKWAVE,
                    event.data // Radius
                );
                break;

            case EngineEventType.EXPLODE:
                vfxBuffer.push(
                    event.x,
                    event.y,
                    event.data, // Color
                    VFX_TYPES.EXPLODE,
                    15 // Particle count
                );
                break;

            case EngineEventType.FLOATING_TEXT: {
                const textInfo = TEXT_STRINGS[event.data] ?? TEXT_STRINGS[TEXT_IDS.NONE];
                if (textInfo.text) {
                    vfxBuffer.push(
                        event.x,
                        event.y,
                        packHex(textInfo.color),
                        VFX_TYPES.FLOATING_TEXT,
                        event.data // TextId for lookup
                    );
                }
                break;
            }

            case EngineEventType.TATTOO_ACTIVATE: {
                // Push tattoo VFX directly to buffer
                vfxBuffer.push(
                    event.x,
                    event.y,
                    packHex('#a855f7'),
                    VFX_TYPES.RING_PULSE,
                    0
                );
                vfxBuffer.push(
                    event.x,
                    event.y - 60,
                    packHex('#a855f7'),
                    VFX_TYPES.FLOATING_TEXT,
                    TEXT_IDS.MUTATION
                );
                break;
            }

            case EngineEventType.RING_COMMIT: {
                // event.data contains ringId (1, 2, or 3)
                const ringId = event.data as RingId;
                let textId: number = TEXT_IDS.RING_1;
                if (ringId === 2) textId = TEXT_IDS.RING_2;
                else if (ringId === 3) textId = TEXT_IDS.RING_3;

                // Ring pulse effect
                vfxBuffer.push(
                    event.x,
                    event.y,
                    0xffffff,
                    VFX_TYPES.RING_PULSE,
                    ringId
                );

                // Floating text
                vfxBuffer.push(
                    event.x,
                    event.y - 50,
                    packHex('#ffd700'),
                    VFX_TYPES.FLOATING_TEXT,
                    textId
                );
                break;
            }

            case EngineEventType.SCREEN_SHAKE:
                // Screen shake is handled through the VFXSystem directly
                // This event is informative only; actual shake via object reference
                break;

            case EngineEventType.ENTITY_DEATH:
                vfxBuffer.push(
                    event.x,
                    event.y,
                    event.data, // Color
                    VFX_TYPES.EXPLODE,
                    20 // Large explosion
                );
                break;
        }
    }
}

// Singleton instance
export const clientEngineBridge = new ClientEngineBridge();
