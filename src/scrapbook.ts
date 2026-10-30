import { FRAME, PHOTO, clone, initialComposition, photoLayer, type Asset, type Assets, type Composition } from "./model";
import { canvas, renderComposition } from "./render";
import { importAsset, loadImage } from "./imports";
import { captureDate } from "./studio/captureDate";

export type StoredPhoto = { composition: Composition; assets: Record<string, {url:string; width:number; height:number; name:string; svg?:string}> };
export type ScrapbookItem = {id:string; image:string; photo:StoredPhoto; x:number; y:number; width:number; rotation:number; tape:boolean};
export type Scrapbook = {version:1; title:string; layout:"collage"|"strip"; paper:string; items:ScrapbookItem[]};
export const newScrapbook = ():Scrapbook => ({version:1,title:"Little moments",layout:"collage",paper:"#f9f4e7",items:[]});
export const MAX_SCRAPBOOK_PHOTOS=12;
export function layoutStrip(count:number) {
  return {width:360,height:24+Math.max(1,count)*324+52,slots:Array.from({length:count},(_,i)=>({x:24,y:24+i*324,width:312,height:312}))};
}
export function placeMemory(item:Omit<ScrapbookItem,"x"|"y"|"width"|"rotation"|"tape">,index:number):ScrapbookItem {
  return {...item,x:35+(index%3)*315,y:40+Math.floor(index/3)*125,width:260,rotation:[-5,4,-3,6][index%4],tape:index%2===0};
}
export function arrangeMemories(items:ScrapbookItem[]):ScrapbookItem[] {
  const columns=items.length<=4?2:items.length<=6?3:4;
  const rows=Math.ceil(items.length/columns),width=items.length<=4?280:items.length<=6?260:190;
  return items.map((item,index)=>({...item,width,x:items.length===1?(1000-width)/2:(index%columns+.5)*1000/columns-width/2,y:(Math.floor(index/columns)+.5)*700/rows-width*FRAME.height/FRAME.width/2+15,rotation:[-5,4,-3,6][index%4]}));
}
async function dataUrl(asset:Asset) {
  if(asset.url.startsWith("data:"))return asset.url;
  const response=await fetch(asset.url);if(!response.ok)throw new Error("A photo could not be saved. Try importing it again.");
  const blob=await response.blob();
  return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as string);reader.onerror=()=>reject(new Error("Could not save the photo on this device."));reader.readAsDataURL(blob);});
}
export async function packPhoto(assets:Assets,composition:Composition):Promise<StoredPhoto> {
  const used=new Set(composition.layers.flatMap(l=>l.assetId?[l.assetId]:[]));
  const entries=await Promise.all([...used].map(async id=>{const a=assets[id];return [id,{url:await dataUrl(a),width:a.width,height:a.height,name:a.name,...(a.svg?{svg:a.svg}:{})}] as const;}));
  return {composition:clone(composition),assets:Object.fromEntries(entries)};
}
export async function unpackPhoto(photo:StoredPhoto):Promise<{assets:Assets;composition:Composition}> {
  const entries=await Promise.all(Object.entries(photo.assets).map(async([id,a])=>[id,{...a,image:await loadImage(a.url)}] as const));
  return {assets:Object.fromEntries(entries),composition:clone(photo.composition)};
}
export async function makeMemory(assets:Assets,composition:Composition,index:number):Promise<ScrapbookItem> {
  const image=await renderComposition(canvas(1,1),assets,composition,FRAME,1.5);
  return placeMemory({id:crypto.randomUUID(),image:image.toDataURL("image/png"),photo:await packPhoto(assets,composition)},index);
}
export async function importMemories(files:File[],offset=0,processed=false):Promise<{items:ScrapbookItem[];errors:string[]}> {
  const items:ScrapbookItem[]=[],errors:string[]=[];
  for(const file of files.slice(0,MAX_SCRAPBOOK_PHOTOS-offset)) {
    let asset:Asset|undefined;
    try {asset=await importAsset(file);const composition=initialComposition("photo");composition.layers=[photoLayer("photo",asset.name,0,asset)];composition.effects.film=processed?0:.65;if(processed)composition.caption=captureDate(file.lastModified);items.push(await makeMemory({photo:asset},composition,offset+items.length));}
    catch(error){errors.push(`${file.name}: ${error instanceof Error?error.message:"Could not open photo."}`);}
    finally {if(asset?.url.startsWith("blob:"))URL.revokeObjectURL(asset.url);}
  }
  if(files.length>MAX_SCRAPBOOK_PHOTOS-offset)errors.push("A page holds up to 12 photos. The remaining photos were not added.");
  return {items:offset===0?arrangeMemories(items):items,errors};
}
export async function renderScrapbook(book:Scrapbook,scale=1):Promise<HTMLCanvasElement> {
  const strip=layoutStrip(book.items.length),width=book.layout==="strip"?strip.width:1000,height=book.layout==="strip"?strip.height:780;
  const output=canvas(width*scale,height*scale),ctx=output.getContext("2d")!;ctx.scale(scale,scale);ctx.fillStyle=book.paper;ctx.fillRect(0,0,width,height);
  const images=await Promise.all(book.items.map(item=>loadImage(item.image)));
  if(book.layout==="collage") {
    ctx.strokeStyle="#dad1bf";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(500,20);ctx.lineTo(500,740);ctx.stroke();
    book.items.forEach((item,i)=>{
      const h=item.width*FRAME.height/FRAME.width;ctx.save();ctx.translate(item.x+item.width/2,item.y+h/2);ctx.rotate(item.rotation*Math.PI/180);
      ctx.shadowColor="#30261430";ctx.shadowBlur=9;ctx.shadowOffsetY=4;ctx.drawImage(images[i],-item.width/2,-h/2,item.width,h);ctx.shadowColor="transparent";
      if(item.tape){ctx.fillStyle="#c8b184b3";ctx.rotate(-.08);ctx.fillRect(-item.width*.21,-h/2-7,item.width*.42,19);}ctx.restore();
    });
  } else book.items.forEach((_,i)=>{
    const slot=strip.slots[i],image=images[i];
    ctx.drawImage(image,(PHOTO.x-FRAME.x)/FRAME.width*image.naturalWidth,(PHOTO.y-FRAME.y)/FRAME.height*image.naturalHeight,PHOTO.size/FRAME.width*image.naturalWidth,PHOTO.size/FRAME.height*image.naturalHeight,slot.x,slot.y,slot.width,slot.height);
  });
  ctx.fillStyle=book.paper==="#242623"?"#faf6ec":"#493e30";ctx.font='20px Georgia, serif';ctx.textAlign="center";ctx.fillText(book.title,width/2,height-22,width-48);return output;
}
function openDatabase():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open("poloroid-scrapbook",1);
    request.onupgradeneeded=()=>request.result.createObjectStore("pages");
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error("Close other roid tabs, then save again."));
  });
}
export async function saveScrapbook(book:Scrapbook) {
  const db=await openDatabase();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction("pages","readwrite");tx.objectStore("pages").put(clone(book),"current");tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
}
export async function loadScrapbook():Promise<Scrapbook|null> {
  const db=await openDatabase();try{return await new Promise((resolve,reject)=>{const req=db.transaction("pages","readonly").objectStore("pages").get("current");req.onsuccess=()=>resolve(req.result?.version===1?req.result:null);req.onerror=()=>reject(req.error);});}finally{db.close();}
}

