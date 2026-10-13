import {
  FRAME,
  PHOTO,
  bounds,
  paperPoints,
  type Asset,
  type Composition,
  type Layer,
  type Rect,
} from "./model";
import { applyEffects } from "./effects";
import { layerPose, type Presentation } from "./presentation";
export function canvas(width: number, height: number) {
  const element = document.createElement("canvas");
  element.width = Math.max(1, Math.ceil(width));
  element.height = Math.max(1, Math.ceil(height));
  return element;
}
export function cropGeometry(
  asset: Pick<Asset, "width" | "height">,
  crop: Composition["crop"],
) {
  const size = Math.min(asset.width, asset.height) / crop.zoom;
  return {
    x: (asset.width - size) / 2 - (crop.x * size) / PHOTO.size,
    y: (asset.height - size) / 2 - (crop.y * size) / PHOTO.size,
    width: size,
    height: size,
  };
}
const cache = new WeakMap<Asset, Map<string, Promise<HTMLCanvasElement>>>();
export function texture(asset: Asset, composition: Composition, scale: number) {
  const key = JSON.stringify([composition.crop, composition.effects, scale]);
  let entries = cache.get(asset);
  if (!entries) {
    entries = new Map();
    cache.set(asset, entries);
  }
  if (entries.has(key)) return entries.get(key)!;
  const result = (async () => {
    const element = canvas(PHOTO.size * scale, PHOTO.size * scale),
      ctx = element.getContext("2d")!;
    const crop = cropGeometry(asset, composition.crop);
    ctx.drawImage(
      asset.image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      element.width,
      element.height,
    );
    ctx.putImageData(
      await applyEffects(
        ctx.getImageData(0, 0, element.width, element.height),
        composition.effects,
      ),
      0,
      0,
    );
    return element;
  })();
  if (entries.size >= 3) entries.delete(entries.keys().next().value!);
  entries.set(key, result);
  return result;
}
export function drawDecoration(ctx: CanvasRenderingContext2D, layer: Layer) {
  const points = paperPoints(layer.width, layer.height, layer.kind === "tape");
  ctx.beginPath();
  points.forEach(([x, y], i) =>
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y),
  );
  ctx.closePath();
  ctx.fillStyle = layer.color;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle =
    layer.kind === "tape" ? "rgba(255,255,255,.18)" : "rgba(90,70,35,.09)";
  ctx.lineWidth = 1;
  for (let x = -layer.height; x < layer.width; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + layer.height, layer.height);
    ctx.stroke();
  }
  ctx.restore();
}
export function drawCaption(ctx: CanvasRenderingContext2D, caption: string) {
  ctx.fillStyle = "#493e30";
  ctx.font = 'italic 25px "DM Serif Display", Georgia, serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(caption, 300, 598, 450);
  ctx.font = '9px "DM Mono", monospace';
  ctx.fillStyle = "#9b8c74";
  ctx.fillText("A MOMENT WORTH KEEPING", 300, 643);
}
export async function renderComposition(
  target: HTMLCanvasElement,
  asset: Asset,
  composition: Composition,
  region: Rect,
  scale = 1,
) {
  await document.fonts?.ready;
  const photo = await texture(asset, composition, scale);
  return paintComposition(target, photo, composition, region, scale);
}
export function paintComposition(
  target: HTMLCanvasElement,
  photo: HTMLCanvasElement,
  composition: Composition,
  region: Rect,
  scale = 1,
  presentation?: Presentation,
) {
  const width = Math.ceil(region.width * scale),
    height = Math.ceil(region.height * scale);
  if (target.width !== width) target.width = width;
  if (target.height !== height) target.height = height;
  const ctx = target.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.scale(scale, scale);
  ctx.translate(-region.x, -region.y);
  ctx.fillStyle = composition.frameColor;
  ctx.fillRect(FRAME.x, FRAME.y, FRAME.width, FRAME.height);
  for (const stored of composition.layers) {
    const visual = presentation?.layers?.[stored.id],
      layer = layerPose(stored, visual);
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    if (layer.kind === "photo")
      ctx.globalAlpha *= presentation?.development ?? 1;
    if (visual?.lift) {
      ctx.shadowColor = "rgba(65,43,22,.22)";
      ctx.shadowBlur = 12 * visual.lift;
      ctx.shadowOffsetY = 7 * visual.lift;
    }
    ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.translate(-layer.width / 2, -layer.height / 2);
    if (layer.kind === "photo" && layer.source) {
      const s = layer.source;
      ctx.drawImage(
        photo,
        s.x * scale,
        s.y * scale,
        s.width * scale,
        s.height * scale,
        0,
        0,
        layer.width,
        layer.height,
      );
    } else drawDecoration(ctx, layer);
    ctx.restore();
  }
  drawCaption(ctx, composition.caption);
  return target;
}
const escapeXml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
function svgData(svg: string) {
  return `data:image/svg+xml;base64,${btoa(Array.from(new TextEncoder().encode(svg), (b) => String.fromCharCode(b)).join(""))}`;
}
export async function serializeSvg(asset: Asset, composition: Composition) {
  await document.fonts?.ready;
  const region = bounds(composition),
    photo = await texture(asset, composition, 3);
  const hasEffects =
    composition.effects.film > 0 || composition.effects.copier > 0;
  const href =
    asset.svg && !hasEffects
      ? svgData(asset.svg)
      : photo.toDataURL("image/png");
  const elements = composition.layers
    .map((layer, index) => {
      const transform = `translate(${layer.x + layer.width / 2} ${layer.y + layer.height / 2}) rotate(${layer.rotation}) translate(${-layer.width / 2} ${-layer.height / 2})`;
      if (layer.kind === "photo" && layer.source) {
        const source = layer.source;
        const factorX = layer.width / source.width,
          factorY = layer.height / source.height;
        let x = -source.x * factorX,
          y = -source.y * factorY,
          width = PHOTO.size * factorX,
          height = PHOTO.size * factorY;
        if (asset.svg && !hasEffects) {
          const crop = cropGeometry(asset, composition.crop);
          x = -((crop.x * PHOTO.size) / crop.width + source.x) * factorX;
          y = -((crop.y * PHOTO.size) / crop.height + source.y) * factorY;
          width = ((asset.width * PHOTO.size) / crop.width) * factorX;
          height = ((asset.height * PHOTO.size) / crop.height) * factorY;
        }
        return `<g transform="${transform}" opacity="${layer.opacity}"><defs><clipPath id="crop-${index}"><rect width="${layer.width}" height="${layer.height}"/></clipPath></defs><g clip-path="url(#crop-${index})"><image xlink:href="${href}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none"/></g></g>`;
      }
      const points = paperPoints(
        layer.width,
        layer.height,
        layer.kind === "tape",
      )
        .map((p) => p.join(","))
        .join(" ");
      return `<g transform="${transform}" opacity="${layer.opacity}"><defs><clipPath id="paper-${index}"><polygon points="${points}"/></clipPath></defs><polygon points="${points}" fill="${escapeXml(layer.color)}"/><g clip-path="url(#paper-${index})">${Array.from({ length: Math.ceil((layer.width + layer.height) / 8) }, (_, i) => `<path d="M ${i * 8 - layer.height} 0 l ${layer.height} ${layer.height}" stroke="${layer.kind === "tape" ? "white" : "#5a4623"}" stroke-opacity="${layer.kind === "tape" ? 0.18 : 0.09}"/>`).join("")}</g></g>`;
    })
    .join("");
  // Rasterize only the lettering so the exported SVG needs no installed fonts.
  const caption = canvas(520 * 3, 100 * 3),
    ctx = caption.getContext("2d")!;
  ctx.scale(3, 3);
  ctx.translate(-40, -575);
  drawCaption(ctx, composition.caption);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${region.width * 3}" height="${region.height * 3}" viewBox="${region.x} ${region.y} ${region.width} ${region.height}"><title>${escapeXml(composition.caption || "My Poloroid")}</title><rect x="${FRAME.x}" y="${FRAME.y}" width="${FRAME.width}" height="${FRAME.height}" fill="${composition.frameColor}"/>${elements}<image x="40" y="575" width="520" height="100" xlink:href="${caption.toDataURL("image/png")}"/></svg>`;
}
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export async function exportPng(asset: Asset, composition: Composition) {
  const out = await renderComposition(
    canvas(1, 1),
    asset,
    composition,
    bounds(composition),
    3,
  );
  const blob = await new Promise<Blob>((resolve, reject) =>
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Export failed. Try again."))),
      "image/png",
    ),
  );
  download(blob, "my-poloroid.png");
}
