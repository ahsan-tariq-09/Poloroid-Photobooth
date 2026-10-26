import { WORKSPACE, worldPoint, type Layer } from "./model";

// Hit areas are screen-sized even when the artwork is scaled down. Spread
// controls around tiny pieces so their touch areas remain separate.
export function pieceHandles(layer: Layer, scale: number) {
  const unit = 1 / Math.max(.01, scale), radius = 22 * unit;
  const halfWidth = Math.max(layer.width / 2, 26 * unit);
  const halfHeight = Math.max(layer.height / 2, 26 * unit);
  const left = layer.width / 2 - halfWidth, right = layer.width / 2 + halfWidth;
  const top = layer.height / 2 - halfHeight, bottom = layer.height / 2 + halfHeight;
  const corners = [
    {id: "nw", x: left, y: top, anchorX: 0, anchorY: 0},
    {id: "ne", x: right, y: top, anchorX: layer.width, anchorY: 0},
    {id: "sw", x: left, y: bottom, anchorX: 0, anchorY: layer.height},
    {id: "se", x: right, y: bottom, anchorX: layer.width, anchorY: layer.height},
  ];
  const gapY = Math.max(28 * unit, Math.sqrt(Math.max(0, (48 * unit) ** 2 - halfWidth ** 2)));
  const gapX = Math.max(28 * unit, Math.sqrt(Math.max(0, (48 * unit) ** 2 - halfHeight ** 2)));
  const candidates = [
    {x: layer.width / 2, y: top - gapY, anchorX: layer.width / 2, anchorY: 0},
    {x: layer.width / 2, y: bottom + gapY, anchorX: layer.width / 2, anchorY: layer.height},
    {x: right + gapX, y: layer.height / 2, anchorX: layer.width, anchorY: layer.height / 2},
    {x: left - gapX, y: layer.height / 2, anchorX: 0, anchorY: layer.height / 2},
  ];
  const rotate = candidates.find(p => {
    const world = worldPoint(layer, p.x, p.y);
    return world.x - radius >= WORKSPACE.x && world.x + radius <= WORKSPACE.x + WORKSPACE.width &&
      world.y - radius >= WORKSPACE.y && world.y + radius <= WORKSPACE.y + WORKSPACE.height;
  }) || candidates[0];
  return {corners, rotate, radius, visualRadius: 6 * unit};
}
