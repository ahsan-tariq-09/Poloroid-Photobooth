import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { panelVariants, useStudioMotion } from "./useStudioMotion";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera as CameraIcon,
  Check,
  Copy,
  Download,
  Film,
  Grip,
  HelpCircle,
  ImagePlus,
  Layers,
  Maximize2,
  MousePointer2,
  Move,
  Plus,
  RotateCcw,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Sticker,
  Trash2,
  Undo2,
  Redo2,
  Upload,
  Printer,
  X,
} from "lucide-react";
import { ACCEPT, importAsset, loadImage } from "./imports";
import {
  addDecoration,
  clone,
  duplicateLayer,
  initialComposition,
  cutLayer,
  cropLayer,
  repeatLayer,
  transformGrid,
  photoLayer,
  DEFAULT_CROP,
  type Layer,
  type Assets,
  type Point,
  type Asset,
  type Composition,
  type Tool,
} from "./model";
import { historyReducer } from "./history";
import { backend, initializeEffects } from "./effects";
import {
  exportFile as downloadArtwork,
  printComposition,
  texture,
  type ExportFormat,
} from "./render";
import Stage from "./Stage";
import Camera from "./Camera";
const tools: { id: Tool; label: string; icon: typeof Move; key: string }[] = [
  { id: "move", label: "Move", icon: MousePointer2, key: "V" },
  { id: "crop", label: "Crop", icon: Maximize2, key: "C" },
  { id: "cut", label: "Cut", icon: Scissors, key: "X" },
  { id: "repeat", label: "Repeat", icon: Copy, key: "D" },
  { id: "tape", label: "Tape", icon: Sticker, key: "T" },
  { id: "paper", label: "Paper", icon: Layers, key: "P" },
  { id: "effects", label: "Distort", icon: Sparkles, key: "E" },
];
const tapeColors = ["#d8b88a", "#e65b3c", "#6b897e", "#53582f", "#dfc1ae"];
const help: Record<Tool, string> = {
  move: "Drag a piece to give it a new home.",
  crop: "Drag a crop box or its corners to trim the selected photo.",
  cut: "Draw across a photo. Release to cut; Undo brings it back.",
  repeat:
    "Repeat a photo in a 3 × 3 grid. Resize the grid box; switch tools to edit tiles.",
  tape: "A little tape holds a memory together.",
  paper: "Add a scrap. Make it a little more yours.",
  effects: "A little faded. A little imperfect. Just right.",
};
function Range({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  suffix = "%",
  onChange,
  onFinish,
  disabled = false,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
  onFinish: () => void;
  disabled?: boolean;
}) {
  return (
    <label className="range-control">
      <span>
        {label}
        <b>
          {Math.round(value)}
          {suffix}
        </b>
      </span>
      <input
        aria-label={label}
        disabled={disabled}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={
          {
            "--progress": `${((value - min) / (max - min)) * 100}%`,
          } as React.CSSProperties
        }
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onFinish}
        onPointerCancel={onFinish}
        onKeyUp={onFinish}
        onBlur={onFinish}
      />
    </label>
  );
}
export default function App() {
  const motionEnabled = useStudioMotion();
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initialComposition(true),
    future: [],
  });
  const [draft, setDraft] = useState<Composition | null>(null),
    draftRef = useRef<Composition | null>(null);
  const composition = draft || history.present;
  const [assets, setAssets] = useState<Assets>({});
  const assetsRef = useRef<Assets>({}),
    initialPhotos = useRef<Layer[]>([]),
    hasRealPhotos = useRef(false);
  const compositionRef = useRef(composition);
  compositionRef.current = composition;
  const uploadQueue = useRef(Promise.resolve()),
    importCount = useRef(0);
  const [grid, setGrid] = useState<{ box: Layer; ids: string[] } | null>(null);
  const gridRef = useRef(grid);
  gridRef.current = grid;
  const [format, setFormat] = useState<ExportFormat>("png");
  const [cutAngle, setCutAngle] = useState(0);
  const [tool, setTool] = useState<Tool>("move"),
    [selected, setSelected] = useState<string | null>(null),
    [cutMode, setCutMode] = useState<"straight" | "freehand">("straight");
  const [panel, setPanel] = useState<"look" | "layers">("look"),
    [camera, setCamera] = useState(false),
    [guide, setGuide] = useState(false),
    [frames, setFrames] = useState(false),
    [busy, setBusy] = useState(false),
    [exporting, setExporting] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [engine, setEngine] = useState("canvas"),
    [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    request = useRef(0),
    alive = useRef(true),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layer = composition.layers.find((l) => l.id === selected);
  const asset =
    (layer?.assetId ? assets[layer.assetId] : null) ||
    Object.values(assets)[0] ||
    null;
  const commit = useCallback((value: Composition) => {
    compositionRef.current = value;
    draftRef.current = null;
    setDraft(null);
    dispatch({ type: "commit", value });
  }, []);
  const preview = (value: Composition) => {
    compositionRef.current = value;
    draftRef.current = value;
    setDraft(value);
  };
  const finish = () => {
    if (draftRef.current) commit(draftRef.current);
  };
  const toast = useCallback((text: string) => {
    setMessage(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setMessage(""), 3500);
  }, []);
  const reportError = useCallback((text: string) => setError(text), []);
  const replaceAsset = useCallback((value: Asset, sample = false) => {
    assetsRef.current = { sample: value };
    setAssets(assetsRef.current);
    const next = initialComposition(sample);
    initialPhotos.current = clone(next.layers);
    compositionRef.current = next;
    setDraft(null);
    draftRef.current = null;
    dispatch({ type: "reset", value: next });
    setSelected(null);
    setTool("move");
    setError("");
  }, []);
  useEffect(() => {
    alive.current = true;
    const token = ++request.current;
    loadImage("/sample-coast.png")
      .then((image) => {
        if (alive.current && token === request.current)
          replaceAsset(
            {
              image,
              url: "/sample-coast.png",
              width: image.naturalWidth,
              height: image.naturalHeight,
              name: "A coastal memory",
            },
            true,
          );
      })
      .catch(() => {
        if (alive.current && token === request.current)
          setError("The sample photo could not load. Upload a photo to start.");
      });
    initializeEffects().then(() => {
      if (alive.current) setEngine(backend);
    });
    return () => {
      alive.current = false;
      request.current++;
      Object.values(assetsRef.current).forEach((a) => {
        if (a.url.startsWith("blob:")) URL.revokeObjectURL(a.url);
      });
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [replaceAsset]);
  const upload = (inputFiles: File | File[]) => {
    const files = Array.isArray(inputFiles) ? inputFiles : [inputFiles];
    request.current++;
    importCount.current++;
    setBusy(true);
    setError("");
    uploadQueue.current = uploadQueue.current
      .then(async () => {
        const errors: string[] = [];
        for (const file of files) {
          if (!alive.current) break;
          try {
            const value = await importAsset(file);
            if (!alive.current) {
              URL.revokeObjectURL(value.url);
              break;
            }
            const id = crypto.randomUUID();
            if (!hasRealPhotos.current) {
              hasRealPhotos.current = true;
              assetsRef.current = {};
              initialPhotos.current = [];
            }
            assetsRef.current = { ...assetsRef.current, [id]: value };
            setAssets(assetsRef.current);
            const added = photoLayer(
              id,
              value.name,
              initialPhotos.current.length,
            );
            initialPhotos.current.push(clone(added));
            const next =
              initialPhotos.current.length === 1
                ? { ...initialComposition(), layers: [added] }
                : {
                    ...clone(compositionRef.current),
                    layers: [...compositionRef.current.layers, added],
                  };
            setGrid(null);
            setSelected(added.id);
            setTool("move");
            setPanel("layers");
            if (initialPhotos.current.length === 1) {
              compositionRef.current = next;
              dispatch({ type: "reset", value: next });
              setDraft(null);
              draftRef.current = null;
            } else commit(next);
          } catch (e) {
            errors.push(
              file.name +
                ": " +
                (e instanceof Error ? e.message : "Could not open this image."),
            );
          }
        }
        if (alive.current) {
          if (errors.length) setError(errors.join(" · "));
          else toast("Your photos are in. Make them yours.");
        }
      })
      .finally(() => {
        importCount.current--;
        if (alive.current) setBusy(importCount.current > 0);
      });
    return uploadQueue.current;
  };
  const openUpload = () => input.current?.click();
  const chooseTool = (id: Tool) => {
    finish();
    setGrid(null);
    setTool(id);
    if (id === "tape" || id === "paper") {
      const next = addDecoration(
        composition,
        id,
        id === "tape" ? tapeColors[0] : "#e8d7b8",
      );
      commit(next);
      setSelected(next.layers.at(-1)!.id);
      setPanel("layers");
    } else if (id === "effects") setPanel("look");
    else if (["cut", "crop", "repeat"].includes(id)) {
      setPanel("layers");
      if (!layer?.source)
        setSelected(
          composition.layers.find((l) => l.kind === "photo")?.id || null,
        );
    }
  };
  const updateLayer = (
    values: Partial<NonNullable<typeof layer>>,
    continuous = false,
  ) => {
    if (!selected) return;
    const next = clone(composition),
      target = next.layers.find((l) => l.id === selected);
    if (!target) return;
    Object.assign(target, values);
    continuous ? preview(next) : commit(next);
  };
  const reorder = (direction: number) => {
    const next = clone(composition),
      index = next.layers.findIndex((l) => l.id === selected);
    const band = next.layers.filter(
      (l) => (l.kind === "photo") === (layer?.kind === "photo"),
    );
    const neighbor = band[band.findIndex((l) => l.id === selected) + direction];
    const destination = neighbor
      ? next.layers.findIndex((l) => l.id === neighbor.id)
      : -1;
    if (index < 0 || destination < 0 || destination >= next.layers.length)
      return;
    [next.layers[index], next.layers[destination]] = [
      next.layers[destination],
      next.layers[index],
    ];
    commit(next);
  };
  const remove = () => {
    if (!selected) return;
    commit({
      ...clone(composition),
      layers: composition.layers.filter((l) => l.id !== selected),
    });
    setSelected(null);
  };
  const duplicate = () => {
    if (!selected) return;
    const next = duplicateLayer(composition, selected);
    commit(next);
    setSelected(next.layers.at(-1)!.id);
  };
  const undo = () => {
    setGrid(null);
    setDraft(null);
    draftRef.current = null;
    dispatch({ type: "undo" });
  };
  const redo = () => {
    setGrid(null);
    setDraft(null);
    draftRef.current = null;
    dispatch({ type: "redo" });
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest(
          'input,textarea,select,[contenteditable], [role="dialog"]',
        ) ||
        camera ||
        guide ||
        frames
      )
        return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === "Escape") {
        setGrid(null);
        setSelected(null);
        setTool("move");
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        e.preventDefault();
        remove();
      }
      if (
        selected &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        e.preventDefault();
        const amount = e.shiftKey ? 10 : 1;
        if (layer)
          updateLayer({
            x:
              layer.x +
              (e.key === "ArrowLeft"
                ? -amount
                : e.key === "ArrowRight"
                  ? amount
                  : 0),
            y:
              layer.y +
              (e.key === "ArrowUp"
                ? -amount
                : e.key === "ArrowDown"
                  ? amount
                  : 0),
          });
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const match = tools.find(
          (t) => t.key.toLowerCase() === e.key.toLowerCase(),
        );
        if (match) chooseTool(match.id);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const cutPhoto = (id: string, points: Point[], mode = cutMode) => {
    try {
      const next = cutLayer(compositionRef.current, id, points, mode);
      const oldIds = new Set(compositionRef.current.layers.map((l) => l.id));
      commit(next);
      setSelected(next.layers.find((l) => !oldIds.has(l.id))!.id);
      setPanel("layers");
      toast("Cut made. Move the pieces to make a collage.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "This cut could not be made.");
    }
  };
  const repeatPhoto = (id: string) => {
    const current = compositionRef.current,
      original = current.layers.find((l) => l.id === id);
    if (!original || original.kind !== "photo") return;
    const next = repeatLayer(current, id),
      oldIds = new Set(current.layers.map((l) => l.id));
    const ids = next.layers.filter((l) => !oldIds.has(l.id)).map((l) => l.id);
    commit(next);
    setGrid({ box: clone(original), ids });
    setSelected(ids[0]);
    setPanel("layers");
    toast("Nine memories. Adjust the grid, or switch tools to edit each tile.");
  };
  const adjustGrid = (box: Layer, final: boolean) => {
    const g = gridRef.current;
    if (!g) return;
    const next = clone(compositionRef.current),
      transformed = transformGrid(
        next.layers.filter((l) => g.ids.includes(l.id)),
        g.box,
        box,
      );
    next.layers = next.layers.map(
      (l) => transformed.find((t) => t.id === l.id) || l,
    );
    const updated = { ...g, box };
    gridRef.current = updated;
    setGrid(updated);
    final ? commit(next) : preview(next);
  };
  const setEffect = (key: "film" | "copier", value: number) => {
    const next = clone(composition);
    next.effects[key] = value / 100;
    preview(next);
  };
  const preset = (film: number, copier: number) => {
    commit({
      ...clone(composition),
      effects: { ...composition.effects, film, copier },
    });
  };
  const exportFile = async (print = false) => {
    if (!asset || busy) return;
    finish();
    setExporting(true);
    setError("");
    try {
      if (print)
        await printComposition(assetsRef.current, compositionRef.current);
      else
        await downloadArtwork(
          assetsRef.current,
          compositionRef.current,
          format,
        );
      setEngine(backend);
      toast(
        print
          ? "Polaroid ready to print at 88 × 107 mm."
          : "Your Polaroid is ready. " + format.toUpperCase() + " downloaded.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not prepare your Polaroid. Try PNG or JPEG.",
      );
    } finally {
      setExporting(false);
    }
  };
  return (
    <MotionConfig reducedMotion="user">
      <div
        className="app-shell"
        data-motion={motionEnabled ? "active" : "paused"}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node))
            setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length)
            void upload(Array.from(e.dataTransfer.files));
        }}
      >
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          multiple
          className="visually-hidden"
          aria-label="Upload a JPG, PNG, HEIC, HEIF, or SVG photo"
          onChange={(e) => {
            if (e.target.files?.length) void upload(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
        <header className="site-header">
          <a className="wordmark" href="#" aria-label="Poloroid home">
            <span className="logo-mark">
              <i />
            </span>
            poloroid<span className="logo-dot">®</span>
          </a>
          <nav>
            <span className="nav-active">The photo lab</span>
            <button onClick={() => setFrames(true)}>
              Printable frames <ArrowRight size={14} />
            </button>
            <button onClick={() => setGuide(true)}>
              How it works <HelpCircle size={14} />
            </button>
          </nav>
          <div className="header-tag">
            <span /> MADE FOR THE MEMORIES
          </div>
        </header>
        <main>
          <section className="intro">
            <div>
              <p className="eyebrow">
                <span className="tiny-star">✳</span> YOUR LITTLE ANALOG ESCAPE
              </p>
              <h1>
                Make a little <em>memory.</em>
              </h1>
              <p className="intro-copy">
                Cut it. Tape it. Give it a little character.
                <br className="mobile-br" /> The best moments were never
                perfect.
              </p>
            </div>
            <div className="intro-note">
              <span className="note-star">✴</span>
              <span>
                DIGITAL HANDS.
                <br />
                ANALOG HEART.
              </span>
              <i>Est. whenever you like</i>
            </div>
          </section>
          <section className="studio" aria-label="Polaroid editor">
            <div className="studio-top">
              <div className="lab-label">
                <span className="live-dot" /> THE PHOTO LAB{" "}
                <span className="separator">/</span>
                <span className="session-label">SESSION 001</span>
              </div>
              <div className="history-actions">
                <button
                  aria-label="Undo"
                  title="Undo (Ctrl+Z)"
                  onClick={undo}
                  disabled={!history.past.length}
                >
                  <Undo2 size={17} />
                </button>
                <button
                  aria-label="Redo"
                  title="Redo (Ctrl+Shift+Z)"
                  onClick={redo}
                  disabled={!history.future.length}
                >
                  <Redo2 size={17} />
                </button>
                <span />
                <button
                  className="reset-button"
                  onClick={() => {
                    commit({
                      ...initialComposition(!hasRealPhotos.current),
                      layers: clone(initialPhotos.current),
                    });
                    setSelected(null);
                    toast("A fresh start. Your photo is still here.");
                  }}
                >
                  <RotateCcw size={14} /> Reset
                </button>
              </div>
            </div>
            <div className="studio-body">
              <aside className="toolbox">
                <p className="panel-eyebrow">MAKE IT YOURS</p>
                <div className="tool-list">
                  {tools.map(({ id, label, icon: Icon, key }) => (
                    <motion.button
                      key={id}
                      whileHover={motionEnabled ? { x: 3 } : undefined}
                      whileTap={motionEnabled ? { scale: 0.96 } : undefined}
                      className={`tool-button ${tool === id ? "active" : ""}`}
                      onClick={() => chooseTool(id)}
                      aria-pressed={tool === id}
                      title={`${label} (${key})`}
                    >
                      {tool === id && (
                        <motion.span
                          className="tool-selection"
                          layoutId="tool-selection"
                          transition={{
                            type: "spring",
                            stiffness: 420,
                            damping: 32,
                            duration: motionEnabled ? undefined : 0,
                          }}
                        />
                      )}
                      <Icon size={19} strokeWidth={1.6} />
                      <span>{label}</span>
                      <kbd>{key}</kbd>
                    </motion.button>
                  ))}
                </div>
                <div className="toolbox-note">
                  <Scissors size={20} strokeWidth={1.2} />
                  <p>
                    A little wonky.
                    <br />A little wonderful.
                  </p>
                </div>
                <button className="upload-side" onClick={openUpload}>
                  <Plus size={17} /> Add photos
                </button>
              </aside>
              <div className="workspace">
                <div className="workspace-top">
                  <span>
                    <span className="mini-square" />{" "}
                    {asset?.name || "YOUR NEXT MEMORY"}
                  </span>
                  <span className="workspace-status">
                    {busy ? "PREPARING…" : "LIVE PREVIEW"}
                  </span>
                </div>
                <div className="canvas-area">
                  <div className="workspace-doodle doodle-left">
                    make it
                    <br />
                    <em>imperfect</em>
                    <svg viewBox="0 0 60 50">
                      <path d="M 9 7 C 3 36 27 42 52 31 M 42 25 L 52 31 L 45 39" />
                    </svg>
                  </div>
                  <div className="workspace-doodle doodle-right">
                    <span>✳</span> good things
                    <br />
                    take a little grain.
                  </div>
                  {asset ? (
                    <Stage
                      enabled={motionEnabled}
                      assets={assets}
                      composition={composition}
                      selected={selected}
                      tool={tool}
                      cutMode={cutMode}
                      grid={tool === "repeat" ? grid?.box : undefined}
                      onSelect={(id) => {
                        setSelected(id);
                        if (!grid) setPanel("layers");
                      }}
                      onChange={(next, final) =>
                        final ? commit(next) : preview(next)
                      }
                      onRepeat={repeatPhoto}
                      onCut={cutPhoto}
                      onGrid={adjustGrid}
                      onError={reportError}
                    />
                  ) : (
                    <button className="empty-upload" onClick={openUpload}>
                      <ImagePlus size={36} />
                      <span>Add your first memory</span>
                    </button>
                  )}
                  {busy && (
                    <div className="preparing">
                      <Film className="spin" size={22} />
                      <span>Preparing your photo…</span>
                      <small>This little memory stays on your device.</small>
                    </div>
                  )}
                </div>
                <div className="workspace-bottom">
                  <span>
                    <MousePointer2 size={13} /> {help[tool]}
                  </span>
                  <button
                    onClick={() => setSelected(null)}
                    title="Hide selection"
                  >
                    <Maximize2 size={14} />
                    <span>Fit to view</span>
                  </button>
                </div>
              </div>
              <aside className="settings">
                <div className="settings-tabs">
                  <button
                    className={panel === "look" ? "selected" : ""}
                    onClick={() => setPanel("look")}
                  >
                    <SlidersHorizontal size={15} /> The look
                  </button>
                  <button
                    className={panel === "layers" ? "selected" : ""}
                    onClick={() => setPanel("layers")}
                  >
                    <Layers size={15} /> Layers{" "}
                    <small>{composition.layers.length}</small>
                  </button>
                </div>
                <AnimatePresence initial={false} mode="wait">
                  <motion.div
                    key={panel}
                    className={"settings-content panel-" + panel}
                    variants={panelVariants}
                    initial={motionEnabled ? "enter" : false}
                    animate={motionEnabled ? "visible" : "still"}
                    exit={motionEnabled ? "exit" : undefined}
                  >
                    {panel === "look" ? (
                      <>
                        <div className="control-section">
                          <p className="panel-eyebrow">A LITTLE NOSTALGIA</p>
                          <div className="presets">
                            {[
                              { name: "Original", film: 0, copier: 0 },
                              { name: "Sun-faded", film: 0.65, copier: 0 },
                              { name: "Copy shop", film: 0.2, copier: 0.85 },
                            ].map((p) => (
                              <button
                                key={p.name}
                                onClick={() => preset(p.film, p.copier)}
                                className={`preset ${composition.effects.film === p.film && composition.effects.copier === p.copier ? "active" : ""}`}
                              >
                                <PresetThumbnail
                                  asset={asset}
                                  composition={composition}
                                  crop={layer?.crop || DEFAULT_CROP}
                                  film={p.film}
                                  copier={p.copier}
                                />
                                <span>{p.name}</span>
                                {composition.effects.film === p.film &&
                                  composition.effects.copier === p.copier && (
                                    <i>
                                      <Check size={9} />
                                    </i>
                                  )}
                              </button>
                            ))}
                          </div>
                          <Range
                            label="Film fade + grain"
                            value={composition.effects.film * 100}
                            onChange={(v) => setEffect("film", v)}
                            onFinish={finish}
                          />
                          <Range
                            label="Copier distortion"
                            value={composition.effects.copier * 100}
                            onChange={(v) => setEffect("copier", v)}
                            onFinish={finish}
                          />
                        </div>
                        <div className="control-section">
                          <p className="panel-eyebrow">THE POLAROID</p>
                          <div className="color-row">
                            <span>Paper tone</span>
                            <div>
                              {["#fff9e9", "#ead0a0", "#f2ded2"].map(
                                (color) => (
                                  <button
                                    key={color}
                                    aria-label={`Paper tone ${color}`}
                                    title={color}
                                    style={{ background: color }}
                                    className={
                                      composition.frameColor === color
                                        ? "active"
                                        : ""
                                    }
                                    onClick={() =>
                                      commit({
                                        ...clone(composition),
                                        frameColor: color,
                                      })
                                    }
                                  >
                                    {composition.frameColor === color && (
                                      <Check size={13} />
                                    )}
                                  </button>
                                ),
                              )}
                            </div>
                          </div>
                          <label className="caption-label">
                            A note to remember
                            <input
                              type="text"
                              placeholder="somewhere, sometime…"
                              maxLength={55}
                              value={composition.caption}
                              onChange={(e) =>
                                preview({
                                  ...clone(composition),
                                  caption: e.target.value,
                                })
                              }
                              onBlur={finish}
                            />
                          </label>
                          <span className="field-hint">
                            Your words, on the bottom of the frame.
                          </span>
                        </div>
                        <div className="control-section framing">
                          <p className="panel-eyebrow">PHOTO FRAMING</p>
                          <Range
                            label="Zoom"
                            min={100}
                            max={300}
                            disabled={layer?.kind !== "photo"}
                            value={(layer?.crop?.zoom || 1) * 100}
                            onChange={(v) =>
                              updateLayer(
                                {
                                  crop: {
                                    ...(layer?.crop || DEFAULT_CROP),
                                    zoom: v / 100,
                                  },
                                },
                                true,
                              )
                            }
                            onFinish={finish}
                          />
                          <button
                            className="text-button"
                            onClick={() => chooseTool("crop")}
                          >
                            <Move size={13} /> Trim selected photo
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="panel-eyebrow">YOUR LITTLE COLLAGE</p>
                        <div className="layer-list">
                          {[...composition.layers].reverse().map((l) => (
                            <button
                              key={l.id}
                              className={`layer-row ${selected === l.id ? "active" : ""}`}
                              onClick={() => {
                                setSelected(l.id);
                                setTool("move");
                                setGrid(null);
                              }}
                            >
                              <span
                                className={`layer-swatch ${l.kind}`}
                                style={{
                                  background:
                                    l.kind !== "photo" ? l.color : undefined,
                                }}
                              >
                                {l.kind === "photo" && (
                                  <img src={assets[l.assetId!]?.url} alt="" />
                                )}
                              </span>
                              <span>
                                {l.name}
                                <small>
                                  {l.kind === "photo"
                                    ? "Photograph"
                                    : l.kind === "tape"
                                      ? "Adhesive"
                                      : "Paper scrap"}
                                </small>
                              </span>
                              <Grip size={12} />
                            </button>
                          ))}
                        </div>
                        {layer && !(grid && tool === "repeat") ? (
                          <div className="selected-controls">
                            <p className="panel-eyebrow">SELECTED PIECE</p>
                            <div className="numeric-fields">
                              {(["x", "y", "width", "height"] as const).map(
                                (key) => (
                                  <label className="numeric-field" key={key}>
                                    {key}
                                    <input
                                      aria-label={"Piece " + key}
                                      type="number"
                                      min={
                                        key === "width" || key === "height"
                                          ? 12
                                          : -200
                                      }
                                      value={Math.round(layer[key])}
                                      onChange={(e) =>
                                        updateLayer(
                                          {
                                            [key]: Math.max(
                                              key === "width" ||
                                                key === "height"
                                                ? 12
                                                : -200,
                                              Number(e.target.value),
                                            ),
                                          },
                                          true,
                                        )
                                      }
                                      onBlur={finish}
                                      onKeyUp={(e) => {
                                        if (e.key === "Enter") finish();
                                      }}
                                    />
                                  </label>
                                ),
                              )}
                            </div>
                            <Range
                              label="Rotation"
                              value={layer.rotation}
                              min={-180}
                              max={180}
                              suffix="°"
                              onChange={(v) =>
                                updateLayer({ rotation: v }, true)
                              }
                              onFinish={finish}
                            />
                            <Range
                              label="Opacity"
                              value={layer.opacity * 100}
                              onChange={(v) =>
                                updateLayer({ opacity: v / 100 }, true)
                              }
                              onFinish={finish}
                            />
                            <Range
                              label="Size"
                              min={20}
                              max={650}
                              suffix="px"
                              value={layer.width}
                              onChange={(v) =>
                                updateLayer(
                                  {
                                    width: v,
                                    height: (layer.height * v) / layer.width,
                                  },
                                  true,
                                )
                              }
                              onFinish={finish}
                            />
                            {layer.kind !== "photo" && (
                              <div className="color-row">
                                <span>Color</span>
                                <div>
                                  {tapeColors.map((color) => (
                                    <button
                                      key={color}
                                      style={{ background: color }}
                                      aria-label={`Piece color ${color}`}
                                      onClick={() => updateLayer({ color })}
                                    >
                                      {layer.color === color && (
                                        <Check size={12} />
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="layer-actions">
                              <button
                                aria-label="Bring forward"
                                title="Bring forward"
                                onClick={() => reorder(1)}
                              >
                                <ArrowUp size={16} />
                              </button>
                              <button
                                aria-label="Send backward"
                                title="Send backward"
                                onClick={() => reorder(-1)}
                              >
                                <ArrowDown size={16} />
                              </button>
                              <button
                                aria-label="Duplicate selected piece"
                                title="Duplicate"
                                onClick={duplicate}
                              >
                                <Copy size={16} />
                              </button>
                              <button
                                aria-label="Delete selected piece"
                                title="Delete"
                                onClick={remove}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                            <div className="nudge-actions">
                              <span>Move</span>
                              {[
                                ["Left", ArrowLeft, -5, 0],
                                ["Up", ArrowUp, 0, -5],
                                ["Down", ArrowDown, 0, 5],
                                ["Right", ArrowRight, 5, 0],
                              ].map(([name, Icon, dx, dy]) => {
                                const I = Icon as typeof Move;
                                return (
                                  <button
                                    key={name as string}
                                    aria-label={`Move ${name}`}
                                    onClick={() =>
                                      updateLayer({
                                        x: layer.x + Number(dx),
                                        y: layer.y + Number(dy),
                                      })
                                    }
                                  >
                                    <I size={14} />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <p className="selection-hint">
                            Select a piece to move, rotate, or rearrange it.
                          </p>
                        )}
                      </>
                    )}
                    {["crop", "cut", "repeat"].includes(tool) && (
                      <div className="tool-target-controls">
                        <p className="panel-eyebrow">
                          {tool.toUpperCase()} TARGET
                        </p>
                        <p className="field-hint">{help[tool]}</p>
                        {tool === "cut" && (
                          <>
                            <div className="segmented">
                              <button
                                className={
                                  cutMode === "straight" ? "active" : ""
                                }
                                onClick={() => setCutMode("straight")}
                              >
                                Straight
                              </button>
                              <button
                                className={
                                  cutMode === "freehand" ? "active" : ""
                                }
                                onClick={() => setCutMode("freehand")}
                              >
                                Freehand
                              </button>
                            </div>
                            <label className="numeric-field">
                              Line angle{" "}
                              <input
                                aria-label="Cut angle"
                                type="number"
                                min="-180"
                                max="180"
                                value={cutAngle}
                                onChange={(e) =>
                                  setCutAngle(Number(e.target.value))
                                }
                              />
                            </label>
                            <button
                              className="secondary-button"
                              disabled={!layer?.source}
                              onClick={() => {
                                if (layer) {
                                  const a = (cutAngle * Math.PI) / 180;
                                  cutPhoto(
                                    layer.id,
                                    [
                                      [
                                        layer.width / 2 -
                                          Math.cos(a) * layer.width,
                                        layer.height / 2 -
                                          Math.sin(a) * layer.height,
                                      ],
                                      [
                                        layer.width / 2 +
                                          Math.cos(a) * layer.width,
                                        layer.height / 2 +
                                          Math.sin(a) * layer.height,
                                      ],
                                    ],
                                    "straight",
                                  );
                                }
                              }}
                            >
                              Cut through center
                            </button>
                          </>
                        )}
                        {tool === "repeat" && !grid && (
                          <button
                            className="secondary-button"
                            disabled={layer?.kind !== "photo"}
                            onClick={() => {
                              if (layer) repeatPhoto(layer.id);
                            }}
                          >
                            Repeat 3 × 3
                          </button>
                        )}
                        {grid && tool === "repeat" && (
                          <div className="numeric-fields">
                            {(["x", "y", "width", "height"] as const).map(
                              (key) => (
                                <label className="numeric-field" key={key}>
                                  {key}
                                  <input
                                    aria-label={"Grid " + key}
                                    type="number"
                                    min={
                                      key === "width" || key === "height"
                                        ? 12
                                        : -200
                                    }
                                    value={Math.round(grid.box[key])}
                                    onChange={(e) =>
                                      adjustGrid(
                                        {
                                          ...grid.box,
                                          [key]: Math.max(
                                            key === "width" || key === "height"
                                              ? 12
                                              : -200,
                                            Number(e.target.value),
                                          ),
                                        },
                                        false,
                                      )
                                    }
                                    onBlur={finish}
                                    onKeyUp={(e) => {
                                      if (e.key === "Enter") finish();
                                    }}
                                  />
                                </label>
                              ),
                            )}
                          </div>
                        )}
                        {layer?.kind === "photo" && tool === "crop" && (
                          <div className="numeric-fields">
                            {(["width", "height"] as const).map((key) => (
                              <label className="numeric-field" key={key}>
                                Crop {key}
                                <input
                                  aria-label={"Crop " + key}
                                  type="number"
                                  min="8"
                                  max={Math.round(layer[key])}
                                  defaultValue={Math.round(layer[key])}
                                  key={layer.id + layer[key]}
                                  onBlur={(e) => {
                                    const size = Math.max(
                                      8,
                                      Math.min(
                                        layer[key],
                                        Number(e.target.value),
                                      ),
                                    );
                                    updateLayer(
                                      cropLayer(layer, {
                                        x: 0,
                                        y: 0,
                                        width:
                                          key === "width" ? size : layer.width,
                                        height:
                                          key === "height"
                                            ? size
                                            : layer.height,
                                      }),
                                    );
                                  }}
                                />
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
                <div className="save-panel">
                  <p>One for the keepsake box.</p>
                  <label className="format-selector">
                    Download format
                    <select
                      aria-label="Download format"
                      value={format}
                      onChange={(e) =>
                        setFormat(e.target.value as ExportFormat)
                      }
                    >
                      <option value="png">PNG</option>
                      <option value="jpeg">JPEG</option>
                      <option value="heic">HEIC</option>
                      <option value="svg">SVG</option>
                    </select>
                  </label>
                  <div className="export-row">
                    <button
                      className="primary-button download-main"
                      disabled={!asset || busy || exporting}
                      onClick={() => void exportFile()}
                    >
                      <Download size={16} />
                      {exporting
                        ? "Preparing…"
                        : "Download " + format.toUpperCase()}
                    </button>
                    <button
                      className="print-button"
                      aria-label="Print Polaroid"
                      disabled={!asset || busy || exporting}
                      onClick={() => void exportFile(true)}
                    >
                      <Printer size={17} /> Print
                    </button>
                  </div>
                  <p className="print-guidance">
                    88 × 107 mm · Print at Actual size / 100% scale.
                  </p>
                  <span>YOUR POLAROID. READY TO KEEP.</span>
                </div>
              </aside>
            </div>
            <div className="studio-footer">
              <span>
                <span className="privacy-dot" /> Your photos stay right here, on
                your device.
              </span>
              <span>
                NO ACCOUNT. JUST A LITTLE CREATIVITY.{" "}
                <span className="small-star">✳</span>
              </span>
            </div>
          </section>
          {error && (
            <div role="alert" className="error-banner">
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          <section className="below-studio">
            <div className="input-invitation">
              <span className="invitation-icon">
                <ImagePlus size={22} strokeWidth={1.4} />
              </span>
              <div>
                <h3>Start with a moment of your own.</h3>
                <p>
                  JPG, PNG, HEIC & SVG. A photo, a doodle, a little anything.
                </p>
              </div>
              <button className="secondary-button" onClick={openUpload}>
                <Upload size={15} /> Upload a photo
              </button>
              <button className="camera-button" onClick={() => setCamera(true)}>
                <CameraIcon size={17} /> Take a photo
              </button>
            </div>
            <motion.button
              whileHover={motionEnabled ? { y: -3 } : undefined}
              whileTap={motionEnabled ? { scale: 0.99 } : undefined}
              className="frame-teaser"
              onClick={() => setFrames(true)}
            >
              <FrameIllustration />
              <div>
                <span className="eyebrow">FROM PIXELS TO YOUR DESK</span>
                <h3>Give your memory a real home.</h3>
                <p>Download a frame. Print it. Keep it.</p>
              </div>
              <span className="round-arrow">
                <ArrowRight size={20} />
              </span>
            </motion.button>
          </section>
        </main>
        <footer className="site-footer">
          <a className="footer-logo" href="#">
            poloroid
          </a>
          <span>Made for the wonderfully imperfect.</span>
          <span className="footer-right">
            A PHOTO. A FEELING. A LITTLE FOREVER. <span>✳</span>
          </span>
        </footer>
        <AnimatePresence>
          {message && (
            <motion.div
              key={message}
              className="toast"
              role="status"
              initial={
                motionEnabled ? { opacity: 0, y: 22, scale: 0.95 } : false
              }
              animate={motionEnabled ? "visible" : "still"}
              variants={{
                visible: {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: { type: "spring", stiffness: 330, damping: 25 },
                },
                still: {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: { duration: 0 },
                },
              }}
              exit={motionEnabled ? { opacity: 0, y: 12 } : undefined}
            >
              <motion.span
                className="toast-check"
                initial={motionEnabled ? { scale: 0 } : false}
                animate={motionEnabled ? "visible" : "still"}
                variants={{
                  visible: {
                    scale: 1,
                    transition: { delay: 0.12, type: "spring" },
                  },
                  still: { scale: 1, transition: { duration: 0 } },
                }}
              >
                <Check size={16} />
              </motion.span>
              {message}
            </motion.div>
          )}
        </AnimatePresence>
        {dragging && (
          <div className="drop-overlay">
            <ImagePlus size={48} />
            <h2>Drop a little memory here.</h2>
            <p>JPG · PNG · HEIC · HEIF · SVG</p>
          </div>
        )}
        <AnimatePresence>
          {camera && (
            <Camera
              key="camera"
              enabled={motionEnabled}
              onClose={() => setCamera(false)}
              onCapture={(file) => {
                setCamera(false);
                void upload(file);
              }}
              onUpload={() => {
                setCamera(false);
                openUpload();
              }}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {guide && (
            <InfoModal
              key="guide"
              title="A little guide to the photo lab."
              eyebrow="PERFECTLY IMPERFECT"
              onClose={() => setGuide(false)}
            >
              <ol className="guide-list">
                <li>
                  <b>Bring a memory.</b> Upload a photo or SVG, or take a fresh
                  photo with your camera.
                </li>
                <li>
                  <b>Make it yours.</b> Crop, cut, and move the pieces. Add tape
                  and paper. Try a faded film or copier effect.
                </li>
                <li>
                  <b>Keep the Polaroid.</b> Download JPEG, HEIC, PNG, or SVG, or
                  print at 88 × 107 mm. Every output includes your Polaroid
                  frame.
                </li>
              </ol>
              <p className="modal-footnote">
                Move: V · Crop: C · Cut: X · Repeat: D · Tape: T · Paper: P ·
                Distort: E<br />
                Undo: Ctrl/⌘ Z · Redo: Ctrl/⌘ Shift Z · Nudge: arrow keys
              </p>
              <p className="modal-footnote">
                SVG artwork is edited as a whole layer. Photographs and pixel
                effects stay embedded in SVG exports. HEIC imports use a still
                image; Live Photo playback is not included.
              </p>
              <span className="engine-note">
                Rendering: {engine === "webgpu" ? "WebGPU" : "Canvas fallback"}
              </span>
            </InfoModal>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {frames && (
            <InfoModal
              key="frames"
              title="A real home for your Polaroid."
              eyebrow="PRINTABLE KEEPSAKES"
              onClose={() => setFrames(false)}
            >
              <p className="modal-description">
                Save your finished Polaroid, print it on paper, and download a
                frame for your 3D printer.
              </p>
              <div className="frame-options">
                <article>
                  <FrameIllustration />
                  <h3>Magnetic frame</h3>
                  <p>Two printed parts, held together with magnets.</p>
                  <div>
                    <a download href="/frames/frame-polaroid-part1.stl">
                      <Download size={14} /> Part 1 · STL
                    </a>
                    <a download href="/frames/frame-polaroid-part2.stl">
                      <Download size={14} /> Part 2 · STL
                    </a>
                  </div>
                  <a
                    className="source-link"
                    target="_blank"
                    rel="noreferrer"
                    href="https://www.printables.com/model/149884-magnetic-photo-frame-polaroidinstax-style/files"
                  >
                    Model & assembly details ↗
                  </a>
                </article>
                <article>
                  <FrameIllustration desk />
                  <h3>Desk frame</h3>
                  <p>A freestanding frame for your favorite memory.</p>
                  <div>
                    <a download href="/frames/polaroid%20frame.stl">
                      <Download size={14} /> Desk frame · STL
                    </a>
                  </div>
                  <a
                    className="source-link"
                    target="_blank"
                    rel="noreferrer"
                    href="https://www.printables.com/model/155872-polaroid-frame/files"
                  >
                    Model & printing details ↗
                  </a>
                </article>
              </div>
              <p className="modal-footnote">
                These are the supplied, unchanged frame models. Check the model
                instructions and photo opening before sizing your paper print.
                The illustration is a visual guide.
              </p>
            </InfoModal>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
function FrameIllustration({ desk = false }: { desk?: boolean }) {
  return (
    <svg
      className="frame-illustration"
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={
          desk ? "M 68 30 L 89 84 L 42 84" : "M 35 17 L 82 30 L 65 91 L 18 78 Z"
        }
        fill="#c6baa0"
        stroke="#857e63"
        strokeWidth="1.5"
      />
      <path
        d="M 23 12 L 74 20 L 64 87 L 13 79 Z"
        fill="#faf2dc"
        stroke="#857e63"
        strokeWidth="1.5"
      />
      <path d="M 29 24 L 63 29 L 57 64 L 23 59 Z" fill="#7b8e77" />
      <path
        d="M 23 55 L 39 39 L 45 47 L 54 42 L 59 49 L 57 64 L 23 59 Z"
        fill="#aabb93"
      />
      <circle cx="53" cy="36" r="4" fill="#ebd49f" />
      <path d="M 24 71 L 49 75" stroke="#bdab89" strokeWidth="2" />
    </svg>
  );
}
function InfoModal({
  title,
  eyebrow,
  children,
  onClose,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    enabled = useStudioMotion();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const controls =
          ref.current?.querySelectorAll<HTMLElement>("button,a[href]");
        if (!controls?.length) return;
        const first = controls[0],
          last = controls[controls.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <motion.div
      className="modal-backdrop"
      initial={enabled ? { opacity: 0 } : false}
      animate={enabled ? "visible" : "still"}
      variants={{
        visible: { opacity: 1, transition: { duration: 0.16 } },
        still: { opacity: 1, transition: { duration: 0 } },
      }}
      exit={enabled ? { opacity: 0 } : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={ref}
        tabIndex={-1}
        className="info-modal"
        initial={enabled ? { y: 28, scale: 0.96 } : false}
        animate={enabled ? "visible" : "still"}
        variants={{
          visible: {
            y: 0,
            scale: 1,
            transition: { type: "spring", stiffness: 260, damping: 26 },
          },
          still: { y: 0, scale: 1, transition: { duration: 0 } },
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-title"
      >
        <div className="modal-top">
          <span className="eyebrow">{eyebrow}</span>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <h2 id="info-title">{title}</h2>
        {children}
      </motion.div>
    </motion.div>
  );
}
function PresetThumbnail({
  asset,
  composition,
  crop,
  film,
  copier,
}: {
  asset: Asset | null;
  composition: Composition;
  crop: typeof DEFAULT_CROP;
  film: number;
  copier: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const signature = JSON.stringify([
    crop,
    composition.effects.seed,
    film,
    copier,
  ]);
  useEffect(() => {
    let disposed = false;
    if (!asset) return;
    texture(
      asset,
      {
        crop,
        effects: { film, copier, seed: composition.effects.seed },
      },
      0.2,
    )
      .then((image) => {
        if (disposed || !ref.current) return;
        ref.current.width = image.width;
        ref.current.height = image.height;
        ref.current.getContext("2d")!.drawImage(image, 0, 0);
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
  }, [asset, signature]);
  return <canvas ref={ref} className="preset-image" aria-hidden="true" />;
}
