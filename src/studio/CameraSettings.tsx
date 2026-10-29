import { ChevronDown, Zap } from "lucide-react";
export const timerStops = [0,3,5,10] as const;
export type TimerSeconds = typeof timerStops[number];
export const filmPresets = ["Classic","B&W","Film Grain","Faded"] as const;
export type FilmPreset = typeof filmPresets[number];
export const isoStops = [100,200,400,800,1600,3200] as const;
export type CameraISO = typeof isoStops[number];
export type CameraPreferences = { seconds:TimerSeconds; preset:FilmPreset; flash:boolean; iso?:CameraISO };

export function CameraReadout({seconds,preset,iso=800}:Pick<CameraPreferences,"seconds"|"preset"|"iso">) {
  return <div className="viewfinder-readout" aria-label="Camera settings">
    <span>ISO <b>{iso}</b></span><span>Film <b>{preset}</b></span><span>Timer <b>{seconds?`${seconds}s`:"Off"}</b></span>
  </div>;
}

export default function CameraSettings({seconds,onSeconds,preset,onPreset,flash,onFlash,iso,onISO,disabled}: {
  seconds:TimerSeconds;onSeconds:(value:TimerSeconds)=>void;preset:FilmPreset;onPreset:(value:FilmPreset)=>void;
  flash:boolean;onFlash:(value:boolean)=>void;iso:CameraISO;onISO:(value:CameraISO)=>void;disabled:boolean;
}) {
  return <div className="camera-settings">
    <div className="camera-dials">
    <fieldset className="timer-control" disabled={disabled}><legend>Self timer</legend>
      <div className="timer-dial"><i className="timer-pointer" aria-hidden="true"/><div className="timer-rotor"><i className="dial-hub" aria-hidden="true"/>
        {timerStops.map((value,index)=><button key={value} type="button" className={`timer-stop stop-${index}`} aria-label={value?`Timer ${value} seconds`:"Timer off"} aria-pressed={seconds===value} onClick={()=>onSeconds(value)}><span>{value?`${value}s`:"OFF"}</span></button>)}
      </div>
      </div>
    </fieldset>
    <fieldset className="iso-control" disabled={disabled}><legend>ISO effect</legend>
      <div className="iso-dial"><i className="timer-pointer" aria-hidden="true"/>
        <div className="iso-markings" aria-hidden="true">{isoStops.map((value,index)=>{
          const angle=(index-isoStops.indexOf(iso))*Math.PI/3;
          return <span key={value} style={{transform:`translate(${Math.sin(angle)*43}px,${-Math.cos(angle)*43}px)`,color:value===iso?"#ffdb98":undefined}}>{value}</span>;
        })}</div>
        <select aria-label="ISO effect" value={iso} onChange={e=>onISO(Number(e.target.value) as CameraISO)}>{isoStops.map(value=><option key={value} value={value}>{value}</option>)}</select>
        <ChevronDown className="iso-chevron" size={12} aria-hidden="true"/>
      </div>
    </fieldset>
    </div>
    <fieldset className="film-presets" disabled={disabled}><legend>Film presets</legend>{filmPresets.map((value,index)=><button key={value} type="button" aria-pressed={preset===value} onClick={()=>onPreset(value)}><i className={`film-cartridge cartridge-${index}`} aria-hidden="true"/><span>{value}</span></button>)}</fieldset>
    <div className="flash-control"><span>Flash</span><div className="flash-toggle"><span className="flash-position" aria-hidden="true">On</span><button type="button" className="flash-switch" role="switch" aria-label="Flash effect" aria-checked={flash} disabled={disabled} onClick={()=>onFlash(!flash)}><i className="flash-lever" aria-hidden="true"/><Zap size={16}/><i className="flash-led" aria-hidden="true"/></button><span className="flash-position" aria-hidden="true">Off</span></div></div>
  </div>;
}
