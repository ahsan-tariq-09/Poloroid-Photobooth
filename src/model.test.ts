import { describe, expect, it } from 'vitest';
import { bounds, duplicateLayer, hitTest, initialComposition, localPoint, splitLayer } from './model';
import { historyReducer } from './history';
import { cropGeometry } from './render';
import { cpuEffects } from './effects';

describe('collage geometry',()=>{
  it('cuts a photo without changing its total source coverage',()=>{
    const original=initialComposition();
    const split=splitLayer(original,original.layers[0].id,'vertical',.3);
    expect(split.layers).toHaveLength(2);
    expect(split.layers[0].source?.width).toBeCloseTo(138);
    expect(split.layers[1].source?.x).toBeCloseTo(138);
    expect(split.layers[1].source?.width).toBeCloseTo(322);
    expect(original.layers).toHaveLength(1);
    expect(split.layers[0].x+split.layers[0].width).toBeCloseTo(split.layers[1].x);
  });
  it('keeps rotated cut pieces on the original transform',()=>{
    const original=initialComposition();original.layers[0].rotation=37;
    const split=splitLayer(original,original.layers[0].id,'horizontal',.4);
    for(const part of split.layers){
      const local=localPoint(original.layers[0],part.x+part.width/2,part.y+part.height/2);
      const source=part.source!;
      expect(local.x).toBeCloseTo(source.x+source.width/2);
      expect(local.y).toBeCloseTo(source.y+source.height/2);
    }
  });
  it('includes rotated fragments beyond the Polaroid border in export bounds',()=>{
    const c=initialComposition();c.layers[0].x=-100;c.layers[0].rotation=45;
    const area=bounds(c);
    expect(area.x).toBeLessThan(-100);expect(area.y).toBeLessThan(35);
    expect(area.y+area.height).toBeGreaterThanOrEqual(675);
  });
  it('duplicates independently and selects the topmost layer',()=>{
    const c=initialComposition(),next=duplicateLayer(c,c.layers[0].id);
    expect(next.layers[1].id).not.toBe(next.layers[0].id);
    next.layers[1].source!.x=10;expect(c.layers[0].source!.x).toBe(0);
    expect(hitTest(next.layers,150,150)?.id).toBe(next.layers[1].id);
  });
  it('crops portrait and landscape sources to a centered square',()=>{
    expect(cropGeometry({width:800,height:1200},{zoom:1,x:0,y:0})).toEqual({x:0,y:200,width:800,height:800});
    expect(cropGeometry({width:1200,height:800},{zoom:2,x:0,y:0})).toEqual({x:400,y:200,width:400,height:400});
  });
});
describe('history',()=>{
  it('undoes one gesture, redoes it, and clears redo on a new edit',()=>{
    const c=initialComposition();let h={past:[],present:c,future:[]} as Parameters<typeof historyReducer>[0];
    h=historyReducer(h,{type:'commit',value:{...c,caption:'a little memory'}});
    h=historyReducer(h,{type:'undo'});expect(h.present.caption).toBe('');
    h=historyReducer(h,{type:'redo'});expect(h.present.caption).toBe('a little memory');
    h=historyReducer(h,{type:'undo'});h=historyReducer(h,{type:'commit',value:{...c,caption:'new'}});expect(h.future).toHaveLength(0);
  });
  it('does not record no-op actions and resets history on source replacement',()=>{
    const c=initialComposition(),h={past:[],present:c,future:[]};
    expect(historyReducer(h,{type:'commit',value:c})).toBe(h);
    expect(historyReducer({...h,past:[c]},{type:'reset',value:initialComposition()} ).past).toHaveLength(0);
  });
});
describe('fallback effects',()=>{
  it('preserves alpha and is deterministic for a grain seed',()=>{
    const pixels=new Uint8ClampedArray([150,120,90,255,0,0,0,0]);
    const settings={film:.7,copier:0,seed:76};
    const a=cpuEffects(pixels,2,1,settings),b=cpuEffects(pixels,2,1,settings);
    expect(a).toEqual(b);expect(a[3]).toBe(255);expect(a[7]).toBe(0);expect(a[0]).not.toBe(pixels[0]);
  });
  it('leaves an original photo unchanged when effects are off',()=>{
    const pixels=new Uint8ClampedArray([80,100,170,255]);
    expect(cpuEffects(pixels,1,1,{film:0,copier:0,seed:76})).toEqual(pixels);
  });
});
