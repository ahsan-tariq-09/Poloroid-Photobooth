import { localPoint, type Layer } from "./model";

// Presentation is deliberately separate from Composition and its undo history.
export type LayerPresentation = {
  lift?: number;
  development?: number;
  arrival?: number;
  cutX?: number;
  cutY?: number;
};
export type Presentation = {
  development?: number;
  layers?: Record<string, LayerPresentation>;
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
