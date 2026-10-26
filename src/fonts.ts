import type { Composition } from "./model";

export const STUDIO_FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
export const fonts = [
  { id: "studio", name: "Studio sans", family: STUDIO_FONT, group: "Sans serif" },
  ...[
    ["DM Sans", "Sans serif"], ["Space Grotesk", "Sans serif"],
    ["Outfit", "Sans serif"], ["Sora", "Sans serif"],
    ["Montserrat", "Sans serif"], ["Oswald", "Sans serif"],
    ["Playfair Display", "Serif"], ["Lora", "Serif"],
    ["Merriweather", "Serif"], ["Cormorant Garamond", "Serif"],
    ["Bodoni Moda", "Serif"], ["Libre Baskerville", "Serif"],
    ["Crimson Text", "Serif"], ["EB Garamond", "Serif"],
    ["DM Serif Display", "Serif"], ["Fraunces", "Serif"],
    ["Bebas Neue", "Display"], ["Anton", "Display"],
    ["Abril Fatface", "Display"], ["Alfa Slab One", "Display"],
    ["Bungee Shade", "Display"], ["Rye", "Display"],
    ["Courier Prime", "Monospace"], ["Cutive Mono", "Monospace"],
    ["Caveat", "Handwriting"], ["Pacifico", "Handwriting"],
    ["Permanent Marker", "Handwriting"], ["Amatic SC", "Handwriting"],
  ].map(([name, group]) => ({
    id: name.toLowerCase().replaceAll(" ", "-"), name,
    family: `"${name}", ${STUDIO_FONT}`, group,
    stylesheet: `https://fonts.googleapis.com/css2?family=${name.replaceAll(" ", "+")}:wght@400&display=swap`,
  })),
  {
    id: "ransom-note", name: "Ransom note · Lindbergh Baby",
    family: `"LindberghBabyRegular", ${STUDIO_FONT}`, group: "Display",
    source: "/fonts/lindbergh-baby/Lindbergh_Baby.ttf",
  },
] as const;

export function fontById(id = "studio") {
  return fonts.find(f => f.id === id) || fonts[0];
}
export function fontFamily(id?: string) { return fontById(id).family; }
export type FontStyle = { bold?: boolean; italic?: boolean };
export function fontCss(id: string | undefined, size: number, style: FontStyle = {}) {
  return `${style.italic ? "italic " : ""}${style.bold ? "700 " : ""}${size}px ${fontFamily(id)}`;
}
// Load real variants where the library offers them. Single-style display faces
// use the browser's normal weight/style synthesis, including on the canvas.
const boldFaces = new Set(["DM Sans", "Space Grotesk", "Outfit", "Sora", "Montserrat", "Oswald", "Playfair Display", "Lora", "Merriweather", "Cormorant Garamond", "Bodoni Moda", "Libre Baskerville", "Crimson Text", "EB Garamond", "Fraunces", "Courier Prime", "Caveat", "Amatic SC"]);
const italicFaces = new Set(["DM Sans", "Montserrat", "Playfair Display", "Lora", "Merriweather", "Cormorant Garamond", "Bodoni Moda", "Libre Baskerville", "Crimson Text", "EB Garamond", "DM Serif Display", "Fraunces", "Courier Prime"]);
const stylesheets = new Map<string, Promise<void>>();
const sheetElements = new Map<string, HTMLElement>();
export async function loadFont(id = "studio", text = "Polaroid", style: FontStyle = {}) {
  const font = fontById(id);
  if (!("stylesheet" in font || "source" in font) || typeof document === "undefined" || !document.fonts?.load) return;
  const weight = style.bold && boldFaces.has(font.name) ? 700 : 400;
  const italic = style.italic && italicFaces.has(font.name);
  const key = `${font.id}-${weight}-${italic ? "italic" : "normal"}`;
  let sheet = stylesheets.get(key);
  if (!sheet) {
    if ("source" in font) {
      // The original OFL font from Font Library is served unchanged with the app;
      // its provider's hotlink endpoint does not reliably allow browser CORS.
      const style = document.createElement("style");
      style.textContent = `@font-face {font-family:"LindberghBabyRegular";src:url("${font.source}") format("truetype");font-style:normal;font-weight:400;font-display:swap;}`;
      document.head.append(style); sheetElements.set(key, style);
      sheet = Promise.resolve();
    } else sheet = new Promise<void>((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = font.stylesheet.replace(":wght@400", italic ? `:ital,wght@1,${weight}` : `:wght@${weight}`);
      sheetElements.set(key, link);
      const timer = setTimeout(fail, 12000);
      function fail() {
        clearTimeout(timer); link.remove(); stylesheets.delete(key);
        reject(new Error(`${font.name} could not load. Check your connection or choose Studio sans.`));
      }
      link.onerror = fail;
      link.onload = () => { clearTimeout(timer); resolve(); };
      document.head.append(link);
    });
    stylesheets.set(key, sheet);
  }
  await sheet;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      document.fonts.load(fontCss(id, 32, style), text || "Polaroid").then(faces => {
        if (!faces.length) throw new Error("Font unavailable");
      }),
      new Promise<never>((_, reject) => {timer = setTimeout(() => reject(new Error("Font timed out")), 12000);}),
    ]);
  } catch {
    sheetElements.get(key)?.remove(); sheetElements.delete(key); stylesheets.delete(key);
    throw new Error(`${font.name} could not load. Check your connection or choose Studio sans.`);
  } finally { clearTimeout(timer); }
}
export async function loadCompositionFonts(c: Composition) {
  await Promise.all([
    c.caption ? loadFont(c.captionFont, c.caption, {bold: c.captionBold, italic: c.captionItalic}) : Promise.resolve(),
    ...c.layers.filter(l => l.kind === "text").map(l => loadFont(l.fontId, l.text, l)),
  ]);
}
