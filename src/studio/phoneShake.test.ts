import { expect, it } from "vitest";
import { createPhoneShakeDetector } from "./phoneShake";
const vector=(x:number)=>({x,y:0,z:0});
it("rejects small movement, a single bump, same-direction jolts and a quick rebound",()=>{
  for(const values of [[1,-2,3,-2,1,2],[28],[28,-28],[28,28,28,28,28]]){
    const detector=createPhoneShakeDetector();expect(values.some((x,i)=>detector.sample(vector(x),null,100+i*220))).toBe(false);
  }
});
it("needs five strong alternating peaks spanning at least 800ms",()=>{
  const detector=createPhoneShakeDetector();for(let i=0;i<4;i++)expect(detector.sample(vector(i%2?-25:25),null,100+i*220)).toBe(false);
  expect(detector.sample(vector(25),null,980)).toBe(true);
});
it("does not accumulate isolated shakes across a pause",()=>{
  const detector=createPhoneShakeDetector();[25,-25,25].forEach((x,i)=>detector.sample(vector(x),null,100+i*220));
  expect(detector.sample(vector(-25),null,1500)).toBe(false);expect(detector.sample(vector(25),null,1720)).toBe(false);
});
it("requires sustained movement, not a rapid burst of sensor spikes",()=>{
  const detector=createPhoneShakeDetector();expect([25,-25,25,-25,25].some((x,i)=>detector.sample(vector(x),null,100+i*30))).toBe(false);
});
it("removes gravity from fallback readings and ignores slow tilting",()=>{
  const detector=createPhoneShakeDetector();for(let i=0;i<100;i++){const angle=i*.03;expect(detector.sample(null,{x:9.8*Math.sin(angle),y:0,z:9.8*Math.cos(angle)},i*20)).toBe(false);}
  detector.reset();detector.sample(null,{x:0,y:0,z:9.8},0);
  const results=[35,-35,35,-35,35].map((x,i)=>detector.sample(null,{x,y:0,z:9.8},100+i*220));expect(results).toEqual([false,false,false,false,true]);
});
it("reset discards progress and invalid readings do not reveal",()=>{
  const detector=createPhoneShakeDetector();[25,-25,25].forEach((x,i)=>detector.sample(vector(x),null,100+i*220));detector.reset();
  expect(detector.sample(vector(-25),null,800)).toBe(false);expect(detector.sample({x:null,y:0,z:0},null,1000)).toBe(false);expect(detector.sample(vector(NaN),null,1200)).toBe(false);
});
