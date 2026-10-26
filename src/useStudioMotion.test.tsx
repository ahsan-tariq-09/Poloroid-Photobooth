// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useStudioMotion } from "./useStudioMotion";

it("settles and restores motion when the preference or visibility changes during a session", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let reduced = false, hidden = false;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", () => ({matches: reduced, addEventListener: (_: string, fn: () => void) => listeners.add(fn), removeEventListener: (_: string, fn: () => void) => listeners.delete(fn)}));
  const priorHidden = Object.getOwnPropertyDescriptor(document, "hidden");
  Object.defineProperty(document, "hidden", {configurable: true, get: () => hidden});
  const host = document.createElement("div"), root = createRoot(host);
  function View() {return <span>{useStudioMotion() ? "active" : "paused"}</span>;}
  try {
    await act(async () => root.render(<View/>)); expect(host.textContent).toBe("active");
    await act(async () => {reduced = true; listeners.forEach(fn => fn());}); expect(host.textContent).toBe("paused");
    await act(async () => {hidden = true; document.dispatchEvent(new Event("visibilitychange")); reduced = false; listeners.forEach(fn => fn());}); expect(host.textContent).toBe("paused");
    await act(async () => {hidden = false; document.dispatchEvent(new Event("visibilitychange"));}); expect(host.textContent).toBe("active");
  } finally {
    await act(async () => root.unmount());
    expect(listeners.size).toBe(0);
    if (priorHidden) Object.defineProperty(document, "hidden", priorHidden); else delete (document as unknown as {hidden?: boolean}).hidden;
    vi.unstubAllGlobals();
  }
});
