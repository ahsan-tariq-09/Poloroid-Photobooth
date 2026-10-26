import { useEffect, useRef } from "react";
import { type Asset, type Composition, type Layer } from "../model";
import { renderComposition } from "../render";

export default function LayerThumbnail({asset, layer, effects}: {
  asset: Asset; layer: Layer; effects: Composition["effects"];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const signature = JSON.stringify([layer.width, layer.height, layer.source, layer.crop, layer.mask, layer.opacity, effects]);
  useEffect(() => {
    let cancelled = false;
    const piece = {...layer, x: 0, y: 0, rotation: 0};
    const composition: Composition = {layers: [piece], effects, caption: "", frameColor: "transparent"};
    const offscreen = document.createElement("canvas");
    void renderComposition(offscreen, {[layer.assetId!]: asset}, composition,
      {x: 0, y: 0, width: layer.width, height: layer.height}, 32 / Math.max(layer.width, layer.height))
      .then(() => {
        if (cancelled || !ref.current) return;
        ref.current.width = 32; ref.current.height = 32;
        ref.current.getContext("2d")!.drawImage(offscreen, (32 - offscreen.width) / 2, (32 - offscreen.height) / 2);
      }).catch(() => {});
    return () => {cancelled = true;};
  }, [asset, signature]);
  return <canvas ref={ref} width={32} height={32} aria-hidden="true"/>;
}
