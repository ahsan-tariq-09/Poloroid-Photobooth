import { useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, Download, ImagePlus, Save, Trash2, Undo2, BookOpen } from "lucide-react";
import { FRAME } from "../model";
import { ACCEPT } from "../imports";
import { canvasBlob, download } from "../render";
import { arrangeMemories, layoutStrip, renderScrapbook, type ScrapbookItem, type StoredPhoto } from "../scrapbook";
import { Range } from "./shared";
import type { ScrapbookStudio } from "./useScrapbook";
import { playSound } from "../sounds";

export default function ScrapbookScreen({studio:b,onCamera,onEditPhoto}:{studio:ScrapbookStudio;onCamera:()=>void;onEditPhoto:(photo:StoredPhoto,id:string)=>void}) {
  const {book}=b,strip=book.layout==="strip",input=useRef<HTMLInputElement>(null),page=useRef<HTMLDivElement>(null);
  const [exporting,setExporting]=useState(false);
  const drag=useRef<{id:string;clientX:number;clientY:number;x:number;y:number;before:typeof book}|null>(null);
  const selected=book.items.find(i=>i.id===b.selected);
  const changeItem=(values:Partial<ScrapbookItem>,remember=true)=>{if(selected)b.change({...book,items:book.items.map(i=>i.id===selected.id?{...i,...values}:i)},remember);};
  const reorder=(delta:number)=>{if(!selected)return;const index=book.items.indexOf(selected),next=Math.max(0,Math.min(book.items.length-1,index+delta));if(index===next)return;const items=[...book.items];items.splice(index,1);items.splice(next,0,selected);b.change({...book,items});};
  const exportPage=async()=>{setExporting(true);b.setError("");try{download(await canvasBlob(await renderScrapbook(book,2),"image/png"),strip?"my-photo-strip.png":"my-scrapbook.png");b.setStatus("Your page was downloaded.");playSound("paper");}catch(e){b.setError(e instanceof Error?e.message:"This page could not be downloaded. Try again.");}finally{setExporting(false);}};
  const stripLayout=layoutStrip(book.items.length);
  return <main className="scrapbook-screen">
    <div className="page-heading"><div><h1 tabIndex={-1}>Put your moments together.</h1><p>Build a scrapbook page or a photobooth strip.</p></div><div className="book-save-actions"><button className="secondary-button" disabled={b.loading||b.busy} onClick={()=>void b.save()}><Save size={17}/> Save on device</button><button className="primary-button" disabled={!book.items.length||exporting||b.busy} onClick={()=>void exportPage()}><Download size={17}/>{exporting?"Preparing…":"Download page"}</button></div></div>
    {b.error&&<p className="notice" role="alert">{b.error}</p>}
    <div className="scrapbook-layout">
      <aside className="book-controls" aria-label="Scrapbook controls"><fieldset className="book-control-fields" disabled={b.loading}>
        <div className="segmented" aria-label="Page layout"><button aria-pressed={!strip} onClick={()=>b.change({...book,layout:"collage"})}>Scrapbook</button><button aria-pressed={strip} onClick={()=>b.change({...book,layout:"strip"})}>Photo strip</button></div>
        <label className="field">Page title<input aria-label="Page title" maxLength={55} value={book.title} onFocus={b.checkpoint} onChange={e=>b.change({...book,title:e.target.value},false)}/></label>
        <div className="book-add-actions"><button className="secondary-button" disabled={b.loading||b.busy||book.items.length>=12} onClick={()=>input.current?.click()}><ImagePlus size={17}/>{b.busy?"Preparing…":"Add photos"}</button><button className="text-button" disabled={b.loading||b.busy||book.items.length>=12} onClick={onCamera}><Camera size={17}/> Take photos</button></div>
        <input ref={input} type="file" hidden multiple accept={ACCEPT} aria-label="Add scrapbook photos" onChange={e=>{const files=Array.from(e.target.files||[]);e.target.value="";void b.addFiles(files);}}/>
        <div className="color-row"><span>Paper</span><div>{[["#f9f4e7","Cream"],["#e0e5d7","Sage"],["#242623","Black"],["#ffffff","White"]].map(([color,name])=><button key={color} style={{background:color}} aria-label={`Page color ${name}`} aria-pressed={book.paper===color} onClick={()=>b.change({...book,paper:color})}/>)}</div></div>
        {selected&&<section className="book-selected" aria-label="Selected scrapbook photo"><h2>Selected photo</h2>
          {!strip&&<><Range label="Photo size" value={selected.width} min={100} max={440} suffix="" onStart={b.checkpoint} onChange={width=>changeItem({width},false)} onFinish={()=>{}}/><Range label="Photo tilt" value={selected.rotation} min={-30} max={30} suffix="°" onStart={b.checkpoint} onChange={rotation=>changeItem({rotation},false)} onFinish={()=>{}}/>
          <div className="nudge-actions">{([["Left",ArrowLeft,-10,0],["Up",ArrowUp,0,-10],["Down",ArrowDown,0,10],["Right",ArrowRight,10,0]] as const).map(([name,Icon,dx,dy])=><button key={name} aria-label={`Move scrapbook photo ${name}`} onClick={()=>changeItem({x:Math.max(-100,Math.min(900,selected.x+dx)),y:Math.max(-100,Math.min(680,selected.y+dy))})}><Icon size={17}/></button>)}</div>
          <label className="tape-toggle"><input type="checkbox" checked={selected.tape} onChange={e=>changeItem({tape:e.target.checked})}/> Add a little tape</label></>}
          <div className="book-order"><button className="secondary-button" disabled={book.items.indexOf(selected)===0} onClick={()=>reorder(-1)}><ArrowUp size={15}/>{strip?"Earlier":"Send back"}</button><button className="secondary-button" disabled={book.items.indexOf(selected)===book.items.length-1} onClick={()=>reorder(1)}><ArrowDown size={15}/>{strip?"Later":"Bring forward"}</button></div>
          <button className="text-button" disabled={b.busy} onClick={()=>onEditPhoto(selected.photo,selected.id)}>Edit this Polaroid <ArrowRight size={16}/></button>
          <button className="text-button remove-photo" disabled={b.busy} onClick={()=>{b.change({...book,items:book.items.filter(i=>i.id!==selected.id)});b.setSelected(null);}}><Trash2 size={16}/> Remove photo</button>
        </section>}
        {!strip&&<button className="text-button" disabled={!book.items.length||b.busy} onClick={()=>b.change({...book,items:arrangeMemories(book.items)})}>Arrange page</button>}
        <button className="text-button" disabled={!b.canUndo||b.busy} onClick={b.undo}><Undo2 size={16}/> Undo</button>
        </fieldset><p className="book-status" role="status">{b.loading?"Opening your saved page…":b.status||(b.dirty?"Unsaved changes":"Save this page to keep it on this device.")}</p>
        <p className="field-hint">Up to 12 photos per page. Save before leaving. Clearing browser data removes saved pages.</p>
      </aside>
      <div className={`book-workspace ${strip?"strip-workspace":""}`}>
        {!book.items.length?<div className="book-empty"><BookOpen size={40} strokeWidth={1}/><h2>A home for your photos.</h2><p>Add a few moments to start your {strip?"photo strip":"scrapbook"}. You can move, tilt, and layer them here.</p><button className="primary-button" disabled={b.loading||b.busy} onClick={()=>input.current?.click()}><ImagePlus size={17}/> Add your first photos</button></div>:
          <div ref={page} className={`scrapbook-paper ${strip?"strip-paper":"collage-paper"}`} aria-label={strip?"Your photo strip":"Your scrapbook page"} style={{background:book.paper,aspectRatio:strip?`${stripLayout.width}/${stripLayout.height}`:"1000/780"}}>
            {book.items.map((item,index)=>{
              const h=item.width*FRAME.height/FRAME.width;
              const slot=stripLayout.slots[index];
              return <button key={item.id} className={`scrapbook-photo ${strip?"strip-photo":"collage-photo"} ${item.tape&&!strip?"with-tape":""}`} aria-label={`Select photo ${index+1}`} aria-pressed={b.selected===item.id} style={strip?{left:`${slot.x/360*100}%`,top:`${slot.y/stripLayout.height*100}%`,width:`${slot.width/360*100}%`,height:`${slot.height/stripLayout.height*100}%`}:{left:`${item.x/10}%`,top:`${item.y/780*100}%`,width:`${item.width/10}%`,height:`${h/780*100}%`,transform:`rotate(${item.rotation}deg)`}}
                onFocus={()=>b.setSelected(item.id)} onClick={()=>b.setSelected(item.id)} onKeyDown={e=>{if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key))return;e.preventDefault();if(strip){reorder(e.key==="ArrowUp"||e.key==="ArrowLeft"?-1:1);}else{b.change({...book,items:book.items.map(i=>i.id===item.id?{...i,x:i.x+(e.key==="ArrowLeft"?-5:e.key==="ArrowRight"?5:0),y:i.y+(e.key==="ArrowUp"?-5:e.key==="ArrowDown"?5:0)}:i)});}}}
                onPointerDown={e=>{b.setSelected(item.id);if(strip||e.button!==0)return;b.checkpoint();drag.current={id:item.id,clientX:e.clientX,clientY:e.clientY,x:item.x,y:item.y,before:book};e.currentTarget.setPointerCapture(e.pointerId);}}
                onPointerMove={e=>{const d=drag.current,rect=page.current?.getBoundingClientRect();if(!d||!rect)return;b.change({...book,items:book.items.map(i=>i.id===d.id?{...i,x:Math.max(-100,Math.min(900,d.x+(e.clientX-d.clientX)/rect.width*1000)),y:Math.max(-100,Math.min(680,d.y+(e.clientY-d.clientY)/rect.height*780))}:i)},false);}}
                onPointerUp={()=>{if(drag.current){drag.current=null;playSound("paper");}}} onPointerCancel={()=>{const d=drag.current;drag.current=null;if(d)b.change(d.before,false);}}>
                <img draggable={false} src={item.image} alt={`Polaroid ${index+1}`}/>
              </button>;
            })}
            <span className="scrapbook-page-title" style={{color:book.paper==="#242623"?"#faf6ec":"#493e30",fontSize:strip?"clamp(10px,1.4vw,17px)":"clamp(8px,1.3vw,16px)"}}>{book.title}</span>
          </div>}
        <p className="book-canvas-hint">{book.items.length?strip?"Select a shot. Use Earlier and Later to arrange your strip.":"Drag to arrange. Select a photo to change its size, tilt, or tape.":"Your photos stay on this device."}</p>
      </div>
    </div>
  </main>;
}


