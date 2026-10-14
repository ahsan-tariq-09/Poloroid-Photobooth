// @vitest-environment jsdom

import { act } from "react";

import { createRoot, type Root } from "react-dom/client";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Asset, Composition } from "./model";

const mocks = vi.hoisted(() => ({
  current: null as null | {
    composition: Composition;
    selected: string | null;
    assets: Record<string, Asset>;
    onSelect: (id: string | null) => void;
    onChange: (next: Composition, final: boolean) => void;
  },

  importAsset: vi.fn(),
  exportFile: vi.fn(),
  printComposition: vi.fn(),
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
  exportFile: mocks.exportFile,
  printComposition: mocks.printComposition,
  texture: async () => document.createElement("canvas"),
}));

vi.mock("./Stage", () => ({
  default: (props: NonNullable<typeof mocks.current>) => {
    mocks.current = props;
    return (
      <button
        aria-label="Select photograph"
        onClick={() =>
          props.onSelect(
            props.composition.layers.find((l) => l.kind === "photo")?.id ||
              null,
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

async function chooseFiles(names: string[]) {
  const input = host.querySelector<HTMLInputElement>("input[type=file]")!;

  expect(input.multiple).toBe(true);

  Object.defineProperty(input, "files", {
    configurable: true,
    value: names.map((n) => new File(["test"], n)),
  });

  await act(async () =>
    input.dispatchEvent(new Event("change", { bubbles: true })),
  );
  await flush();
}

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

  mocks.exportFile.mockResolvedValue(undefined);
  mocks.printComposition.mockResolvedValue(undefined);

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
  it("keeps a new photo fragment selected when tape sits above the photo", async () => {
    await click('[title="Tape (T)"]');

    await click('[title="Cut (X)"]');

    await click(".tool-target-controls .secondary-button");

    expect(comp().layers).toHaveLength(3);

    expect(
      comp().layers.find((layer) => layer.id === mocks.current!.selected)?.kind,
    ).toBe("photo");

    expect(
      host.querySelector<HTMLButtonElement>(
        ".tool-target-controls .secondary-button",
      )!.disabled,
    ).toBe(false);

    await click(".tool-target-controls .secondary-button");

    expect(comp().layers).toHaveLength(4);
  });

  it("preserves cut, decoration, duplication, layer controls, undo/redo and reset", async () => {
    expect(comp().layers).toHaveLength(1);

    await click('[aria-label="Select photograph"]');

    await click('[title="Cut (X)"]');

    await click(".tool-target-controls .secondary-button");

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

  it("retains effects and sends the complete collage to all four downloads and print", async () => {
    await click(".preset:nth-child(2)");
    expect(comp().effects.film).toBe(0.65);

    const select = host.querySelector<HTMLSelectElement>(
      '[aria-label="Download format"]',
    )!;

    for (const format of ["png", "jpeg", "heic", "svg"]) {
      await act(async () => {
        select.value = format;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });

      await click(".download-main");
      expect(mocks.exportFile).toHaveBeenLastCalledWith(
        mocks.current!.assets,
        comp(),
        format,
      );
    }

    await click('[aria-label="Print Polaroid"]');
    expect(mocks.printComposition).toHaveBeenCalledWith(
      mocks.current!.assets,
      comp(),
    );

    expect(host.textContent).toContain("88 × 107 mm");
  });

  it("queues rapid uploads so a slow HEIC and a later SVG are both retained", async () => {
    let first!: (v: Asset) => void, second!: (v: Asset) => void;

    mocks.importAsset
      .mockImplementationOnce(
        () =>
          new Promise<Asset>((r) => {
            first = r;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Asset>((r) => {
            second = r;
          }),
      );

    await chooseFiles(["older.heic"]);
    await chooseFiles(["newer.svg"]);
    expect(mocks.importAsset).toHaveBeenCalledTimes(1);

    await act(async () => first(fixture("older.heic")));
    await flush();
    expect(mocks.importAsset).toHaveBeenCalledTimes(2);

    await act(async () => second(fixture("newer.svg")));
    await flush();

    expect(comp().layers).toHaveLength(2);
    expect(Object.values(mocks.current!.assets).map((a) => a.name)).toEqual([
      "older.heic",
      "newer.svg",
    ]);

    await click('[aria-label="Undo"]');
    expect(comp().layers).toHaveLength(1);

    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:newer.svg");

    await click('[aria-label="Redo"]');
    expect(comp().layers).toHaveLength(2);
  });

  it("keeps successful mixed batch imports and restores every original photo on reset", async () => {
    mocks.importAsset
      .mockResolvedValueOnce(fixture("a.jpg"))
      .mockRejectedValueOnce(new Error("Cannot decode"))
      .mockResolvedValueOnce(fixture("b.svg"));

    await chooseFiles(["a.jpg", "bad.heic", "b.svg"]);
    await flush();

    expect(comp().layers).toHaveLength(2);
    expect(host.textContent).toContain("bad.heic");

    await click('[title="Tape (T)"]');
    await click(".reset-button");
    expect(comp().layers).toHaveLength(2);
    expect(comp().layers.every((l) => l.kind === "photo")).toBe(true);
  });

  it("creates nine tiles and keeps single duplication separate", async () => {
    await click('[aria-label="Select photograph"]');
    await click('[title="Repeat (D)"]');
    await click(".tool-target-controls .secondary-button");

    expect(comp().layers).toHaveLength(9);
    expect(host.querySelector('[aria-label="Grid width"]')).not.toBeNull();

    await click('[title="Move (V)"]');
    await click('[aria-label="Duplicate selected piece"]');
    expect(comp().layers).toHaveLength(10);

    await click('[aria-label="Undo"]');
    expect(comp().layers).toHaveLength(9);
    await click('[aria-label="Undo"]');
    expect(comp().layers).toHaveLength(1);
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
