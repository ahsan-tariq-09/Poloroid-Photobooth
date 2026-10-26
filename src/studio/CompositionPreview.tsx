import { useEffect, useRef, useState } from "react";
import { FRAME, type Assets, type Composition } from "../model";
import { renderComposition } from "../render";

// Render into an isolated canvas first, so a slow previous render cannot overwrite a new one.
export default function CompositionPreview({
  assets,
  composition,
  label,
  scale = 1,
}: {
  assets: Assets;
  composition: Composition;
  label: string;
  scale?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  const region = FRAME;
  useEffect(() => {
    let cancelled = false;
    setError(false);
    const offscreen = document.createElement("canvas");
    void renderComposition(
      offscreen,
      assets,
      composition,
      FRAME,
      scale,
    )
      .then(() => {
        if (cancelled || !ref.current) return;
        ref.current.width = offscreen.width;
        ref.current.height = offscreen.height;
        ref.current.getContext("2d")!.drawImage(offscreen, 0, 0);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [assets, composition, scale]);
  return (
    <div
      className="composition-preview"
      style={{ aspectRatio: `${region.width}/${region.height}` }}
    >
      <canvas ref={ref} role="img" aria-label={label} />
      {error && (
        <p role="status">
          Preview unavailable. Try opening the example or returning to editing.
        </p>
      )}
    </div>
  );
}
