import { useEffect, useRef, useState } from "react";
import { importMemories, loadScrapbook, makeMemory, newScrapbook, saveScrapbook, MAX_SCRAPBOOK_PHOTOS, type Scrapbook } from "../scrapbook";
import type { Assets, Composition } from "../model";
import { playSound } from "../sounds";
export function useScrapbook() {
  const [book,setBook]=useState(newScrapbook),ref=useRef(book);ref.current=book;
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[status,setStatus]=useState("");
  const [selected,setSelected]=useState<string|null>(null),[dirty,setDirty]=useState(false),[past,setPast]=useState<Scrapbook[]>([]);
  const revision=useRef(0),alive=useRef(true),working=useRef(false);
  useEffect(()=>{alive.current=true;void loadScrapbook().then(saved=>{if(alive.current&&saved){ref.current=saved;setBook(saved);setSelected(saved.items[0]?.id??null);setStatus("Saved page reopened.");}}).catch(()=>{if(alive.current)setError("Device storage is unavailable. You can still create and download a page.");}).finally(()=>{if(alive.current)setLoading(false);});return()=>{alive.current=false;};},[]);
  const change=(next:Scrapbook,remember=true)=>{if(remember)setPast(p=>[...p.slice(-19),ref.current]);ref.current=next;setBook(next);revision.current++;setDirty(true);setStatus("");};
  const checkpoint=()=>setPast(p=>[...p.slice(-19),ref.current]);
  const undo=()=>{const previous=past.at(-1);if(previous){setPast(past.slice(0,-1));change(previous,false);}};
  const addFiles=async(files:File[],layout?:Scrapbook["layout"],processed=false)=>{
    if(working.current||loading)return false;working.current=true;setBusy(true);setError("");
    try{const result=await importMemories(files,ref.current.items.length,processed);if(!alive.current)return false;if(result.items.length){change({...ref.current,layout:layout??ref.current.layout,items:[...ref.current.items,...result.items]});setSelected(result.items[0].id);playSound("paper");}if(result.errors.length)setError(result.errors.join(" · "));return result.items.length>0;}
    catch(e){if(alive.current)setError(e instanceof Error?e.message:"Photos could not be added.");return false;}
    finally{working.current=false;if(alive.current)setBusy(false);}
  };
  const addCurrent=async(assets:Assets,composition:Composition,replaceId:string|null=null)=>{
    if(working.current||loading)return false;if(!replaceId && ref.current.items.length>=MAX_SCRAPBOOK_PHOTOS){setError("This page already has 12 photos. Remove one to make room.");return false;}
    working.current=true;setBusy(true);setError("");
    try{const item=await makeMemory(assets,composition,ref.current.items.length);if(!alive.current)return false;const original=ref.current.items.find(i=>i.id===replaceId);if(replaceId&&!original)throw new Error("This photo was removed from the scrapbook. Add it as a new photo instead.");change({...ref.current,items:original?ref.current.items.map(i=>i.id===replaceId?{...i,image:item.image,photo:item.photo}:i):[...ref.current.items,item]});setSelected(original?.id??item.id);playSound("paper");return true;}
    catch(e){if(alive.current)setError(e instanceof Error?e.message:"The Polaroid could not be added.");return false;}
    finally{working.current=false;if(alive.current)setBusy(false);}
  };
  const save=async()=>{
    if(working.current||loading)return;working.current=true;setBusy(true);setError("");const snapshot=ref.current,version=revision.current;
    try{await saveScrapbook(snapshot);if(alive.current){if(revision.current===version){setDirty(false);setStatus("Saved on this device.");}else setStatus("Earlier version saved. Save again to keep your latest changes.");}}
    catch{if(alive.current)setError("This page could not be saved on this device. Storage may be full or blocked. Download it to keep a copy.");}
    finally{working.current=false;if(alive.current)setBusy(false);}
  };
  return {book,change,checkpoint,undo,canUndo:past.length>0,selected,setSelected,loading,busy,error,setError,status,setStatus,dirty,save,addFiles,addCurrent};
}
export type ScrapbookStudio=ReturnType<typeof useScrapbook>;

