import { expect, it } from "vitest";
import { cpuEffects } from "./effects";
it("makes black-and-white pixels neutral while preserving transparent areas", () => {
  const out = cpuEffects(new Uint8ClampedArray([200,80,30,255,90,160,20,0]),2,1,{film:.3,copier:0,seed:76,grayscale:1});
  expect(out[0]).toBe(out[1]); expect(out[1]).toBe(out[2]);
  expect(out[3]).toBe(255); expect(out[7]).toBe(0);
});
