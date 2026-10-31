import type { ReactNode, RefObject } from "react";
import { ImagePlus, RefreshCw } from "lucide-react";
import InstantCamera from "./InstantCamera";

/** The full-screen camera keeps the same housing and paper outlet as the desktop. */
export default function MobileCameraScreen({ containerRef, navigation, viewfinder, settings, print, decisions, flash,
  captured, disabled, taking, loading, loaded, status, notice, retry, onRoll, onShutter, onFlip, onUpload }: {
  containerRef: RefObject<HTMLDivElement | null>;
  navigation?: ReactNode; viewfinder: ReactNode; settings: ReactNode; print: ReactNode;
  decisions: ReactNode; flash: ReactNode; retry: ReactNode;
  captured: boolean; disabled: boolean; taking: boolean; loading: boolean; loaded: boolean; status: string; notice: string;
  onRoll: () => void; onShutter: () => void; onFlip: () => void; onUpload: () => void;
}) {
  return <main className={`mobile-camera ${captured ? "has-print" : ""}`}>
    <h1 className="sr-only">roid instant camera</h1>
    <div className="mobile-camera-body" ref={containerRef} tabIndex={-1}>
      {notice && <div className="mobile-camera-recovery"><p role="status">{notice}</p>{retry}</div>}
      <InstantCamera printed={captured} print={print} settings={settings}
        navigation={<nav aria-label="Camera navigation">{navigation}<button onClick={onUpload} disabled={taking} aria-label="Upload photos"><ImagePlus size={20}/></button></nav>}
        onRoll={onRoll} rollDisabled={taking || loading} loaded={loaded} loading={loading}
        onShutter={onShutter} disabled={disabled} label="Capture" status={status}
        controls={<button className="camera-flip" onClick={onFlip} disabled={taking || loading || captured} aria-label="Flip camera"><RefreshCw size={20}/></button>}>
        {viewfinder}
      </InstantCamera>
      {decisions}
      {flash}
    </div>
  </main>;
}
