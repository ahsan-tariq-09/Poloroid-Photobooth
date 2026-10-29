import type { ReactNode } from "react";
import { Camera, RotateCw } from "lucide-react";

/** Shared housing for the demo and the live camera. */
export default function InstantCamera({ children, onShutter, disabled, label = "Take a photo", status = "OPEN VIEWFINDER", controls, onRoll, rollDisabled, loaded = false, loading = false, print, printed = false, settings }: {
  children: ReactNode; onShutter?: () => void; disabled?: boolean;
  label?: string; status?: string; controls?: ReactNode;
  onRoll: () => void; rollDisabled?: boolean; loaded?: boolean; loading?: boolean;
  print?: ReactNode; printed?: boolean;
  settings?: ReactNode;
}) {
  return <div className={`camera-assembly ${printed?"has-print":""}`}><div className="instant-camera">
    <div className="camera-nameplate"><span>roid <small>beta</small></span><span className="camera-indicator">INSTANT<br/>COLOR</span></div>
    <div className="viewfinder-bezel"><i className="camera-screw screw-tl" aria-hidden="true"/><i className="camera-screw screw-tr" aria-hidden="true"/><i className="camera-screw screw-bl" aria-hidden="true"/><i className="camera-screw screw-br" aria-hidden="true"/><div className="camera-display">{children}<div className="viewfinder-corners" aria-hidden="true"/><span className="viewfinder-status">{status}</span></div></div>
    {!printed&&settings}
    <div className="camera-hardware">
      <div className="hardware-control"><button type="button" className={`film-roll ${loading?"film-loading":""} ${!loaded&&!printed?"roll-needed":""}`} aria-label="Roll film" aria-busy={loading} aria-pressed={loaded} disabled={rollDisabled} onClick={onRoll}><RotateCw size={23}/></button><span>{loading?"LOADING FILM":loaded?"FILM LOADED":printed?"ROLL AGAIN":"ROLL FILM"}</span></div>
      <div className="camera-hardware-copy"><div className="camera-center-control">{controls||<span className="film-stripes" aria-hidden="true"><i/><i/><i/></span>}</div><span>Made to keep.</span></div>
      <div className="hardware-control shutter-control"><button type="button" className={`shutter ${loaded&&!printed&&!disabled?"shutter-ready":""}`} aria-label={label} disabled={disabled} onClick={onShutter}><Camera size={26} strokeWidth={2}/></button></div>
    </div><div className="ejection-slot" aria-hidden="true"/>
  </div>{print}</div>;
}
