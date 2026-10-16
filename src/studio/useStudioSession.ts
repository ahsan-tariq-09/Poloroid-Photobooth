import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { importAsset } from "../imports";
import {
  addDecoration,
  clone,
  duplicateLayer,
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
export type Category = "arrange" | "decorate" | "look";
export type Screen = "/" | "/edit" | "/finish";
export const tapeColors = [
  "#d8b88a",
  "#e65b3c",
  "#6b897e",
  "#53582f",
  "#dfc1ae",
];
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
    [cutMode, setCutMode] = useState<"straight" | "freehand">("straight");
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
  const upload = (inputFiles: File | File[], replace = false) => {
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
              const added = photoLayer(id, value.name);
              resetSession(
                { [id]: value },
                { ...initialComposition(), layers: [added] },
              );
            } else {
              const added = photoLayer(
                id,
                value.name,
                baseline.current.layers.filter((l) => l.kind === "photo")
                  .length,
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
    setGrid(null);
    setTool("move");
    commit({
      ...clone(composition),
      layers: composition.layers.filter((l) => l.id !== selected),
    });
    setSelected(null);
  };
  const duplicate = () => {
    if (!selected) return;
    setGrid(null);
    setTool("move");
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
  const cutPhoto = (id: string, points: Point[], mode = cutMode) => {
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
    history,
    composition,
    assets,
    hasSession,
    busy,
    exporting,
    error,
    setError,
    message,
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
    duplicate,
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
