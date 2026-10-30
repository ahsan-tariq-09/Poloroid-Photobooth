import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { importAsset } from "../imports";
import { captureDate } from "./captureDate";
import {
  addDecoration,
  addText as addTextLayer,
  clone,
  pasteLayer,
  orderLayer,
  alignLayer,
  type LayerOrder,
  type Alignment,
  initialComposition,
  cutLayer,
  repeatLayer,
  transformGrid,
  photoLayer,
  type Layer,
  type Assets,
  type Point,
  type Composition,
  type Tool,
} from "../model";
import { historyReducer } from "../history";
import { initializeEffects } from "../effects";
import {
  exportFile as downloadArtwork,
  printComposition,
  type ExportFormat,
} from "../render";
import { loadSample, type ExampleDefinition } from "./examples";
import { assertComposition } from "../limits";
export type Category = "arrange" | "decorate" | "look";
export type Screen = "/" | "/edit" | "/finish";
export const tapeColors = [
  "#d8b88a",
  "#e65b3c",
  "#6b897e",
  "#53582f",
  "#dfc1ae",
];
export const colorNames: Record<string, string> = {
  "#d8b88a": "Sand", "#e65b3c": "Terracotta", "#6b897e": "Sage",
  "#53582f": "Olive", "#dfc1ae": "Blush", "#fff9e9": "Cream",
  "#ead0a0": "Sand", "#f2ded2": "Blush",
};
export function useStudioSession() {
  const [empty] = useState(() => initialComposition());
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: empty,
    future: [],
  });
  const [draft, setDraft] = useState<Composition | null>(null),
    draftRef = useRef<Composition | null>(null);
  const composition = draft || history.present;
  const [assets, setAssets] = useState<Assets>({});
  const assetsRef = useRef<Assets>({}),
    baseline = useRef<Composition>(empty);
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
    [cutMode, setCutMode] = useState<"straight" | "freehand">("freehand");
  const [clipboard, setClipboard] = useState<Layer | null>(null);
  const [category, setCategory] = useState<Category>("arrange");
  const [hasSession, setHasSession] = useState(false);
  const [busy, setBusy] = useState(false),
    [exporting, setExporting] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const request = useRef(0),
    alive = useRef(true),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layer = composition.layers.find((l) => l.id === selected);
  useEffect(() => {
    if (selected && !composition.layers.some(l => l.id === selected))
      setSelected(composition.layers.at(-1)?.id || null);
  }, [selected, composition.layers]);
  const asset =
    (layer?.assetId ? assets[layer.assetId] : null) ||
    Object.values(assets)[0] ||
    null;
  const commit = useCallback((value: Composition) => {
    try { assertComposition(value); } catch (e) { setError((e as Error).message); return false; }
    compositionRef.current = value;
    draftRef.current = null;
    setDraft(null);
    dispatch({ type: "commit", value });
    return true;
  }, []);
  const preview = (value: Composition) => {
    try { assertComposition(value); } catch (e) { setError((e as Error).message); return false; }
    compositionRef.current = value;
    draftRef.current = value;
    setDraft(value);
    return true;
  };
  const finish = () => {
    if (draftRef.current) commit(draftRef.current);
  };
  const toast = useCallback((text: string) => {
    setMessage(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setMessage(""), 3500);
  }, []);
  const clearMessage = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setMessage("");
  }, []);
  const reportError = useCallback((text: string) => setError(text), []);
  const ownedUrls = useRef(new Set<string>());
  useEffect(() => {
    alive.current = true;
    void initializeEffects();
    return () => {
      alive.current = false;
      request.current++;
      ownedUrls.current.forEach((url) => URL.revokeObjectURL(url));
      ownedUrls.current.clear();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);
  // Assets remain available to every history snapshot. Replacement releases the old session.
  useEffect(() => {
    const retained = new Set(Object.values(assets).map((a) => a.url));
    ownedUrls.current.forEach((url) => {
      if (!retained.has(url)) {
        URL.revokeObjectURL(url);
        ownedUrls.current.delete(url);
      }
    });
  }, [assets]);
  const resetSession = (nextAssets: Assets, next: Composition) => {
    setClipboard(null);
    assetsRef.current = nextAssets;
    setAssets(nextAssets);
    baseline.current = clone(next);
    compositionRef.current = next;
    draftRef.current = null;
    setDraft(null);
    dispatch({ type: "reset", value: next });
    setHasSession(true);
    setSelected(next.layers.find((l) => l.kind === "photo")?.id || null);
    setTool("move");
    setCategory("arrange");
    setGrid(null);
  };
  const startExample = async (example: ExampleDefinition) => {
    const token = ++request.current;
    setBusy(true);
    setError("");
    try {
      const value = await loadSample();
      if (!alive.current || token !== request.current) return false;
      resetSession({ sample: value }, clone(example.composition));
      return true;
    } catch {
      if (alive.current)
        setError("The example could not load. Try again or upload a photo.");
      return false;
    } finally {
      if (alive.current && token === request.current) setBusy(false);
    }
  };
  const upload = (inputFiles: File | File[], replace = false, processed = false) => {
    finish();
    const files = Array.isArray(inputFiles) ? inputFiles : [inputFiles];
    const token = replace ? ++request.current : request.current;
    importCount.current++;
    setBusy(true);
    setError("");
    let succeeded = false;
    const operation = uploadQueue.current
      .then(async () => {
        const errors: string[] = [];
        for (const file of files) {
          if (!alive.current || token !== request.current) break;
          try {
            const value = await importAsset(file);
            if (!alive.current || token !== request.current) {
              if (value.url.startsWith("blob:")) URL.revokeObjectURL(value.url);
              break;
            }
            if (value.url.startsWith("blob:")) ownedUrls.current.add(value.url);
            const id = crypto.randomUUID();
            if (
              (replace && !succeeded) ||
              !Object.keys(assetsRef.current).length
            ) {
              const added = photoLayer(id, value.name, 0, value);
              resetSession(
                { [id]: value },
                { ...initialComposition(), caption: processed ? captureDate(file.lastModified) : "", effects: {film: processed ? 0 : .65, copier: 0, seed: 76}, layers: [added] },
              );
            } else {
              const added = photoLayer(
                id,
                value.name,
                baseline.current.layers.filter((l) => l.kind === "photo")
                  .length, value,
              );
              assetsRef.current = { ...assetsRef.current, [id]: value };
              setAssets(assetsRef.current);
              baseline.current.layers.push(clone(added));
              commit({
                ...clone(compositionRef.current),
                layers: [...compositionRef.current.layers, added],
              });
              setSelected(added.id);
              setTool("move");
              setCategory("arrange");
              setGrid(null);
            }
            succeeded = true;
          } catch (e) {
            errors.push(
              file.name +
                ": " +
                (e instanceof Error ? e.message : "Could not open this image."),
            );
          }
        }
        if (alive.current && token === request.current) {
          if (errors.length) setError(errors.join(" · "));
          else if (succeeded) toast("Photos added.");
        }
        return succeeded && token === request.current;
      })
      .finally(() => {
        importCount.current--;
        if (alive.current) setBusy(importCount.current > 0);
      });
    uploadQueue.current = operation.then(() => {});
    return operation;
  };
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
    } else if (["cut", "crop", "repeat"].includes(id)) {
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
  const addText = () => {
    finish();
    const next = addTextLayer(compositionRef.current);
    if (!commit(next)) return;
    setSelected(next.layers.at(-1)!.id);
    setCategory("decorate"); setTool("move"); setGrid(null);
    toast("Text added. Write your own words in Text content.");
  };
  const reorder = (action: LayerOrder) => {
    finish();
    setGrid(null);
    setTool("move");
    if (selected) commit(orderLayer(compositionRef.current, selected, action));
  };
  const align = (alignment: Alignment) => {
    finish();
    setGrid(null);
    setTool("move");
    const current = compositionRef.current;
    commit({
      ...current,
      layers: current.layers.map((l) =>
        l.id === selected ? alignLayer(l, alignment) : l,
      ),
    });
  };
  const remove = () => {
    if (!selected) return;
    setGrid(null);
    setTool("move");
    commit({
      ...clone(composition),
      layers: composition.layers.filter((l) => l.id !== selected),
    });
    setSelected(null);
  };
  const copy = () => {
    finish();
    const piece = compositionRef.current.layers.find((l) => l.id === selected);
    if (piece) {
      setClipboard(clone(piece));
      toast("Piece copied. Use Paste to add it.");
    }
  };
  const paste = () => {
    if (!clipboard) return;
    finish();
    setGrid(null);
    setTool("move");
    const next = pasteLayer(compositionRef.current, clipboard);
    commit(next);
    setSelected(next.layers.at(-1)!.id);
    setCategory(clipboard.kind === "photo" ? "arrange" : "decorate");
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
  const cutPhoto = (id: string, points: Point[], mode = cutMode) => {
    setError("");
    try {
      const next = cutLayer(compositionRef.current, id, points, mode);
      const oldIds = new Set(compositionRef.current.layers.map((l) => l.id));
      commit(next);
      setSelected(next.layers.find((l) => !oldIds.has(l.id))!.id);
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
    toast("Grid created. Switch tools to edit individual tiles.");
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
    try { assertComposition(next); } catch(e) {setError((e as Error).message); return;}
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
  const preset = (film: number, copier: number, grayscale = 0) => {
    commit({
      ...clone(composition),
      effects: { ...composition.effects, film, copier, grayscale },
    });
  };
  const exportFile = async (print = false) => {
    if (!asset || busy || exporting) return;
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
  const changeCategory = (value: Category) => {
    finish();
    setGrid(null);
    setTool("move");
    setCategory(value);
  };
  const leaveEditor = () => {
    finish();
    setGrid(null);
  };
  const reset = () => {
    commit(clone(baseline.current));
    setGrid(null);
    setSelected(null);
    setTool("move");
  };
  const select = (id: string | null) => {
    finish();
    setSelected(id);
    const piece = compositionRef.current.layers.find((l) => l.id === id);
    if (piece && category !== "look") {
      const nextCategory = piece.kind === "photo" ? "arrange" : "decorate";
      if (nextCategory !== category) {
        setCategory(nextCategory);
        setTool("move");
        setGrid(null);
      }
    }
  };
  return {
    restore: resetSession,
    addText,
    history,
    composition,
    assets,
    hasSession,
    busy,
    exporting,
    error,
    setError,
    message,
    clearMessage,
    category,
    changeCategory,
    tool,
    chooseTool,
    selected,
    select,
    layer,
    asset,
    cutMode,
    setCutMode,
    cutAngle,
    setCutAngle,
    grid,
    adjustGrid,
    commit,
    preview,
    finish,
    leaveEditor,
    updateLayer,
    reorder,
    remove,
    copy,
    paste,
    clipboard,
    align,
    undo,
    redo,
    reset,
    cutPhoto,
    repeatPhoto,
    setEffect,
    preset,
    format,
    setFormat,
    exportFile,
    upload,
    startExample,
    reportError,
  };
}
export type Studio = ReturnType<typeof useStudioSession>;
