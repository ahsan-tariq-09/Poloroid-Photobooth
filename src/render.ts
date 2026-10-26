import {
  FRAME,
  PHOTO,
  paperPoints,
  shape,
  shapePath,
  DEFAULT_CROP,
  type Asset,
  type Assets,
  type Composition,
  type Crop,
  type Layer,
  type Rect,
} from "./model";
import { applyEffects } from "./effects";
import { layerPose, type Presentation } from "./presentation";
import { fontCss, loadCompositionFonts, type FontStyle } from "./fonts";
import { assertComposition, assertRenderSize } from "./limits";
export function canvas(width: number, height: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(width));
  c.height = Math.max(1, Math.ceil(height));
  return c;
}
export type TextureSettings = { crop: Crop; effects: Composition["effects"] };
export function cropGeometry(
  asset: Pick<Asset, "width" | "height">,
  crop: Crop,
) {
  const size = (crop.original ? Math.max(asset.width, asset.height) : Math.min(asset.width, asset.height)) / crop.zoom;
  return {
    x: (asset.width - size) / 2 - (crop.x * size) / PHOTO.size,
    y: (asset.height - size) / 2 - (crop.y * size) / PHOTO.size,
    width: size,
    height: size,
  };
}
const cache = new WeakMap<Asset, Map<string, Promise<HTMLCanvasElement>>>();
export function texture(
  asset: Asset,
  settings: TextureSettings,
  scale: number,
) {
  const key = JSON.stringify([settings.crop, settings.effects, scale]);
  let entries = cache.get(asset);
  if (!entries) {
    entries = new Map();
    cache.set(asset, entries);
  }
  if (entries.has(key)) return entries.get(key)!;
  const result = (async () => {
    const c = canvas(PHOTO.size * scale, PHOTO.size * scale),
      ctx = c.getContext("2d")!,
      crop = cropGeometry(asset, settings.crop);
    ctx.drawImage(
      asset.image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      c.width,
      c.height,
    );
    ctx.putImageData(
      await applyEffects(
        ctx.getImageData(0, 0, c.width, c.height),
        settings.effects,
      ),
      0,
      0,
    );
    return c;
  })();
  if (entries.size >= 6) entries.delete(entries.keys().next().value!);
  entries.set(key, result);
  void result.catch(() => entries!.delete(key));
  return result;
}
export type Textures = Record<string, HTMLCanvasElement>;
export async function prepareTextures(
  assets: Assets,
  c: Composition,
  scale: number,
): Promise<Textures> {
  const entries = await Promise.all(
    c.layers
      .filter((l) => l.kind === "photo")
      .map(async (l) => {
        const asset = assets[l.assetId!];
        if (!asset)
          throw new Error("A photo source is missing. Please upload it again.");
        return [
          l.id,
          await texture(
            asset,
            { crop: l.crop || DEFAULT_CROP, effects: c.effects },
            scale,
          ),
        ] as const;
      }),
  );
  return Object.fromEntries(entries);
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
export function drawCaption(ctx: CanvasRenderingContext2D, caption: string, fontId?: string, style: FontStyle & {fontSize?: number; color?: string} = {}) {
  ctx.fillStyle = style.color || "#493e30";
  ctx.font = fontCss(fontId, style.fontSize ?? 25, style);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(caption, 300, 598, 450);
}
export function drawTextLayer(ctx: CanvasRenderingContext2D, layer: Layer) {
  const text = (layer.text || "").slice(0, 200);
  if (!text) return;
  const padding = 4, width = Math.max(1, layer.width - padding * 2);
  let size = layer.fontSize ?? Math.min(64, layer.height * 0.65), lines: string[] = [];
  const wrap = () => {
    ctx.font = fontCss(layer.fontId, size, layer);
    lines = [];
    for (const paragraph of text.split("\n")) {
      let line = "";
      for (const token of paragraph.match(/\S+|\s+/gu) || []) {
        if (/^\s+$/u.test(token)) { if (line) line += token; continue; }
        if (line && ctx.measureText(line + token).width > width) {lines.push(line.trimEnd()); line = "";}
        // Break an overlong word only when it cannot fit on its own line.
        for (const char of Array.from(token)) {
          if (line && ctx.measureText(line + char).width > width) {lines.push(line); line = "";}
          line += char;
        }
      }
      lines.push(line.trimEnd());
    }
  };
  wrap();
  // Older compositions retain automatic fitting; an explicit size stays exact.
  while (layer.fontSize === undefined && size > 4 && lines.length * size * 1.2 > layer.height - padding * 2) {size--; wrap();}
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, layer.width, layer.height); ctx.clip();
  ctx.fillStyle = layer.color;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const firstBaseline = Math.max(padding + size * .6, layer.height / 2 - (lines.length - 1) / 2 * size * 1.2);
  lines.forEach((line, i) => ctx.fillText(line, layer.width / 2, firstBaseline + i * size * 1.2, width));
  ctx.restore();
}

export async function renderComposition(
  target: HTMLCanvasElement,
  assets: Assets,
  c: Composition,
  region: Rect,
  scale = 1,
) {
  assertComposition(c);
  assertRenderSize(region, scale);
  await loadCompositionFonts(c);
  await document.fonts?.ready;
  return paintComposition(
    target,
    await prepareTextures(assets, c, scale),
    c,
    region,
    scale,
  );
}
function trace(ctx: CanvasRenderingContext2D, layer: Layer) {
  ctx.beginPath();
  for (const polygon of shape(layer))
    for (const ring of polygon) {
      ring.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
    }
}
export function paintComposition(
  target: HTMLCanvasElement,
  photos: Textures,
  c: Composition,
  region: Rect,
  scale = 1,
  presentation?: Presentation,
) {
  assertComposition(c);
  assertRenderSize(region, scale);
  const width = Math.ceil(region.width * scale),
    height = Math.ceil(region.height * scale);
  if (target.width !== width) target.width = width;
  if (target.height !== height) target.height = height;
  const ctx = target.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.scale(scale, scale);
  ctx.translate(-region.x, -region.y);
  ctx.fillStyle = c.frameColor;
  ctx.fillRect(FRAME.x, FRAME.y, FRAME.width, FRAME.height);
  const draw = (stored: Layer) => {
    const visual = presentation?.layers?.[stored.id],
      layer = layerPose(stored, visual);
    ctx.save();
    ctx.globalAlpha =
      layer.opacity *
      (layer.kind === "photo"
        ? (visual?.development ?? presentation?.development ?? 1)
        : 1);
    if (visual?.lift) {
      ctx.shadowColor = "rgba(65,43,22,.22)";
      ctx.shadowBlur = 12 * visual.lift;
      ctx.shadowOffsetY = 7 * visual.lift;
    }
    ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.translate(-layer.width / 2, -layer.height / 2);
    if (layer.kind === "photo" && layer.source) {
      trace(ctx, layer);
      ctx.clip("evenodd");
      const photo = photos[stored.id],
        s = layer.source;
      if (photo) {
        const factor = photo.width / PHOTO.size;
        ctx.drawImage(
          photo,
          s.x * factor,
          s.y * factor,
          s.width * factor,
          s.height * factor,
          0,
          0,
          layer.width,
          layer.height,
        );
      }
    } else if (layer.kind === "text") drawTextLayer(ctx, layer);
    else drawDecoration(ctx, layer);
    ctx.restore();
  };
  c.layers.filter((l) => l.kind === "photo").forEach(draw);
  // The locked frame is painted above photos; its square aperture stays transparent.
  ctx.fillStyle = c.frameColor;
  ctx.beginPath();
  ctx.rect(FRAME.x, FRAME.y, FRAME.width, FRAME.height);
  ctx.rect(PHOTO.x, PHOTO.y, PHOTO.size, PHOTO.size);
  ctx.fill("evenodd");
  drawCaption(ctx, c.caption, c.captionFont, {fontSize: c.captionSize, bold: c.captionBold, italic: c.captionItalic, color: c.captionColor});
  c.layers.filter((l) => l.kind !== "photo").forEach(draw);
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
  return (
    "data:image/svg+xml;base64," +
    btoa(
      Array.from(new TextEncoder().encode(svg), (b) =>
        String.fromCharCode(b),
      ).join(""),
    )
  );
}
export async function serializeSvg(assets: Assets, c: Composition) {
  assertComposition(c);
  await loadCompositionFonts(c);
  await document.fonts?.ready;
  const region = FRAME,
    photos = await prepareTextures(assets, c, 3),
    hasEffects = c.effects.film > 0 || c.effects.copier > 0 || (c.effects.grayscale ?? 0) > 0;
  const photosSvg: string[] = [],
    decorationsSvg: string[] = [];
  c.layers.forEach((l, index) => {
    const transform =
      "translate(" +
      (l.x + l.width / 2) +
      " " +
      (l.y + l.height / 2) +
      ") rotate(" +
      l.rotation +
      ") translate(" +
      -l.width / 2 +
      " " +
      -l.height / 2 +
      ")";
    if (l.kind === "photo" && l.source) {
      const asset = assets[l.assetId!],
        s = l.source,
        fx = l.width / s.width,
        fy = l.height / s.height;
      let x = -s.x * fx,
        y = -s.y * fy,
        width = PHOTO.size * fx,
        height = PHOTO.size * fy;
      const vector = asset.svg && !hasEffects;
      if (vector) {
        const crop = cropGeometry(asset, l.crop || DEFAULT_CROP);
        x = -((crop.x * PHOTO.size) / crop.width + s.x) * fx;
        y = -((crop.y * PHOTO.size) / crop.height + s.y) * fy;
        width = ((asset.width * PHOTO.size) / crop.width) * fx;
        height = ((asset.height * PHOTO.size) / crop.height) * fy;
      }
      const href = vector
        ? svgData(asset.svg!)
        : photos[l.id].toDataURL("image/png");
      photosSvg.push(
        '<g transform="' +
          transform +
          '" opacity="' +
          l.opacity +
          '"><defs><clipPath id="photo-' +
          index +
          '"><path d="' +
          shapePath(l) +
          '" clip-rule="evenodd"/></clipPath></defs><g clip-path="url(#photo-' +
          index +
          ')"><image xlink:href="' +
          href +
          '" x="' +
          x +
          '" y="' +
          y +
          '" width="' +
          width +
          '" height="' +
          height +
          '" preserveAspectRatio="none"/></g></g>',
      );
    } else if (l.kind === "text") {
      const text = canvas(l.width * 3, l.height * 3), ctx = text.getContext("2d")!;
      ctx.scale(3, 3); drawTextLayer(ctx, l);
      decorationsSvg.push(`<g transform="${transform}" opacity="${l.opacity}"><image width="${l.width}" height="${l.height}" xlink:href="${text.toDataURL("image/png")}"/></g>`);
    } else {
      const points = paperPoints(l.width, l.height, l.kind === "tape")
        .map((p) => p.join(","))
        .join(" ");
      decorationsSvg.push(
        '<g transform="' +
          transform +
          '" opacity="' +
          l.opacity +
          '"><defs><clipPath id="paper-' +
          index +
          '"><polygon points="' +
          points +
          '"/></clipPath></defs><polygon points="' +
          points +
          '" fill="' +
          escapeXml(l.color) +
          '"/><g clip-path="url(#paper-' +
          index +
          ')">' +
          Array.from(
            { length: Math.ceil((l.width + l.height) / 8) },
            (_, i) =>
              '<path d="M ' +
              (i * 8 - l.height) +
              " 0 l " +
              l.height +
              " " +
              l.height +
              '" stroke="' +
              (l.kind === "tape" ? "white" : "#5a4623") +
              '" stroke-opacity="' +
              (l.kind === "tape" ? 0.18 : 0.09) +
              '"/>',
          ).join("") +
          "</g></g>",
      );
    }
  });
  const caption = canvas(FRAME.width * 3, 135 * 3),
    ctx = caption.getContext("2d")!;
  ctx.scale(3, 3);
  ctx.translate(-40, -540);
  drawCaption(ctx, c.caption, c.captionFont, {fontSize: c.captionSize, bold: c.captionBold, italic: c.captionItalic, color: c.captionColor});
  const frame =
    '<rect x="' +
    FRAME.x +
    '" y="' +
    FRAME.y +
    '" width="' +
    FRAME.width +
    '" height="' +
    FRAME.height +
    '" fill="' +
    c.frameColor +
    '"/>';
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' +
    (region.width * 88) / FRAME.width +
    'mm" height="' +
    (region.height * 88) / FRAME.width +
    'mm" viewBox="' +
    region.x +
    " " +
    region.y +
    " " +
    region.width +
    " " +
    region.height +
    '"><title>' +
    escapeXml(c.caption || "My Polaroid") +
    "</title><defs><clipPath id=\"frame-clip\"><rect x=\"40\" y=\"35\" width=\"520\" height=\"" + FRAME.height + "\"/></clipPath></defs><g clip-path=\"url(#frame-clip)\">" +
    frame +
    photosSvg.join("") +
    `<path fill="${c.frameColor}" fill-rule="evenodd" d="M${FRAME.x} ${FRAME.y}h${FRAME.width}v${FRAME.height}h${-FRAME.width}Z M${PHOTO.x} ${PHOTO.y}h${PHOTO.size}v${PHOTO.size}h${-PHOTO.size}Z"/>` +
    '<image x="40" y="540" width="520" height="135" xlink:href="' +
    caption.toDataURL("image/png") +
    '"/>' +
    decorationsSvg.join("") +
    "</g></svg>"
  );
}
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export type ExportFormat = "png" | "jpeg" | "heic" | "svg";
export function flatten(output: HTMLCanvasElement) {
  const ctx = output.getContext("2d")!;
  ctx.save();
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, output.width, output.height);
  ctx.restore();
  return output;
}
export function canvasBlob(output: HTMLCanvasElement, type: string) {
  return new Promise<Blob>((resolve, reject) =>
    output.toBlob(
      (b) =>
        b && b.type === type
          ? resolve(b)
          : reject(
              new Error(
                "This browser could not encode " +
                  type +
                  ". Try downloading again, or reduce the artwork size in Edit.",
              ),
            ),
      type,
      0.95,
    ),
  );
}
export async function exportFile(
  assets: Assets,
  c: Composition,
  format: ExportFormat,
) {
  if (format === "svg") {
    download(
      new Blob([await serializeSvg(assets, c)], { type: "image/svg+xml" }),
      "my-polaroid.svg",
    );
    return;
  }
  const out = await renderComposition(canvas(1, 1), assets, c, FRAME, 3);
  if (format !== "png") flatten(out);
  const blob =
    format === "heic"
      ? await (await import("./heicExport")).encodeHeic(out)
      : await canvasBlob(out, format === "jpeg" ? "image/jpeg" : "image/png");
  download(blob, "my-polaroid." + (format === "jpeg" ? "jpg" : format));
}
export async function printComposition(assets: Assets, c: Composition) {
  const region = FRAME,
    out = await renderComposition(canvas(1, 1), assets, c, region, 3);
  const sheet = document.createElement("div");
  sheet.className = "print-sheet";
  sheet.setAttribute("aria-hidden", "true");
  const frame = document.createElement("div");
  frame.className = "print-polaroid";
  frame.style.width = "88mm";
  frame.style.height = "107mm";
  const image = document.createElement("img");
  image.alt = "Finished Polaroid";
  image.src = out.toDataURL("image/png");
  Object.assign(image.style, {
    position: "absolute",
    width: (region.width * 88) / FRAME.width + "mm",
    height: (region.height * 88) / FRAME.width + "mm",
    left: ((region.x - FRAME.x) * 88) / FRAME.width + "mm",
    top: ((region.y - FRAME.y) * 88) / FRAME.width + "mm",
  });
  frame.append(image);
  sheet.append(frame);
  document.querySelector(".print-sheet")?.remove();
  document.body.append(sheet);
  // Register before print(): some browsers dispatch afterprint synchronously.
  const cleanup = () => sheet.remove();
  window.addEventListener("afterprint", cleanup, { once: true });
  try {
    await image.decode();
    window.print();
  } catch (error) {
    window.removeEventListener("afterprint", cleanup);
    sheet.remove();
    throw error;
  }
}
