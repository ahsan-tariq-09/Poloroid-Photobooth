// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import DemoCamera from "./DemoCamera";
vi.mock("../useStudioMotion", () => ({useStudioMotion: () => false}));
vi.mock("../sounds", () => ({playSound: vi.fn()}));

it("loads film, keeps the print blank until shaken, opens the editor and rolls a fresh demo", async () => {
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT:true});
  const host=document.createElement("div"), root=createRoot(host), develop=vi.fn();
  document.body.append(host);
  const button=(label:string)=>host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
  Object.defineProperty(HTMLImageElement.prototype,"naturalWidth",{configurable:true,value:640});
  Object.defineProperty(HTMLImageElement.prototype,"naturalHeight",{configurable:true,value:480});
  const draw=vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({drawImage:draw,getImageData:()=>({data:new Uint8ClampedArray([80,100,120,255]),width:1,height:1}),putImageData:vi.fn()} as never);
  vi.spyOn(HTMLCanvasElement.prototype,"toBlob").mockImplementation(cb=>cb(new Blob(["demo"])));
  URL.createObjectURL=vi.fn(()=>"blob:demo");URL.revokeObjectURL=vi.fn();
  try {
    await act(async()=>root.render(<DemoCamera busy={false} onDevelop={develop}/>));
    expect(button("Click demo shutter").disabled).toBe(true);
    await act(async()=>button("Roll film").click());
    expect(button("Click demo shutter").disabled).toBe(false);
    await act(async()=>button("Timer off").click());
    await act(async()=>button("Click demo shutter").click());
    expect(host.querySelector(".instant-print")).not.toBeNull();
    expect(draw).toHaveBeenCalledWith(expect.any(HTMLImageElement),80,0,480,480,0,0,480,480);
    expect(button("Click demo shutter").disabled).toBe(true);
    expect(host.querySelector('img[alt="Your demo instant photo"]')).toBeNull();
    expect(host.querySelector(".demo-develop")).toBeNull();
    await act(async()=>button("Shake to reveal").click());
    expect(host.querySelector('img[alt="Your demo instant photo"]')).not.toBeNull();
    await act(async()=>host.querySelector<HTMLButtonElement>(".demo-develop")!.click());
    expect(develop).toHaveBeenCalledOnce();
    await act(async()=>button("Roll film").click());
    expect(host.querySelector(".instant-print")).toBeNull();
    expect(button("Click demo shutter").disabled).toBe(false);
  } finally {await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();}
});
