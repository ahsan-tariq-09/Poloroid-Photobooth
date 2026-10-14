import { describe, expect, it } from "vitest";
import { clone, initialComposition, localPoint } from "./model";
import { layerPose, pointerInComposition, worldPoint } from "./presentation";

describe("temporary interaction presentation", () => {
  it("lifts and animates a piece without changing composition or its source", () => {
    const composition = initialComposition(),
      before = clone(composition),
      layer = composition.layers[0];
    const lifted = layerPose(layer, { lift: 1, arrival: 0.4 });
    expect(lifted.width).toBeGreaterThan(layer.width);
    expect(lifted.y).not.toBe(layer.y);
    expect(composition).toEqual(before);
    expect(layerPose(layer, { lift: 0, arrival: 1 })).toEqual(layer);
  });
  it("maps a pointer on a rotated animated piece back to its unchanged source position", () => {
    const layer = initialComposition().layers[0];
    layer.rotation = 38;
    const pose = layerPose(layer, { lift: 1, arrival: 0.5 });
    const visiblePoint = worldPoint(
      pose,
      pose.width * 0.23,
      pose.height * 0.71,
    );
    const logical = pointerInComposition(
      layer,
      pose,
      visiblePoint.x,
      visiblePoint.y,
    );
    const originalPoint = localPoint(layer, logical.x, logical.y);
    expect(originalPoint.x).toBeCloseTo(layer.width * 0.23);
    expect(originalPoint.y).toBeCloseTo(layer.height * 0.71);
  });
});
