import { readFileSync } from "node:fs";
import { resolveObjectURL } from "node:buffer";
import { Worker as NodeWorker } from "node:worker_threads";
import { createCanvas, ImageData, loadImage } from "@napi-rs/canvas";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Execute the decoder's actual browser-worker source in a Node worker. This
// exercises libheif pixels and the PNG conversion, without any browser UI.
class BrowserWorker {
  worker?: NodeWorker;
  ready: Promise<void>;
  listeners = new Map<string, Set<(event: unknown) => void>>();
  onerror?: (event: unknown) => void;
  constructor(url: string) {
    workers.push(this);
    this.ready = (async () => {
      const source = await resolveObjectURL(url)!.text();
      const bootstrap = `
        const {parentPort}=require('node:worker_threads');
        globalThis.self=globalThis;
        globalThis.location={href:'https://test.invalid/worker.js'};
        globalThis.importScripts=()=>{};
        globalThis.ImageData=class {constructor(w,h){this.width=w;this.height=h;this.data=new Uint8ClampedArray(w*h*4);}};
        globalThis.onmessage=undefined;
        globalThis.postMessage=(data)=>parentPort.postMessage(data);
        globalThis.process=undefined;
        ${source}
        parentPort.on('message',data=>globalThis.onmessage({data}));
      `;
      this.worker = new NodeWorker(bootstrap, { eval: true });
      this.worker.on("message", (data) => {
        if (data.imageData) {
          const decoded = data.imageData;
          data.imageData = new ImageData(
            new Uint8ClampedArray(decoded.data),
            decoded.width,
            decoded.height,
          );
        }
        this.emit("message", { data, currentTarget: this });
      });
      this.worker.on("error", (error) =>
        this.emit("error", { data: error.message, currentTarget: this }),
      );
    })();
  }
  emit(type: string, event: unknown) {
    for (const listener of this.listeners.get(type) || []) listener(event);
    if (type === "error") this.onerror?.(event);
  }
  addEventListener(type: string, listener: (event: unknown) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.get(type)?.delete(listener);
  }
  postMessage(data: unknown) {
    void this.ready.then(() => this.worker!.postMessage(data));
  }
}
const workers: BrowserWorker[] = [];
beforeAll(() => {
  vi.stubGlobal("Worker", BrowserWorker);
  vi.stubGlobal("ImageData", ImageData);
  vi.stubGlobal("document", {
    createElement: () => {
      const c = createCanvas(1, 1);
      Object.assign(c, {
        toBlob: (callback: (value: Blob) => void) =>
          callback(
            new Blob([new Uint8Array(c.toBuffer("image/png"))], {
              type: "image/png",
            }),
          ),
      });
      return c;
    },
  });
});
afterAll(async () => {
  await Promise.all(workers.map((w) => w.worker?.terminate()));
  vi.unstubAllGlobals();
});
describe("actual HEIC decoder", () => {
  it("decodes a public HEIC still image into an editable PNG", async () => {
    const { heicTo, isHeic } = await import("heic-to/csp");
    const file = new File(
      [new Uint8Array(readFileSync("tests/fixtures/libheif-example.heic"))],
      "example.heic",
      { type: "image/heic" },
    );
    expect(await isHeic(file)).toBe(true);
    const result = await heicTo({ blob: file, type: "image/png" });
    expect(result.type).toBe("image/png");
    expect(result.size).toBeGreaterThan(1000);
    const signature = new Uint8Array(await result.slice(0, 8).arrayBuffer());
    expect([...signature]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  }, 30_000);
  it("rejects malformed HEIC input so the caller can retain the previous photo", async () => {
    const { heicTo } = await import("heic-to/csp");
    await expect(
      heicTo({ blob: new Blob(["invalid heic"]), type: "image/png" }),
    ).rejects.toBeDefined();
  }, 30_000);
});

describe("actual HEIC encoder worker", () => {
  it("encodes a rendered image as HEIC and decodes it with the independent import decoder", async () => {
    const result = await build({
      configFile: false,
      logLevel: "silent",
      build: {
        write: false,
        minify: false,
        lib: {
          entry: "src/heicExport.worker.ts",
          formats: ["iife"],
          name: "HeicWorker",
        },
      },
    });
    const output = Array.isArray(result) ? result[0] : result;
    if (!("output" in output))
      throw new Error("Worker build did not return output");
    const chunk = output.output.find((item) => item.type === "chunk");
    if (!chunk || chunk.type !== "chunk")
      throw new Error("Missing worker bundle");
    const worker = new NodeWorker(
      `
      const {parentPort}=require('node:worker_threads');
      globalThis.self=globalThis;globalThis.location={href:'https://test.invalid/encoder.js'};
      globalThis.importScripts=()=>{};globalThis.postMessage=(data)=>parentPort.postMessage(data);globalThis.process=undefined;
      ${chunk.code}
      parentPort.on('message',data=>globalThis.onmessage({data}));
    `,
      { eval: true },
    );
    try {
      const c = createCanvas(128, 157),
        ctx = c.getContext("2d");
      ctx.fillStyle = "#fff9e9";
      ctx.fillRect(0, 0, 128, 157);
      ctx.fillStyle = "#d52c29";
      ctx.fillRect(10, 10, 54, 110);
      ctx.fillStyle = "#286b9b";
      ctx.fillRect(64, 10, 54, 110);
      const message = new Promise<{ bytes?: Uint8Array; error?: string }>(
        (resolve, reject) => {
          worker.once("message", resolve);
          worker.once("error", reject);
        },
      );
      worker.postMessage({
        pixels: ctx.getImageData(0, 0, 128, 157).data,
        width: 128,
        height: 157,
      });
      const encoded = await message;
      expect(encoded.error).toBeUndefined();
      expect(encoded.bytes!.length).toBeGreaterThan(100);
      expect(new TextDecoder().decode(encoded.bytes!.slice(4, 32))).toContain(
        "ftyp",
      );
      const { heicTo } = await import("heic-to/csp");
      const png = await heicTo({
        blob: new Blob([new Uint8Array(encoded.bytes!)], {
          type: "image/heic",
        }),
        type: "image/png",
      });
      const decoded = await loadImage(new Uint8Array(await png.arrayBuffer()));
      expect(decoded.width).toBe(128);
      expect(decoded.height).toBe(157);
      const compare = createCanvas(128, 157);
      compare.getContext("2d").drawImage(decoded, 0, 0);
      const red = compare.getContext("2d").getImageData(30, 60, 1, 1).data;
      expect(red[0]).toBeGreaterThan(170);
      expect(red[1]).toBeLessThan(90);
    } finally {
      await worker.terminate();
    }
  }, 60000);
});
