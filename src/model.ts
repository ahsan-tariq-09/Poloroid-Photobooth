import { difference, intersection } from "polyclip-ts";
export const FRAME = { x: 40, y: 35, width: 520, height: (520 * 107) / 88 };
export const PHOTO = { x: 70, y: 65, size: 460 };
export const WORKSPACE = { x: -35, y: 0, width: 670, height: 710 };
export type Tool =
  | "move"
  | "crop"
  | "cut"
  | "repeat"
  | "tape"
  | "paper"
  | "effects";
export type Rect = { x: number; y: number; width: number; height: number };
export type Point = [number, number];
export type Polygon = Point[][];
export type MultiPolygon = Polygon[];
export type Crop = { zoom: number; x: number; y: number };
export const DEFAULT_CROP: Crop = { zoom: 1, x: 0, y: 0 };
export type Layer = Rect & {
  id: string;
  kind: "photo" | "tape" | "paper";
  name: string;
  rotation: number;
  opacity: number;
  color: string;
  assetId?: string;
  crop?: Crop;
  source?: Rect;
  mask?: MultiPolygon;
};
export type Composition = {
  layers: Layer[];
  effects: { film: number; copier: number; seed: number };
  caption: string;
  frameColor: string;
};
export type Asset = {
  image: HTMLImageElement;
  width: number;
  height: number;
  name: string;
  svg?: string;
  url: string;
};
export type Assets = Record<string, Asset>;
export const clone = <T>(value: T): T => structuredClone(value);
export function photoLayer(
  assetId: string,
  name = "Your photograph",
  index = 0,
): Layer {
  const size = index ? PHOTO.size * 0.7 : PHOTO.size,
    offset = index ? 22 + ((index - 1) % 4) * 24 : 0;
  return {
    id: crypto.randomUUID(),
    kind: "photo",
    name,
    assetId,
    crop: { ...DEFAULT_CROP },
    x: PHOTO.x + offset,
    y: PHOTO.y + offset,
    width: size,
    height: size,
    rotation: 0,
    opacity: 1,
    color: "",
    source: { x: 0, y: 0, width: PHOTO.size, height: PHOTO.size },
  };
}
export function initialComposition(
  sample = false,
  assetId = "sample",
): Composition {
  return {
    layers: [photoLayer(assetId)],
    effects: { film: 0, copier: 0, seed: 76 },
    caption: sample ? "somewhere, summer '76" : "",
    frameColor: "#fff9e9",
  };
}
export function localPoint(layer: Layer, x: number, y: number) {
  const angle = (-layer.rotation * Math.PI) / 180,
    dx = x - layer.x - layer.width / 2,
    dy = y - layer.y - layer.height / 2;
  return {
    x: dx * Math.cos(angle) - dy * Math.sin(angle) + layer.width / 2,
    y: dx * Math.sin(angle) + dy * Math.cos(angle) + layer.height / 2,
  };
}
export function worldPoint(layer: Layer, x: number, y: number) {
  const a = (layer.rotation * Math.PI) / 180,
    dx = x - layer.width / 2,
    dy = y - layer.height / 2;
  return {
    x: layer.x + layer.width / 2 + dx * Math.cos(a) - dy * Math.sin(a),
    y: layer.y + layer.height / 2 + dx * Math.sin(a) + dy * Math.cos(a),
  };
}
export function shape(layer: Layer): MultiPolygon {
  return (
    layer.mask || [
      [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
    ]
  ).map((poly) =>
    poly.map((ring) =>
      ring.map(([x, y]) => [x * layer.width, y * layer.height] as Point),
    ),
  );
}
export function shapePath(layer: Layer) {
  return shape(layer)
    .map((poly) =>
      poly
        .map((ring) => "M" + ring.map((p) => p.join(" ")).join("L") + "Z")
        .join(""),
    )
    .join("");
}
function inRing(ring: Point[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > y !== b[1] > y &&
      x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
export function contains(layer: Layer, x: number, y: number) {
  const p = localPoint(layer, x, y);
  return shape(layer).some(
    (poly) =>
      inRing(poly[0], p.x, p.y) &&
      !poly.slice(1).some((r) => inRing(r, p.x, p.y)),
  );
}
export function inOpening(x: number, y: number) {
  return (
    x >= PHOTO.x &&
    y >= PHOTO.y &&
    x <= PHOTO.x + PHOTO.size &&
    y <= PHOTO.y + PHOTO.size
  );
}
export function hitTest(
  layers: Layer[],
  x: number,
  y: number,
  photosOnly = false,
) {
  const ordered = [
    ...layers.filter((l) => l.kind === "photo"),
    ...layers.filter((l) => l.kind !== "photo"),
  ];
  return ordered
    .reverse()
    .find(
      (l) =>
        (!photosOnly || l.kind === "photo") &&
        (l.kind !== "photo" || inOpening(x, y)) &&
        contains(l, x, y),
    );
}
export function bounds(composition: Composition): Rect {
  let left = FRAME.x,
    top = FRAME.y,
    right = FRAME.x + FRAME.width,
    bottom = FRAME.y + FRAME.height;
  for (const l of composition.layers.filter((l) => l.kind !== "photo")) {
    const a = (l.rotation * Math.PI) / 180,
      hw =
        (Math.abs(l.width * Math.cos(a)) + Math.abs(l.height * Math.sin(a))) /
        2,
      hh =
        (Math.abs(l.width * Math.sin(a)) + Math.abs(l.height * Math.cos(a))) /
        2;
    left = Math.min(left, l.x + l.width / 2 - hw);
    right = Math.max(right, l.x + l.width / 2 + hw);
    top = Math.min(top, l.y + l.height / 2 - hh);
    bottom = Math.max(bottom, l.y + l.height / 2 + hh);
  }
  return {
    x: Math.floor(left),
    y: Math.floor(top),
    width: Math.ceil(right) - Math.floor(left),
    height: Math.ceil(bottom) - Math.floor(top),
  };
}
const area = (ring: Point[]) =>
  Math.abs(
    ring.reduce((sum, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0) / 2,
  );
export function fragment(layer: Layer, polygon: Polygon): Layer {
  const points = polygon.flat(),
    xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const x = Math.min(...xs),
    y = Math.min(...ys),
    width = Math.max(...xs) - x,
    height = Math.max(...ys) - y;
  const center = worldPoint(layer, x + width / 2, y + height / 2),
    source = layer.source!;
  return {
    ...clone(layer),
    id: crypto.randomUUID(),
    name: "Photo fragment",
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
    source: {
      x: source.x + (x / layer.width) * source.width,
      y: source.y + (y / layer.height) * source.height,
      width: (width / layer.width) * source.width,
      height: (height / layer.height) * source.height,
    },
    mask: [
      polygon.map((r) =>
        r.map((p) => [(p[0] - x) / width, (p[1] - y) / height] as Point),
      ),
    ],
  };
}
export function cropLayer(layer: Layer, rect: Rect): Layer {
  if (layer.kind !== "photo" || !layer.source) return layer;
  const clipped = intersection(shape(layer), [
    [
      [rect.x, rect.y],
      [rect.x + rect.width, rect.y],
      [rect.x + rect.width, rect.y + rect.height],
      [rect.x, rect.y + rect.height],
      [rect.x, rect.y],
    ],
  ]);
  if (!clipped.length) return layer;
  const out = fragment(layer, [clipped.flatMap((p) => p[0])]);
  const origin = localPoint(
    layer,
    out.x + out.width / 2,
    out.y + out.height / 2,
  );
  out.mask = clipped.map((p) =>
    p.map((r) =>
      r.map(
        ([x, y]) =>
          [
            (x - origin.x + out.width / 2) / out.width,
            (y - origin.y + out.height / 2) / out.height,
          ] as Point,
      ),
    ),
  );
  out.id = layer.id;
  out.name = layer.name;
  return out;
}
function edgePoint(p: Point, w: number, h: number): Point {
  const candidates: Point[] = [
    [0, Math.max(0, Math.min(h, p[1]))],
    [w, Math.max(0, Math.min(h, p[1]))],
    [Math.max(0, Math.min(w, p[0])), 0],
    [Math.max(0, Math.min(w, p[0])), h],
  ];
  return candidates.sort(
    (a, b) =>
      Math.hypot(a[0] - p[0], a[1] - p[1]) -
      Math.hypot(b[0] - p[0], b[1] - p[1]),
  )[0];
}
function perimeter(p: Point, w: number, h: number) {
  return p[1] === 0
    ? p[0]
    : p[0] === w
      ? w + p[1]
      : p[1] === h
        ? w + h + (w - p[0])
        : 2 * w + h + (h - p[1]);
}
function crosses(a: Point, b: Point, c: Point, d: Point) {
  const side = (p: Point, q: Point, r: Point) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return (
    side(a, b, c) * side(a, b, d) < -1e-8 &&
    side(c, d, a) * side(c, d, b) < -1e-8
  );
}
export function cutLayer(
  composition: Composition,
  id: string,
  input: Point[],
  mode: "straight" | "freehand",
): Composition {
  const layer = composition.layers.find((l) => l.id === id);
  if (!layer?.source || input.length < 2)
    throw new Error("Draw a line across the selected photo.");
  const w = layer.width,
    h = layer.height;
  let path = input.map((p) => [p[0], p[1]] as Point);
  if (mode === "straight") {
    const a = path[0],
      b = path.at(-1)!,
      dx = b[0] - a[0],
      dy = b[1] - a[1];
    if (Math.hypot(dx, dy) < 3)
      throw new Error("Drag to draw a longer cut line.");
    const hits: { t: number; p: Point }[] = [];
    for (const [axis, value] of [
      [0, 0],
      [0, w],
      [1, 0],
      [1, h],
    ]) {
      const delta = axis ? dy : dx;
      if (Math.abs(delta) < 1e-8) continue;
      const t = (value - a[axis]) / delta,
        p: Point = [a[0] + t * dx, a[1] + t * dy];
      p[axis] = value;
      if (
        p[0] >= -1e-6 &&
        p[0] <= w + 1e-6 &&
        p[1] >= -1e-6 &&
        p[1] <= h + 1e-6
      )
        hits.push({ t, p: edgePoint(p, w, h) });
    }
    hits.sort((a, b) => a.t - b.t);
    if (hits.length < 2)
      throw new Error("Draw through the photo to make a cut.");
    path = [hits[0].p, hits.at(-1)!.p];
  } else {
    const sampled: Point[] = [path[0]];
    for (const p of path.slice(1, -1)) {
      const last = sampled.at(-1)!;
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 1) sampled.push(p);
    }
    sampled.push(path.at(-1)!);
    path = sampled;
    const extend = (point: Point, neighbor: Point): Point => {
      const edge = edgePoint(point, w, h);
      if (Math.hypot(edge[0] - point[0], edge[1] - point[1]) <= 16) return edge;
      const visible = worldPoint(layer, ...point);
      const nearCutEdge = shape(layer).some((poly) =>
        poly.some((ring) =>
          ring.some((a, i) => {
            const b = ring[(i + 1) % ring.length],
              dx = b[0] - a[0],
              dy = b[1] - a[1];
            const t = Math.max(
              0,
              Math.min(
                1,
                ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) /
                  (dx * dx + dy * dy || 1),
              ),
            );
            return (
              Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy) <=
              16
            );
          }),
        ),
      );
      const nearOpening =
        inOpening(visible.x, visible.y) &&
        Math.min(
          visible.x - PHOTO.x,
          PHOTO.x + PHOTO.size - visible.x,
          visible.y - PHOTO.y,
          PHOTO.y + PHOTO.size - visible.y,
        ) <= 16;
      if (!nearOpening && !nearCutEdge) return point;
      const dx = point[0] - neighbor[0],
        dy = point[1] - neighbor[1];
      const hits: { t: number; p: Point }[] = [];
      for (const [axis, value] of [
        [0, 0],
        [0, w],
        [1, 0],
        [1, h],
      ]) {
        const delta = axis ? dy : dx;
        if (Math.abs(delta) < 1e-8) continue;
        const t = (value - point[axis]) / delta;
        const p: Point = [point[0] + dx * t, point[1] + dy * t];
        p[axis] = value;
        if (t >= 0 && p[0] >= 0 && p[0] <= w && p[1] >= 0 && p[1] <= h)
          hits.push({ t, p });
      }
      return hits.sort((a, b) => a.t - b.t)[0]?.p || point;
    };
    const first = extend(path[0], path[1]),
      last = extend(path.at(-1)!, path.at(-2)!);
    if (
      Math.hypot(...edgePoint(first, w, h).map((n, i) => n - first[i])) >
        0.001 ||
      Math.hypot(...edgePoint(last, w, h).map((n, i) => n - last[i])) > 0.001
    )
      throw new Error("Freehand cuts must start and finish at a photo edge.");
    path[0] = first;
    path[path.length - 1] = last;
    if (path.slice(1, -1).some(([x, y]) => x < 0 || x > w || y < 0 || y > h))
      throw new Error("Keep the stroke inside the photo between its edges.");
  }
  for (let i = 0; i < path.length - 1; i++)
    for (let j = i + 2; j < path.length - 1; j++)
      if (crosses(path[i], path[i + 1], path[j], path[j + 1]))
        throw new Error("Use a cut line that does not cross itself.");
  const end = perimeter(path.at(-1)!, w, h),
    start = perimeter(path[0], w, h),
    length = 2 * (w + h);
  const corners: { t: number; p: Point }[] = [
    { t: 0, p: [0, 0] },
    { t: w, p: [w, 0] },
    { t: w + h, p: [w, h] },
    { t: 2 * w + h, p: [0, h] },
  ];
  const closure = corners
    .map((c) => ({ ...c, t: c.t <= end ? c.t + length : c.t }))
    .filter((c) => c.t < (start <= end ? start + length : start))
    .sort((a, b) => a.t - b.t)
    .map((c) => c.p);
  const ring = [...path, ...closure, path[0]],
    geometry = shape(layer);
  const sides = [intersection(geometry, [ring]), difference(geometry, [ring])];
  if (
    sides.some(
      (s) =>
        !s.length ||
        s.reduce(
          (sum, p) =>
            sum + area(p[0]) - p.slice(1).reduce((a, r) => a + area(r), 0),
          0,
        ) < 1,
    )
  )
    throw new Error(
      "This stroke does not divide the photo. Try drawing across it.",
    );
  const pieces = sides
    .flat()
    .filter((p) => area(p[0]) > 1)
    .map((p) => fragment(layer, p));
  const next = clone(composition),
    index = next.layers.findIndex((l) => l.id === id);
  next.layers.splice(index, 1, ...pieces);
  return next;
}
export function repeatLayer(composition: Composition, id: string) {
  const layer = composition.layers.find((l) => l.id === id);
  if (layer?.kind !== "photo") return composition;
  const next = clone(composition),
    pieces: Layer[] = [];
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++) {
      const width = layer.width / 3,
        height = layer.height / 3,
        center = worldPoint(layer, (col + 0.5) * width, (row + 0.5) * height);
      pieces.push({
        ...clone(layer),
        id: crypto.randomUUID(),
        name: layer.name + " · " + (row + 1) + "," + (col + 1),
        width,
        height,
        x: center.x - width / 2,
        y: center.y - height / 2,
      });
    }
  next.layers.splice(
    next.layers.findIndex((l) => l.id === id),
    1,
    ...pieces,
  );
  return next;
}
export function transformGrid(
  layers: Layer[],
  from: Layer,
  to: Layer,
): Layer[] {
  return layers.map((l) => {
    const p = localPoint(from, l.x + l.width / 2, l.y + l.height / 2),
      center = worldPoint(
        to,
        (p.x / from.width) * to.width,
        (p.y / from.height) * to.height,
      ),
      width = (l.width / from.width) * to.width,
      height = (l.height / from.height) * to.height;
    return {
      ...l,
      width,
      height,
      x: center.x - width / 2,
      y: center.y - height / 2,
      rotation: l.rotation + to.rotation - from.rotation,
    };
  });
}
export function duplicateLayer(
  composition: Composition,
  id: string,
): Composition {
  const next = clone(composition),
    layer = next.layers.find((l) => l.id === id);
  if (!layer) return composition;
  next.layers.push({
    ...clone(layer),
    id: crypto.randomUUID(),
    x: layer.x + 22,
    y: layer.y + 22,
    name: layer.name + " copy",
  });
  return next;
}
export function addDecoration(
  composition: Composition,
  kind: "tape" | "paper",
  color: string,
): Composition {
  const next = clone(composition);
  next.layers.push({
    id: crypto.randomUUID(),
    kind,
    name: kind === "tape" ? "Washi tape" : "Torn paper",
    x: kind === "tape" ? 10 : 360,
    y: kind === "tape" ? 45 : 520,
    width: kind === "tape" ? 170 : 160,
    height: kind === "tape" ? 42 : 92,
    rotation: kind === "tape" ? -18 : 7,
    opacity: kind === "tape" ? 0.78 : 1,
    color,
  });
  return next;
}
export function paperPoints(width: number, height: number, tape: boolean) {
  return tape
    ? [
        [0, 3],
        [width - 4, 0],
        [width, 8],
        [width - 3, 16],
        [width, 24],
        [width - 4, height],
        [3, height - 2],
        [0, height - 9],
        [4, height - 17],
        [0, height - 26],
      ]
    : [
        [0, 6],
        [width * 0.17, 0],
        [width * 0.31, 5],
        [width * 0.47, 1],
        [width * 0.64, 6],
        [width * 0.83, 2],
        [width, 6],
        [width - 3, height * 0.4],
        [width, height - 4],
        [width * 0.79, height],
        [width * 0.64, height - 5],
        [width * 0.46, height - 1],
        [width * 0.3, height - 6],
        [width * 0.13, height],
        [0, height - 4],
        [3, height * 0.5],
      ];
}
