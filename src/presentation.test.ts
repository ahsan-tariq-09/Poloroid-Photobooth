import { describe, expect, it } from "vitest";
import { clone, initialComposition, localPoint, splitLayer } from "./model";
import {
  detectCut,
  layerPose,
  pointerInComposition,
  worldPoint,
} from "./presentation";

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
  it("derives a cut cue from the actual split position, including rotation", () => {
    const previous = initialComposition();
    previous.layers[0].rotation = 31;
    const next = splitLayer(previous, previous.layers[0].id, "vertical", 0.3),
      cue = detectCut(previous, next)!;
    const start = localPoint(previous.layers[0], cue.x1, cue.y1),
      end = localPoint(previous.layers[0], cue.x2, cue.y2);
    expect(start.x).toBeCloseTo(138);
    expect(start.y).toBeCloseTo(0);
    expect(end.x).toBeCloseTo(138);
    expect(end.y).toBeCloseTo(460);
    expect(cue.ids).toEqual(next.layers.map((l) => l.id));
    expect(next.layers[0].x).not.toBe(
      layerPose(next.layers[0], { arrival: 0, cutX: -cue.dx, cutY: -cue.dy }).x,
    );
  });
  it("does not interpret ordinary movement as a cut", () => {
    const previous = initialComposition(),
      next = clone(previous);
    next.layers[0].x += 20;
    expect(detectCut(previous, next)).toBeNull();
  });
});
