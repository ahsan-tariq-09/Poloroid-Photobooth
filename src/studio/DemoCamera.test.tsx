// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import DemoCamera from "./DemoCamera";
vi.mock("../sounds",()=>({playSound:vi.fn(),preloadSounds:vi.fn()}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});

it("keeps home controls working and opens the real camera with their settings",async()=>{
  const host=document.createElement("div"),root=createRoot(host),open=vi.fn();document.body.append(host);
  const button=(label:string)=>host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
  try{
    await act(async()=>root.render(<DemoCamera busy={false} onCamera={open}/>));
    await act(async()=>{button("Timer 5 seconds").click();[...host.querySelectorAll('button')].find(b=>b.textContent==='B&W')!.click();button("Flash effect").click();});
    expect(open).not.toHaveBeenCalled();
    const iso=host.querySelector<HTMLButtonElement>('[aria-label="ISO effect"]')!;
    expect(iso).not.toBeNull();
    expect(host.querySelector('select')).toBeNull();
    await act(async()=>iso.click());
    expect(iso.getAttribute('aria-valuenow')).toBe('1600');
    expect((host.querySelector('.iso-markings') as HTMLElement).style.transform).toBe('rotate(-240deg)');
    expect((host.querySelector('.timer-rotor') as HTMLElement).style.transform).toBe('rotate(-135deg)');
    await act(async()=>iso.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true})));
    expect(iso.getAttribute('aria-valuenow')).toBe('3200');
    await act(async()=>iso.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));
    expect(iso.getAttribute('aria-valuenow')).toBe('3200');
    await act(async()=>iso.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})));
    expect(iso.getAttribute('aria-valuenow')).toBe('1600');
    expect(host.querySelector('.viewfinder-readout')!.textContent).toContain('1600');
    expect(host.querySelector('.viewfinder-readout')!.textContent).toContain('B&W');
    expect(host.querySelector('.viewfinder-readout')!.textContent).toContain('5s');
    await act(async()=>button("Roll film").click());
    expect(open).toHaveBeenLastCalledWith({seconds:5,preset:"B&W",flash:true,iso:1600,loadStartedAt:expect.any(Number)});
    expect(host.querySelector('.instant-print')).toBeNull();
    expect(host.querySelector('img')!.alt).toContain('display photo');
    await act(async()=>button("Take a photo with this camera").click());
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenLastCalledWith({seconds:5,preset:"B&W",flash:true,iso:1600,loadStartedAt:expect.any(Number)});
  }finally{await act(async()=>root.unmount());host.remove();}
});

it("disables the home controls while photos are opening",async()=>{
  const host=document.createElement("div"),root=createRoot(host),open=vi.fn();document.body.append(host);
  try{
    await act(async()=>root.render(<DemoCamera busy={true} onCamera={open}/>));
    const buttons=[...host.querySelectorAll<HTMLButtonElement>('button')];
    expect(buttons.every(b=>b.disabled||b.closest('fieldset')?.disabled)).toBe(true);
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Roll film"]')!.click());
    expect(open).not.toHaveBeenCalled();
  }finally{await act(async()=>root.unmount());host.remove();}
});
