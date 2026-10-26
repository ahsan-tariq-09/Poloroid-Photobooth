import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, AlignCenter } from "lucide-react";
import { FRAME, PHOTO, type Layer } from "../model";
import { MIN_POSITION, MAX_POSITION } from "../limits";

export default function PositionControls({layer, onChange}: {layer: Layer; onChange: (values: Partial<Layer>) => void}) {
  const move = (dx: number, dy: number) => onChange({x: Math.max(MIN_POSITION,Math.min(MAX_POSITION,layer.x+dx)),y: Math.max(MIN_POSITION,Math.min(MAX_POSITION,layer.y+dy))});
  const area = layer.kind === "photo" ? {x:PHOTO.x,y:PHOTO.y,width:PHOTO.size,height:PHOTO.size} : FRAME;
  return <div className="position-controls"><span>Position</span><div className="nudge-actions">
    <button aria-label="Move Left" onClick={()=>move(-10,0)}><ArrowLeft size={17}/></button>
    <button aria-label="Move Up" onClick={()=>move(0,-10)}><ArrowUp size={17}/></button>
    <button aria-label="Center photo" onClick={()=>onChange({x:area.x+(area.width-layer.width)/2,y:area.y+(area.height-layer.height)/2})}><AlignCenter size={17}/></button>
    <button aria-label="Move Down" onClick={()=>move(0,10)}><ArrowDown size={17}/></button>
    <button aria-label="Move Right" onClick={()=>move(10,0)}><ArrowRight size={17}/></button>
  </div><p className="field-hint">Drag the photo, or use the arrows for a small nudge.</p></div>;
}
