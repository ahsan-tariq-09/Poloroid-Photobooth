import { describe, expect, it } from "vitest";
import { pieceHandles } from "./handles";
import { photoLayer, worldPoint, WORKSPACE } from "./model";

describe("screen-sized editing handles", () => {
  it.each([.25, .4, 1])("keeps touch targets separate at scale %s, including a tiny rotated piece", scale => {
    const layer = {...photoLayer("sample"), x: 260, y: 250, width: 12, height: 12, rotation: 37};
    const h = pieceHandles(layer, scale), all = [...h.corners, h.rotate];
    expect(h.radius * 2 * scale).toBeCloseTo(44);
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      expect(Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y) * scale).toBeGreaterThanOrEqual(44);
    }
    const rotation = worldPoint(layer, h.rotate.x, h.rotate.y);
    expect(rotation.x - h.radius).toBeGreaterThanOrEqual(WORKSPACE.x);
    expect(rotation.y - h.radius).toBeGreaterThanOrEqual(WORKSPACE.y);
  });
});
