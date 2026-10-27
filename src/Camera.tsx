import { useEffect, useRef, useState } from "react";
import { X, RefreshCw, Upload, ArrowRight, Check } from "lucide-react";
import { motion, useIsPresent } from "motion/react";
import InstantCamera from "./studio/InstantCamera";
import InstantPrint from "./studio/InstantPrint";
import CameraSettings, { type TimerSeconds, type FilmPreset } from "./studio/CameraSettings";
import { applyCameraFilm } from "./studio/cameraFilm";
import { playSound, unlockSound } from "./sounds";

export type CaptureDestination = "edit" | "finish" | "scrapbook";
export default function Camera({onClose, onCapture, onUpload, enabled}: {
  onClose: () => void; onCapture: (files: File[], destination: CaptureDestination) => void;
  onUpload: () => void; enabled: boolean;
}) {
  const present = useIsPresent(), video=useRef<HTMLVideoElement>(null), stream=useRef<MediaStream|null>(null);
  const container=useRef<HTMLDivElement>(null), alive=useRef(true), timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const captureRunning=useRef(false), generation=useRef(0), urls=useRef<string[]>([]);
  const [error,setError]=useState(""), [ready,setReady]=useState(false), [count,setCount]=useState<number|null>(null);
  const [facing,setFacing]=useState<"user"|"environment">("user"), [shots,setShots]=useState(1), [shot,setShot]=useState(0);
  const [prints,setPrints]=useState<{file:File;url:string}[]>([]), [revealed,setRevealed]=useState(false), [restart,setRestart]=useState(0);
  const [seconds,setSeconds]=useState<TimerSeconds>(3), [preset,setPreset]=useState<FilmPreset>("Classic"), [flash,setFlash]=useState(false), [flashFrame,setFlashFrame]=useState(0);
  const motionEnabled=useRef(enabled);motionEnabled.current=enabled;
  const captured=prints.length>0;
  useEffect(()=>{if(!enabled)setFlashFrame(0);},[enabled]);
  const [filmLoaded,setFilmLoaded]=useState(false);
  const roll=()=>{playSound("paper");setFilmLoaded(true);if(captured){container.current?.focus();urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current=[];setPrints([]);setRevealed(false);setRestart(n=>n+1);}};
  const stop=()=>{stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(timer.current)clearTimeout(timer.current);};
  useEffect(()=>{
    alive.current=present; setReady(false); setError(""); if (!present) return; let disposed=false; let owned:MediaStream|null=null;
    if(!navigator.mediaDevices?.getUserMedia){setError("Camera capture needs HTTPS or localhost. Upload a photo to keep creating."); return;}
    void navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing}},audio:false}).then(value=>{
      if(disposed || !alive.current){value.getTracks().forEach(t=>t.stop());return;}
      owned=value;stream.current=value;if(video.current)video.current.srcObject=value;
    }).catch(()=>{if(!disposed)setError("Your camera is unavailable or permission was declined. Upload a photo to keep creating.");});
    return ()=>{disposed=true;alive.current=false;generation.current++;captureRunning.current=false;owned?.getTracks().forEach(t=>t.stop());if(stream.current===owned)stream.current=null;if(timer.current)clearTimeout(timer.current);};
  },[facing,restart,present]);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;container.current?.focus();
    return ()=>{urls.current.forEach(url=>URL.revokeObjectURL(url));previous?.focus();};
  },[]);
  useEffect(()=>{if(!present){alive.current=false;stop();}},[present]);
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if(e.key==="Escape"){e.preventDefault();onClose();}
      if(e.key!=="Tab")return;
      const controls=container.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select,[tabindex="0"]');
      if(!controls?.length)return;const first=controls[0],last=controls[controls.length-1];
      if(e.shiftKey&&(document.activeElement===first||document.activeElement===container.current)){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===container.current)){e.preventDefault();first.focus();}
    };
    const hide=()=>{if(document.hidden&&captureRunning.current){generation.current++;urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current=[];if(timer.current)clearTimeout(timer.current);captureRunning.current=false;setCount(null);setShot(0);setError("Capture paused while this page was hidden. Press the shutter to try again.");}};
    document.addEventListener("keydown",key);document.addEventListener("visibilitychange",hide);
    return ()=>{document.removeEventListener("keydown",key);document.removeEventListener("visibilitychange",hide);};
  },[onClose]);
  const take=()=>{
    if(captureRunning.current||!ready||!filmLoaded)return;
    unlockSound();setError("");captureRunning.current=true;setShot(1);const token=++generation.current;
    const results:{file:File;url:string}[]=[];
    const fail=(message:string)=>{captureRunning.current=false;setCount(null);setShot(0);setError(message);results.forEach(p=>{URL.revokeObjectURL(p.url);urls.current=urls.current.filter(url=>url!==p.url);});};
    const captureFrame=()=>{
      if(!alive.current||!captureRunning.current||generation.current!==token)return;
      const v=video.current;
      if(!v?.videoWidth||!v.videoHeight){fail("The camera is still warming up. Try the shutter again.");return;}
      // Match the square, stretched viewfinder in the saved pixels too.
      const canvas=document.createElement("canvas");canvas.width=canvas.height=Math.min(v.videoWidth,v.videoHeight);
      const ctx=canvas.getContext("2d");
      if(!ctx){fail("That photo could not be captured. Try again.");return;}
      try{
        if(facing==="user"){ctx.translate(canvas.width,0);ctx.scale(-1,1);}
        ctx.drawImage(v,0,0,canvas.width,canvas.height);
        ctx.putImageData(applyCameraFilm(ctx.getImageData(0,0,canvas.width,canvas.height),preset,flash),0,0);
      }catch{fail("That photo could not be captured. Try again.");return;}
      playSound("shutter");setCount(null);if(flash&&motionEnabled.current)setFlashFrame(n=>n+1);
      canvas.toBlob(blob=>{
        if(!alive.current||!captureRunning.current||generation.current!==token)return;
        if(!blob){fail("That photo could not be captured. Try again.");return;}
        const url=URL.createObjectURL(blob);urls.current.push(url);results.push({file:new File([blob],`camera-photo-${results.length+1}.png`,{type:"image/png"}),url});
        if(results.length<shots){setShot(results.length+1);timer.current=setTimeout(()=>countdown(seconds),400);}
        else {captureRunning.current=false;setPrints(results);setFilmLoaded(false);setShot(0);stop();setReady(false);playSound("paper");}
      },"image/png");
    };
    const countdown=(n:number)=>{
      if(!alive.current||!captureRunning.current||generation.current!==token)return;
      if(n===0){captureFrame();return;}
      setCount(n);playSound("tick");
      timer.current=setTimeout(()=>countdown(n-1),1000);
    };countdown(seconds);
  };
  return <motion.div className="modal-backdrop camera-backdrop" initial={enabled?{opacity:0}:false} animate={{opacity:1}} exit={enabled?{opacity:0,transition:{duration:.15}}:undefined} transition={{duration:enabled?.25:0,ease:[.22,1,.36,1]}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div ref={container} tabIndex={-1} className={`camera-modal camera-experience ${captured?"has-print":""}`} role="dialog" aria-modal="true" aria-labelledby="camera-title">
      <div className="capture-heading"><div><h2 id="camera-title">{captured?"A moment, on paper.":"Take a photo"}</h2><p>{captured?(revealed?"Keep it simple, or make it your own.":"Shake the print to bring your photo into view."):"Roll the film, choose your settings, then click."}</p></div><button className="icon-button" aria-label="Close camera" onClick={onClose}><X size={20}/></button></div>
      {!captured&&<div className="capture-mode segmented" aria-label="Camera mode"><button aria-pressed={shots===1} disabled={shot>0} onClick={()=>setShots(1)}>Single Polaroid</button><button aria-pressed={shots===4} disabled={shot>0} onClick={()=>setShots(4)}>4-shot strip</button></div>}
      <InstantCamera printed={captured} print={captured?<InstantPrint photos={prints.map(p=>({src:p.url,alt:"Your captured photo"}))} caption={prints.length>1?"Four little moments":"Just now."} enabled={enabled} onReveal={()=>setRevealed(true)} onRetake={roll}/>:undefined}
        settings={<CameraSettings seconds={seconds} onSeconds={setSeconds} preset={preset} onPreset={setPreset} flash={flash} onFlash={setFlash} disabled={shot>0}/>}
        onRoll={roll} rollDisabled={shot>0||(!ready&&!captured)} loaded={filmLoaded} onShutter={take} disabled={!ready||!filmLoaded||shot>0||captured} label="Capture" status={captured?"PRINT READY":shot?`SHOT ${shot} OF ${shots}`:ready?(filmLoaded?`READY · ${seconds?`TIMER ${seconds}s`:"TIMER OFF"}`:"ROLL TO LOAD FILM"):"CONNECTING CAMERA"} controls={!captured?<button className="camera-flip" aria-label="Flip camera" disabled={shot>0} onClick={()=>setFacing(f=>f==="user"?"environment":"user")}><RefreshCw size={18}/></button>:undefined}>
        <video ref={video} autoPlay playsInline muted style={{transform:facing==="user"?"scaleX(-1)":undefined}} onLoadedData={()=>setReady(true)}/>
        {!captured&&<span className={!ready||error?"camera-message":"sr-only"} role="status">{error||(!ready?"Waiting for your camera…":filmLoaded?"Film loaded. Click the shutter.":"Camera ready. Roll the film, then click the shutter.")}</span>}
        {count!==null&&<span className="countdown" aria-live="assertive">{count}</span>}
      </InstantCamera>
      {captured&&<>
        {revealed&&<>
        <div className="capture-decisions"><button className="primary-button" onClick={()=>onCapture(prints.map(p=>p.file),prints.length>1?"scrapbook":"edit")}>Develop <ArrowRight size={17}/></button><button className="secondary-button" onClick={()=>onCapture(prints.map(p=>p.file),prints.length>1?"scrapbook":"finish")}><Check size={17}/> Done</button></div>
        <p className="field-hint">{prints.length>1?"Arrange your shots in the photo-strip builder.":"Develop opens the editor. Done keeps the photo movable."}</p>
        </>}
      </>}
      {enabled&&flashFrame>0&&<motion.div key={flashFrame} className="capture-flash" aria-hidden="true" initial={{opacity:.28}} animate={{opacity:0}} transition={{duration:.32}} onAnimationComplete={()=>setFlashFrame(0)}/>}
      {!captured&&<p className="field-hint">Flash adds a soft digital fill to your photo.</p>}
      {!captured&&<button className="text-button camera-upload" onClick={onUpload}><Upload size={15}/> Upload a photo instead</button>}
    </div>
  </motion.div>;
}
