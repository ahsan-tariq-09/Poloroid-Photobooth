import { Zap } from "lucide-react";
export const timerStops = [0,3,5,10] as const;
export type TimerSeconds = typeof timerStops[number];
export const filmPresets = ["Classic","B&W","Film Grain","Faded"] as const;
export type FilmPreset = typeof filmPresets[number];

export default function CameraSettings({seconds,onSeconds,preset,onPreset,flash,onFlash,disabled}: {
  seconds:TimerSeconds;onSeconds:(value:TimerSeconds)=>void;preset:FilmPreset;onPreset:(value:FilmPreset)=>void;
  flash:boolean;onFlash:(value:boolean)=>void;disabled:boolean;
}) {
  return <div className="camera-settings">
    <fieldset className="timer-control" disabled={disabled}><legend>Self timer</legend>
      <div className="timer-dial"><i className="timer-pointer" aria-hidden="true"/><div className="timer-rotor" style={{transform:`rotate(${-timerStops.indexOf(seconds)*90}deg)`}}><i className="dial-hub" aria-hidden="true"/>
        {timerStops.map((value,index)=><button key={value} type="button" className={`timer-stop stop-${index}`} aria-label={value?`Timer ${value} seconds`:"Timer off"} aria-pressed={seconds===value} onClick={()=>onSeconds(value)}><span style={{transform:`rotate(${timerStops.indexOf(seconds)*90}deg)`}}>{value?`${value}s`:"OFF"}</span></button>)}
      </div>
      </div><span className="hardware-value">{seconds?`${seconds} seconds`:"No delay"}</span>
    </fieldset>
    <fieldset className="film-presets" disabled={disabled}><legend>Film presets</legend>{filmPresets.map((value,index)=><button key={value} type="button" aria-pressed={preset===value} onClick={()=>onPreset(value)}><i className={`film-cartridge cartridge-${index}`} aria-hidden="true"/><span>{value}</span></button>)}</fieldset>
    <div className="flash-control"><span>Flash</span><div className="flash-toggle"><span className="flash-position" aria-hidden="true">On</span><button type="button" className="flash-switch" role="switch" aria-label="Flash effect" aria-checked={flash} disabled={disabled} onClick={()=>onFlash(!flash)}><i className="flash-lever" aria-hidden="true"/><Zap size={16}/><i className="flash-led" aria-hidden="true"/></button><span className="flash-position" aria-hidden="true">Off</span></div></div>
  </div>;
}
