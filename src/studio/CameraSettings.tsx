import { Zap } from "lucide-react";
export const timerStops = [0,3,5,10] as const;
export type TimerSeconds = typeof timerStops[number];
export const filmPresets = ["Classic","B&W","Film Grain","Faded"] as const;
export type FilmPreset = typeof filmPresets[number];
export const isoStops = [100,200,400,800,1600,3200] as const;
export type CameraISO = typeof isoStops[number];
export type CameraPreferences = { seconds:TimerSeconds; preset:FilmPreset; flash:boolean; iso?:CameraISO; loadStartedAt?:number };

export function CameraReadout({seconds,preset,iso=800}:Pick<CameraPreferences,"seconds"|"preset"|"iso">) {
  return <div className="viewfinder-readout" aria-label="Camera settings">
    <span>ISO <b>{iso}</b></span><span>Film <b>{preset}</b></span><span>Timer <b>{seconds?`${seconds}s`:"Off"}</b></span>
  </div>;
}

export default function CameraSettings({seconds,onSeconds,preset,onPreset,flash,onFlash,iso,onISO,disabled}: {
  seconds:TimerSeconds;onSeconds:(value:TimerSeconds)=>void;preset:FilmPreset;onPreset:(value:FilmPreset)=>void;
  flash:boolean;onFlash:(value:boolean)=>void;iso:CameraISO;onISO:(value:CameraISO)=>void;disabled:boolean;
}) {
  const timerAngle=45-timerStops.indexOf(seconds)*90, isoIndex=isoStops.indexOf(iso);
  return <div className="camera-settings">
    <div className="camera-dials">
    <fieldset className="timer-control" disabled={disabled}><legend>Self timer</legend>
      <div className="timer-dial"><i className="timer-pointer" aria-hidden="true"/><div className="timer-rotor" style={{transform:`rotate(${timerAngle}deg)`}}><i className="dial-hub" aria-hidden="true"/>
        {timerStops.map((value,index)=><button key={value} type="button" className={`timer-stop stop-${index}`} aria-label={value?`Timer ${value} seconds`:"Timer off"} aria-pressed={seconds===value} onClick={()=>onSeconds(value)}><span style={{transform:`rotate(${-timerAngle}deg)`}}>{value?`${value}s`:"OFF"}</span></button>)}
      </div>
      </div>
    </fieldset>
    <fieldset className="iso-control" disabled={disabled}><legend>ISO effect</legend>
      <div className="iso-dial"><i className="timer-pointer" aria-hidden="true"/>
        <div className="iso-markings" style={{transform:`rotate(${-isoIndex*60}deg)`}} aria-hidden="true"><i className="dial-hub"/>{isoStops.map((value,index)=>{
          const angle=index*Math.PI/3;
          return <span key={value} style={{transform:`translate(${Math.sin(angle)*43}px,${-Math.cos(angle)*43}px) rotate(${isoIndex*60}deg)`,color:value===iso?"#ffdb98":undefined,fontWeight:value===iso?700:undefined}}>{value}</span>;
        })}</div>
        <button type="button" className="iso-knob" role="slider" aria-label="ISO effect" aria-valuemin={100} aria-valuemax={3200} aria-valuenow={iso} aria-valuetext={`ISO ${iso}`} title="Tap to turn ISO; use arrow keys to adjust" onClick={()=>onISO(isoStops[(isoIndex+1)%isoStops.length])} onKeyDown={event=>{
          const step=event.key==='ArrowUp'||event.key==='ArrowRight'?1:event.key==='ArrowDown'||event.key==='ArrowLeft'?-1:0;
          if(step||event.key==='Home'||event.key==='End'){
            event.preventDefault();onISO(isoStops[event.key==='Home'?0:event.key==='End'?isoStops.length-1:Math.max(0,Math.min(isoStops.length-1,isoIndex+step))]);
          }
        }}/>
      </div>
    </fieldset>
    </div>
    <fieldset className="film-presets" disabled={disabled}><legend>Film presets</legend>{filmPresets.map((value,index)=><button key={value} type="button" aria-pressed={preset===value} onClick={()=>onPreset(value)}><i className={`film-cartridge cartridge-${index}`} aria-hidden="true"/><span>{value}</span></button>)}</fieldset>
    <div className="flash-control"><span>Flash</span><div className="flash-toggle"><span className="flash-position" aria-hidden="true">On</span><button type="button" className="flash-switch" role="switch" aria-label="Flash effect" aria-checked={flash} disabled={disabled} onClick={()=>onFlash(!flash)}><i className="flash-lever" aria-hidden="true"/><Zap size={16}/><i className="flash-led" aria-hidden="true"/></button><span className="flash-position" aria-hidden="true">Off</span></div></div>
  </div>;
}
