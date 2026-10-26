// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import InstantPrint from "./InstantPrint";
vi.mock("../sounds",()=>({playSound:vi.fn()}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
async function setup(){const host=document.createElement("div"),root=createRoot(host),reveal=vi.fn();document.body.append(host);await act(async()=>root.render(<InstantPrint photos={[{src:"photo.png",alt:"Captured moment"}]} caption="Today" enabled={false} onReveal={reveal}/>));return {host,reveal,close:async()=>{await act(async()=>root.unmount());host.remove();}};}
it.each(["denied","unavailable","rejected"])("keeps the tap fallback when motion is %s",async kind=>{
  const permission=kind==="rejected"?vi.fn().mockRejectedValue(new Error("blocked")):vi.fn().mockResolvedValue("denied");
  vi.stubGlobal("isSecureContext",true);vi.stubGlobal("DeviceMotionEvent",kind==="unavailable"?undefined:{requestPermission:permission});
  const s=await setup();try{
    expect(s.host.querySelector(".phone-shake")).toBeNull();expect(permission).not.toHaveBeenCalled();expect(s.host.querySelector("img")).toBeNull();
    await act(async()=>s.host.querySelector<HTMLButtonElement>('[aria-label="Shake to reveal"]')!.click());expect(s.reveal).toHaveBeenCalledOnce();expect(s.host.querySelector("img")).not.toBeNull();
    if(kind!=="unavailable")expect(permission).toHaveBeenCalledOnce();
  }finally{await s.close();}
});
it.each([false,true])("starts listening automatically, rejects tiny movement, and reveals on firm shaking (permission API: %s)",async permissionApi=>{
  const permission=vi.fn().mockResolvedValue("granted");vi.stubGlobal("isSecureContext",true);vi.stubGlobal("DeviceMotionEvent",permissionApi?{requestPermission:permission}:{});const remove=vi.spyOn(window,"removeEventListener");
  const s=await setup();const send=async(x:number,time:number)=>{const e=new Event("devicemotion");Object.defineProperties(e,{acceleration:{value:{x,y:0,z:0}},accelerationIncludingGravity:{value:{x,y:0,z:9.8}},timeStamp:{value:time}});await act(async()=>window.dispatchEvent(e));};
  try{expect(permission).not.toHaveBeenCalled();expect(s.host.querySelector(".phone-shake")).toBeNull();
    await send(0,100);await send(1,250);expect(s.reveal).not.toHaveBeenCalled();
    for(let i=0;i<4;i++){await send(i%2?-25:25,400+i*220);expect(s.reveal).not.toHaveBeenCalled();}
    await send(25,1280);expect(s.reveal).toHaveBeenCalledOnce();expect(remove).toHaveBeenCalledWith("devicemotion",expect.any(Function));expect(permission).not.toHaveBeenCalled();
  }finally{await s.close();}
});
it("discards shake progress when hidden and removes listeners on unmount",async()=>{
  vi.stubGlobal("isSecureContext",true);vi.stubGlobal("DeviceMotionEvent",{});const remove=vi.spyOn(window,"removeEventListener"),hidden=vi.spyOn(document,"hidden","get").mockReturnValue(false),s=await setup();
  const send=async(x:number,time:number)=>{const e=new Event("devicemotion");Object.defineProperties(e,{acceleration:{value:{x,y:0,z:0}},timeStamp:{value:time}});await act(async()=>window.dispatchEvent(e));};
  try{await send(25,100);await send(-25,320);await send(25,540);hidden.mockReturnValue(true);await act(async()=>document.dispatchEvent(new Event("visibilitychange")));await send(-25,760);hidden.mockReturnValue(false);await act(async()=>document.dispatchEvent(new Event("visibilitychange")));await send(25,980);await send(-25,1200);expect(s.reveal).not.toHaveBeenCalled();}finally{await s.close();}
  expect(remove).toHaveBeenCalledWith("devicemotion",expect.any(Function));
});
it("reveals after a deliberate side-to-side pointer gesture",async()=>{
  const s=await setup();const drag=s.host.querySelector(".print-drag")!;
  const send=async(type:string,x:number)=>{const e=new MouseEvent(type,{bubbles:true,clientX:x,button:0});Object.defineProperty(e,"pointerId",{value:1});await act(async()=>drag.dispatchEvent(e));};
  try{await send("pointerdown",100);await send("pointermove",150);await send("pointermove",90);expect(s.reveal).not.toHaveBeenCalled();await send("pointermove",150);expect(s.reveal).toHaveBeenCalledOnce();}finally{await s.close();}
});
