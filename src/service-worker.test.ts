import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function worker(online = true) {
  const listeners: Record<string, (event: any) => void> = {};
  const cache = { addAll: vi.fn().mockResolvedValue(undefined), match: vi.fn().mockResolvedValue("cached-shell"), put: vi.fn() };
  const caches = { open: vi.fn().mockResolvedValue(cache), keys: vi.fn().mockResolvedValue(["poloroid-old", "poloroid-test", "other-app"]), delete: vi.fn() };
  const fetch = online ? vi.fn().mockResolvedValue({ ok: true, clone: () => "response" }) : vi.fn().mockRejectedValue(new Error("offline"));
  const self = { location: { origin: "https://studio.test" }, clients: { claim: vi.fn() }, addEventListener: (name: string, fn: any) => { listeners[name] = fn; } };
  const source = readFileSync(new URL("./service-worker.js", import.meta.url), "utf8").replace("__CACHE_NAME__", "poloroid-test").replace("__PRECACHE__", JSON.stringify(["/", "/assets/app.js"]));
  runInNewContext(source, { self, caches, fetch, URL });
  return { listeners, cache, caches, fetch, self };
}

describe("offline app shell", () => {
  it("precaches the build and only removes this app's obsolete caches", async () => {
    const w = worker(); let task: Promise<unknown>;
    w.listeners.install({ waitUntil: (p: Promise<unknown>) => { task = p; } }); await task!;
    expect(w.cache.addAll).toHaveBeenCalledWith(["/", "/assets/app.js"]);
    w.listeners.activate({ waitUntil: (p: Promise<unknown>) => { task = p; } }); await task!;
    expect(w.caches.delete.mock.calls).toEqual([["poloroid-old"]]);
    expect(w.self.clients.claim).toHaveBeenCalled();
  });
  it("opens the cached shell for a deep route when offline", async () => {
    const w = worker(false); let response: Promise<unknown>;
    w.listeners.fetch({ request: { url: "https://studio.test/scrapbook", method: "GET", mode: "navigate" }, respondWith: (p: Promise<unknown>) => { response = p; } });
    expect(await response!).toBe("cached-shell");
    expect(w.cache.match).toHaveBeenCalledWith("/", { ignoreVary: true });
  });
  it("serves a cached codec offline without making a network request", async () => {
    const w = worker(false); let response: Promise<unknown>;
    w.listeners.fetch({ request: { url: "https://studio.test/assets/codec.js", method: "GET" }, respondWith: (p: Promise<unknown>) => { response = p; } });
    expect(await response!).toBe("cached-shell"); expect(w.fetch).not.toHaveBeenCalled();
    expect(w.cache.match.mock.calls[0][1]).toEqual({ ignoreVary: true });
  });
  it("does not intercept remote requests or photo uploads", () => {
    const w = worker(), respondWith = vi.fn();
    w.listeners.fetch({ request: { url: "https://fonts.googleapis.com/example", method: "GET" }, respondWith });
    w.listeners.fetch({ request: { url: "https://studio.test/photo", method: "POST" }, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
  });
  it.each(["/sample-flash.webp", "/textures/leather.webp"])("serves the new camera asset %s offline", async path => {
    const w=worker(false); let response:Promise<unknown>;
    w.listeners.fetch({request:{url:`https://studio.test${path}`,method:"GET"},respondWith:(p:Promise<unknown>)=>{response=p;}});
    expect(await response!).toBe("cached-shell");
    expect(w.fetch).not.toHaveBeenCalled();
  });
});
