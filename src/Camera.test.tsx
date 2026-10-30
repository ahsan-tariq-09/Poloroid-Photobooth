// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
import Camera from "./Camera";
import * as sounds from "./sounds";
vi.mock("./studio/CameraPreview",()=>({default:()=>null}));

beforeEach(()=>{
  vi.spyOn(HTMLMediaElement.prototype,"play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype,"paused","get").mockReturnValue(false);
  vi.spyOn(HTMLMediaElement.prototype,"readyState","get").mockReturnValue(2);
  Object.defineProperty(HTMLVideoElement.prototype,"videoWidth",{configurable:true,value:640});
  Object.defineProperty(HTMLVideoElement.prototype,"videoHeight",{configurable:true,value:480});
});

it.each([true,false])("keeps sound through Strict Mode replay and stops it on unmount (camera API available: %s)",async available=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:available?{getUserMedia:vi.fn(async()=>({getTracks:()=>[{stop:vi.fn()}]}))}:undefined});
  const stopSounds=vi.spyOn(sounds,"stopSounds");
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  try{
    await act(async()=>root.render(<StrictMode><Camera initialSettings={{seconds:0,preset:"Classic",flash:false,iso:800,loadStartedAt:performance.now()}} enabled={false} onClose={()=>{}} onUpload={()=>{}} onCapture={()=>{}}/></StrictMode>));
    if(available)expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
    expect(stopSounds).not.toHaveBeenCalled();
    await act(async()=>root.unmount());
    expect(stopSounds).toHaveBeenCalledTimes(1);
  }finally{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();}
});

it("offers a gesture retry when inline camera playback is blocked",async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const stop=vi.fn(),media={getTracks:()=>[{stop}]},getUserMedia=vi.fn().mockResolvedValue(media);
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia}});
  const play=vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException("Blocked","NotAllowedError"));
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  try{
    await act(async()=>root.render(<Camera initialSettings={{seconds:0,preset:"Classic",flash:false,iso:800}} enabled={false} onClose={()=>{}} onUpload={()=>{}} onCapture={()=>{}}/>));
    expect(host.textContent).toContain("Tap Retry camera");
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Capture"]')!.disabled).toBe(true);
    const source=host.querySelector("video")!;
    expect(source.muted).toBe(true);expect(source.playsInline).toBe(true);
    await act(async()=>[...host.querySelectorAll("button")].find(button=>button.textContent==="Retry camera")!.click());
    expect(play).toHaveBeenCalledTimes(2);expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Capture"]')!.disabled).toBe(false);
    await act(async()=>root.unmount());
    expect(stop).toHaveBeenCalled();expect(source.srcObject).toBeNull();
  }finally{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();}
});

it("does not arm the shutter until video is playing with a decoded frame",async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop:vi.fn()}]})}});
  const paused=vi.spyOn(HTMLMediaElement.prototype,"paused","get").mockReturnValue(true);
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  try{
    await act(async()=>root.render(<Camera initialSettings={{seconds:0,preset:"Classic",flash:false,iso:800}} enabled={false} onClose={()=>{}} onUpload={()=>{}} onCapture={()=>{}}/>));
    const source=host.querySelector("video")!,shutter=host.querySelector<HTMLButtonElement>('[aria-label="Capture"]')!;
    await act(async()=>source.dispatchEvent(new Event("loadeddata")));
    expect(shutter.disabled).toBe(true);
    paused.mockReturnValue(false);Object.defineProperty(source,"videoWidth",{configurable:true,value:0});
    await act(async()=>source.dispatchEvent(new Event("playing")));expect(shutter.disabled).toBe(true);
    Object.defineProperty(source,"videoWidth",{configurable:true,value:640});
    await act(async()=>source.dispatchEvent(new Event("playing")));expect(shutter.disabled).toBe(false);
  }finally{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();}
});

it("replaces the connecting status when camera permission is denied",async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockRejectedValue(new DOMException("Denied","NotAllowedError"))}});
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  try{
    await act(async()=>root.render(<Camera enabled={false} onClose={()=>{}} onUpload={()=>{}} onCapture={()=>{}}/>));
    expect(host.querySelector('.viewfinder-status')!.textContent).toBe("CAMERA UNAVAILABLE");
    expect(host.querySelector('[role="status"]')!.textContent).toContain("permission was declined");
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Capture"]')!.disabled).toBe(true);
    expect([...host.querySelectorAll('button')].find(b=>b.textContent?.includes("Upload a photo instead"))!.disabled).toBe(false);
  }finally{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();}
});

it("requests camera access again after a permission failure",async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const getUserMedia=vi.fn().mockRejectedValueOnce(new DOMException("Denied","NotAllowedError")).mockResolvedValue({getTracks:()=>[{stop:vi.fn()}]});
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia}});
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  try{
    await act(async()=>root.render(<Camera enabled={false} onClose={()=>{}} onUpload={()=>{}} onCapture={()=>{}}/>));
    await act(async()=>[...host.querySelectorAll("button")].find(button=>button.textContent==="Retry camera")!.click());
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(host.querySelector('.viewfinder-status')!.textContent).toBe("ROLL TO LOAD FILM");
  }finally{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();}
});

it("ignores an old playback failure after switching cameras and releases both streams",async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const oldStop=vi.fn(),newStop=vi.fn(),oldStream={getTracks:()=>[{stop:oldStop}]},newStream={getTracks:()=>[{stop:newStop}]};
  const getUserMedia=vi.fn().mockResolvedValueOnce(oldStream).mockResolvedValueOnce(newStream);
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia}});
  let rejectOld!:(error:Error)=>void;
  vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(()=>new Promise((_,reject)=>{rejectOld=reject;}));
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  try{
    await act(async()=>root.render(<Camera enabled={false} onClose={()=>{}} onUpload={()=>{}} onCapture={()=>{}}/>));
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Flip camera"]')!.click());
    expect(oldStop).toHaveBeenCalled();
    await act(async()=>rejectOld(new DOMException("Interrupted","AbortError")));
    expect(host.querySelector('.viewfinder-status')!.textContent).toBe("ROLL TO LOAD FILM");
    const source=host.querySelector("video")!;expect(source.srcObject).toBe(newStream);
    await act(async()=>root.unmount());expect(newStop).toHaveBeenCalled();expect(source.srcObject).toBeNull();
  }finally{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();}
});

it("starts with the settings and loaded film chosen on the home camera",async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop:vi.fn()}]})}});
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  try{
    await act(async()=>root.render(<Camera initialSettings={{seconds:5,preset:"B&W",flash:true,iso:1600}} enabled={false} onClose={()=>{}} onUpload={()=>{}} onCapture={()=>{}}/>));
    await act(async()=>host.querySelector('video')!.dispatchEvent(new Event('loadeddata',{bubbles:true})));
    expect(host.querySelector('[aria-label="Timer 5 seconds"]')!.getAttribute('aria-pressed')).toBe('true');
    expect([...host.querySelectorAll('button')].find(b=>b.textContent==='B&W')!.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('[aria-label="Flash effect"]')!.getAttribute('aria-checked')).toBe('true');
    expect(host.querySelector('[aria-label="ISO effect"]')!.getAttribute('aria-valuenow')).toBe('1600');
    expect(host.querySelector('.viewfinder-readout')!.textContent).toContain('1600');
    expect(host.querySelector('[aria-label="Roll film"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Capture"]')!.disabled).toBe(false);
  }finally{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();}
});

it("keeps the shutter and film roll disabled for the full 2.8-second load",async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop:vi.fn()}]})}});
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  vi.useFakeTimers();
  try{
    await act(async()=>root.render(<Camera enabled={false} onClose={()=>{}} onUpload={()=>{}} onCapture={()=>{}}/>));
    const shutter=host.querySelector<HTMLButtonElement>('[aria-label="Capture"]')!,roll=host.querySelector<HTMLButtonElement>('[aria-label="Roll film"]')!;
    await act(async()=>roll.click());
    expect(host.querySelector('.viewfinder-status')!.textContent).toBe("LOADING FILM");
    expect(roll.disabled).toBe(true);expect(shutter.disabled).toBe(true);
    await act(async()=>vi.advanceTimersByTimeAsync(2799));
    expect(shutter.disabled).toBe(true);expect(roll.getAttribute('aria-pressed')).toBe('false');
    await act(async()=>vi.advanceTimersByTimeAsync(1));
    expect(shutter.disabled).toBe(false);expect(roll.disabled).toBe(false);expect(roll.getAttribute('aria-pressed')).toBe('true');
  }finally{await act(async()=>root.unmount());vi.useRealTimers();host.remove();vi.restoreAllMocks();}
});

it.each([[8000,800],[3000,0]])("finishes a home-camera load started at %s after only %s remaining milliseconds",async(loadStartedAt,remaining)=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop:vi.fn()}]})}});
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  vi.useFakeTimers();vi.spyOn(performance,"now").mockReturnValue(10000);
  try{
    await act(async()=>root.render(<Camera initialSettings={{seconds:0,preset:"Classic",flash:false,iso:800,loadStartedAt}} enabled={false} onClose={()=>{}} onUpload={()=>{}} onCapture={()=>{}}/>));
    const shutter=host.querySelector<HTMLButtonElement>('[aria-label="Capture"]')!;
    if(remaining){await act(async()=>vi.advanceTimersByTimeAsync(remaining-1));expect(shutter.disabled).toBe(true);}
    await act(async()=>vi.advanceTimersByTimeAsync(remaining?1:0));
    expect(shutter.disabled).toBe(false);
    expect(host.querySelector('.viewfinder-status')!.textContent).toBe("READY");
  }finally{await act(async()=>root.unmount());vi.restoreAllMocks();vi.useRealTimers();host.remove();}
});

it.each([[640,480,80,0],[480,640,0,80]])("crops %s×%s video without stretching, captures one Polaroid and opens Finish", async (width,height,sourceX,sourceY) => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const stop=vi.fn(), capture=vi.fn(), host=document.createElement("div"), root=createRoot(host);
  document.body.append(host);
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop}]})}});
  Object.defineProperty(HTMLVideoElement.prototype,"videoWidth",{configurable:true,value:width});
  Object.defineProperty(HTMLVideoElement.prototype,"videoHeight",{configurable:true,value:height});
  const draw=vi.fn(),translate=vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({drawImage:draw,translate,scale:vi.fn(),getImageData:vi.fn(()=>({data:new Uint8ClampedArray([80,100,120,255]),width:1,height:1})),putImageData:vi.fn()} as never);
  const toBlob=vi.spyOn(HTMLCanvasElement.prototype,"toBlob").mockImplementation(cb=>cb(new Blob(["frame"],{type:"image/png"})));
  URL.createObjectURL=vi.fn(()=>`blob:${crypto.randomUUID()}`); URL.revokeObjectURL=vi.fn();
  try {
    await act(async()=>root.render(<Camera enabled={false} onClose={()=>{}} onUpload={()=>{}} onCapture={capture}/>));
    await act(async()=>host.querySelector("video")!.dispatchEvent(new Event("loadeddata",{bubbles:true})));
    expect([...host.querySelectorAll("button")].some(b=>b.textContent==="4-shot strip")).toBe(false);
    vi.useFakeTimers();await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Roll film"]')!.click());
    await act(async()=>vi.advanceTimersByTimeAsync(2800));
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Capture"]')!.click());
    await act(async()=>vi.advanceTimersByTimeAsync(12000+3*2490));
    expect(toBlob).toHaveBeenCalledTimes(1); expect(stop).toHaveBeenCalled();
    // Both orientations crop a square source, rather than distorting the full frame.
    expect(draw).toHaveBeenCalledWith(host.querySelector("video"),sourceX,sourceY,480,480,0,0,480,480);
    expect(translate).toHaveBeenCalledWith(480,0);
    expect(host.querySelectorAll('img[alt="Your captured photo"]')).toHaveLength(0);
    expect(host.querySelector(".capture-decisions")).toBeNull();
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Shake to reveal"]')!.click());
    expect(host.querySelectorAll('img[alt="Your captured photo"]')).toHaveLength(1);
    expect(capture).not.toHaveBeenCalled();
    await act(async()=>[...host.querySelectorAll("button")].find(b=>b.textContent?.trim()==="Done")!.click());
    expect(capture.mock.calls[0][0].map((f:File)=>f.name)).toEqual(["camera-photo-1.png"]);
    expect(capture.mock.calls[0][1]).toBe("finish");
    const retake=[...host.querySelectorAll("button")].find(b=>b.textContent==="Retake photo")!;
    retake.focus();
    await act(async()=>retake.click());
    expect(document.activeElement).toBe(host.querySelector('[role="dialog"]'));
    expect(host.querySelectorAll('img[alt="Your captured photo"]')).toHaveLength(0);
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
  } finally { vi.useRealTimers(); await act(async()=>root.unmount());host.remove();vi.restoreAllMocks(); }
});

it.each(["dimensions", "blob"])("allows a new attempt after a %s capture failure", async failure => {
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop:vi.fn()}]})}});
  Object.defineProperty(HTMLVideoElement.prototype,"videoWidth",{configurable:true,value:640});
  Object.defineProperty(HTMLVideoElement.prototype,"videoHeight",{configurable:true,value:480});
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({drawImage:vi.fn(),translate:vi.fn(),scale:vi.fn(),getImageData:vi.fn(()=>({data:new Uint8ClampedArray([80,100,120,255]),width:1,height:1})),putImageData:vi.fn()} as never);
  vi.spyOn(HTMLCanvasElement.prototype,"toBlob").mockImplementation(cb=>cb(null));
  try {
    await act(async()=>root.render(<Camera enabled={false} onClose={()=>{}} onUpload={()=>{}} onCapture={()=>{}}/>));
    await act(async()=>host.querySelector("video")!.dispatchEvent(new Event("loadeddata",{bubbles:true})));
    vi.useFakeTimers();await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Roll film"]')!.click());
    await act(async()=>vi.advanceTimersByTimeAsync(2800));const shutter=host.querySelector<HTMLButtonElement>('[aria-label="Capture"]')!;
    if(failure==="dimensions")Object.defineProperty(HTMLVideoElement.prototype,"videoWidth",{configurable:true,value:0});
    await act(async()=>shutter.click());await act(async()=>vi.advanceTimersByTimeAsync(3000));
    expect(shutter.disabled).toBe(false);expect(host.textContent).toContain(failure==="dimensions"?"warming up":"could not be captured");
  } finally {vi.useRealTimers();await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();}
});

it.each([0,3,5,10])("uses the %s-second dial setting and captures only one Polaroid",async seconds=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop:vi.fn()}]})}});
  Object.defineProperty(HTMLVideoElement.prototype,"videoWidth",{configurable:true,value:640});Object.defineProperty(HTMLVideoElement.prototype,"videoHeight",{configurable:true,value:480});
  const write=vi.fn();vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({drawImage:vi.fn(),translate:vi.fn(),scale:vi.fn(),getImageData:()=>({data:new Uint8ClampedArray([80,100,120,255]),width:1,height:1}),putImageData:write} as never);
  const blob=vi.spyOn(HTMLCanvasElement.prototype,"toBlob").mockImplementation(cb=>cb(new Blob(["frame"])));URL.createObjectURL=vi.fn(()=>`blob:${crypto.randomUUID()}`);URL.revokeObjectURL=vi.fn();
  const button=(name:string)=>[...host.querySelectorAll<HTMLButtonElement>("button")].find(b=>b.getAttribute("aria-label")===name||b.textContent===name)!;
  try{
    await act(async()=>root.render(<Camera enabled={seconds===3} onClose={()=>{}} onUpload={()=>{}} onCapture={()=>{}}/>));await act(async()=>host.querySelector("video")!.dispatchEvent(new Event("loadeddata",{bubbles:true})));
    expect(button("Timer 3 seconds").getAttribute("aria-pressed")).toBe("true");expect(button("Capture").disabled).toBe(true);
    vi.useFakeTimers();await act(async()=>{button(seconds?`Timer ${seconds} seconds`:"Timer off").click();button("B&W").click();button("Flash effect").click();button("Roll film").click();});
    await act(async()=>vi.advanceTimersByTimeAsync(2800));await act(async()=>button("Capture").click());
    if(seconds===3)await act(async()=>root.render(<Camera enabled={false} onClose={()=>{}} onUpload={()=>{}} onCapture={()=>{}}/>));
    if(seconds){await act(async()=>vi.advanceTimersByTimeAsync(seconds*1000-1));expect(blob).not.toHaveBeenCalled();expect(button("Timer off").closest("fieldset")!.disabled).toBe(true);await act(async()=>vi.advanceTimersByTimeAsync(1));}
    expect(blob).toHaveBeenCalledTimes(1);
    await act(async()=>vi.advanceTimersByTimeAsync(2489));expect(blob).toHaveBeenCalledTimes(1);
    await act(async()=>vi.advanceTimersByTimeAsync(3*(seconds*1000+2490)-2489));expect(blob).toHaveBeenCalledTimes(1);expect(write).toHaveBeenCalledTimes(1);
    const pixels=write.mock.calls[0][0].data;expect(pixels[0]).toBe(pixels[1]);expect(pixels[1]).toBe(pixels[2]);expect(host.querySelector(".capture-flash")).toBeNull();expect(host.querySelector(".capture-decisions")).toBeNull();
    if(seconds===0||seconds===3){await act(async()=>root.render(<Camera enabled={true} onClose={()=>{}} onUpload={()=>{}} onCapture={()=>{}}/>));expect(host.querySelector(".capture-flash")).toBeNull();}
  }finally{vi.useRealTimers();await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();}
});

it("discards an unfinished capture after hiding, even when a new capture starts",async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  const stop=vi.fn();Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop}]})}});
  Object.defineProperty(HTMLVideoElement.prototype,"videoWidth",{configurable:true,value:640});Object.defineProperty(HTMLVideoElement.prototype,"videoHeight",{configurable:true,value:480});
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({drawImage:vi.fn(),translate:vi.fn(),scale:vi.fn(),getImageData:()=>({data:new Uint8ClampedArray([80,100,120,255]),width:1,height:1}),putImageData:vi.fn()} as never);
  const pending:BlobCallback[]=[];vi.spyOn(HTMLCanvasElement.prototype,"toBlob").mockImplementation(cb=>{pending.push(cb);});URL.createObjectURL=vi.fn(()=>"blob:new");URL.revokeObjectURL=vi.fn();const hidden=vi.spyOn(document,"hidden","get").mockReturnValue(false);
  const click=async(label:string)=>act(async()=>host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
  try{
    await act(async()=>root.render(<Camera enabled={false} onClose={()=>{}} onUpload={()=>{}} onCapture={()=>{}}/>));await act(async()=>host.querySelector("video")!.dispatchEvent(new Event("loadeddata",{bubbles:true})));
    vi.useFakeTimers();await click("Timer off");await click("Roll film");await act(async()=>vi.advanceTimersByTimeAsync(2800));await click("Capture");expect(pending).toHaveLength(1);
    hidden.mockReturnValue(true);await act(async()=>document.dispatchEvent(new Event("visibilitychange")));hidden.mockReturnValue(false);await act(async()=>document.dispatchEvent(new Event("visibilitychange")));
    await click("Capture");expect(pending).toHaveLength(2);await act(async()=>pending[0](new Blob(["old"])));expect(host.querySelector(".instant-print")).toBeNull();expect(stop).not.toHaveBeenCalled();
    await act(async()=>pending[1](new Blob(["new"])));expect(host.querySelector(".instant-print")).not.toBeNull();expect(stop).toHaveBeenCalled();
  }finally{await act(async()=>root.unmount());vi.useRealTimers();host.remove();vi.restoreAllMocks();}
});
