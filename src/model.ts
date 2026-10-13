export const FRAME = { x: 40, y: 35, width: 520, height: 640 };
export const PHOTO = { x: 70, y: 65, size: 460 };
export type Tool = 'move' | 'crop' | 'cut' | 'repeat' | 'tape' | 'paper' | 'effects';
export type Rect = { x: number; y: number; width: number; height: number };
export type Layer = Rect & {
  id: string;
  kind: 'photo' | 'tape' | 'paper';
  name: string;
  rotation: number;
  opacity: number;
  color: string;
  source?: Rect;
};
export type Composition = {
  layers: Layer[];
  crop: { zoom: number; x: number; y: number };
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
export function initialComposition(sample = false): Composition {
  return {
    layers: [{ id: crypto.randomUUID(), kind: 'photo', name: 'Your photograph',
      x: PHOTO.x, y: PHOTO.y, width: PHOTO.size, height: PHOTO.size,
      rotation: 0, opacity: 1, color: '', source: { x: 0, y: 0, width: PHOTO.size, height: PHOTO.size } }],
    crop: { zoom: 1, x: 0, y: 0 },
    effects: { film: 0, copier: 0, seed: 76 },
    caption: sample ? "somewhere, summer '76" : '', frameColor: '#fff9e9',
  };
}
export const clone = <T,>(value: T): T => structuredClone(value);
export function localPoint(layer: Layer, x: number, y: number) {
  const angle = -layer.rotation * Math.PI / 180;
  const dx = x - layer.x - layer.width / 2, dy = y - layer.y - layer.height / 2;
  return { x: dx * Math.cos(angle) - dy * Math.sin(angle) + layer.width / 2,
    y: dx * Math.sin(angle) + dy * Math.cos(angle) + layer.height / 2 };
}
export function hitTest(layers: Layer[], x: number, y: number) {
  return [...layers].reverse().find(layer => {
    const p = localPoint(layer, x, y);
    return p.x >= 0 && p.x <= layer.width && p.y >= 0 && p.y <= layer.height;
  });
}
export function bounds(composition: Composition): Rect {
  let left = FRAME.x, top = FRAME.y, right = FRAME.x + FRAME.width, bottom = FRAME.y + FRAME.height;
  for (const layer of composition.layers) {
    const a = layer.rotation * Math.PI / 180;
    const halfW = (Math.abs(layer.width * Math.cos(a)) + Math.abs(layer.height * Math.sin(a))) / 2;
    const halfH = (Math.abs(layer.width * Math.sin(a)) + Math.abs(layer.height * Math.cos(a))) / 2;
    left = Math.min(left, layer.x + layer.width / 2 - halfW);
    right = Math.max(right, layer.x + layer.width / 2 + halfW);
    top = Math.min(top, layer.y + layer.height / 2 - halfH);
    bottom = Math.max(bottom, layer.y + layer.height / 2 + halfH);
  }
  return { x: Math.floor(left), y: Math.floor(top), width: Math.ceil(right) - Math.floor(left), height: Math.ceil(bottom) - Math.floor(top) };
}
export function splitLayer(composition: Composition, id: string, axis: 'horizontal' | 'vertical', fraction = .5): Composition {
  const next = clone(composition), index = next.layers.findIndex(l => l.id === id);
  const layer = next.layers[index];
  if (!layer?.source || layer.kind !== 'photo') return composition;
  const f = Math.max(.08, Math.min(.92, fraction));
  const source = layer.source, vertical = axis === 'vertical';
  const first = clone(layer), second = clone(layer);
  first.id = crypto.randomUUID(); second.id = crypto.randomUUID();
  first.name = 'Photo fragment'; second.name = 'Photo fragment';
  first.width = vertical ? layer.width * f : layer.width;
  first.height = vertical ? layer.height : layer.height * f;
  second.width = vertical ? layer.width * (1 - f) : layer.width;
  second.height = vertical ? layer.height : layer.height * (1 - f);
  first.source = { ...source, width: vertical ? source.width * f : source.width, height: vertical ? source.height : source.height * f };
  second.source = { x: source.x + (vertical ? source.width * f : 0), y: source.y + (vertical ? 0 : source.height * f), width: vertical ? source.width * (1 - f) : source.width, height: vertical ? source.height : source.height * (1 - f) };
  const angle = layer.rotation * Math.PI / 180;
  for (const [part, cx, cy] of [[first, first.width / 2, first.height / 2], [second, vertical ? layer.width * f + second.width / 2 : layer.width / 2, vertical ? layer.height / 2 : layer.height * f + second.height / 2]] as const) {
    const dx = cx - layer.width / 2, dy = cy - layer.height / 2;
    part.x = layer.x + layer.width / 2 + dx * Math.cos(angle) - dy * Math.sin(angle) - part.width / 2;
    part.y = layer.y + layer.height / 2 + dx * Math.sin(angle) + dy * Math.cos(angle) - part.height / 2;
  }
  next.layers.splice(index, 1, first, second);
  return next;
}
export function duplicateLayer(composition: Composition, id: string): Composition {
  const next = clone(composition), layer = next.layers.find(l => l.id === id);
  if (!layer) return composition;
  next.layers.push({ ...clone(layer), id: crypto.randomUUID(), x: layer.x + 22, y: layer.y + 22, name: `${layer.name} copy` });
  return next;
}
export function addDecoration(composition: Composition, kind: 'tape' | 'paper', color: string): Composition {
  const next = clone(composition);
  next.layers.push({ id: crypto.randomUUID(), kind, name: kind === 'tape' ? 'Washi tape' : 'Torn paper', x: kind === 'tape' ? 10 : 360, y: kind === 'tape' ? 45 : 520, width: kind === 'tape' ? 170 : 160, height: kind === 'tape' ? 42 : 92, rotation: kind === 'tape' ? -18 : 7, opacity: kind === 'tape' ? .78 : 1, color });
  return next;
}
export function paperPoints(width: number, height: number, tape: boolean) {
  return tape
    ? [[0,3],[width-4,0],[width,8],[width-3,16],[width,24],[width-4,height],[3,height-2],[0,height-9],[4,height-17],[0,height-26]]
    : [[0,6],[width*.17,0],[width*.31,5],[width*.47,1],[width*.64,6],[width*.83,2],[width,6],[width-3,height*.4],[width,height-4],[width*.79,height],[width*.64,height-5],[width*.46,height-1],[width*.3,height-6],[width*.13,height],[0,height-4],[3,height*.5]];
}
