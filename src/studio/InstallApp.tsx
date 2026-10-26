import { useEffect, useState } from "react";
import { Download } from "lucide-react";
type InstallPrompt = Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export default function InstallApp() {
  const [prompt,setPrompt]=useState<InstallPrompt|null>(null),[installed,setInstalled]=useState(false),[help,setHelp]=useState(false);
  const [offline,setOffline]=useState("Preparing offline access…");
  useEffect(()=>{
    let alive=true;
    if(import.meta.env.PROD) {
      if("serviceWorker" in navigator) void navigator.serviceWorker.ready.then(()=>{if(alive)setOffline("Ready to use offline on this device.");});
      else setOffline("Open in Safari or Chrome for offline use.");
    }
    setInstalled(window.matchMedia('(display-mode: standalone)').matches);
    const available=(e:Event)=>{e.preventDefault();setPrompt(e as InstallPrompt);};
    const done=()=>{setInstalled(true);setPrompt(null);};
    window.addEventListener('beforeinstallprompt',available);window.addEventListener('appinstalled',done);
    return()=>{alive=false;window.removeEventListener('beforeinstallprompt',available);window.removeEventListener('appinstalled',done);};
  },[]);
  if(installed)return <p className="field-hint" role="status">{offline}</p>;
  return <div className="install-app">{import.meta.env.PROD&&<p className="field-hint" role="status">{offline}</p>}<button className="text-button" onClick={()=>{if(prompt){void prompt.prompt().then(()=>prompt.userChoice).then(()=>setPrompt(null)).catch(()=>setHelp(true));}else setHelp(v=>!v);}}><Download size={15}/> Install Polaroid</button>{help&&<p role="status">On iPhone or iPad, open this site in Safari, tap Share, then Add to Home Screen. On Android, use your browser menu and choose Install app or Add to Home screen.</p>}</div>;
}

