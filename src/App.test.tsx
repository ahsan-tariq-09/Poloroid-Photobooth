// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset, Composition } from "./model";

const mocks = vi.hoisted(() => ({
  current: null as null | {
    composition: Composition;
    asset: Asset;
    onDown: (x: number, y: number, id?: string) => string | null;
  },
  importAsset: vi.fn(),
  exportPng: vi.fn(),
  download: vi.fn(),
  serializeSvg: vi.fn(),
}));
vi.mock("./imports", () => ({
  ACCEPT: ".jpg,.jpeg,.png,.heic,.heif,.svg",
  loadImage: async () => ({ naturalWidth: 800, naturalHeight: 800 }),
  importAsset: mocks.importAsset,
}));
vi.mock("./effects", () => ({
  backend: "canvas",
  initializeEffects: async () => false,
}));
vi.mock("./render", () => ({
  exportPng: mocks.exportPng,
  download: mocks.download,
  serializeSvg: mocks.serializeSvg,
  texture: async () => document.createElement("canvas"),
}));
vi.mock("./Stage", () => ({
  default: (props: NonNullable<typeof mocks.current>) => {
    mocks.current = props;
    return (
      <button
        aria-label="Select photograph"
        onClick={() =>
          props.onDown(
            150,
            150,
            props.composition.layers.find((l) => l.kind === "photo")?.id,
          )
        }
      >
        Select photograph
      </button>
    );
  },
}));
import App from "./App";

let root: Root, host: HTMLDivElement;
const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
async function click(selector: string) {
  const button = host.querySelector<HTMLButtonElement>(selector);
  expect(button).not.toBeNull();
  await act(async () => button!.click());
  await flush();
}
const comp = () => mocks.current!.composition;
function fixture(name: string): Asset {
  return {
    name,
    url: `blob:${name}`,
    width: 800,
    height: 800,
    image: {} as HTMLImageElement,
  };
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: Promise.resolve() },
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: () => {},
  } as never);
  URL.revokeObjectURL = vi.fn();
  mocks.exportPng.mockResolvedValue(undefined);
  mocks.serializeSvg.mockResolvedValue(
    '<svg xmlns="http://www.w3.org/2000/svg"/>',
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<App />));
  await flush();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("existing editor regression", () => {
  it("preserves cut, decoration, duplication, layer controls, undo/redo and reset", async () => {
    expect(comp().layers).toHaveLength(1);
    await click('[aria-label="Select photograph"]');
    await click('[title="Cut (X)"]');
    await click(".cut-controls .secondary-button");
    expect(comp().layers).toHaveLength(2);
    await click('[title="Tape (T)"]');
    expect(comp().layers).toHaveLength(3);
    await click('[title="Paper (P)"]');
    expect(comp().layers).toHaveLength(4);
    await click('[aria-label="Duplicate selected piece"]');
    expect(comp().layers).toHaveLength(5);
    const before = comp().layers.at(-1)!.x;
    await click('[aria-label="Move Right"]');
    expect(comp().layers.at(-1)!.x).toBe(before + 5);
    await click('[aria-label="Delete selected piece"]');
    expect(comp().layers).toHaveLength(4);
    await click('[aria-label="Undo"]');
    expect(comp().layers).toHaveLength(5);
    await click('[aria-label="Redo"]');
    expect(comp().layers).toHaveLength(4);
    await click(".reset-button");
    expect(comp().layers).toHaveLength(1);
    expect(comp().effects).toEqual({ film: 0, copier: 0, seed: 76 });
  });
  it("retains existing effects and passes the finished composition to both downloads", async () => {
    await click(".preset:nth-child(2)");
    expect(comp().effects.film).toBe(0.65);
    await click(".download-main");
    expect(mocks.exportPng).toHaveBeenCalledWith(mocks.current!.asset, comp());
    await click(".svg-download");
    expect(mocks.serializeSvg).toHaveBeenCalledWith(
      mocks.current!.asset,
      comp(),
    );
    expect(mocks.download).toHaveBeenCalledWith(
      expect.any(Blob),
      "my-poloroid.svg",
    );
  });
  it("ignores an older upload that finishes after a newer one", async () => {
    let first!: (v: Asset) => void, second!: (v: Asset) => void;
    mocks.importAsset
      .mockImplementationOnce(
        () =>
          new Promise<Asset>((resolve) => {
            first = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Asset>((resolve) => {
            second = resolve;
          }),
      );
    const input = host.querySelector<HTMLInputElement>("input[type=file]")!;
    async function choose(name: string) {
      Object.defineProperty(input, "files", {
        configurable: true,
        value: [new File(["test"], name)],
      });
      await act(async () =>
        input.dispatchEvent(new Event("change", { bubbles: true })),
      );
    }
    await choose("older.heic");
    await choose("newer.svg");
    await act(async () => second(fixture("newer.svg")));
    await flush();
    expect(mocks.current!.asset.name).toBe("newer.svg");
    await act(async () => first(fixture("older.heic")));
    await flush();
    expect(mocks.current!.asset.name).toBe("newer.svg");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:older.heic");
  });
  it("keeps all three STL links and accessible dialogs", async () => {
    await click("nav button");
    expect(host.querySelector("[role=dialog]")).not.toBeNull();
    const links = [
      ...host.querySelectorAll<HTMLAnchorElement>("a[download]"),
    ].map((a) => a.getAttribute("href"));
    expect(links).toEqual([
      "/frames/frame-polaroid-part1.stl",
      "/frames/frame-polaroid-part2.stl",
      "/frames/polaroid%20frame.stl",
    ]);
    await click('[aria-label="Close dialog"]');
    expect(host.querySelector("[role=dialog]")).toBeNull();
  });
  it("stops the camera stream on close and handles permission failure", async () => {
    const stop = vi.fn(),
      getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    await click(".camera-button");
    expect(getUserMedia).toHaveBeenCalledOnce();
    await click('[aria-label="Close camera"]');
    expect(stop).toHaveBeenCalled();
    getUserMedia.mockRejectedValueOnce(new Error("Permission denied"));
    await click(".camera-button");
    expect(host.textContent).toContain("permission was declined");
    await click('[aria-label="Close camera"]');
  });
});
