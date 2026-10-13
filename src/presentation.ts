import { localPoint, type Composition, type Layer } from "./model";

// Presentation is deliberately separate from Composition and its undo history.
export type LayerPresentation = {
  lift?: number;
  arrival?: number;
  cutX?: number;
  cutY?: number;
};
export type Presentation = {
  development?: number;
  layers?: Record<string, LayerPresentation>;
};
export type CutFeedback = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  ids: [string, string];
  dx: number;
  dy: number;
};
export function layerPose(
  layer: Layer,
  presentation?: LayerPresentation,
): Layer {
  if (!presentation) return layer;
  const lift = presentation.lift || 0,
    arrival = presentation.arrival ?? 1,
    enter = 1 - arrival;
  const factor = 1 + 0.025 * lift + 0.09 * enter;
  const width = layer.width * factor,
    height = layer.height * factor;
  return {
    ...layer,
    width,
    height,
    x: layer.x + (layer.width - width) / 2 + (presentation.cutX || 0) * enter,
    y:
      layer.y +
      (layer.height - height) / 2 -
      6 * lift +
      (presentation.cutY ?? -14) * enter,
    rotation: layer.rotation + (layer.kind === "photo" ? 1.5 : -7) * enter,
    opacity: layer.opacity * (0.4 + 0.6 * arrival),
  };
}
export function worldPoint(layer: Layer, x: number, y: number) {
  const angle = (layer.rotation * Math.PI) / 180,
    dx = x - layer.width / 2,
    dy = y - layer.height / 2;
  return {
    x: layer.x + layer.width / 2 + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: layer.y + layer.height / 2 + dx * Math.sin(angle) + dy * Math.cos(angle),
  };
}
export function pointerInComposition(
  layer: Layer,
  pose: Layer,
  x: number,
  y: number,
) {
  const point = localPoint(pose, x, y);
  return worldPoint(
    layer,
    (point.x * layer.width) / pose.width,
    (point.y * layer.height) / pose.height,
  );
}
export function detectCut(
  previous: Composition,
  next: Composition,
): CutFeedback | null {
  const previousIds = new Set(previous.layers.map((l) => l.id)),
    nextIds = new Set(next.layers.map((l) => l.id));
  const removed = previous.layers.filter((l) => !nextIds.has(l.id)),
    added = next.layers.filter((l) => !previousIds.has(l.id));
  if (
    removed.length !== 1 ||
    added.length !== 2 ||
    !removed[0].source ||
    added.some((l) => !l.source)
  )
    return null;
  const old = removed[0],
    first = added[0],
    vertical = first.source!.width < old.source!.width;
  const fraction = vertical
    ? first.source!.width / old.source!.width
    : first.source!.height / old.source!.height;
  const start = worldPoint(
    old,
    vertical ? old.width * fraction : 0,
    vertical ? 0 : old.height * fraction,
  );
  const end = worldPoint(
    old,
    vertical ? old.width * fraction : old.width,
    vertical ? old.height : old.height * fraction,
  );
  const angle = (old.rotation * Math.PI) / 180;
  return {
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    ids: [added[0].id, added[1].id],
    dx: vertical ? Math.cos(angle) * 7 : -Math.sin(angle) * 7,
    dy: vertical ? Math.sin(angle) * 7 : Math.cos(angle) * 7,
  };
}
