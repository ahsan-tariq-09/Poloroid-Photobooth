import { Bold, Italic } from "lucide-react";
import NumericInput from "./NumericInput";

export default function TextFormatting({label, size, bold, italic, max = 160, onChange}: {
  label: "Text" | "Caption";
  size: number;
  bold?: boolean;
  italic?: boolean;
  max?: number;
  onChange: (change: {fontSize?: number; bold?: boolean; italic?: boolean}) => void;
}) {
  return <div className="text-formatting" role="group" aria-label={`${label} formatting`}>
    <label className="field">Font size <span className="font-size-input">
      <NumericInput label={`${label} font size`} value={size} min={8} max={max} onCommit={fontSize => onChange({fontSize})}/>
      <span aria-hidden="true">px</span>
    </span></label>
    <button type="button" aria-label={`${label} bold`} aria-pressed={!!bold} onClick={() => onChange({bold: !bold})}>
      <Bold size={17} aria-hidden="true"/> Bold
    </button>
    <button type="button" aria-label={`${label} italic`} aria-pressed={!!italic} onClick={() => onChange({italic: !italic})}>
      <Italic size={17} aria-hidden="true"/> Italic
    </button>
  </div>;
}
