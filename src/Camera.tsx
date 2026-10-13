import { useEffect, useRef, useState } from 'react';
import { Camera as CameraIcon, X, RefreshCw, Upload } from 'lucide-react';

export default function Camera({ onClose, onCapture, onUpload }: {onClose:()=>void;onCapture:(file:File)=>void;onUpload:()=>void}) {
  const video=useRef<HTMLVideoElement>(null), stream=useRef<MediaStream|null>(null), alive=useRef(true), timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [error,setError]=useState(''),[ready,setReady]=useState(false),[count,setCount]=useState<number|null>(null),[facing,setFacing]=useState<'user'|'environment'>('user');
  const container=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    alive.current=true; setReady(false);setError('');
    let disposed=false;
    let owned:MediaStream|null=null;
    const previous=document.activeElement as HTMLElement|null;
    container.current?.focus();
    if(!navigator.mediaDevices?.getUserMedia){setError('Camera capture needs HTTPS or localhost. You can still upload a photo.');return;}
    navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing}},audio:false}).then(value=>{
      if(disposed){value.getTracks().forEach(t=>t.stop());return;}
      owned=value;stream.current=value;if(video.current)video.current.srcObject=value;
    }).catch(()=>{if(!disposed)setError('Your camera is unavailable or permission was declined. Upload a photo to keep creating.');});
    return ()=>{disposed=true;alive.current=false;owned?.getTracks().forEach(t=>t.stop());if(stream.current===owned)stream.current=null;if(timer.current)clearTimeout(timer.current);previous?.focus();};
  },[facing]);
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){e.preventDefault();onClose();}
      if(e.key==='Tab'){
        const controls=container.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]');
        if(!controls?.length)return;
        const first=controls[0],last=controls[controls.length-1];
        if(e.shiftKey && (document.activeElement===first || document.activeElement===container.current)){e.preventDefault();last.focus();}
        else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
      }
    };document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);
  },[onClose]);
  const take=()=>{
    setCount(3);
    const tick=(n:number)=>{timer.current=setTimeout(()=>{
      if(!alive.current)return;
      if(n>1){setCount(n-1);tick(n-1);return;}
      const v=video.current;if(!v)return;
      const canvas=document.createElement('canvas');canvas.width=v.videoWidth;canvas.height=v.videoHeight;
      const ctx=canvas.getContext('2d')!;
      if(facing==='user'){ctx.translate(canvas.width,0);ctx.scale(-1,1);}ctx.drawImage(v,0,0);
      canvas.toBlob(blob=>{if(blob && alive.current)onCapture(new File([blob],'camera-photo.png',{type:'image/png'}));},'image/png');
      setCount(null);
    },1000);};tick(3);
  };
  return <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div ref={container} tabIndex={-1} className="camera-modal" role="dialog" aria-modal="true" aria-labelledby="camera-title">
    <div className="modal-top"><span className="eyebrow">THE PHOTO BOOTH</span><button className="icon-button" aria-label="Close camera" onClick={onClose}><X size={20}/></button></div>
    <h2 id="camera-title">Ready for your close-up?</h2>
    <p>A three-second countdown. One little memory.</p>
    <div className="camera-view"><video ref={video} autoPlay playsInline muted style={{transform:facing==='user'?'scaleX(-1)':undefined}} onLoadedData={()=>setReady(true)}/>{!ready && !error && <span className="camera-message">Waiting for your camera…</span>}{error && <span className="camera-message">{error}</span>}{count && <span className="countdown" aria-live="assertive">{count}</span>}</div>
    <div className="camera-actions"><button className="secondary-button" disabled={count!==null} onClick={()=>{setFacing(f=>f==='user'?'environment':'user');}}><RefreshCw size={16}/> Flip camera</button><button className="primary-button" disabled={!ready || count!==null} onClick={take}><CameraIcon size={18}/> Capture</button></div>
    <button className="text-button" onClick={onUpload}><Upload size={14}/> Upload a photo instead</button>
  </div></div>;
}
