import { describe, expect, it } from "vitest";
import {
  FRAME,
  PHOTO,
  bounds,
  pasteLayer,
  hitTest,
  initialComposition,
  localPoint,
  worldPoint,
  cutLayer,
  cropLayer,
  repeatLayer,
  shape,
  transformGrid,
  alignLayer,
  orderLayer,
  addDecoration,
  contains,
} from "./model";
import { historyReducer } from "./history";
import { cropGeometry } from "./render";
import { cpuEffects } from "./effects";

describe("collage geometry", () => {
  it("cuts a closed shape from a rotated photo, leaving a matching hole and reusable pieces", () => {
    const c = initialComposition();
    c.layers[0].rotation = 27;
    const next = cutLayer(
      c,
      c.layers[0].id,
      [
        [100, 100],
        [300, 100],
        [330, 210],
        [200, 300],
        [100, 100],
      ],
      "freehand",
    );
    expect(next.layers).toHaveLength(2);
    const ring = next.layers.find((l) => l.mask![0].length === 2)!;
    expect(ring).toBeDefined();
    const center = worldPoint(c.layers[0], 210, 180);
    expect(contains(ring, center.x, center.y)).toBe(false);
    expect(
      next.layers.filter((l) => contains(l, center.x, center.y)),
    ).toHaveLength(1);
    const split = cutLayer(
      next,
      ring.id,
      [
        [0, 230],
        [460, 230],
      ],
      "straight",
    );
    expect(split.layers.length).toBeGreaterThan(2);
    expect(c.layers).toHaveLength(1);
  });
  it("orders by one step or all the way while preserving the fixed photo and decoration bands", () => {
    let c = initialComposition();
    c = pasteLayer(c, c.layers[0]);
    c = pasteLayer(c, c.layers[0]);
    c = addDecoration(c, "tape", "#eee");
    const [a, b, d, t] = c.layers.map((l) => l.id);
    expect(orderLayer(c, a, "forward").layers.map((l) => l.id)).toEqual([
      b,
      a,
      d,
      t,
    ]);
    expect(orderLayer(c, a, "front").layers.map((l) => l.id)).toEqual([
      b,
      d,
      a,
      t,
    ]);
    expect(orderLayer(c, d, "backward").layers.map((l) => l.id)).toEqual([
      a,
      d,
      b,
      t,
    ]);
    expect(orderLayer(c, d, "back").layers.map((l) => l.id)).toEqual([
      d,
      a,
      b,
      t,
    ]);
    expect(orderLayer(c, t, "back")).toBe(c);
  });
  it("aligns the actual rotated outline to all six page positions", () => {
    const l = initialComposition().layers[0];
    l.rotation = 35;
    for (const alignment of [
      "left",
      "center",
      "right",
      "top",
      "middle",
      "bottom",
    ] as const) {
      const aligned = alignLayer(l, alignment);
      const points = shape(aligned)
        .flat(2)
        .map(([x, y]) => worldPoint(aligned, x, y));
      const xs = points.map((p) => p.x),
        ys = points.map((p) => p.y);
      const values = {
        left: Math.min(...xs),
        center: (Math.min(...xs) + Math.max(...xs)) / 2,
        right: Math.max(...xs),
        top: Math.min(...ys),
        middle: (Math.min(...ys) + Math.max(...ys)) / 2,
        bottom: Math.max(...ys),
      };
      const expected = {
        left: FRAME.x,
        center: FRAME.x + FRAME.width / 2,
        right: FRAME.x + FRAME.width,
        top: FRAME.y,
        middle: FRAME.y + FRAME.height / 2,
        bottom: FRAME.y + FRAME.height,
      };
      expect(values[alignment]).toBeCloseTo(expected[alignment]);
      expect(aligned.source).toEqual(l.source);
    }
  });
  it("pastes an independent snapshot and selects visible photo overflow without selecting through the border", () => {
    const c = initialComposition();
    const copied = structuredClone(c.layers[0]);
    const next = pasteLayer(c, copied);
    next.layers[1].crop!.zoom = 2;
    expect(copied.crop!.zoom).toBe(1);
    expect(next.layers[1].id).not.toBe(copied.id);
    c.layers[0].x = -100;
    expect(hitTest(c.layers, 0, 200)?.id).toBe(c.layers[0].id);
    expect(hitTest(c.layers, 50, 200)).toBeUndefined();
    expect(hitTest(c.layers, 100, 200)?.id).toBe(c.layers[0].id);
  });
  it("keeps the frame at the classic 88:107 ratio and includes photo overflow", () => {
    const c = initialComposition();
    const original = bounds(c);
    c.layers[0].x = -500;
    c.layers[0].rotation = 45;
    expect(bounds(c).x).toBeLessThan(original.x);
    expect(FRAME.width / FRAME.height).toBeCloseTo(88 / 107);
    expect(hitTest(c.layers, 20, 20)).toBeUndefined();
  });
  it("cuts diagonally without a gap, preserving rotated source coordinates", () => {
    const original = initialComposition();
    original.layers[0].rotation = 37;
    const result = cutLayer(
      original,
      original.layers[0].id,
      [
        [0, 100],
        [460, 350],
      ],
      "straight",
    );
    expect(result.layers).toHaveLength(2);
    expect(original.layers).toHaveLength(1);
    for (const part of result.layers) {
      const center = localPoint(
        original.layers[0],
        part.x + part.width / 2,
        part.y + part.height / 2,
      );
      expect(center.x).toBeCloseTo(part.source!.x + part.source!.width / 2);
      expect(center.y).toBeCloseTo(part.source!.y + part.source!.height / 2);
      expect(part.mask).toBeDefined();
    }
  });
  it("cuts along a freehand stroke and permits further cuts", () => {
    const c = initialComposition(),
      path: [number, number][] = [
        [0, 210],
        [100, 100],
        [230, 320],
        [350, 200],
        [460, 230],
      ];
    const result = cutLayer(c, c.layers[0].id, path, "freehand");
    expect(result.layers).toHaveLength(2);
    const piece = result.layers[0];
    const next = cutLayer(
      result,
      piece.id,
      [
        [piece.width / 2, 0],
        [piece.width / 2, piece.height],
      ],
      "straight",
    );
    expect(next.layers.length).toBeGreaterThan(2);
  });
  it("keeps slow freehand curves and extends cuts from the visible aperture edge", () => {
    const c = initialComposition();
    c.layers[0].x = 0;
    const points: [number, number][] = [];
    for (let x = 70; x <= 460; x += 0.25)
      points.push([x, 200 + Math.sin(((x - 70) / 390) * Math.PI) * 40]);
    const next = cutLayer(c, c.layers[0].id, points, "freehand");
    expect(next.layers).toHaveLength(2);
    expect(next.layers.some((l) => l.mask![0][0].length > 100)).toBe(true);
  });
  it("accepts a freehand cut starting on a previous diagonal cut edge", () => {
    const c = initialComposition(),
      split = cutLayer(
        c,
        c.layers[0].id,
        [
          [0, 0],
          [460, 460],
        ],
        "straight",
      );
    const l = split.layers[0],
      ring = shape(l)[0][0];
    const edges = ring.slice(0, -1).map((a, i) => ({ a, b: ring[i + 1] }));
    const diagonal = edges.find(
      ({ a, b }) => Math.abs(b[0] - a[0]) > 200 && Math.abs(b[1] - a[1]) > 200,
    )!;
    const other = edges.find((e) => e !== diagonal)!;
    const start: [number, number] = [
      (diagonal.a[0] + diagonal.b[0]) / 2,
      (diagonal.a[1] + diagonal.b[1]) / 2,
    ];
    const end: [number, number] = [
      (other.a[0] + other.b[0]) / 2,
      (other.a[1] + other.b[1]) / 2,
    ];
    const center: [number, number] = [
      ring.slice(0, -1).reduce((s, p) => s + p[0], 0) / 3,
      ring.slice(0, -1).reduce((s, p) => s + p[1], 0) / 3,
    ];
    expect(
      cutLayer(split, l.id, [start, center, end], "freehand").layers.length,
    ).toBeGreaterThan(2);
  });
  it("rejects short, self-crossing and interior freehand strokes without mutation", () => {
    const c = initialComposition(),
      before = structuredClone(c),
      id = c.layers[0].id;
    expect(() =>
      cutLayer(
        c,
        id,
        [
          [100, 100],
          [101, 101],
        ],
        "straight",
      ),
    ).toThrow();
    expect(() =>
      cutLayer(
        c,
        id,
        [
          [100, 100],
          [200, 200],
        ],
        "freehand",
      ),
    ).toThrow(/edge/);
    expect(() =>
      cutLayer(
        c,
        id,
        [
          [0, 0],
          [300, 300],
          [100, 300],
          [460, 0],
        ],
        "freehand",
      ),
    ).toThrow(/cross/);
    expect(c).toEqual(before);
  });
  it("trims a rotated photo without rescaling surviving pixels or other photos", () => {
    const c = initialComposition(),
      l = c.layers[0];
    l.rotation = 30;
    const cropped = cropLayer(l, { x: 30, y: 50, width: 200, height: 150 });
    expect(cropped.width).toBeCloseTo(200);
    expect(cropped.source!.x).toBeCloseTo(30);
    expect(cropped.source!.width).toBeCloseTo(200);
    const old = worldPoint(l, 30, 50),
      now = worldPoint(cropped, 0, 0);
    expect(now.x).toBeCloseTo(old.x);
    expect(now.y).toBeCloseTo(old.y);
    expect(l.width).toBe(PHOTO.size);
  });
  it("repeats nine full photo copies into a fitted grid and resizes them together", () => {
    const c = initialComposition(),
      l = c.layers[0],
      next = repeatLayer(c, l.id);
    expect(next.layers).toHaveLength(9);
    expect(new Set(next.layers.map((l) => l.id)).size).toBe(9);
    expect(next.layers[0].width).toBeCloseTo(460 / 3);
    expect(next.layers[8].x + next.layers[8].width).toBeCloseTo(l.x + l.width);
    expect(next.layers.every((t) => t.source!.width === 460)).toBe(true);
    const resized = transformGrid(next.layers, l, {
      ...l,
      width: 230,
      height: 230,
    });
    expect(resized[0].width).toBeCloseTo(230 / 3);
  });
  it("uses fragment masks and fixed bands when selecting pieces", () => {
    const c = initialComposition(),
      next = pasteLayer(c, c.layers[0]);
    next.layers[1].mask = [
      [
        [
          [0, 0],
          [1, 0],
          [0, 1],
          [0, 0],
        ],
      ],
    ];
    expect(hitTest(next.layers, 500, 500)?.id).toBe(c.layers[0].id);
    expect(hitTest(next.layers, 150, 150)?.id).toBe(next.layers[1].id);
    expect(shape(next.layers[1])[0][0][1][0]).toBe(460);
  });
  it("crops portrait and landscape sources to a centered square", () => {
    expect(
      cropGeometry({ width: 800, height: 1200 }, { zoom: 1, x: 0, y: 0 }),
    ).toEqual({ x: 0, y: 200, width: 800, height: 800 });
    expect(
      cropGeometry({ width: 1200, height: 800 }, { zoom: 2, x: 0, y: 0 }),
    ).toEqual({ x: 400, y: 200, width: 400, height: 400 });
  });
});
describe("history", () => {
  it("undoes one gesture, redoes it, and clears redo on a new edit", () => {
    const c = initialComposition();
    let h = { past: [], present: c, future: [] } as Parameters<
      typeof historyReducer
    >[0];
    h = historyReducer(h, {
      type: "commit",
      value: { ...c, caption: "a little memory" },
    });
    h = historyReducer(h, { type: "undo" });
    expect(h.present.caption).toBe("");
    h = historyReducer(h, { type: "redo" });
    expect(h.present.caption).toBe("a little memory");
    h = historyReducer(h, { type: "undo" });
    h = historyReducer(h, { type: "commit", value: { ...c, caption: "new" } });
    expect(h.future).toHaveLength(0);
  });
  it("does not record no-op actions and resets history on source replacement", () => {
    const c = initialComposition(),
      h = { past: [], present: c, future: [] };
    expect(historyReducer(h, { type: "commit", value: c })).toBe(h);
    expect(
      historyReducer(
        { ...h, past: [c] },
        { type: "reset", value: initialComposition() },
      ).past,
    ).toHaveLength(0);
  });
});
describe("fallback effects", () => {
  it("preserves alpha and is deterministic for a grain seed", () => {
    const pixels = new Uint8ClampedArray([150, 120, 90, 255, 0, 0, 0, 0]);
    const settings = { film: 0.7, copier: 0, seed: 76 };
    const a = cpuEffects(pixels, 2, 1, settings),
      b = cpuEffects(pixels, 2, 1, settings);
    expect(a).toEqual(b);
    expect(a[3]).toBe(255);
    expect(a[7]).toBe(0);
    expect(a[0]).not.toBe(pixels[0]);
  });
  it("leaves an original photo unchanged when effects are off", () => {
    const pixels = new Uint8ClampedArray([80, 100, 170, 255]);
    expect(cpuEffects(pixels, 1, 1, { film: 0, copier: 0, seed: 76 })).toEqual(
      pixels,
    );
  });
});
