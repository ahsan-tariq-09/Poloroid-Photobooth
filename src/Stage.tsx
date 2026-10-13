import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { canvas, renderComposition } from './render';
import { bounds, localPoint, type Asset, type Composition, type Tool } from './model';

export default function Stage({ asset, composition, selected, tool, axis, onDown, onMove, onUp, onError }: {
  asset: Asset; composition: Composition; selected: string | null; tool: Tool; axis: 'horizontal'|'vertical';
  onDown: (x:number,y:number)=>void; onMove:(x:number,y:number)=>void; onUp:()=>void; onError:(message:string)=>void;
}) {
  const ref = useRef<HTMLCanvasElement>(null), version = useRef(0);
  const [hover,setHover] = useState<{x:number;y:number}|null>(null);
  const extent = bounds(composition);
  const region = { x: Math.min(-35,extent.x-24), y: Math.min(0,extent.y-24), width: Math.max(635,extent.x+extent.width+24)-Math.min(-35,extent.x-24), height: Math.max(710,extent.y+extent.height+24)-Math.min(0,extent.y-24) };
  // Freeze the coordinate system during a gesture to avoid moving the pointer's target.
  const heldRegion = useRef<typeof region | null>(null);
  const view = heldRegion.current || region;
  useEffect(()=>{
    const ticket = ++version.current;
    renderComposition(canvas(1,1),asset,composition,view,1.5).then(out=>{
      if(ticket !== version.current || !ref.current) return;
      ref.current.width=out.width; ref.current.height=out.height; ref.current.getContext('2d')!.drawImage(out,0,0);
    }).catch(error=>{ if(ticket===version.current) onError(error instanceof Error?error.message:'Could not render your photograph.'); });
    return ()=>{version.current++;};
  },[asset,composition,view.x,view.y,view.width,view.height,onError]);
  const point = (event:PointerEvent<SVGSVGElement>)=>{
    const matrix=event.currentTarget.getScreenCTM();
    if(matrix){const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());return {x:p.x,y:p.y};}
    const rect=event.currentTarget.getBoundingClientRect();
    return { x:view.x+(event.clientX-rect.left)/rect.width*view.width, y:view.y+(event.clientY-rect.top)/rect.height*view.height };
  };
  const layer=composition.layers.find(l=>l.id===selected);
  const hovering=layer && hover?localPoint(layer,hover.x,hover.y):null;
  const canCut=tool==='cut' && layer?.kind==='photo' && hovering && hovering.x>=0 && hovering.y>=0 && hovering.x<=layer.width && hovering.y<=layer.height;
  return <div className={`artboard tool-${tool}`} style={{aspectRatio:`${view.width}/${view.height}`}}>
    <canvas ref={ref} aria-label="Your Polaroid composition" role="img" />
    <svg className="interaction" tabIndex={0} viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} aria-label="Drag your photo and collage pieces; use arrow keys to nudge the selected piece" onPointerDown={e=>{
      if(e.button!==0)return;
      heldRegion.current=view; e.currentTarget.setPointerCapture(e.pointerId); const p=point(e); onDown(p.x,p.y);
    }} onPointerMove={e=>{const p=point(e);setHover(p);if(e.currentTarget.hasPointerCapture(e.pointerId))onMove(p.x,p.y);}} onPointerUp={()=>{onUp();heldRegion.current=null;}} onPointerCancel={()=>{onUp();heldRegion.current=null;}} onPointerLeave={()=>setHover(null)}>
      {layer && tool!=='crop' && <g transform={`translate(${layer.x+layer.width/2} ${layer.y+layer.height/2}) rotate(${layer.rotation}) translate(${-layer.width/2} ${-layer.height/2})`}>
        <rect x="-3" y="-3" width={layer.width+6} height={layer.height+6} className="selection"/>
        {[[0,0],[layer.width,0],[0,layer.height],[layer.width,layer.height]].map(([x,y],i)=><rect key={i} x={x-4} y={y-4} width="8" height="8" className="handle"/>)}
        {canCut && <line x1={axis==='vertical'?hovering!.x:0} x2={axis==='vertical'?hovering!.x:layer.width} y1={axis==='horizontal'?hovering!.y:0} y2={axis==='horizontal'?hovering!.y:layer.height} className="cut-guide"/>}
      </g>}
    </svg>
  </div>;
}
