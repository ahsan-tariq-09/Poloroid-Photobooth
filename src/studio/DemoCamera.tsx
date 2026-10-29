import { useEffect, useRef, useState } from "react";
import InstantCamera from "./InstantCamera";
import { playSound, preloadSounds } from "../sounds";
import CameraSettings, { CameraReadout, type CameraISO, type TimerSeconds, type FilmPreset, type CameraPreferences } from "./CameraSettings";
import { applyCameraFilm } from "./cameraFilm";

/** Interactive controls around a display photograph; captures use the real camera. */
export default function DemoCamera({ busy, onCamera }: { busy:boolean; onCamera:(settings:CameraPreferences)=>void }) {
  const [seconds,setSeconds]=useState<TimerSeconds>(3),[preset,setPreset]=useState<FilmPreset>("Classic"),[flash,setFlash]=useState(false);
  const [iso,setISO]=useState<CameraISO>(800);
  const [loaded,setLoaded]=useState(false),[sourceReady,setSourceReady]=useState(false);
  const [starting,setStarting]=useState(false),pending=useRef(false),alive=useRef(true);
  const source=useRef<HTMLImageElement>(null),preview=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{alive.current=true;void preloadSounds();return()=>{alive.current=false;};},[]);
  useEffect(()=>{
    const image=source.current,canvas=preview.current;
    if(!sourceReady||!image?.naturalWidth||!canvas)return;
    const ctx=canvas.getContext("2d");if(!ctx)return;
    try{
      canvas.width=canvas.height=Math.min(640,image.naturalWidth,image.naturalHeight);
      const size=Math.min(image.naturalWidth,image.naturalHeight);
      ctx.fillStyle="#000";ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.globalAlpha=.93;
      ctx.drawImage(image,(image.naturalWidth-size)/2,(image.naturalHeight-size)/2,size,size,0,0,canvas.width,canvas.height);
      ctx.globalAlpha=1;
      ctx.putImageData(applyCameraFilm(ctx.getImageData(0,0,canvas.width,canvas.height),preset,flash,iso),0,0);
      canvas.style.visibility="visible";
    }catch{canvas.style.visibility="hidden";}
  },[sourceReady,preset,flash,iso]);
  const openCamera=async()=>{
    if(pending.current)return;pending.current=true;setStarting(true);
    await playSound("load");pending.current=false;
    if(!alive.current)return;
    setStarting(false);setLoaded(true);onCamera({seconds,preset,flash,iso,loadStartedAt:performance.now()});
  };
  return <div className="camera-demo">
    <p className="demo-instruction roll-instruction">Choose your settings, then roll the film to take a photo.</p>
    <InstantCamera onRoll={openCamera} rollDisabled={busy||starting} loaded={loaded} loading={starting}
      onShutter={openCamera} disabled={busy||starting} label="Take a photo with this camera"
      settings={<CameraSettings seconds={seconds} onSeconds={setSeconds} preset={preset} onPreset={setPreset} flash={flash} onFlash={setFlash} iso={iso} onISO={setISO} disabled={busy}/>}
      status="DISPLAY PHOTO · ROLL TO START">
      <img ref={source} src="/sample-flash.webp" onLoad={()=>setSourceReady(true)} alt="AI-generated vintage party display photo"/>
      <canvas ref={preview} className="demo-film-preview" aria-hidden="true" style={{visibility:"hidden"}}/>
      <CameraReadout seconds={seconds} preset={preset} iso={iso}/>
    </InstantCamera>
    <p className="camera-effect-note">ISO simulates exposure and grain. Film changes appear in your photo.</p>
  </div>;
}
