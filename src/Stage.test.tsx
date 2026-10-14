// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clone,
  initialComposition,
  type Asset,
  type Composition,
  type Tool,
} from "./model";

const mocks = vi.hoisted(() => ({
  texture: vi.fn(),
  paint: vi.fn(),
  controllers: [] as {
    stop: ReturnType<typeof vi.fn>;
    update: (v: number) => void;
  }[],
}));
vi.mock("./render", () => ({
  prepareTextures: mocks.texture,
  paintComposition: mocks.paint,
}));
vi.mock("motion/react", async () => {
  const { createElement } = await import("react");
  return {
    motion: {
      div: ({
        children,
        initial,
        animate,
        variants,
        ...props
      }: Record<string, unknown>) => {
        void initial;
        void animate;
        void variants;
        return createElement("div", props, children as never);
      },
    },
    animate: (
      _from: number,
      _to: number,
      options: { onUpdate: (v: number) => void },
    ) => {
      const controller = { stop: vi.fn(), update: options.onUpdate };
      mocks.controllers.push(controller);
      return controller;
    },
  };
});
import Stage from "./Stage";

let host: HTMLDivElement, root: Root;
const asset = {
  image: {} as HTMLImageElement,
  url: "sample",
  name: "sample",
  width: 800,
  height: 800,
};
const flush = () =>
  act(async () => {
    await Promise.resolve();
  });
const assetMaps = new WeakMap<Asset, Record<string, Asset>>();
const onError = vi.fn(),
  onDown = vi.fn(),
  onMove = vi.fn(),
  onUp = vi.fn();
async function render(
  composition: Composition,
  enabled = true,
  currentAsset: Asset = asset,
  tool: Tool = "move",
) {
  await act(async () =>
    root.render(
      <Stage
        assets={
          assetMaps.get(currentAsset) ||
          (() => {
            const registry = { sample: currentAsset };
            assetMaps.set(currentAsset, registry);
            return registry;
          })()
        }
        composition={composition}
        selected={composition.layers[0]?.id || null}
        tool={tool}
        cutMode="straight"
        enabled={enabled}
        onSelect={onDown}
        onChange={onMove}
        onRepeat={onUp}
        onCut={onUp}
        onGrid={onUp}
        onError={onError}
      />,
    ),
  );
  await flush();
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: Promise.resolve() },
  });
  mocks.texture.mockResolvedValue({});
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  mocks.controllers = [];
});
describe("preview lifecycle and rendering cost", () => {
  it("reuses the processed photo during animation and layer movement", async () => {
    const c = initialComposition();
    await render(c);
    expect(mocks.texture).toHaveBeenCalledOnce();
    await act(async () => mocks.controllers[0].update(0.4));
    const next = clone(c);
    next.layers[0].x += 30;
    await render(next);
    expect(mocks.texture).toHaveBeenCalledOnce();
    expect(mocks.paint).toHaveBeenCalled();
    expect(next.effects).toEqual(c.effects);
  });
  it("stops active animations and settles presentation when motion is disabled", async () => {
    const c = initialComposition();
    await render(c);
    const control = mocks.controllers[0];
    await render(c, false);
    expect(control.stop).toHaveBeenCalled();
    expect(mocks.paint.mock.calls.at(-1)?.[5]).toEqual({
      development: 1,
      layers: {},
    });
  });
  it("ignores a processed texture that belongs to a replaced photo", async () => {
    let first!: (value: Record<string, HTMLCanvasElement>) => void,
      second!: (value: Record<string, HTMLCanvasElement>) => void;
    mocks.texture
      .mockImplementationOnce(
        () =>
          new Promise<Record<string, HTMLCanvasElement>>((r) => {
            first = r;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Record<string, HTMLCanvasElement>>((r) => {
            second = r;
          }),
      );
    await render(initialComposition(), false);
    const newer = { ...asset, url: "newer" };
    await render(initialComposition(), false, newer);
    const newTexture = { new: document.createElement("canvas") },
      oldTexture = { old: document.createElement("canvas") };
    await act(async () => second(newTexture));
    await flush();
    await act(async () => first(oldTexture));
    await flush();
    expect(mocks.paint.mock.calls.at(-1)?.[1]).toBe(newTexture);
    expect(mocks.paint.mock.calls.some((call) => call[1] === oldTexture)).toBe(
      false,
    );
  });
});

function pointer(type: string, x: number, y: number, target: Element) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX: x + 35,
    clientY: y,
  });
  Object.defineProperty(event, "pointerId", { value: 1 });
  target.dispatchEvent(event);
}
async function pointerSetup(c: Composition, tool: Tool = "move") {
  Object.defineProperty(SVGSVGElement.prototype, "getScreenCTM", {
    configurable: true,
    value: () => null,
  });
  Object.defineProperty(SVGSVGElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => ({ left: 0, top: 0, width: 670, height: 710 }),
  });
  Object.defineProperty(SVGSVGElement.prototype, "setPointerCapture", {
    configurable: true,
    value: () => {},
  });
  Object.defineProperty(SVGSVGElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: () => true,
  });
  await render(c, false, asset, tool);
  return host.querySelector("svg")!;
}
describe("real pointer gestures", () => {
  it("resizes using the corner handle, committing just once at release", async () => {
    const c = initialComposition(),
      svg = await pointerSetup(c);
    await act(async () =>
      pointer(
        "pointerdown",
        530,
        525,
        host.querySelector('[data-handle="se"]')!,
      ),
    );
    await act(async () => pointer("pointermove", 420, 410, svg));
    expect(onMove.mock.calls.at(-1)?.[1]).toBe(false);
    expect(onMove.mock.calls.at(-1)?.[0].layers[0].width).toBeCloseTo(350);
    await act(async () => pointer("pointerup", 420, 410, svg));
    expect(onMove.mock.calls.filter((c) => c[1] === true)).toHaveLength(1);
    expect(c.layers[0].width).toBe(460);
  });
  it("shows a diagonal stroke and sends local coordinates to the cutting operation", async () => {
    const c = initialComposition(),
      svg = await pointerSetup(c, "cut");
    await act(async () => pointer("pointerdown", 75, 70, svg));
    await act(async () => pointer("pointermove", 525, 515, svg));
    expect(host.querySelector(".cut-guide")?.getAttribute("points")).toContain(
      "525,515",
    );
    await act(async () => pointer("pointerup", 525, 515, svg));
    expect(onUp).toHaveBeenCalledWith(c.layers[0].id, [
      [5, 5],
      [455, 450],
    ]);
  });
  it("trims through the crop box and rotates a tape handle without touching source geometry", async () => {
    const c = initialComposition(),
      svg = await pointerSetup(c, "crop");
    await act(async () => pointer("pointerdown", 100, 100, svg));
    await act(async () => pointer("pointermove", 300, 350, svg));
    await act(async () => pointer("pointerup", 300, 350, svg));
    const cropped = onMove.mock.calls.at(-1)![0].layers[0];
    expect(cropped.width).toBeCloseTo(200);
    expect(cropped.height).toBeCloseTo(250);
    expect(cropped.source.x).toBeCloseTo(30);
    onMove.mockClear();
    c.layers[0] = { ...c.layers[0], kind: "tape", rotation: 0 };
    await render(c, false);
    const handle = host.querySelector('[data-handle="rotate"]')!;
    await act(async () => pointer("pointerdown", 300, 33, handle));
    await act(async () => pointer("pointermove", 562, 295, svg));
    await act(async () => pointer("pointerup", 562, 295, svg));
    expect(onMove.mock.calls.at(-1)![0].layers[0].rotation).toBeCloseTo(90);
  });
});
