import { useRef } from "react";
import type { Studio } from "./useStudioSession";
import CompositionPreview from "./CompositionPreview";
import PositionControls from "./PositionControls";
import { FRAME, type Layer } from "../model";
import { MIN_POSITION, MAX_POSITION } from "../limits";

export default function FinishPosition({studio:s}:{studio:Studio}) {
  const photos=s.composition.layers.filter(l=>l.kind==="photo");
  const photo=photos.find(l=>l.id===s.selected)||photos[0];
  const drag=useRef<{x:number;y:number;left:number;top:number;scale:number}|null>(null);
  const update=(values:Partial<Layer>,continuous=false)=>{
    const next={...s.composition,layers:s.composition.layers.map(l=>l.id===photo?.id?{...l,...values}:l)};
    continuous?s.preview(next):s.commit(next);
  };
  const clamp=(n:number)=>Math.min(MAX_POSITION,Math.max(MIN_POSITION,n));
  return <div className="finish-position">
    <div className="finish-draggable" role="group" tabIndex={0} aria-label="Move photo inside the Polaroid. Drag or use arrow keys."
      onKeyDown={e=>{if(!photo||!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key))return;e.preventDefault();update({x:clamp(photo.x+(e.key==="ArrowLeft"?-5:e.key==="ArrowRight"?5:0)),y:clamp(photo.y+(e.key==="ArrowUp"?-5:e.key==="ArrowDown"?5:0))});}}
      onPointerDown={e=>{if(!photo||e.button!==0)return;drag.current={x:e.clientX,y:e.clientY,left:photo.x,top:photo.y,scale:FRAME.width/e.currentTarget.getBoundingClientRect().width};e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerMove={e=>{const d=drag.current;if(d)update({x:clamp(d.left+(e.clientX-d.x)*d.scale),y:clamp(d.top+(e.clientY-d.y)*d.scale)},true);}}
      onPointerUp={()=>{drag.current=null;s.finish();}} onPointerCancel={()=>{drag.current=null;s.finish();}}>
      <CompositionPreview assets={s.assets} composition={s.composition} label="Finished Polaroid" scale={1.5}/>
    </div>
    {photo&&<div className="finish-adjustments">{photos.length>1&&<label className="field">Photo to move<select value={photo.id} onChange={e=>s.select(e.target.value)}>{photos.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}<PositionControls layer={photo} onChange={update}/></div>}
  </div>;
}
