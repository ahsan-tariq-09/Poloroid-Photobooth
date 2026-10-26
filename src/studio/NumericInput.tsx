import { useEffect, useRef, useState } from "react";

export default function NumericInput({ value, min, max, label, onCommit }: {
  value: number; min: number; max: number; label: string;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(Math.round(value)));
  const editing = useRef(false);
  const cancelled = useRef(false);
  const latestValue = useRef(value);
  latestValue.current = value;
  useEffect(() => { if (!editing.current) setDraft(String(Math.round(value))); }, [value]);
  const commit = () => {
    editing.current = false;
    if (cancelled.current) {cancelled.current = false; setDraft(String(Math.round(value))); return;}
    const parsed = Number(draft);
    if (!draft.trim() || !Number.isFinite(parsed)) { setDraft(String(Math.round(value))); return; }
    const next = Math.max(min, Math.min(max, parsed));
    setDraft(String(next));
    onCommit(next);
    // A composition-level limit may reject an otherwise valid individual field.
    requestAnimationFrame(() => { if (!editing.current) setDraft(String(Math.round(latestValue.current))); });
  };
  return <input type="number" aria-label={label} min={min} max={max} value={draft}
    onFocus={() => { editing.current = true; }}
    onChange={e => setDraft(e.target.value)} onBlur={commit}
    onKeyDown={e => {
      if (e.key === "Enter") e.currentTarget.blur();
      if (e.key === "Escape") {cancelled.current = true; e.currentTarget.blur();}
    }} />;
}
