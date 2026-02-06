import { SkillStore, TransformStore, PhysicsStore, StateStore, MAX_ENTITIES, EntityFlags, defaultWorld } from '@cjr/engine';
import { vfxBuffer, VFX_TYPES } from '../../VFXRingBuffer'; // Import trực tiếp Buffer
const w = defaultWorld;

// EIDOLON-V: CONST ENUM để Inline số nguyên (Tối ưu biên dịch)
export const enum ShapeEnum {
  CIRCLE = 1,
  SQUARE = 2,
  TRIANGLE = 3,
  HEX = 4,
}

export class SkillSystem {
  static handleInput(
    id: number,
    input: { space: boolean; target: { x: number; y: number } },
    state: any
  ) {
    // Validation nhanh bằng Bitmask
    if ((w.stateFlags[id] & EntityFlags.ACTIVE) === 0) return;

    if (!input.space) return;

    const sIdx = id * 4; // SkillStore.STRIDE = 4
    // Check Cooldown
    if (SkillStore.data[sIdx] > 0) return;

    // Execute
    const shapeId = SkillStore.data[sIdx + 3];
    this.executeSkillDOD(id, shapeId, input.target);

    // Reset Cooldown (Index 1 = MaxCooldown)
    SkillStore.data[sIdx] = SkillStore.data[sIdx + 1];
  }

  static update(dt: number) {
    const count = MAX_ENTITIES;
    const flags = w.stateFlags;
    const data = SkillStore.data;

    // Vòng lặp đơn giản, CPU branch prediction sẽ làm việc tốt
    for (let id = 0; id < count; id++) {
      if ((flags[id] & EntityFlags.ACTIVE) === 0) continue;

      const idx = id * 4;
      if (data[idx] > 0) {
        data[idx] -= dt;
      }
    }
  }

  private static executeSkillDOD(id: number, shapeId: number, target: { x: number; y: number }) {
    const tIdx = id * 8;
    const pIdx = id * 8;
    const tData = w.transform;
    const pData = w.physics;

    const x = tData[tIdx];
    const y = tData[tIdx + 1];
    const vx = pData[pIdx];
    const vy = pData[pIdx + 1];

    // 1. Circle (Jet Dash)
    if (shapeId === ShapeEnum.CIRCLE) {
      // Normalized Velocity Logic
      // Tránh Math.sqrt nếu vận tốc quá nhỏ
      const speedSq = vx * vx + vy * vy;
      let dx = 1,
        dy = 0;

      if (speedSq > 0.001) {
        const invMag = 1.0 / Math.sqrt(speedSq);
        dx = vx * invMag;
        dy = vy * invMag;
      }

      const dashPower = 800;
      pData[pIdx] = dx * dashPower;
      pData[pIdx + 1] = dy * dashPower;

      // EIDOLON-V FIX: ZERO ALLOCATION VFX
      // Không lookup Entity để lấy ID string.
      // Đẩy thẳng tọa độ và loại VFX vào Buffer.
      // Màu sắc: Tạm thời hardcode màu Cyan (0x00FFFF) cho Skill Dash.
      // (Sau này có thể thêm Color vào SkillStore nếu cần)
      vfxBuffer.push(x, y, 0x00ffff, VFX_TYPES.PARTICLE_BURST, 10); // Data=10 particles
    }

    // 2. Square (Shockwave)
    else if (shapeId === ShapeEnum.SQUARE) {
      // Logic Shockwave (Tạm thời push VFX để test)
      vfxBuffer.push(x, y, 0xff00ff, VFX_TYPES.SHOCKWAVE, 150); // Data=Radius
    }
  }
}
