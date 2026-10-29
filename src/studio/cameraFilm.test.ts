import { expect, it } from "vitest";
import { applyCameraFilm } from "./cameraFilm";
const image=()=>({data:new Uint8ClampedArray([30,70,110,255,240,245,250,255]),width:2,height:1} as ImageData);
it("produces neutral B&W and preserves alpha and dimensions",()=>{const result=applyCameraFilm(image(),"B&W",false);expect(result.data[0]).toBe(result.data[1]);expect(result.data[1]).toBe(result.data[2]);expect(result.data[3]).toBe(255);expect(result.width).toBe(2);});
it("fills shadows more than highlights without blowing out the photo",()=>{const off=applyCameraFilm(image(),"Classic",false).data,on=applyCameraFilm(image(),"Classic",true).data;expect(on[0]-off[0]).toBeGreaterThan(on[4]-off[4]);expect(on[4]).toBeLessThan(255);});
it("adds stronger reproducible grain and a distinct faded stock",()=>{const grain=applyCameraFilm(image(),"Film Grain",false).data;expect(grain).not.toEqual(applyCameraFilm(image(),"Classic",false).data);expect(grain).toEqual(applyCameraFilm(image(),"Film Grain",false).data);expect(applyCameraFilm(image(),"Faded",false).data[0]).toBeGreaterThan(image().data[0]);});

it("uses ISO 800 as neutral and applies increasing linear-light exposure",()=>{
  const gray=()=>({data:new Uint8ClampedArray([128,128,128,117]),width:1,height:1} as ImageData);
  expect(applyCameraFilm(gray(),"B&W",false,800).data).toEqual(applyCameraFilm(gray(),"B&W",false).data);
  const low=applyCameraFilm(gray(),"B&W",false,400),high=applyCameraFilm(gray(),"B&W",false,1600);
  expect(low.data[0]).toBeLessThan(110);
  expect(high.data[0]).toBeGreaterThan(160);
  expect(high.data[0]).toBeLessThan(220);
  expect(high.data[0]).toBe(high.data[1]);
  expect(high.data[3]).toBe(117);
});
