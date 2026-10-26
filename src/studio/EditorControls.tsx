import {
  Copy,
  ImagePlus,
  Maximize2,
  MousePointer2,
  Scissors,
} from "lucide-react";
import { motion } from "motion/react";
import { clone, cropLayer, DEFAULT_CROP, type Tool } from "../model";
import { panelVariants } from "../useStudioMotion";
import { Range, PresetThumbnail } from "./shared";
import { colorNames, tapeColors, type Category, type Studio } from "./useStudioSession";
import NumericInput from "./NumericInput";
import FontPicker from "./FontPicker";
import TextFormatting from "./TextFormatting";
import LayerThumbnail from "./LayerThumbnail";
import { MAX_PIECE_SIZE } from "../limits";
import PositionControls from "./PositionControls";

const tools: { id: Tool; label: string; icon: typeof Copy }[] = [
  { id: "move", label: "Move", icon: MousePointer2 },
  { id: "crop", label: "Crop", icon: Maximize2 },
  { id: "cut", label: "Cut", icon: Scissors },
  { id: "repeat", label: "Repeat", icon: Copy },
];
const toolHelp: Partial<Record<Tool, string>> = {
  move: "Select a piece, then drag to move it. Use its corners to resize.",
  crop: "Drag a rectangle or the corner handles to trim the selected photo.",
  cut: "Draw a scissor path from edge to edge, or return to the starting circle to cut out a shape. Release to cut.",
  repeat:
    "Make a 3×3 grid. Adjust the box, then switch tools to edit each tile.",
};

function ToolSettings({ s }: { s: Studio }) {
  const { layer, tool, grid } = s;
  return (
    <div className="tool-target-controls">
      <p className="field-hint">{toolHelp[tool]}</p>
      {tool === "cut" && (
        <>
          <div className="segmented" aria-label="Cut mode">
            {(["freehand", "straight"] as const).map((mode) => (
              <button
                key={mode}
                aria-pressed={s.cutMode === mode}
                onClick={() => s.setCutMode(mode)}
              >
                {mode === "straight" ? "Straight line" : "Scissors"}
              </button>
            ))}
          </div>
          <details>
            <summary>Cut by angle</summary>
            <label className="field">
              Line angle
              <NumericInput
                label="Cut angle" min={-180} max={180}
                value={s.cutAngle}
                onCommit={s.setCutAngle}
              />
            </label>
            <button
              className="secondary-button"
              disabled={!layer?.source}
              onClick={() => {
                if (!layer) return;
                const a = (s.cutAngle * Math.PI) / 180,
                  distance = Math.max(layer.width, layer.height);
                s.cutPhoto(
                  layer.id,
                  [
                    [
                      layer.width / 2 - Math.cos(a) * distance,
                      layer.height / 2 - Math.sin(a) * distance,
                    ],
                    [
                      layer.width / 2 + Math.cos(a) * distance,
                      layer.height / 2 + Math.sin(a) * distance,
                    ],
                  ],
                  "straight",
                );
              }}
            >
              Cut through center
            </button>
          </details>
        </>
      )}
      {tool === "repeat" && !grid && (
        <button
          className="secondary-button"
          disabled={layer?.kind !== "photo"}
          onClick={() => layer && s.repeatPhoto(layer.id)}
        >
          Repeat 3 × 3
        </button>
      )}
      {tool === "repeat" && grid && (
        <div className="numeric-fields">
          {(["width", "height"] as const).map((key) => (
            <label className="field" key={key}>
              Grid {key}
              <NumericInput key={`${grid.box.id}-${key}`}
                label={`Grid ${key}`}
                min={12}
                max={MAX_PIECE_SIZE}
                value={Math.round(grid.box[key])}
                onCommit={(value) =>
                  s.adjustGrid(
                    {
                      ...grid.box,
                      [key]: value,
                    },
                    true,
                  )
                }
              />
            </label>
          ))}
        </div>
      )}
      {tool === "crop" && layer?.kind === "photo" && (
        <div className="numeric-fields">
          {(["width", "height"] as const).map((key) => (
            <label className="field" key={key}>
              Crop {key}
              <NumericInput
                key={`${layer.id}-${layer[key]}`}
                label={`Crop ${key}`}
                min={12}
                max={layer[key]}
                value={Math.round(layer[key])}
                onCommit={(value) => {
                  const amount = Math.max(
                    12,
                    Math.min(layer[key], value),
                  );
                  const next = clone(s.composition);
                  next.layers = next.layers.map((l) =>
                    l.id === layer.id
                      ? cropLayer(l, {
                          x: 0,
                          y: 0,
                          width: l.width,
                          height: l.height,
                          [key]: amount,
                        })
                      : l,
                  );
                  s.commit(next);
                }}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function PieceSettings({ s }: { s: Studio }) {
  const { layer } = s;
  if (!layer || (s.grid && s.tool === "repeat")) return null;
  return (
    <div className="selected-controls">
      <h3>
        {layer.kind === "photo"
          ? "Selected photo"
          : layer.kind === "text" ? "Selected text" : layer.kind === "tape"
            ? "Selected tape"
            : "Selected paper"}
      </h3>
      {layer.kind === "text" && <div className="text-settings">
        <label className="field">Text content
          <textarea aria-label="Text content" rows={3} maxLength={200} value={layer.text || ""}
            onChange={e => s.updateLayer({text: e.target.value, name: e.target.value.trim() ? `Text · ${e.target.value.trim().slice(0, 24)}` : "Text"}, true)} onBlur={s.finish}/>
        </label>
        <FontPicker label="Text font" value={layer.fontId} sample={layer.text} bold={layer.bold} italic={layer.italic} onChange={fontId => {s.setError(""); s.updateLayer({fontId});}}/>
        <TextFormatting key={layer.id} label="Text" size={layer.fontSize ?? Math.min(64, layer.height * .65)} bold={layer.bold} italic={layer.italic}
          onChange={change => {s.setError(""); s.updateLayer({...change, ...(change.fontSize ? {height: Math.max(layer.height, change.fontSize * 2.4 + 8)} : {})});}}/>
        <p className="field-hint">Text wraps inside its box. Enlarge the box to make room for more lines.</p>
        <label className="field text-color-field">Text color<input type="color" aria-label="Text color" value={layer.color} onChange={e => s.updateLayer({color: e.target.value}, true)} onBlur={s.finish}/></label>
      </div>}
      <Range
        label="Rotation"
        value={layer.rotation}
        min={-180}
        max={180}
        suffix="°"
        onChange={(v) => s.updateLayer({ rotation: v }, true)}
        onFinish={s.finish}
      />
      <Range
        label={layer.kind === "text" ? "Text box size" : "Size"}
        value={layer.width}
        min={20}
        max={650}
        suffix="px"
        onChange={(v) =>
          s.updateLayer(
            { width: v, height: (layer.height * v) / layer.width },
            true,
          )
        }
        onFinish={s.finish}
      />
      {layer.kind !== "photo" && layer.kind !== "text" && (
        <div className="color-row">
          <span>Color</span>
          <div>
            {tapeColors.map((color) => (
              <button
                key={color}
                style={{ background: color }}
                aria-label={`Piece color ${colorNames[color]}`}
                title={colorNames[color]}
                aria-pressed={layer.color === color}
                onClick={() => s.updateLayer({ color })}
              />
            ))}
          </div>
        </div>
      )}
      <PositionControls layer={layer} onChange={s.updateLayer}/>
      <details className="more-options">
        <summary>Size and transparency</summary>
        <div className="numeric-fields">
          {(["width", "height"] as const).map((key) => (
            <label className="field" key={key}>
              {key}
              <NumericInput key={`${layer.id}-${key}`}
                label={`Piece ${key}`}
                value={Math.round(layer[key])}
                min={12}
                max={MAX_PIECE_SIZE}
                onCommit={(value) =>
                  s.updateLayer(
                    {
                      [key]: value,
                    },
                  )
                }
              />
            </label>
          ))}
        </div>
        <label className="field">
          Angle
          <NumericInput
            label="Piece angle"
            min={-180}
            max={180}
            value={Math.round(layer.rotation)}
            onCommit={(value) =>
              s.updateLayer(
                {
                  rotation: value,
                },
              )
            }
          />
        </label>
        <p className="field-hint">Only the area inside the frame is included in your download.</p>
        <Range
          label="Opacity"
          value={layer.opacity * 100}
          onChange={(v) => s.updateLayer({ opacity: v / 100 }, true)}
          onFinish={s.finish}
        />

      </details>
    </div>
  );
}

function Pieces({ s }: { s: Studio }) {
  return (
    <details className="pieces-section">
      <summary>
        Photos and pieces <span>{s.composition.layers.length}</span>
      </summary>
      <div className="layer-list">
        {[
          ...s.composition.layers.filter((l) => l.kind !== "photo").reverse(),
          ...s.composition.layers.filter((l) => l.kind === "photo").reverse(),
        ].map((l) => (
          <button
            className="layer-row"
            aria-pressed={s.selected === l.id}
            key={l.id}
            onClick={() => {
              s.chooseTool("move");
              s.select(l.id);
              s.changeCategory(l.kind === "photo" ? "arrange" : "decorate");
            }}
          >
            <span
              className="layer-swatch"
              style={{ background: l.color || undefined }}
            >
              {l.assetId && s.assets[l.assetId] && <LayerThumbnail asset={s.assets[l.assetId]} layer={l} effects={s.composition.effects}/>}
            </span>
            <span>{l.name}</span>
          </button>
        ))}
      </div>
    </details>
  );
}

function LookSettings({ s }: { s: Studio }) {
  return (
    <>
      <h2>Photo look</h2>
      <div className="presets">
        {[
          { name: "Original", film: 0, copier: 0, grayscale: 0 },
          { name: "Warm film", film: 0.65, copier: 0, grayscale: 0 },
          { name: "Black & white", film: 0.35, copier: 0, grayscale: 1 },
          { name: "Copy shop", film: 0.2, copier: 0.85, grayscale: 0 },
        ].map((p) => (
          <button
            className="preset"
            key={p.name}
            aria-pressed={
              s.composition.effects.film === p.film &&
              s.composition.effects.copier === p.copier && (s.composition.effects.grayscale ?? 0) === p.grayscale
            }
            onClick={() => s.preset(p.film, p.copier, p.grayscale)}
          >
            <PresetThumbnail
              asset={s.asset}
              composition={s.composition}
              crop={s.layer?.crop || DEFAULT_CROP}
              film={p.film}
              copier={p.copier} grayscale={p.grayscale}
            />
            <span>{p.name}</span>
          </button>
        ))}
      </div>
      <Range
        label="Faded film"
        value={s.composition.effects.film * 100}
        onChange={(v) => s.setEffect("film", v)}
        onFinish={s.finish}
      />
      <Range
        label="Copy shop"
        value={s.composition.effects.copier * 100}
        onChange={(v) => s.setEffect("copier", v)}
        onFinish={s.finish}
      />
      <div className="control-section">
        <h2>Frame and caption</h2>
        <div className="color-row">
          <span>Frame color</span>
          <div>
            {["#fff9e9", "#ead0a0", "#f2ded2"].map((color) => (
              <button
                key={color}
                style={{ background: color }}
                aria-label={`Paper tone ${colorNames[color]}`}
                title={colorNames[color]}
                aria-pressed={s.composition.frameColor === color}
                onClick={() =>
                  s.commit({ ...clone(s.composition), frameColor: color })
                }
              />
            ))}
          </div>
        </div>
        <label className="field">
          Caption
          <input
            type="text"
            placeholder="Add a caption (optional)"
            maxLength={55}
            value={s.composition.caption}
            onChange={(e) =>
              s.preview({ ...clone(s.composition), caption: e.target.value })
            }
            onBlur={s.finish}
          />
        </label>
        <label className="field text-color-field">Caption color<input type="color" aria-label="Caption color" value={s.composition.captionColor || "#493e30"} onChange={e => s.preview({...s.composition, captionColor: e.target.value})} onBlur={s.finish}/></label>
        <FontPicker label="Caption font" value={s.composition.captionFont} sample={s.composition.caption} bold={s.composition.captionBold} italic={s.composition.captionItalic}
          onChange={captionFont => {s.setError(""); s.commit({...clone(s.composition), captionFont});}}/>
        <TextFormatting label="Caption" size={s.composition.captionSize ?? 25} max={48} bold={s.composition.captionBold} italic={s.composition.captionItalic}
          onChange={({fontSize, bold, italic}) => {s.setError(""); s.commit({...clone(s.composition),
            ...(fontSize !== undefined ? {captionSize: fontSize} : {}),
            ...(bold !== undefined ? {captionBold: bold} : {}),
            ...(italic !== undefined ? {captionItalic: italic} : {}),
          });}}/>
      </div>
    </>
  );
}

export default function EditorControls({
  studio: s,
  onUpload,
  enabled,
}: {
  studio: Studio;
  onUpload: () => void;
  enabled: boolean;
}) {
  return (
    <aside className="editor-controls" aria-label="Editing controls">
      <div className="categories" aria-label="Editing categories">
        {(["arrange", "decorate", "look"] as Category[]).map((category) => (
          <button
            key={category}
            aria-pressed={s.category === category}
            onClick={() => s.changeCategory(category)}
          >
            {category[0].toUpperCase() + category.slice(1)}
          </button>
        ))}
      </div>
      <motion.div
        key={s.category}
        className="category-content"
        initial={enabled ? "enter" : false}
        animate={enabled ? "visible" : "still"}
        variants={panelVariants}
      >
        {s.category === "arrange" && (
          <>
            <h2>Arrange your photos</h2>
            <button
              className="secondary-button add-photos"
              disabled={s.busy}
              onClick={onUpload}
            >
              <ImagePlus size={17} /> Add photos
            </button>
            <div className="tool-grid">
              {tools.map(({ id, label, icon: Icon }) => (
                <button
                  className="tool-button"
                  key={id}
                  title={label}
                  aria-pressed={s.tool === id}
                  onClick={() => s.chooseTool(id)}
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </div>
            <ToolSettings s={s} />
            {s.layer?.kind === "photo" && (
              <>
                <Range
                  label="Zoom"
                  min={100}
                  max={300}
                  value={(s.layer.crop?.zoom || 1) * 100}
                  onChange={(v) =>
                    s.updateLayer(
                      {
                        crop: {
                          ...(s.layer?.crop || DEFAULT_CROP),
                          zoom: v / 100,
                        },
                      },
                      true,
                    )
                  }
                  onFinish={s.finish}
                />
                {s.tool === "move" && <PieceSettings s={s} />}
              </>
            )}
          </>
        )}
        {s.category === "decorate" && (
          <>
            <h2>Text, tape and paper</h2>
            <div className="decoration-buttons">
              <button className="secondary-button add-text-button" onClick={s.addText}>Add text</button>
              <button
                className="secondary-button"
                title="Tape"
                onClick={() => s.chooseTool("tape")}
              >
                Add tape
              </button>
              <button
                className="secondary-button"
                title="Paper"
                onClick={() => s.chooseTool("paper")}
              >
                Add paper
              </button>
            </div>
            {s.layer && s.layer.kind !== "photo" ? (
              <PieceSettings s={s} />
            ) : (
              <p className="field-hint">
                Add text, tape or paper, or select a piece on the canvas to adjust it.
              </p>
            )}
          </>
        )}
        {s.category === "look" && <LookSettings s={s} />}
      </motion.div>
      <Pieces s={s} />
    </aside>
  );
}
