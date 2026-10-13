// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clone,
  initialComposition,
  type Asset,
  type Composition,
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
  texture: mocks.texture,
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
const onError = vi.fn(),
  onDown = vi.fn(),
  onMove = vi.fn(),
  onUp = vi.fn();
async function render(
  composition: Composition,
  enabled = true,
  currentAsset: Asset = asset,
) {
  await act(async () =>
    root.render(
      <Stage
        asset={currentAsset}
        composition={composition}
        selected={composition.layers[0]?.id || null}
        tool="move"
        axis="horizontal"
        enabled={enabled}
        onDown={onDown}
        onMove={onMove}
        onUp={onUp}
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
  mocks.texture.mockResolvedValue(document.createElement("canvas"));
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
    let first!: (value: HTMLCanvasElement) => void,
      second!: (value: HTMLCanvasElement) => void;
    mocks.texture
      .mockImplementationOnce(
        () =>
          new Promise<HTMLCanvasElement>((r) => {
            first = r;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<HTMLCanvasElement>((r) => {
            second = r;
          }),
      );
    await render(initialComposition(), false);
    const newer = { ...asset, url: "newer" };
    await render(initialComposition(), false, newer);
    const newTexture = document.createElement("canvas"),
      oldTexture = document.createElement("canvas");
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
