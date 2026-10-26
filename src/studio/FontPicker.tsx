import { useEffect, useState } from "react";
import { fontFamily, fonts, loadFont } from "../fonts";

export default function FontPicker({value = "studio", onChange, label = "Font", sample = "The coast is calling.", bold, italic}: {
  value?: string; onChange: (id: string) => void; label?: string; sample?: string; bold?: boolean; italic?: boolean;
}) {
  const [status, setStatus] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    setStatus(value === "studio" ? "" : "Loading font…");
    loadFont(value, sample, {bold, italic}).then(() => { if(alive) setStatus(""); }, error => {if(alive) setStatus(error.message);});
    return () => {alive = false;};
  }, [value, sample, bold, italic, retry]);
  const failed = status.includes("could not load");
  return <div className="font-picker">
    <label className="field">{label}
      <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>
        {["Sans serif", "Serif", "Display", "Handwriting", "Monospace"].map(group => <optgroup key={group} label={group}>
          {fonts.filter(f => f.group === group).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </optgroup>)}
      </select>
    </label>
    <p className="font-specimen" style={{fontFamily: fontFamily(value), fontWeight: bold ? 700 : 400, fontStyle: italic ? "italic" : "normal", fontSynthesis: "weight style"}} aria-hidden="true">{sample || "Your words here"}</p>
    <p className="font-status" role="status" aria-live="polite">{status || "30 fonts · Google Fonts + Font Library"}</p>
    {failed && <div className="font-recovery"><button className="text-button" onClick={() => {onChange(value); setRetry(n => n + 1);}}>Retry font</button><button className="text-button" onClick={() => onChange("studio")}>Use Studio sans</button></div>}
  </div>;
}
