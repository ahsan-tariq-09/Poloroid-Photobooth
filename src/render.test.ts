import { createCanvas, ImageData, loadImage } from "@napi-rs/canvas";
import { Resvg } from "@resvg/resvg-js";
import { Buffer } from "node:buffer";
import { mkdirSync, writeFileSync } from "node:fs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  initialComposition,
  photoLayer,
  addDecoration,
  bounds,
  cutLayer,
  FRAME,
  type Asset,
} from "./model";
import {
  canvas,
  paintComposition,
  renderComposition,
  serializeSvg,
  prepareTextures,
  flatten,
  drawCaption,
} from "./render";

beforeAll(() => {
  vi.stubGlobal("document", { createElement: () => createCanvas(1, 1) });
  vi.stubGlobal("ImageData", ImageData);
});
async function makeAsset(svg?: string): Promise<Asset> {
  let image;
  if (svg) image = await loadImage(Buffer.from(svg));
  else {
    const c = createCanvas(300, 200),
      ctx = c.getContext("2d");
    ctx.fillStyle = "#286c79";
    ctx.fillRect(0, 0, 300, 200);
    ctx.fillStyle = "#e47932";
    ctx.fillRect(150, 0, 150, 200);
    image = await loadImage(c.toBuffer("image/png"));
  }
  return {
    image: image as unknown as HTMLImageElement,
    width: image.width,
    height: image.height,
    url: "test",
    name: "test",
    svg,
  };
}
const at = (output: HTMLCanvasElement, x: number, y: number) => [
  ...output.getContext("2d")!.getImageData(x, y, 1, 1).data,
];
describe("real Polaroid rendering and export", () => {
  it("keeps closed scissor holes and outside-frame cutouts identical in PNG and reopened SVG", async () => {
    const asset = await makeAsset();
    let c = initialComposition();
    c = cutLayer(
      c,
      c.layers[0].id,
      [
        [90, 90],
        [330, 110],
        [280, 330],
        [90, 90],
      ],
      "freehand",
    );
    const cutout = c.layers.find((l) => l.mask![0].length === 1)!;
    cutout.x -= 210;
    cutout.rotation = -19;
    const region = bounds(c),
      out = await renderComposition(
        canvas(1, 1),
        { sample: asset },
        c,
        region,
        2,
      );
    const svg = await serializeSvg({ sample: asset }, c);
    const image = await loadImage(
      new Resvg(svg, { fitTo: { mode: "width", value: out.width } })
        .render()
        .asPng(),
    );
    const reopened = createCanvas(out.width, out.height);
    reopened.getContext("2d").drawImage(image, 0, 0);
    const actual = reopened
      .getContext("2d")
      .getImageData(0, 0, out.width, out.height).data;
    const expected = out
      .getContext("2d")!
      .getImageData(0, 0, out.width, out.height).data;
    expect(actual.length).toBe(expected.length);
    expect(
      expected.reduce((sum, v, i) => sum + Math.abs(v - actual[i]), 0) /
        expected.length,
    ).toBeLessThan(2);
    expect(region.x).toBeLessThan(FRAME.x);
  });
  it("renders only the supplied caption using the interface font stack", () => {
    const fillText = vi.fn();
    const ctx = { fillText } as unknown as CanvasRenderingContext2D;
    drawCaption(ctx, "Coast, October 2026");
    expect(fillText).toHaveBeenCalledExactlyOnceWith(
      "Coast, October 2026",
      300,
      598,
      450,
    );
    expect(ctx.font).toBe(
      '25px "Helvetica Neue", Helvetica, Arial, sans-serif',
    );
  });
  it("renders the actual sample as a complete Polaroid", async () => {
    const image = await loadImage("public/sample-coast.png");
    const asset = {
      image: image as unknown as HTMLImageElement,
      width: image.width,
      height: image.height,
      url: "sample",
      name: "sample",
    };
    const composition = initialComposition();
    const output = await renderComposition(
      canvas(1, 1),
      { sample: asset },
      composition,
      bounds(composition),
      3,
    );
    mkdirSync(".sites-runtime/qa", { recursive: true });
    writeFileSync(
      ".sites-runtime/qa/sample-poloroid.png",
      Buffer.from(output.toDataURL("image/png").split(",")[1], "base64"),
    );
    expect(at(output, 10, 10)).toEqual([255, 249, 233, 255]);
    expect(output.height / output.width).toBeCloseTo(
      Math.ceil(FRAME.height) / FRAME.width,
    );
  });
  it("exports the complete frame with a wider caption area", async () => {
    const asset = await makeAsset(),
      c = initialComposition(),
      region = bounds(c);
    const output = await renderComposition(
      canvas(1, 1),
      { sample: asset },
      c,
      region,
      3,
    );
    expect(output.width).toBe(1560);
    expect(output.height).toBe(Math.ceil(FRAME.height) * 3);
    expect(at(output, 4, 4)).toEqual([255, 249, 233, 255]);
    expect(at(output, 750, 1750)).toEqual([255, 249, 233, 255]);
    expect(at(output, 350, 300)[0]).toBe(40);
    expect(at(output, 1200, 300)[0]).toBe(228);
  });
  it("keeps exports and undo state unchanged while the preview is moving or developing", async () => {
    const asset = await makeAsset(),
      composition = initialComposition(),
      before = structuredClone(composition),
      area = bounds(composition);
    const original = await renderComposition(
      canvas(1, 1),
      { sample: asset },
      composition,
      area,
      1,
    );
    const pixels = original.toDataURL();
    const animated = paintComposition(
      canvas(1, 1),
      await prepareTextures({ sample: asset }, composition, 1),
      composition,
      area,
      1,
      {
        development: 0.2,
        layers: { [composition.layers[0].id]: { lift: 1, arrival: 0.5 } },
      },
    );
    expect(animated.toDataURL()).not.toBe(pixels);
    expect(composition).toEqual(before);
    const exported = await renderComposition(
      canvas(1, 1),
      { sample: asset },
      composition,
      area,
      1,
    );
    expect(exported.toDataURL()).toBe(pixels);
    const neutral = paintComposition(
      canvas(1, 1),
      await prepareTextures({ sample: asset }, composition, 1),
      composition,
      area,
      1,
      { development: 1, layers: {} },
    );
    expect(neutral.toDataURL()).toBe(pixels);
  });
  it("reopens the SVG entirely from embedded assets and matches PNG geometry with effects and overflow", async () => {
    const asset = await makeAsset();
    let c = initialComposition();
    c = cutLayer(
      c,
      c.layers[0].id,
      [
        [0, 184],
        [460, 184],
      ],
      "straight",
    );
    c.layers[1].x -= 90;
    c.layers[1].rotation = 12;
    c.effects = { film: 0.6, copier: 0.8, seed: 76 };
    c = addDecoration(c, "tape", "#e65b3c");
    c.caption = "A little memory";
    const svg = await serializeSvg({ sample: asset }, c);
    expect(svg).not.toMatch(/href="https?:/);
    expect(svg).toContain("data:image/png;base64,");
    const image = await loadImage(
      new Resvg(svg, { fitTo: { mode: "width", value: bounds(c).width * 3 } })
        .render()
        .asPng(),
    );
    const output = await renderComposition(
      canvas(1, 1),
      { sample: asset },
      c,
      bounds(c),
      3,
    );
    expect(image.width).toBe(output.width);
    expect(image.height).toBe(output.height);
    const reopened = createCanvas(image.width, image.height);
    reopened.getContext("2d").drawImage(image, 0, 0);
    const pixels = output
      .getContext("2d")!
      .getImageData(0, 0, output.width, output.height).data;
    const actual = reopened
      .getContext("2d")
      .getImageData(0, 0, image.width, image.height).data;
    mkdirSync(".sites-runtime/qa", { recursive: true });
    writeFileSync(".sites-runtime/qa/export.svg", svg);
    writeFileSync(
      ".sites-runtime/qa/export.png",
      Buffer.from(output.toDataURL("image/png").split(",")[1], "base64"),
    );
    writeFileSync(
      ".sites-runtime/qa/reopened-svg.png",
      reopened.toBuffer("image/png"),
    );
    let difference = 0;
    for (let i = 0; i < pixels.length; i += 4)
      for (let ch = 0; ch < 4; ch++)
        difference += Math.abs(pixels[i + ch] - actual[i + ch]);
    expect(difference / pixels.length).toBeLessThan(3);
  });
  it("shares curved-cut geometry between two photos, PNG, SVG, and flattened JPEG", async () => {
    const a = await makeAsset();
    const b = await makeAsset(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#8863bc"/></svg>',
    );
    let c = initialComposition();
    c.layers[0].x = 15;
    const added = photoLayer("second", "Another memory", 1);
    added.rotation = 23;
    c.layers.push(added);
    c = cutLayer(
      c,
      added.id,
      [
        [0, 130],
        [90, 70],
        [200, 200],
        [322, 140],
      ],
      "freehand",
    );
    c.layers.at(-1)!.x += 25;
    const assets = { sample: a, second: b },
      region = bounds(c);
    const out = await renderComposition(canvas(1, 1), assets, c, region, 3);
    // A photo positioned under the left border cannot cover the locked frame.
    expect(at(out, (50 - region.x) * 3, (150 - region.y) * 3)).toEqual([
      255, 249, 233, 255,
    ]);
    expect(at(out, (25 - region.x) * 3, (150 - region.y) * 3)).toEqual([
      40, 108, 121, 255,
    ]);
    const svg = await serializeSvg(assets, c);
    const reopened = new Resvg(svg, {
      fitTo: { mode: "width", value: out.width },
    })
      .render()
      .asPng();
    const image = await loadImage(reopened),
      compare = createCanvas(out.width, out.height);
    compare.getContext("2d").drawImage(image, 0, 0);
    const expected = out
      .getContext("2d")!
      .getImageData(0, 0, out.width, out.height).data;
    const actual = compare
      .getContext("2d")
      .getImageData(0, 0, out.width, out.height).data;
    const mean =
      expected.reduce((sum, v, i) => sum + Math.abs(v - actual[i]), 0) /
      expected.length;
    expect(mean).toBeLessThan(2);
    flatten(out);
    const jpeg = Buffer.from(
      out.toDataURL("image/jpeg", 0.95).split(",")[1],
      "base64",
    );
    const decoded = await loadImage(jpeg);
    expect(decoded.width).toBe(out.width);
    expect(decoded.height).toBe(out.height);
    expect([...jpeg.subarray(0, 2)]).toEqual([255, 216]);
  });
  it("retains uploaded vector SVG artwork when pixel effects are off", async () => {
    const source =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100"><defs><linearGradient id="g"><stop stop-color="#287588"/><stop offset="1" stop-color="#de5032"/></linearGradient></defs><rect x="10" y="5" width="180" height="90" fill="url(#g)" opacity="0.6"/></svg>';
    const asset = await makeAsset(source),
      composition = initialComposition();
    const svg = await serializeSvg({ sample: asset }, composition);
    expect(svg).toContain("data:image/svg+xml;base64,");
    expect(svg).toContain(
      '<rect x="40" y="35" width="520" height="632.2727272727273"',
    );
    const image = await loadImage(
      new Resvg(svg, {
        fitTo: { mode: "width", value: bounds(composition).width * 3 },
      })
        .render()
        .asPng(),
    );
    expect(image.width).toBe(1560);
    expect(image.height).toBe(Math.ceil(FRAME.height) * 3);
    const reopened = createCanvas(image.width, image.height);
    reopened.getContext("2d").drawImage(image, 0, 0);
    expect(
      reopened.getContext("2d").getImageData(700, 700, 1, 1).data[0],
    ).toBeLessThan(240);
  });
});
