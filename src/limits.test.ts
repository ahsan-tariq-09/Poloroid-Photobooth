import {describe, expect, it} from "vitest";
import {assertComposition, assertRenderSize} from "./limits";
import {initialComposition, addText} from "./model";
import {fonts, fontFamily} from "./fonts";

describe("composition and font boundaries", () => {
  it("rejects nonfinite, oversized, and excessively spread artwork before allocation", () => {
    for (const values of [{width: Infinity}, {x: NaN}, {height: 100000}, {x: 1601}]) {
      const c = initialComposition(); Object.assign(c.layers[0], values);
      expect(() => assertComposition(c)).toThrow();
    }
    expect(() => assertRenderSize({x:0,y:0,width:2000,height:2000},3)).toThrow(/too large/);
    expect(() => assertComposition(initialComposition())).not.toThrow();
    expect(() => assertComposition(addText(initialComposition()))).not.toThrow();
  });
  it("offers exactly 30 distinct font choices including the library ransom-note face", () => {
    expect(fonts).toHaveLength(30);
    expect(new Set(fonts.map(f => f.id)).size).toBe(30);
    expect(fontFamily("ransom-note")).toContain("LindberghBabyRegular");
    expect(fontFamily("untrusted font; url(x)")).toBe(fontFamily("studio"));
  });
});
