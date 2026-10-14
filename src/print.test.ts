// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { printComposition } from "./render";
import { FRAME, initialComposition, type Assets } from "./model";

afterEach(() => {
  vi.restoreAllMocks();
  document.querySelector(".print-sheet")?.remove();
});
it("waits for the artwork and prints an 88 by 107 mm frame, cleaning up after printing", async () => {
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: Promise.resolve() },
  });
  const context = new Proxy(
    {},
    {
      get: (_, key) =>
        key === "getImageData"
          ? () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })
          : () => {},
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as never,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    "data:image/png;base64,test",
  );
  let ready!: () => void;
  Object.defineProperty(HTMLImageElement.prototype, "decode", {
    configurable: true,
    value: () =>
      new Promise<void>((resolve) => {
        ready = resolve;
      }),
  });
  const print = vi
    .spyOn(window, "print")
    .mockImplementation(() => window.dispatchEvent(new Event("afterprint")));
  const assets: Assets = {
    sample: {
      name: "sample",
      url: "sample",
      width: 100,
      height: 100,
      image: new Image(),
    },
  };
  const pending = printComposition(assets, initialComposition());
  for (let i = 0; i < 8; i++) await Promise.resolve();
  expect(print).not.toHaveBeenCalled();
  const frame = document.querySelector<HTMLElement>(".print-polaroid")!;
  expect(frame.style.width).toBe("88mm");
  expect(frame.style.height).toBe("107mm");
  const img = frame.querySelector("img")!;
  expect(parseFloat(img.style.width)).toBeCloseTo(88);
  expect(FRAME.width / FRAME.height).toBeCloseTo(88 / 107);
  ready();
  await pending;
  expect(print).toHaveBeenCalledOnce();
  expect(document.querySelector(".print-sheet")).toBeNull();
});
