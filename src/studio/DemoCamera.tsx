import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import InstantCamera from "./InstantCamera";
import { useStudioMotion } from "../useStudioMotion";
import { playSound } from "../sounds";
import InstantPrint from "./InstantPrint";
import CameraSettings, { type TimerSeconds, type FilmPreset } from "./CameraSettings";
import { applyCameraFilm } from "./cameraFilm";

/** The sample uses the same film processing and print reveal as real captures. */
export default function DemoCamera({ busy, onDevelop }: { busy: boolean; onDevelop: (file:File) => void }) {
  const [phase,setPhase]=useState<"empty"|"loaded"|"printed"|"revealed">("empty");
  const [seconds,setSeconds]=useState<TimerSeconds>(3),[preset,setPreset]=useState<FilmPreset>("Classic"),[flash,setFlash]=useState(false);
  const [count,setCount]=useState<number|null>(null),[processing,setProcessing]=useState(false),[error,setError]=useState("");
  const [photo,setPhoto]=useState<{src:string;file:File}|null>(null),[flashFrame,setFlashFrame]=useState(0);
  const source=useRef<HTMLImageElement>(null),alive=useRef(true),generation=useRef(0);
  const enabled=useStudioMotion(),printed=phase==="printed"||phase==="revealed",locked=busy||count!==null||processing;
  const roll=()=>{setPhase("loaded");setPhoto(null);setError("");playSound("paper");};
  useEffect(()=>{if(!enabled)setFlashFrame(0);},[enabled]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;generation.current++;};},[]);
  useEffect(()=>()=>{if(photo)URL.revokeObjectURL(photo.src);},[photo]);
  useEffect(()=>{
    if(count===null)return;
    if(count>0){playSound("tick");const timer=setTimeout(()=>setCount(count-1),1000);return()=>clearTimeout(timer);}
    setCount(null);setProcessing(true);
    const token=++generation.current;
    try{
      const image=source.current;
      if(!image?.naturalWidth)throw new Error("The demo photo is still loading. Try the shutter again.");
      const canvas=document.createElement("canvas");canvas.width=canvas.height=Math.min(image.naturalWidth,image.naturalHeight);
      const ctx=canvas.getContext("2d");if(!ctx)throw new Error("The demo could not develop. Try again.");
      ctx.drawImage(image,(image.naturalWidth-canvas.width)/2,(image.naturalHeight-canvas.height)/2,canvas.width,canvas.height,0,0,canvas.width,canvas.height);ctx.putImageData(applyCameraFilm(ctx.getImageData(0,0,canvas.width,canvas.height),preset,flash),0,0);
      playSound("shutter");if(flash&&enabled)setFlashFrame(n=>n+1);
      canvas.toBlob(blob=>{
        if(!alive.current||generation.current!==token)return;
        setProcessing(false);
        if(!blob){setError("The demo could not develop. Try again.");return;}
        setPhoto({src:URL.createObjectURL(blob),file:new File([blob],"demo-party.png",{type:"image/png"})});setPhase("printed");
      },"image/png");
    }catch(e){setProcessing(false);setError(e instanceof Error?e.message:"The demo could not develop. Try again.");}
  },[count,preset,flash]);
  useEffect(()=>{const hide=()=>{if(document.hidden){generation.current++;setCount(null);setProcessing(false);}};document.addEventListener("visibilitychange",hide);return()=>document.removeEventListener("visibilitychange",hide);},[]);
  return <div className="camera-demo">
    {!printed&&<p className={`demo-instruction ${phase==="empty"?"roll-instruction":""}`} role="status">{error|| (phase==="empty"?"Turn the Roll film knob, then click.":count!==null?"Hold still. Your photo is on its way.":"Film loaded. Click the red shutter.")}</p>}
    <InstantCamera onRoll={roll} rollDisabled={locked} loaded={phase==="loaded"}
      onShutter={()=>{setError("");setCount(seconds);}} disabled={locked||phase!=="loaded"} label="Click demo shutter"
      settings={<CameraSettings seconds={seconds} onSeconds={setSeconds} preset={preset} onPreset={setPreset} flash={flash} onFlash={setFlash} disabled={locked}/>}
      printed={printed} print={printed&&photo?<InstantPrint photos={[{src:photo.src,alt:"Your demo instant photo"}]} caption="A night to remember." enabled={enabled} onReveal={()=>setPhase("revealed")} onRetake={roll}/>:undefined}
      status={phase==="empty"?"DEMO · ROLL FILM FIRST":phase==="loaded"?"DEMO · READY TO CLICK":"DEMO · PRINT READY"}>
      <img ref={source} src="/sample-flash.webp" alt="AI-generated vintage party photo with soft flash and film grain"/>
      {count!==null&&count>0&&<span className="countdown" aria-live="assertive">{count}</span>}
    </InstantCamera>
    {enabled&&flashFrame>0&&<motion.div key={flashFrame} className="capture-flash" aria-hidden="true" initial={{opacity:.28}} animate={{opacity:0}} transition={{duration:.32}} onAnimationComplete={()=>setFlashFrame(0)}/>}
    {phase==="revealed"&&photo&&<button className="text-button demo-develop" disabled={busy} onClick={()=>onDevelop(photo.file)}>Make this photo yours →</button>}
  </div>;
}
