import DOMPurify from "dompurify";
import type { Asset } from "./model";

export const ACCEPT =
  ".jpg,.jpeg,.png,.heic,.heif,.svg,image/jpeg,image/png,image/heic,image/heif,image/svg+xml";
export function identifyFile(file: Pick<File, "name" | "type">) {
  const ext = file.name.split(".").at(-1)?.toLowerCase();
  if (["heic", "heif"].includes(ext || "") || /image\/hei[cf]/.test(file.type))
    return "heic";
  if (ext === "svg" || file.type === "image/svg+xml") return "svg";
  if (
    ["jpg", "jpeg", "png"].includes(ext || "") ||
    ["image/jpeg", "image/png"].includes(file.type)
  )
    return "raster";
  throw new Error("Choose a JPG, PNG, HEIC, HEIF, or SVG image.");
}
export function sanitizeSvg(
  input: string,
  depth = 0,
): { svg: string; width: number; height: number } {
  if (depth > 4)
    throw new Error(
      "This SVG contains too many nested images. Flatten its nested artwork and try again.",
    );
  const parsed = new DOMParser().parseFromString(input, "image/svg+xml");
  if (
    parsed.querySelector("parsererror") ||
    parsed.documentElement.localName !== "svg"
  )
    throw new Error(
      "This SVG could not be read. Please export a valid SVG and try again.",
    );
  if (/<\!DOCTYPE|<\!ENTITY/i.test(input))
    throw new Error(
      "Please use a self-contained SVG without document entities.",
    );
  // Inspect dependencies before sanitization so missing artwork never disappears silently.
  for (const el of parsed.querySelectorAll("*")) {
    for (const attr of [...el.attributes]) {
      if (
        /^(href|xlink:href)$/i.test(attr.name) &&
        /^data:image\/svg\+xml;base64,/i.test(attr.value)
      ) {
        try {
          const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
            Uint8Array.from(atob(attr.value.split(",")[1]), (c) =>
              c.charCodeAt(0),
            ),
          );
          const nested = sanitizeSvg(decoded, depth + 1).svg;
          attr.value =
            "data:image/svg+xml;base64," +
            btoa(
              Array.from(new TextEncoder().encode(nested), (b) =>
                String.fromCharCode(b),
              ).join(""),
            );
          continue;
        } catch (error) {
          throw error instanceof Error
            ? error
            : new Error("A nested SVG image could not be read.");
        }
      }
      if (
        /^(href|xlink:href|src)$/i.test(attr.name) &&
        !attr.value.startsWith("#") &&
        !/^data:image\/(png|jpeg);base64,[a-z0-9+/=\s]+$/i.test(attr.value)
      ) {
        throw new Error(
          "This SVG uses linked resources. Embed its images and outline its fonts, then upload again.",
        );
      }
      if (externalCss(attr.value))
        throw new Error(
          "This SVG uses external styles. Embed resources, then upload again.",
        );
    }
    if (el.localName === "style" && externalCss(el.textContent || ""))
      throw new Error(
        "This SVG uses external styles. Embed resources, then upload again.",
      );
  }
  const clean = DOMPurify.sanitize(
    new XMLSerializer().serializeToString(parsed),
    {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: [
        "script",
        "foreignObject",
        "animate",
        "animateTransform",
        "animateMotion",
        "set",
        "a",
      ],
    },
  );
  const doc = new DOMParser().parseFromString(clean, "image/svg+xml");
  const root = doc.documentElement;
  const box = root
    .getAttribute("viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  const parseSize = (text: string | null) =>
    text && /^\d+(?:\.\d+)?(?:px)?$/.test(text) ? parseFloat(text) : NaN;
  const width =
    box?.length === 4 ? box[2] : parseSize(root.getAttribute("width"));
  const height =
    box?.length === 4 ? box[3] : parseSize(root.getAttribute("height"));
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    (box && box.some((v) => !Number.isFinite(v)))
  )
    throw new Error(
      "Add a valid viewBox or pixel width and height to this SVG.",
    );
  root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  root.setAttribute("width", String(width));
  root.setAttribute("height", String(height));
  return { svg: new XMLSerializer().serializeToString(root), width, height };
}
function externalCss(text: string) {
  if (/@import/i.test(text)) return true;
  return [...text.matchAll(/url\(([^)]*)\)/gi)].some(
    (match) =>
      !match[1]
        .trim()
        .replace(/^['"]|['"]$/g, "")
        .startsWith("#"),
  );
}
export async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}
export async function importAsset(file: File): Promise<Asset> {
  const kind = identifyFile(file);
  if (file.size > 50 * 1024 * 1024)
    throw new Error("Please choose an image smaller than 50 MB.");
  let blob: Blob = file,
    svg: string | undefined;
  if (kind === "heic") {
    const { heicTo } = await import("heic-to/csp");
    try {
      blob = await heicTo({ blob: file, type: "image/png" });
    } catch {
      throw new Error(
        "We could not decode this HEIC photo. Try another photo or export it as JPG from Photos.",
      );
    }
  }
  if (kind === "svg") {
    const result = sanitizeSvg(await file.text());
    svg = result.svg;
    blob = new Blob([svg], { type: "image/svg+xml" });
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    if (image.naturalWidth * image.naturalHeight > 80_000_000)
      throw new Error(
        "This image is too large. Resize it below 80 megapixels and try again.",
      );
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      name: file.name,
      svg,
      url,
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error instanceof Error
      ? error
      : new Error("This image could not be opened.");
  }
}
