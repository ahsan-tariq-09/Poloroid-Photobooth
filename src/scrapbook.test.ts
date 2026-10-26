import { expect, it } from "vitest";
import { layoutStrip } from "./scrapbook";
it("lays out four distinct photos in a vertical booth strip without clipping any slot", () => {
  const result = layoutStrip(4);
  expect(result.width).toBe(360);
  expect(result.slots).toEqual([{x:24,y:24,width:312,height:312},{x:24,y:348,width:312,height:312},{x:24,y:672,width:312,height:312},{x:24,y:996,width:312,height:312}]);
  expect(result.height).toBe(1372);
});


it("arranges up to twelve keepsakes within the page and retains editable originals", async () => {
  const {arrangeMemories,placeMemory,newScrapbook}=await import("./scrapbook");
  const {initialComposition,FRAME}=await import("./model");
  for(const count of [1,2,4,6,12]) {
    const originals=Array.from({length:count},(_,i)=>placeMemory({id:String(i),image:"data:test",photo:{composition:initialComposition(),assets:{}}},i));
    const arranged=arrangeMemories(originals);
    expect(arranged.map(i=>i.id)).toEqual(originals.map(i=>i.id));
    for(const item of arranged) {
      expect(item.x).toBeGreaterThan(0);expect(item.x+item.width).toBeLessThan(1000);
      expect(item.y).toBeGreaterThan(0);expect(item.y+item.width*FRAME.height/FRAME.width).toBeLessThan(750);
      expect(item.photo).toBe(originals[Number(item.id)].photo);
    }
    expect(newScrapbook().items).toHaveLength(0);
  }
});
