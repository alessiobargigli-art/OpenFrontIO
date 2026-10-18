import { describe, expect, it, vi } from "vitest";
import { StructurePass } from "../../../../src/client/render/gl/passes/StructurePass";
import { UnitPass } from "../../../../src/client/render/gl/passes/UnitPass";

describe("per-owner atlas selection in real render passes", () => {
  it("packs different rows into unit instances without changing positions, owner, or flags", () => {
    const pass = Object.create(UnitPass.prototype) as UnitPass;
    const buffer = new ArrayBuffer(64);
    Object.assign(pass, {
      unitSkins: new Map(),
      groundCount: 0,
      groundBuf: {
        float32: new Float32Array(buffer),
        uint8: new Uint8Array(buffer),
        ensureCapacity: vi.fn(),
      },
    });
    pass.setPlayerUnitSkin(2, "warcraft");
    const emit = (pass as any).emitGround.bind(pass);
    emit(10, 20, 1, 2, 3);
    emit(30, 40, 2, 2, 3);
    const f32 = new Float32Array(buffer),
      bytes = new Uint8Array(buffer);
    expect([...f32.slice(0, 3)]).toEqual([10, 20, 1]);
    expect([...f32.slice(4, 7)]).toEqual([30, 40, 2]);
    expect(bytes[12]).toBe(2);
    expect(bytes[28]).toBe(14);
    expect(bytes[13]).toBe(3);
    expect(bytes[29]).toBe(3);
  });
  it("uses the same owner row for missiles and allows switching back to default", () => {
    const pass = Object.create(UnitPass.prototype) as UnitPass;
    const buffer = new ArrayBuffer(64);
    Object.assign(pass, {
      unitSkins: new Map(),
      missileCount: 0,
      missileBuf: {
        float32: new Float32Array(buffer),
        uint8: new Uint8Array(buffer),
        ensureCapacity: vi.fn(),
      },
    });
    pass.setPlayerUnitSkin(2, "warcraft");
    (pass as any).emitMissile(10, 20, 2, 5, 1);
    pass.setPlayerUnitSkin(2, undefined);
    (pass as any).emitMissile(10, 20, 2, 5, 1);
    expect(new Uint8Array(buffer)[12]).toBe(17);
    expect(new Uint8Array(buffer)[28]).toBe(5);
  });
  it("packs the structure row while preserving construction and deletion indicators", () => {
    const pass = Object.create(StructurePass.prototype) as StructurePass;
    const buffer = new ArrayBuffer(48);
    Object.assign(pass, {
      unitSkins: new Map(),
      mapW: 100,
      typeToAtlasCol: new Map([["City", 0]]),
      instanceBuf: {
        float32: new Float32Array(buffer),
        buffer: {},
        ensureCapacity: vi.fn(),
      },
      gl: { ARRAY_BUFFER: 1, bindBuffer: vi.fn(), bufferSubData: vi.fn() },
    });
    pass.setPlayerUnitSkin(2, "warcraft");
    pass.updateStructures(
      new Map([
        [
          1,
          {
            isActive: true,
            unitType: "City",
            ownerID: 1,
            pos: 201,
            underConstruction: true,
            markedForDeletion: false,
          },
        ],
        [
          2,
          {
            isActive: true,
            unitType: "City",
            ownerID: 2,
            pos: 403,
            underConstruction: false,
            markedForDeletion: true,
          },
        ],
      ] as any),
    );
    expect([...new Float32Array(buffer)]).toEqual([
      1, 2, 1, 1, 0, 0, 3, 4, 2, 0, 6, 1,
    ]);
  });
});
