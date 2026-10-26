import { bounds, type Composition, type Rect } from "./model";

export const MAX_PIECE_SIZE = 1600;
export const MIN_POSITION = -1600;
export const MAX_POSITION = 1600;
export const MAX_RENDER_EDGE = 10000;
export const MAX_RENDER_PIXELS = 32_000_000;
export const SIZE_ERROR = "This artwork is too large to save. Reduce the size or bring pieces closer to the frame, then try again.";

export function assertRenderSize(region: Rect, scale: number) {
  const w = Math.ceil(region.width * scale), h = Math.ceil(region.height * scale);
  if (![region.x, region.y, w, h, scale].every(Number.isFinite) || w < 1 || h < 1 || scale <= 0 || w > MAX_RENDER_EDGE || h > MAX_RENDER_EDGE || w * h > MAX_RENDER_PIXELS)
    throw new Error(SIZE_ERROR);
}
export function assertComposition(c: Composition) {
  for (const l of c.layers) {
    if (![l.x, l.y, l.width, l.height, l.rotation, l.opacity].every(Number.isFinite) || l.width <= 0 || l.height <= 0 || l.width > MAX_PIECE_SIZE || l.height > MAX_PIECE_SIZE || l.x < MIN_POSITION || l.y < MIN_POSITION || l.x > MAX_POSITION || l.y > MAX_POSITION)
      throw new Error("Keep pieces between 1 and 1600 px in size and within 1600 px of the page. Your last valid edit has been kept.");
  }
  assertRenderSize(bounds(c), 3);
}
