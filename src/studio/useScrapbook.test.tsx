// @vitest-environment jsdom
import {act} from "react";
import {createRoot} from "react-dom/client";
import {afterEach,expect,it,vi} from "vitest";
import {newScrapbook,placeMemory,type Scrapbook} from "../scrapbook";
import {initialComposition} from "../model";
import {useScrapbook,type ScrapbookStudio} from "./useScrapbook";
const storage=vi.hoisted(()=>({load:vi.fn(),save:vi.fn(),make:vi.fn()}));
vi.mock("../scrapbook",async original=>({...await original<typeof import("../scrapbook")>(),loadScrapbook:storage.load,saveScrapbook:storage.save,makeMemory:storage.make}));
vi.mock("../sounds",()=>({playSound:()=>{}}));
let current:ScrapbookStudio;
const host=document.createElement("div");let root:ReturnType<typeof createRoot>;
function Harness(){current=useScrapbook();return null;}
async function mount(book:Scrapbook){Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});storage.load.mockResolvedValue(book);root=createRoot(host);await act(async()=>root.render(<Harness/>));}
afterEach(async()=>{await act(async()=>root?.unmount());vi.clearAllMocks();});
it("updates the original scrapbook item even on a full page, retaining its arrangement",async()=>{
 const original=placeMemory({id:"original",image:"old",photo:{composition:initialComposition(),assets:{}}},0);
 const book={...newScrapbook(),items:Array.from({length:12},(_,i)=>({...original,id:i?String(i):"original"}))};await mount(book);
 storage.make.mockResolvedValue({...original,id:"new-id",image:"updated"});
 await act(async()=>{expect(await current.addCurrent({},initialComposition(),"original")).toBe(true);});
 expect(current.book.items).toHaveLength(12);expect(current.book.items[0]).toEqual({...original,image:"updated"});
 expect(current.selected).toBe("original");
});
it("keeps newer edits marked unsaved when an older save completes",async()=>{
 await mount(newScrapbook());let finish!:()=>void;storage.save.mockImplementation(()=>new Promise<void>(r=>{finish=r;}));
 let saving!:Promise<void>;await act(async()=>{saving=current.save();});
 await act(async()=>current.change({...current.book,title:"Changed during save"}));
 await act(async()=>{finish();await saving;});
 expect(current.dirty).toBe(true);expect(current.status).toContain("Save again");
 expect(storage.save.mock.calls[0][0].title).toBe("Little moments");
});
