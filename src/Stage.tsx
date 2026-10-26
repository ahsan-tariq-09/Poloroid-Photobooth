import { useEffect, useRef, useState, type MouseEvent } from "react";
import { animate, motion, type AnimationPlaybackControls } from "motion/react";
import { paintComposition, prepareTextures, type Textures } from "./render";
import { loadCompositionFonts } from "./fonts";
import { pieceHandles } from "./handles";
import {
  WORKSPACE,
  clone,
  cropLayer,
  hitTest,
  localPoint,
  worldPoint,
  shapePath,
  type Assets,
  type Composition,
  type Layer,
  type Point,
  type Tool,
} from "./model";
import {
  layerPose,
  pointerInComposition,
  type Presentation,
} from "./presentation";

const arrowDirections: Record<string, Point> = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};

export function resizeBox(
  layer: Layer,
  p: { x: number; y: number },
  corner: string,
): Layer {
  let left = 0,
    top = 0,
    right = layer.width,
    bottom = layer.height;
  if (corner.includes("w")) left = Math.min(layer.width - 12, p.x);
  else right = Math.max(12, p.x);
  if (corner.includes("n")) top = Math.min(layer.height - 12, p.y);
  else bottom = Math.max(12, p.y);
  const width = right - left,
    height = bottom - top,
    center = worldPoint(layer, left + width / 2, top + height / 2);
  return {
    ...layer,
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
  };
}
type Gesture = {
  original: Composition;
  layer: Layer;
  point: { x: number; y: number };
  offset: { x: number; y: number };
  mode: string;
  corner: string;
  points: Point[];
  handleOffset: {x: number; y: number};
};
export default function Stage({
  assets,
  composition,
  selected,
  tool,
  cutMode,
  enabled,
  grid,
  onSelect,
  onChange,
  onRepeat,
  onCut,
  onGrid,
  onError,
  menuOpen = false,
}: {
  assets: Assets;
  composition: Composition;
  selected: string | null;
  tool: Tool;
  cutMode: "straight" | "freehand";
  enabled: boolean;
  grid?: Layer;
  onSelect: (id: string | null) => void;
  onChange: (value: Composition, final: boolean) => void;
  onRepeat: (id: string) => void;
  onCut: (id: string, points: Point[]) => void;
  onGrid: (value: Layer, final: boolean) => void;
  onError: (message: string) => void;
  menuOpen?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    version = useRef(0),
    photos = useRef<Textures>({}),
    gesture = useRef<Gesture | null>(null),
    pending = useRef<Composition | null>(null);
  const [ready, setReady] = useState(0),
    [presentation, setPresentation] = useState<Presentation>({
      development: enabled ? 0 : 1,
      layers: {},
    });
  const [screenScale, setScreenScale] = useState(1);
  useEffect(() => {
    const element = canvas.current?.parentElement;
    if (!element) return;
    const measure = () => setScreenScale(element.getBoundingClientRect().width / WORKSPACE.width || 1);
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const presentationRef = useRef(presentation),
    controllers = useRef(new Map<string, AnimationPlaybackControls>());
  const [box, setBox] = useState<Layer | null>(null),
    [stroke, setStroke] = useState<Point[]>([]),
    [seam, setSeam] = useState<Point[]>([]);
  const first = useRef(true),
    previous = useRef(new Set<string>()),
    seenAssets = useRef(new Set<string>());
  const signature = JSON.stringify([
    composition.effects,
    composition.captionFont,
    composition.captionBold, composition.captionItalic,
    composition.layers.filter(l => l.kind === "text").map(l => [l.id, l.fontId, l.text, l.bold, l.italic]),
    composition.layers
      .filter((l) => l.kind === "photo")
      .map((l) => [l.id, l.assetId, l.crop]),
  ]);
  function update(fn: (p: Presentation) => Presentation) {
    presentationRef.current = fn(presentationRef.current);
    setPresentation(presentationRef.current);
  }
  function run(
    key: string,
    from: number,
    to: number,
    duration: number,
    change: (v: number) => void,
    spring = false,
  ) {
    controllers.current.get(key)?.stop();
    controllers.current.set(
      key,
      animate(from, to, {
        ...(spring
          ? { type: "spring", stiffness: 360, damping: 27 }
          : { duration, ease: "easeOut" }),
        onUpdate: change,
        onComplete: () => controllers.current.delete(key),
      }),
    );
  }
  function lift(id: string, value: number) {
    if (enabled)
      run(
        "lift-" + id,
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
  }
  useEffect(() => {
    const ticket = ++version.current;
    void Promise.all([
      prepareTextures(assets, composition, 1.5),
      loadCompositionFonts(composition),
    ])
      .then(([textures]) => {
        if (ticket !== version.current) return;
        photos.current = textures;
        setReady((v) => v + 1);
        if (first.current) {
          first.current = false;
          if (enabled)
            run("develop", 0, 1, 1.1, (v) =>
              update((p) => ({ ...p, development: v })),
            );
          else update((p) => ({ ...p, development: 1 }));
        }
      })
      .catch((e) => {
        if (ticket === version.current)
          onError(
            e instanceof Error ? e.message : "Could not render this collage.",
          );
      });
    return () => {
      version.current++;
    };
  }, [assets, signature, onError]);
  useEffect(() => {
    const ids = new Set(composition.layers.map((l) => l.id));
    if (enabled)
      for (const l of composition.layers)
        if (!previous.current.has(l.id) && previous.current.size) {
          const developing =
            l.kind === "photo" && !seenAssets.current.has(l.assetId!);
          update((p) => ({
            ...p,
            layers: {
              ...p.layers,
              [l.id]: { arrival: 0, development: developing ? 0 : 1 },
            },
          }));
          if (developing)
            run("development-" + l.id, 0, 1, 1.1, (v) =>
              update((p) => ({
                ...p,
                layers: {
                  ...p.layers,
                  [l.id]: { ...p.layers?.[l.id], development: v },
                },
              })),
            );
          run(
            "arrival-" + l.id,
            0,
            1,
            0.4,
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
    for (const [key, c] of controllers.current)
      if (
        key !== "develop" &&
        !ids.has(key.replace(/^(arrival|lift|development)-/, ""))
      ) {
        c.stop();
        controllers.current.delete(key);
      }
    update((p) => ({
      ...p,
      layers: Object.fromEntries(
        Object.entries(p.layers || {}).filter(([id]) => ids.has(id)),
      ),
    }));
    previous.current = ids;
    composition.layers.forEach((l) => {
      if (l.assetId) seenAssets.current.add(l.assetId);
    });
  }, [composition.layers, enabled]);
  useEffect(() => {
    if (!enabled) {
      controllers.current.forEach((c) => c.stop());
      controllers.current.clear();
      update(() => ({ development: 1, layers: {} }));
      setSeam([]);
    }
  }, [enabled]);
  useEffect(
    () => () => {
      controllers.current.forEach((c) => c.stop());
      controllers.current.clear();
    },
    [],
  );
  useEffect(() => {
    const redraw = () => setReady(v => v + 1);
    document.fonts?.addEventListener?.("loadingdone", redraw);
    return () => document.fonts?.removeEventListener?.("loadingdone", redraw);
  }, []);
  useEffect(() => {
    if (!document.hidden && canvas.current)
      paintComposition(
        canvas.current,
        photos.current,
        composition,
        WORKSPACE,
        1.5,
        presentation,
      );
  }, [composition, presentation, ready, enabled]);
  useEffect(() => {
    gesture.current = null;
    pending.current = null;
    setBox(null);
    setStroke([]);
    if (menuOpen) {
      controllers.current.forEach((controller, key) => {
        if (key.startsWith("lift-")) controller.stop();
      });
      update((p) => ({
        ...p,
        layers: Object.fromEntries(
          Object.entries(p.layers || {}).map(([id, value]) => [
            id,
            { ...value, lift: 0 },
          ]),
        ),
      }));
    }
  }, [tool, cutMode, menuOpen]);
  const poses = composition.layers.map((l) =>
    layerPose(l, presentation.layers?.[l.id]),
  );
  const target = box || grid || poses.find((l) => l.id === selected),
    active = gesture.current;
  const handles = target ? pieceHandles(target, screenScale) : null;
  const point = (event: MouseEvent<SVGSVGElement>) => {
    const matrix = event.currentTarget.getScreenCTM();
    if (matrix) {
      const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        matrix.inverse(),
      );
      return { x: p.x, y: p.y };
    }
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x:
        WORKSPACE.x +
        ((event.clientX - rect.left) / rect.width) * WORKSPACE.width,
      y:
        WORKSPACE.y +
        ((event.clientY - rect.top) / rect.height) * WORKSPACE.height,
    };
  };
  const finish = (cancel = false) => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    if (g.mode === "cut") {
      if (!cancel) {
        onCut(g.layer.id, g.points);
        setSeam(
          g.points.map((p) => {
            const v = worldPoint(g.layer, ...p);
            return [v.x, v.y];
          }),
        );
      }
    } else if (g.mode === "grid" || g.mode === "grid-resize") {
      if (cancel) onGrid(g.layer, true);
      else if (box) onGrid(box, true);
    } else if (pending.current) {
      onChange(cancel ? g.original : pending.current, true);
    }
    lift(g.layer.id, 0);
    pending.current = null;
    setBox(null);
    setStroke([]);
  };
  return (
    <motion.div
      className={"artboard tool-" + tool + (active ? " is-dragging" : "")}
      style={{
        aspectRatio: WORKSPACE.width + "/" + WORKSPACE.height,
      }}
      initial={enabled ? { y: 18, opacity: 0 } : false}
      animate={{ y: 0, opacity: 1 }}
      transition={
        enabled
          ? { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
          : { duration: 0 }
      }
    >
      <canvas ref={canvas} aria-label="Your Polaroid composition" role="img" />
      <svg
        className="interaction"
        tabIndex={0}
        viewBox={
          WORKSPACE.x +
          " " +
          WORKSPACE.y +
          " " +
          WORKSPACE.width +
          " " +
          WORKSPACE.height
        }
        aria-label="Polaroid editor. Select pieces, drag handles to resize, or draw a cut. Arrow keys move the selected piece; hold Shift to move 10 pixels."
        onKeyDown={e => {
          if (menuOpen || gesture.current || e.altKey || e.ctrlKey || e.metaKey) return;
          const direction = arrowDirections[e.key];
          if (!direction) return;
          const stored = grid && tool === "repeat" ? grid : composition.layers.find(l => l.id === selected);
          if (!stored) return;
          e.preventDefault();
          const amount = e.shiftKey ? 10 : 1;
          const moved = {...stored, x: stored.x + direction[0] * amount, y: stored.y + direction[1] * amount};
          if (grid && tool === "repeat") onGrid(moved, true);
          else {const next = clone(composition); next.layers = next.layers.map(l => l.id === stored.id ? moved : l); onChange(next, true);}
        }}
        onDragStart={(e) => e.preventDefault()}
        onContextMenu={(e) => {
          finish(true);
          const p = point(e);
          onSelect(hitTest(poses, p.x, p.y)?.id || null);
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 || menuOpen) return;
          const p = point(e),
            handle = (e.target as SVGElement).getAttribute("data-handle") || "";
          const photosOnly =
            tool === "cut" || tool === "crop" || tool === "repeat";
          const pose =
            handle && target
              ? target
              : hitTest(poses, p.x, p.y, photosOnly) ||
                (tool === "cut" && target?.kind === "photo"
                  ? target
                  : undefined);
          if (!pose) {
            onSelect(null);
            return;
          }
          const stored =
            grid && tool === "repeat"
              ? grid
              : composition.layers.find((l) => l.id === pose.id)!;
          if (tool === "repeat" && !grid) {
            onSelect(stored.id);
            onRepeat(stored.id);
            return;
          }
          // Stop mouse text-dragging without suppressing the touch/pen menu timer.
          if (e.pointerType !== "touch" && e.pointerType !== "pen")
            e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.focus({ preventScroll: true });
          // Handle coordinates are attached to the stored target; moving uses the visual pose.
          const mapped = grid
            ? p
            : pointerInComposition(stored, pose, p.x, p.y);
          const local = localPoint(stored, mapped.x, mapped.y);
          const mode = grid
            ? handle
              ? "grid-resize"
              : "grid"
            : handle === "rotate"
              ? "rotate"
              : handle
                ? tool === "crop"
                  ? "crop-resize"
                  : "resize"
                : tool === "cut"
                  ? "cut"
                  : tool === "crop"
                    ? "crop-draw"
                    : "move";
          gesture.current = {
            original: clone(composition),
            layer: clone(stored),
            point: mapped,
            offset: { x: mapped.x - p.x, y: mapped.y - p.y },
            mode,
            corner: handle,
            handleOffset: handle && handle !== "rotate" ? {
              x: (handle.includes("e") ? stored.width : 0) - local.x,
              y: (handle.includes("s") ? stored.height : 0) - local.y,
            } : {x: 0, y: 0},
            points: [
              cutMode === "freehand" && mode === "cut"
                ? [
                    Math.max(0, Math.min(stored.width, local.x)),
                    Math.max(0, Math.min(stored.height, local.y)),
                  ]
                : [local.x, local.y],
            ],
          };
          if (selected !== stored.id && !grid) onSelect(stored.id);
          if (mode === "move") lift(stored.id, 1);
          if (mode === "cut") setStroke([[mapped.x, mapped.y]]);
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
          const raw = point(e),
            p = { x: raw.x + g.offset.x, y: raw.y + g.offset.y },
            rawLocal = localPoint(g.layer, p.x, p.y),
            local = {x: rawLocal.x + g.handleOffset.x, y: rawLocal.y + g.handleOffset.y};
          if (g.mode === "cut") {
            const value: Point =
              cutMode === "freehand"
                ? [
                    Math.max(0, Math.min(g.layer.width, local.x)),
                    Math.max(0, Math.min(g.layer.height, local.y)),
                  ]
                : [local.x, local.y];
            const last = g.points.at(-1)!;
            if (Math.hypot(value[0] - last[0], value[1] - last[1]) < 0.75)
              return;
            g.points =
              cutMode === "straight"
                ? [g.points[0], value]
                : [...g.points, value];
            setStroke(
              g.points.map((q) => {
                const v = worldPoint(g.layer, ...q);
                return [v.x, v.y];
              }),
            );
            return;
          }
          let nextLayer = { ...g.layer };
          if (g.mode === "move" || g.mode === "grid") {
            nextLayer.x += p.x - g.point.x;
            nextLayer.y += p.y - g.point.y;
          } else if (g.mode === "rotate") {
            const center = {
              x: g.layer.x + g.layer.width / 2,
              y: g.layer.y + g.layer.height / 2,
            };
            const start = Math.atan2(
                g.point.y - center.y,
                g.point.x - center.x,
              ),
              now = Math.atan2(p.y - center.y, p.x - center.x);
            nextLayer.rotation =
              ((g.layer.rotation + ((now - start) * 180) / Math.PI + 540) %
                360) -
              180;
          } else if (g.mode === "crop-draw") {
            const start = localPoint(g.layer, g.point.x, g.point.y),
              x = Math.max(0, Math.min(start.x, local.x)),
              y = Math.max(0, Math.min(start.y, local.y));
            const width =
                Math.min(g.layer.width, Math.max(start.x, local.x)) - x,
              height = Math.min(g.layer.height, Math.max(start.y, local.y)) - y;
            if (width < 8 || height < 8) return;
            nextLayer = cropLayer(g.layer, { x, y, width, height });
          } else if (g.mode === "crop-resize") {
            const r = resizeBox(
              g.layer,
              {
                x: Math.max(0, Math.min(g.layer.width, local.x)),
                y: Math.max(0, Math.min(g.layer.height, local.y)),
              },
              g.corner,
            );
            const center = localPoint(
              g.layer,
              r.x + r.width / 2,
              r.y + r.height / 2,
            );
            nextLayer = cropLayer(g.layer, {
              x: center.x - r.width / 2,
              y: center.y - r.height / 2,
              width: r.width,
              height: r.height,
            });
          } else nextLayer = resizeBox(g.layer, local, g.corner);
          setBox(nextLayer);
          if (g.mode.startsWith("grid")) {
            onGrid(nextLayer, false);
            return;
          }
          const next = clone(g.original);
          next.layers = next.layers.map((l) =>
            l.id === g.layer.id ? nextLayer : l,
          );
          pending.current = next;
          onChange(next, false);
        }}
        onPointerUp={(e) => {
          const g = gesture.current;
          if (g?.mode === "cut") {
            const raw = point(e),
              local = localPoint(
                g.layer,
                raw.x + g.offset.x,
                raw.y + g.offset.y,
              );
            const end: Point =
              cutMode === "freehand"
                ? [
                    Math.max(0, Math.min(g.layer.width, local.x)),
                    Math.max(0, Math.min(g.layer.height, local.y)),
                  ]
                : [local.x, local.y];
            if (cutMode === "straight") g.points = [g.points[0], end];
            else if (
              Math.hypot(
                end[0] - g.points.at(-1)![0],
                end[1] - g.points.at(-1)![1],
              ) > 0.1
            )
              g.points.push(end);
          }
          finish();
        }}
        onPointerCancel={() => finish(true)}
        onLostPointerCapture={() => {
          if (gesture.current) finish(true);
        }}
      >
        {target && (
          <g
            transform={
              "translate(" +
              (target.x + target.width / 2) +
              " " +
              (target.y + target.height / 2) +
              ") rotate(" +
              target.rotation +
              ") translate(" +
              -target.width / 2 +
              " " +
              -target.height / 2 +
              ")"
            }
          >
            <path d={shapePath(target)} className="selection piece-outline" />
            <rect
              x="-3"
              y="-3"
              width={target.width + 6}
              height={target.height + 6}
              className="selection"
            />
            <text className="target-label" x="0" y="-13">
              {grid
                ? "Repeat · 3 × 3"
                : tool === "crop"
                  ? "Crop target"
                  : tool === "cut"
                    ? "Cut target"
                    : target.kind === "tape"
                      ? "Tape"
                      : target.name}
            </text>
            {tool !== "cut" && handles?.corners.map(corner => (
                <g key={corner.id}>
                  <line x1={corner.anchorX} y1={corner.anchorY} x2={corner.x} y2={corner.y} className="handle-leader"/>
                  <circle
                    cx={corner.x} cy={corner.y} r={handles.radius}
                    data-handle={corner.id}
                    className="handle-hit"
                    aria-label={"Resize " + corner.id}
                  />
                  <circle
                    cx={corner.x} cy={corner.y} r={handles.visualRadius}
                    className="handle"
                    aria-hidden="true"
                  />
                </g>
              ))}
            {tool !== "crop" && tool !== "cut" && !grid && handles && (
              <>
                <line
                  x1={handles.rotate.anchorX} y1={handles.rotate.anchorY}
                  x2={handles.rotate.x} y2={handles.rotate.y}
                  className="rotation-stem"
                />
                <circle
                  cx={handles.rotate.x} cy={handles.rotate.y} r={handles.radius}
                  data-handle="rotate"
                  className="handle-hit rotation-handle"
                  aria-label="Rotate selected piece"
                />
                <circle
                  cx={handles.rotate.x} cy={handles.rotate.y} r={handles.visualRadius}
                  className="handle"
                  aria-hidden="true"
                />
              </>
            )}
            {grid &&
              [1, 2].map((n) => (
                <g key={n}>
                  <line
                    x1={(target.width * n) / 3}
                    x2={(target.width * n) / 3}
                    y1="0"
                    y2={target.height}
                    className="selection"
                  />
                  <line
                    y1={(target.height * n) / 3}
                    y2={(target.height * n) / 3}
                    x1="0"
                    x2={target.width}
                    className="selection"
                  />
                </g>
              ))}
          </g>
        )}
        {stroke.length > 0 && (
          <>
            <circle
              cx={stroke[0][0]}
              cy={stroke[0][1]}
              r="8"
              className="cut-start"
            />
            <polyline
              points={stroke.map((p) => p.join(",")).join(" ")}
              className="cut-guide"
              fill="none"
            />
          </>
        )}
        {seam.length > 1 && enabled && (
          <motion.polyline
            key={seam.map((p) => p.join()).join()}
            points={seam.map((p) => p.join(",")).join(" ")}
            className="cut-feedback"
            fill="none"
            initial={{ opacity: 1, pathLength: 0 }}
            animate={{ opacity: 0, pathLength: 1 }}
            transition={{ duration: 0.65 }}
          />
        )}
      </svg>
      {enabled && (presentation.development ?? 1) < 0.98 && (
        <div className="developing-label" role="status">
          Developing photo…
        </div>
      )}
    </motion.div>
  );
}
