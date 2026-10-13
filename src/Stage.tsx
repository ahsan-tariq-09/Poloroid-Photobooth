import { useEffect, useRef, useState, type PointerEvent } from "react";
import { animate, motion, type AnimationPlaybackControls } from "motion/react";
import { paintComposition, texture } from "./render";
import {
  bounds,
  hitTest,
  localPoint,
  type Asset,
  type Composition,
  type Tool,
} from "./model";
import {
  detectCut,
  layerPose,
  pointerInComposition,
  type CutFeedback,
  type Presentation,
} from "./presentation";

export default function Stage({
  asset,
  composition,
  selected,
  tool,
  axis,
  enabled,
  onDown,
  onMove,
  onUp,
  onError,
}: {
  asset: Asset;
  composition: Composition;
  selected: string | null;
  tool: Tool;
  axis: "horizontal" | "vertical";
  enabled: boolean;
  onDown: (x: number, y: number, id?: string) => string | null;
  onMove: (x: number, y: number) => void;
  onUp: () => void;
  onError: (message: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null),
    version = useRef(0);
  const photo = useRef<{ asset: Asset; canvas: HTMLCanvasElement } | null>(
    null,
  );
  const [ready, setReady] = useState(0),
    [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [presentation, setPresentation] = useState<Presentation>({
    development: enabled ? 0 : 1,
    layers: {},
  });
  const presentationRef = useRef(presentation);
  const [cut, setCut] = useState<(CutFeedback & { progress: number }) | null>(
    null,
  );
  const [dragged, setDragged] = useState<string | null>(null);
  const animations = useRef(new Map<string, AnimationPlaybackControls>());
  const developed = useRef<Asset | null>(null),
    previous = useRef({ asset, composition });
  const update = (fn: (value: Presentation) => Presentation) => {
    const next = fn(presentationRef.current);
    presentationRef.current = next;
    setPresentation(next);
  };
  const run = (
    key: string,
    from: number,
    to: number,
    duration: number,
    onUpdate: (v: number) => void,
    spring = false,
  ) => {
    animations.current.get(key)?.stop();
    const controls = animate(from, to, {
      ...(spring
        ? { type: "spring", stiffness: 360, damping: 27 }
        : { duration, ease: "easeOut" }),
      onUpdate,
      onComplete: () => animations.current.delete(key),
    });
    animations.current.set(key, controls);
  };
  const lift = (id: string, value: number) => {
    if (!enabled) return;
    run(
      `lift-${id}`,
      presentationRef.current.layers?.[id]?.lift || 0,
      value,
      0.24,
      (v) =>
        update((p) => ({
          ...p,
          layers: { ...p.layers, [id]: { ...p.layers?.[id], lift: v } },
        })),
      true,
    );
  };
  const extent = bounds(composition);
  const region = {
    x: Math.min(-35, extent.x - 24),
    y: Math.min(0, extent.y - 24),
    width:
      Math.max(635, extent.x + extent.width + 24) -
      Math.min(-35, extent.x - 24),
    height:
      Math.max(710, extent.y + extent.height + 24) - Math.min(0, extent.y - 24),
  };
  const heldRegion = useRef<typeof region | null>(null),
    view = heldRegion.current || region;
  const pointerOffset = useRef({ x: 0, y: 0 });
  const textureSignature = JSON.stringify([
    composition.crop,
    composition.effects,
  ]);

  useEffect(() => {
    const ticket = ++version.current;
    if (photo.current?.asset !== asset) photo.current = null;
    Promise.all([texture(asset, composition, 1.5), document.fonts.ready])
      .then(([bitmap]) => {
        if (ticket !== version.current) return;
        photo.current = { asset, canvas: bitmap };
        setReady((v) => v + 1);
        if (developed.current !== asset) {
          developed.current = asset;
          if (enabled) {
            update((p) => ({ ...p, development: 0 }));
            run("development", 0, 1, 2, (v) =>
              update((p) => ({ ...p, development: v })),
            );
          } else update((p) => ({ ...p, development: 1 }));
        }
      })
      .catch((error) => {
        if (ticket === version.current)
          onError(
            error instanceof Error
              ? error.message
              : "Could not render your photograph.",
          );
      });
    return () => {
      version.current++;
    };
  }, [asset, textureSignature, onError]);

  useEffect(() => {
    if (document.hidden || photo.current?.asset !== asset || !canvasRef.current)
      return;
    paintComposition(
      canvasRef.current,
      photo.current.canvas,
      composition,
      view,
      1.5,
      presentation,
    );
  }, [
    asset,
    composition,
    presentation,
    ready,
    view.x,
    view.y,
    view.width,
    view.height,
    enabled,
  ]);

  useEffect(() => {
    if (previous.current.asset !== asset) {
      animations.current.forEach((a) => a.stop());
      animations.current.clear();
      developed.current = null;
      photo.current = null;
      setDragged(null);
      heldRegion.current = null;
      setCut(null);
      update(() => ({ development: enabled ? 0 : 1, layers: {} }));
      previous.current = { asset, composition };
      return;
    }
    const old = previous.current.composition;
    previous.current = { asset, composition };
    if (!enabled) return;
    const oldIds = new Set(old.layers.map((l) => l.id)),
      newIds = new Set(composition.layers.map((l) => l.id));
    if (
      Object.keys(presentationRef.current.layers || {}).some(
        (id) => !newIds.has(id),
      )
    )
      update((p) => ({
        ...p,
        layers: Object.fromEntries(
          Object.entries(p.layers || {}).filter(([id]) => newIds.has(id)),
        ),
      }));
    for (const [key, animation] of animations.current) {
      if (
        key !== "development" &&
        key !== "cut" &&
        !newIds.has(key.replace(/^(arrival|lift)-/, ""))
      ) {
        animation.stop();
        animations.current.delete(key);
      }
    }
    const feedback = detectCut(old, composition);
    const added = composition.layers.filter((l) => !oldIds.has(l.id));
    if (feedback) {
      setCut({ ...feedback, progress: 0 });
      run("cut", 0, 1, 0.65, (v) =>
        setCut(v < 1 ? { ...feedback, progress: v } : null),
      );
    }
    for (const l of added) {
      const side = feedback?.ids.indexOf(l.id),
        direction = side === 0 ? -1 : 1;
      update((p) => ({
        ...p,
        layers: {
          ...p.layers,
          [l.id]: {
            arrival: 0,
            cutX: feedback ? feedback.dx * direction : 0,
            cutY: feedback ? feedback.dy * direction : undefined,
          },
        },
      }));
      run(
        `arrival-${l.id}`,
        0,
        1,
        0.45,
        (v) =>
          update((p) => ({
            ...p,
            layers: {
              ...p.layers,
              [l.id]: { ...p.layers?.[l.id], arrival: v },
            },
          })),
        true,
      );
    }
  }, [asset, composition, enabled]);

  useEffect(() => {
    if (!enabled) {
      animations.current.forEach((a) => a.stop());
      animations.current.clear();
      developed.current = asset;
      update(() => ({ development: 1, layers: {} }));
      setCut(null);
    }
  }, [enabled, asset]);
  useEffect(
    () => () => {
      animations.current.forEach((a) => a.stop());
      animations.current.clear();
    },
    [],
  );

  const point = (event: PointerEvent<SVGSVGElement>) => {
    const matrix = event.currentTarget.getScreenCTM();
    if (matrix) {
      const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        matrix.inverse(),
      );
      return { x: p.x, y: p.y };
    }
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: view.x + ((event.clientX - rect.left) / rect.width) * view.width,
      y: view.y + ((event.clientY - rect.top) / rect.height) * view.height,
    };
  };
  const poses = composition.layers.map((l) =>
    layerPose(l, presentation.layers?.[l.id]),
  );
  const layer = poses.find((l) => l.id === selected),
    hovering = layer && hover ? localPoint(layer, hover.x, hover.y) : null;
  const canCut =
    tool === "cut" &&
    layer?.kind === "photo" &&
    hovering &&
    hovering.x >= 0 &&
    hovering.y >= 0 &&
    hovering.x <= layer.width &&
    hovering.y <= layer.height;
  const release = () => {
    if (dragged) lift(dragged, 0);
    setDragged(null);
    onUp();
    heldRegion.current = null;
    pointerOffset.current = { x: 0, y: 0 };
  };
  return (
    <motion.div
      className={`artboard tool-${tool} ${dragged ? "is-dragging" : ""}`}
      style={{ aspectRatio: `${view.width}/${view.height}`, rotate: -3 }}
      initial={enabled ? { y: 65, opacity: 0 } : false}
      animate={enabled ? "visible" : "still"}
      variants={{
        visible: {
          y: 0,
          opacity: 1,
          transition: { type: "spring", stiffness: 130, damping: 20 },
        },
        still: { y: 0, opacity: 1, transition: { duration: 0 } },
      }}
    >
      <canvas
        ref={canvasRef}
        aria-label="Your Polaroid composition"
        role="img"
      />
      <svg
        className="interaction"
        tabIndex={0}
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        aria-label="Drag your photo and collage pieces; use arrow keys to nudge the selected piece"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          heldRegion.current = view;
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.focus();
          const p = point(e),
            pose = hitTest(poses, p.x, p.y),
            stored = composition.layers.find((l) => l.id === pose?.id);
          const mapped =
            pose && stored ? pointerInComposition(stored, pose, p.x, p.y) : p;
          pointerOffset.current = { x: mapped.x - p.x, y: mapped.y - p.y };
          const id = onDown(mapped.x, mapped.y, pose?.id);
          if (id) {
            setDragged(id);
            lift(id, 1);
          }
        }}
        onPointerMove={(e) => {
          const p = point(e);
          setHover(p);
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            onMove(
              p.x + pointerOffset.current.x,
              p.y + pointerOffset.current.y,
            );
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={() => setHover(null)}
      >
        {layer && tool !== "crop" && (
          <g
            transform={`translate(${layer.x + layer.width / 2} ${layer.y + layer.height / 2}) rotate(${layer.rotation}) translate(${-layer.width / 2} ${-layer.height / 2})`}
          >
            <rect
              x="-3"
              y="-3"
              width={layer.width + 6}
              height={layer.height + 6}
              className="selection"
            />
            {[
              [0, 0],
              [layer.width, 0],
              [0, layer.height],
              [layer.width, layer.height],
            ].map(([x, y], i) => (
              <rect
                key={i}
                x={x - 4}
                y={y - 4}
                width="8"
                height="8"
                className="handle"
              />
            ))}
            {canCut && (
              <line
                x1={axis === "vertical" ? hovering!.x : 0}
                x2={axis === "vertical" ? hovering!.x : layer.width}
                y1={axis === "horizontal" ? hovering!.y : 0}
                y2={axis === "horizontal" ? hovering!.y : layer.height}
                className="cut-guide"
              />
            )}
          </g>
        )}
        {cut && (
          <line
            x1={cut.x1}
            y1={cut.y1}
            x2={cut.x1 + (cut.x2 - cut.x1) * Math.min(1, cut.progress * 4)}
            y2={cut.y1 + (cut.y2 - cut.y1) * Math.min(1, cut.progress * 4)}
            opacity={1 - cut.progress}
            className="cut-feedback"
          />
        )}
      </svg>
      {enabled && (presentation.development ?? 1) < 0.98 && (
        <div className="developing-label" role="status">
          DEVELOPING A LITTLE MEMORY…
        </div>
      )}
    </motion.div>
  );
}
