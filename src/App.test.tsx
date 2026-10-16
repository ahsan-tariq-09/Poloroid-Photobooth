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
  renderComposition: async () => document.createElement("canvas"),
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
import { examples } from "./studio/examples";

let root: Root, host: HTMLDivElement;

const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  for (let i = 0; host?.textContent?.includes("Opening editor…") && i < 30; i++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
};

async function click(selector: string) {
  const button = host.querySelector<HTMLButtonElement>(selector);

  expect(button).not.toBeNull();

  await act(async () => button!.click());

  await flush();
}

async function menuAction(label: string, submenu?: string) {
  const trigger = host.querySelector<HTMLButtonElement>(
    '[aria-label="Piece menu"]',
  )!;
  await act(async () =>
    trigger.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    ),
  );
  await flush();
  if (submenu) {
    const trigger = [
      ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ].find((el) => el.textContent === submenu)!;
    await act(async () =>
      trigger.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      ),
    );
    await flush();
  }
  const item = [
    ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ].find((el) => el.textContent === label);
  expect(item).toBeDefined();
  await act(async () => item!.click());
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

  window.history.replaceState(null, "", "/");
  window.scrollTo = vi.fn();
  mocks.current = null;
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

async function button(text: string) {
  const target = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim() === text,
  );
  expect(target, text).toBeDefined();
  await act(async () => target!.click());
  await flush();
}
async function startClassic() {
  await click('[aria-label="Try Classic example"]');
}
describe("existing editor regression", () => {
  beforeEach(startClassic);
  it("copies without history, pastes after deletion, and undoes menu alignment and ordering one action at a time", async () => {
    const original = structuredClone(comp());
    await menuAction("Copy");
    expect(
      host.querySelector<HTMLButtonElement>('[aria-label="Undo"]')!.disabled,
    ).toBe(true);
    await menuAction("Paste");
    const pasted = structuredClone(comp());
    await menuAction("Left", "Align to page");
    expect(comp().layers.at(-1)!.x).toBe(40);
    await click('[aria-label="Undo"]');
    expect(comp()).toEqual(pasted);
    await menuAction("Send to back", "Layer");
    expect(comp().layers[0].id).toBe(pasted.layers[1].id);
    await click('[aria-label="Undo"]');
    expect(comp()).toEqual(pasted);
    await menuAction("Delete");
    expect(comp()).toEqual(original);
    await menuAction("Paste");
    expect(comp().layers).toHaveLength(2);
    expect(comp().layers[1].assetId).toBe(original.layers[0].assetId);
  });
  it("keeps a new photo fragment selected when tape sits above the photo", async () => {
    await button("Decorate");
    await click('[title="Tape"]');

    await button("Arrange");
    await click('[title="Cut"]');

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

  it("preserves cut, decoration, copy/paste, layer controls, undo/redo and reset", async () => {
    expect(comp().layers).toHaveLength(1);

    await click('[aria-label="Select photograph"]');

    await button("Arrange");
    await click('[title="Cut"]');

    await click(".tool-target-controls .secondary-button");

    expect(comp().layers).toHaveLength(2);

    await button("Decorate");
    await click('[title="Tape"]');

    expect(comp().layers).toHaveLength(3);

    await click('[title="Paper"]');

    expect(comp().layers).toHaveLength(4);

    await menuAction("Copy");
    await menuAction("Paste");

    expect(comp().layers).toHaveLength(5);

    const before = comp().layers.at(-1)!.x;

    await click('[aria-label="Move Right"]');

    expect(comp().layers.at(-1)!.x).toBe(before + 5);

    await menuAction("Delete");

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
    await button("Look");
    await click(".preset:nth-child(2)");
    expect(comp().effects.film).toBe(0.65);

    await button("Continue");
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

    await click(".add-photos");
    await chooseFiles(["older.heic"]);
    await chooseFiles(["newer.svg"]);
    expect(mocks.importAsset).toHaveBeenCalledTimes(1);

    await act(async () => first(fixture("older.heic")));
    await flush();
    expect(mocks.importAsset).toHaveBeenCalledTimes(2);

    await act(async () => second(fixture("newer.svg")));
    await flush();

    expect(comp().layers).toHaveLength(3);
    expect(Object.values(mocks.current!.assets).map((a) => a.name)).toEqual([
      "Coastal photo",
      "older.heic",
      "newer.svg",
    ]);

    await click('[aria-label="Undo"]');
    expect(comp().layers).toHaveLength(2);

    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:newer.svg");

    await click('[aria-label="Redo"]');
    expect(comp().layers).toHaveLength(3);
  });

  it("keeps successful mixed batch imports and restores every original photo on reset", async () => {
    mocks.importAsset
      .mockResolvedValueOnce(fixture("a.jpg"))
      .mockRejectedValueOnce(new Error("Cannot decode"))
      .mockResolvedValueOnce(fixture("b.svg"));

    await click(".wordmark");
    await chooseFiles(["a.jpg", "bad.heic", "b.svg"]);
    await button("Start new Polaroid");
    await flush();

    expect(comp().layers).toHaveLength(2);
    expect(host.textContent).toContain("bad.heic");

    await button("Decorate");
    await click('[title="Tape"]');
    await click(".reset-button");
    expect(comp().layers).toHaveLength(2);
    expect(comp().layers.every((l) => l.kind === "photo")).toBe(true);
  });

  it("creates nine tiles and keeps single duplication separate", async () => {
    await click('[aria-label="Select photograph"]');
    await click('[title="Repeat"]');
    await click(".tool-target-controls .secondary-button");

    expect(comp().layers).toHaveLength(9);
    expect(host.querySelector('[aria-label="Grid width"]')).not.toBeNull();

    await click('[title="Move"]');
    await menuAction("Copy");
    await menuAction("Paste");
    expect(comp().layers).toHaveLength(10);

    await click('[aria-label="Undo"]');
    expect(comp().layers).toHaveLength(9);
    await click('[aria-label="Undo"]');
    expect(comp().layers).toHaveLength(1);
  });

  it("keeps all three STL links and accessible dialogs", async () => {
    await button("Continue");

    const links = [
      ...host.querySelectorAll<HTMLAnchorElement>("a[download]"),
    ].map((a) => a.getAttribute("href"));

    expect(links).toEqual([
      "/frames/frame-polaroid-part1.stl",

      "/frames/frame-polaroid-part2.stl",

      "/frames/polaroid%20frame.stl",
    ]);
  });

  it("stops the camera stream on close and handles permission failure", async () => {
    const stop = vi.fn(),
      getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,

      value: { getUserMedia },
    });

    if (!host.querySelector(".camera-button")) await click(".wordmark");
    await click(".camera-button");

    expect(getUserMedia).toHaveBeenCalledOnce();

    await click('[aria-label="Close camera"]');

    expect(stop).toHaveBeenCalled();

    getUserMedia.mockRejectedValueOnce(new Error("Permission denied"));

    if (!host.querySelector(".camera-button")) await click(".wordmark");
    await click(".camera-button");

    expect(host.textContent).toContain("permission was declined");

    await click('[aria-label="Close camera"]');
  });
});

describe("photo-first navigation and sessions", () => {
  it("starts without editing controls, and guards direct Edit and Finish routes", async () => {
    expect(host.textContent).toContain("Create a Polaroid");
    expect(host.querySelector(".editor-controls")).toBeNull();
    expect(host.querySelectorAll(".example-card")).toHaveLength(3);
    for (const path of ["/edit", "/finish"]) {
      await act(async () => {
        window.history.pushState(null, "", path);
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      await flush();
      expect(window.location.pathname).toBe("/");
      expect(host.textContent).toContain("Choose a photo or example to start");
    }
  });

  it.each(examples)(
    "opens $title with precisely the thumbnail composition and a reversible edit",
    async (example) => {
      await click(`[aria-label="Try ${example.title} example"]`);
      expect(window.location.pathname).toBe("/edit");
      expect(comp()).toEqual(example.composition);
      await menuAction("Copy");
      await menuAction("Paste");
      expect(comp().layers.length).toBe(example.composition.layers.length + 1);
      await button("Undo");
      expect(comp()).toEqual(example.composition);
    },
  );

  it("preserves selection, caption drafts, composition and history through screens and browser Back/Forward", async () => {
    await startClassic();
    await button("Decorate");
    await button("Add tape");
    const selected = mocks.current!.selected;
    const next = { ...comp(), caption: "Coast, 2026" };
    await act(async () => mocks.current!.onChange(next, false));
    await button("Look"); // Category changes finish a pending edit.
    await button("Continue");
    expect(window.location.pathname).toBe("/finish");
    expect(host.querySelector(".editor-controls")).toBeNull();
    await act(async () => window.history.back());
    await new Promise((resolve) => setTimeout(resolve, 25));
    await flush();
    expect(window.location.pathname).toBe("/edit");
    expect(comp()).toEqual(next);
    expect(mocks.current!.selected).toBe(selected);
    await button("Undo");
    expect(comp().caption).toBe("");
    await button("Redo");
    expect(comp().caption).toBe("Coast, 2026");
    await act(async () => window.history.forward());
    await new Promise((resolve) => setTimeout(resolve, 25));
    await flush();
    expect(window.location.pathname).toBe("/finish");
    await click('a[href="/edit"]');
    expect(comp()).toEqual(next);
  });

  it("confirms replacement, preserves work on failure, then releases old assets after success", async () => {
    mocks.importAsset.mockResolvedValueOnce(fixture("first.jpg"));
    await chooseFiles(["first.jpg"]);
    expect(comp().caption).toBe("");
    await button("Decorate");
    await button("Add tape");
    const before = structuredClone(comp());
    await click(".wordmark");
    expect(host.textContent).toContain("Resume editing");
    await click('[aria-label="Try 3×3 grid example"]');
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () =>
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    await flush();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    mocks.importAsset.mockRejectedValueOnce(new Error("Cannot decode"));
    await chooseFiles(["bad.heic"]);
    await button("Start new Polaroid");
    expect(window.location.pathname).toBe("/");
    expect(host.textContent).toContain("Cannot decode");
    await click('a[href="/edit"]');
    expect(comp()).toEqual(before);
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:first.jpg");
    await click(".wordmark");
    mocks.importAsset.mockResolvedValueOnce(fixture("next.png"));
    await chooseFiles(["next.png"]);
    await button("Start new Polaroid");
    expect(comp().layers).toHaveLength(1);
    expect(comp().caption).toBe("");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:first.jpg");
    expect(
      host.querySelector<HTMLButtonElement>('[aria-label="Undo"]')!.disabled,
    ).toBe(true);
  });

  it("ignores stale new-session imports and keeps the most recent choice", async () => {
    let complete!: (asset: Asset) => void;
    mocks.importAsset.mockImplementationOnce(
      () =>
        new Promise<Asset>((resolve) => {
          complete = resolve;
        }),
    );
    mocks.importAsset.mockResolvedValueOnce(fixture("new.png"));
    await chooseFiles(["slow.heic"]);
    await chooseFiles(["new.png"]);
    await act(async () => complete(fixture("slow.heic")));
    await flush();
    expect(Object.values(mocks.current!.assets).map((a) => a.name)).toEqual([
      "new.png",
    ]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:slow.heic");
  });

  it("releases repeat grouping on category changes and removes editor shortcuts", async () => {
    await startClassic();
    await button("Repeat");
    await button("Repeat 3 × 3");
    expect(host.querySelector('[aria-label="Grid width"]')).not.toBeNull();
    await button("Decorate");
    await button("Arrange");
    expect(host.querySelector('[aria-label="Grid width"]')).toBeNull();
    const before = structuredClone(comp());
    for (const key of [
      "v",
      "c",
      "x",
      "d",
      "t",
      "p",
      "e",
      "Delete",
      "Backspace",
      "ArrowRight",
      "Escape",
    ]) {
      await act(async () =>
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key, bubbles: true }),
        ),
      );
    }
    await act(async () =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "z",
          ctrlKey: true,
          bubbles: true,
        }),
      ),
    );
    expect(comp()).toEqual(before);
    expect(host.querySelector("kbd")).toBeNull();
    expect(
      host
        .querySelector<HTMLButtonElement>('[title="Move"]')!
        .getAttribute("aria-pressed"),
    ).toBe("true");
    await button("Undo");
    expect(comp().layers).toHaveLength(1);
  });

  it("enters Edit after the camera countdown and stops the capture stream", async () => {
    const stop = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi
          .fn()
          .mockResolvedValue({ getTracks: () => [{ stop }] }),
      },
    });
    mocks.importAsset.mockResolvedValueOnce(fixture("camera-photo.png"));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: () => {},
      translate: () => {},
      scale: () => {},
    } as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback) => callback(new Blob(["photo"], { type: "image/png" })),
    );
    await button("Use camera");
    await act(async () =>
      host
        .querySelector("video")!
        .dispatchEvent(new Event("loadeddata", { bubbles: true })),
    );
    vi.useFakeTimers();
    try {
      const capture = [...host.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "Capture",
      )!;
      await act(async () => capture.click());
      expect(host.textContent).toContain("3");
      await act(async () => vi.advanceTimersByTimeAsync(3000));
      expect(window.location.pathname).toBe("/edit");
      expect(comp().layers[0].name).toBe("camera-photo.png");
      expect(comp().caption).toBe("");
      expect(stop).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
