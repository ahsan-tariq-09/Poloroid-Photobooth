import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { motion, useMotionValue } from "motion/react";
import { Hand } from "lucide-react";
import { playSound } from "../sounds";
import { createPhoneShakeDetector } from "./phoneShake";

type MotionAccess = typeof DeviceMotionEvent & { requestPermission?: () => Promise<"granted" | "denied"> };

/** Owns the blank-to-developed print, gestures, and optional phone sensor access. */
export default function InstantPrint({ photos, caption, enabled, onReveal, onRetake }: {
  photos: {src:string;alt:string}[]; caption:string; enabled:boolean; onReveal:()=>void; onRetake?:()=>void;
}) {
  const [phase,setPhase]=useState<"blank"|"shaking"|"revealed">("blank");
  const motionApi=window.isSecureContext?window.DeviceMotionEvent as MotionAccess|undefined:undefined;
  const [sensorActive,setSensorActive]=useState(false);
  const revealStarted=useRef(false), revealCallback=useRef(onReveal);
  const offset=useMotionValue(0);
  const gesture=useRef<{id:number;anchor:number;direction:number;turns:number;distance:number}|null>(null);
  revealCallback.current=onReveal;

  const reveal=useCallback(()=>{
    if(revealStarted.current)return;
    revealStarted.current=true; gesture.current=null; offset.set(0); playSound("paper"); setPhase("shaking");
  },[offset]);
  useEffect(()=>{
    if(phase!=="shaking")return;
    const finish=()=>{setPhase("revealed");revealCallback.current();};
    if(!enabled){finish();return;}
    const timer=setTimeout(finish,650);
    return()=>clearTimeout(timer);
  },[phase,enabled]);
  useEffect(()=>{
    if(!motionApi||phase!=="blank")return;
    const detector=createPhoneShakeDetector();let fired=false;
    const listener=(event:DeviceMotionEvent)=>{
      if(document.hidden||fired)return;
      const readings=[event.acceleration,event.accelerationIncludingGravity];
      if(readings.some(a=>a&&[a.x,a.y,a.z].every(v=>typeof v==="number"&&Number.isFinite(v))))setSensorActive(true);
      if(detector.sample(event.acceleration,event.accelerationIncludingGravity,event.timeStamp)){fired=true;reveal();}
    };
    window.addEventListener("devicemotion",listener);
    document.addEventListener("visibilitychange",detector.reset);
    return()=>{window.removeEventListener("devicemotion",listener);document.removeEventListener("visibilitychange",detector.reset);};
  },[motionApi,phase,reveal]);
  const revealByButton=()=>{
    // Permission prompts require a user gesture. Revealing this print never depends on access.
    if(motionApi?.requestPermission&&!sensorActive){
      try{void motionApi.requestPermission().catch(()=>{});}catch{/* The tap fallback still works. */}
    }
    reveal();
  };
  const move=(event:PointerEvent<HTMLDivElement>)=>{
    const g=gesture.current;
    if(!g||g.id!==event.pointerId)return;
    const delta=event.clientX-g.anchor;
    if(enabled)offset.set(Math.max(-12,Math.min(12,delta/3)));
    if(Math.abs(delta)<20)return;
    const direction=Math.sign(delta);
    if(g.direction&&direction!==g.direction)g.turns++;
    g.distance+=Math.abs(delta);g.direction=direction;g.anchor=event.clientX;
    if(g.turns>=2&&g.distance>=100)reveal();
  };
  const end=()=>{gesture.current=null;offset.set(0);};
  return <div className="print-reveal">
    <div className="print-outlet"><motion.div className="instant-print" initial={enabled?{y:"-100%"}:false} animate={{y:0}} transition={{duration:enabled?.85:0,ease:[.22,1,.36,1]}}>
      <motion.div className="print-drag" style={{x:offset}} onPointerDown={event=>{
        if(phase!=="blank"||event.button!==0)return;
        gesture.current={id:event.pointerId,anchor:event.clientX,direction:0,turns:0,distance:0};
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
        <motion.div className={`instant-paper ${photos.length>1?"instant-strip":""}`} animate={enabled&&phase==="shaking"?{rotate:[0,-3,3,-2,2,0]}:{rotate:0}} transition={{duration:enabled?.6:0}}>
          {photos.map((photo,index)=><div className="instant-photo-window" key={photo.src}>
            {phase==="revealed" ? <motion.img src={photo.src} alt={photo.alt} initial={enabled?{opacity:0}:false} animate={{opacity:1}} transition={{duration:enabled?.7:0}} draggable={false}/> : <div className="undeveloped-photo" aria-label={`Unrevealed photo ${index+1}`}>{index===0&&<><Hand size={25} strokeWidth={1.4}/><span>{phase==="shaking"?"Coming into focus…":"Shake to reveal"}</span></>}</div>}
          </div>)}
          <span className="instant-caption">{caption}</span>
        </motion.div>
      </motion.div>
    </motion.div></div>
    <div className="print-reveal-actions">
      <div className="print-action-row">
        <button className={`${phase==="blank"?"primary-button":"secondary-button"} shake-reveal`} aria-label={phase==="revealed"?"Photo revealed":"Shake to reveal"} disabled={phase!=="blank"} onClick={revealByButton}><Hand size={20}/>{phase==="blank"?"Shake to reveal":phase==="shaking"?"Developing…":"Photo revealed"}</button>
        {onRetake&&<button className="secondary-button retake-photo" onClick={onRetake}>Retake photo</button>}
      </div>
      <p className="field-hint print-shake-hint" role="status">{phase==="blank"?"Phone shake starts automatically where supported. Use a few firm back-and-forth shakes. Small movements won’t reveal the photo.":phase==="shaking"?"Your photo is developing.":"Your moment is ready to keep."}</p>
      {phase==="blank"&&<>
        <p className="field-hint">You can also drag the print or tap Shake to reveal.</p>
        {motionApi?.requestPermission&&!sensorActive&&<p className="field-hint print-shake-hint">Your browser may ask for motion access when you tap Shake to reveal.</p>}
      </>}
    </div>
  </div>;
}
