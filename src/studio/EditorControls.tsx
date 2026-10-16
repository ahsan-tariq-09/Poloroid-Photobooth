import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Copy,
  ImagePlus,
  Maximize2,
  MousePointer2,
  Scissors,
  Trash2,
} from "lucide-react";
import { motion } from "motion/react";
import { clone, cropLayer, DEFAULT_CROP, type Tool } from "../model";
import { panelVariants } from "../useStudioMotion";
import { Range, PresetThumbnail } from "./shared";
import { tapeColors, type Category, type Studio } from "./useStudioSession";

const tools: { id: Tool; label: string; icon: typeof Copy }[] = [
  { id: "move", label: "Move", icon: MousePointer2 },
  { id: "crop", label: "Crop", icon: Maximize2 },
  { id: "cut", label: "Cut", icon: Scissors },
  { id: "repeat", label: "Repeat", icon: Copy },
];
const toolHelp: Partial<Record<Tool, string>> = {
  move: "Select a piece, then drag to move it. Use its corners to resize.",
  crop: "Drag a rectangle or the corner handles to trim the selected photo.",
  cut: "Draw from one edge of the photo to another. Release to cut.",
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
            {(["straight", "freehand"] as const).map((mode) => (
              <button
                key={mode}
                aria-pressed={s.cutMode === mode}
                onClick={() => s.setCutMode(mode)}
              >
                {mode === "straight" ? "Straight" : "Freehand"}
              </button>
            ))}
          </div>
          <details>
            <summary>Cut by angle</summary>
            <label className="field">
              Line angle
              <input
                aria-label="Cut angle"
                type="number"
                min={-180}
                max={180}
                value={s.cutAngle}
                onChange={(e) => s.setCutAngle(Number(e.target.value))}
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
          {(["x", "y", "width", "height"] as const).map((key) => (
            <label className="field" key={key}>
              Grid {key}
              <input
                aria-label={`Grid ${key}`}
                type="number"
                min={key === "x" || key === "y" ? -200 : 12}
                value={Math.round(grid.box[key])}
                onChange={(e) =>
                  s.adjustGrid(
                    {
                      ...grid.box,
                      [key]: Math.max(
                        key === "x" || key === "y" ? -200 : 12,
                        Number(e.target.value),
                      ),
                    },
                    false,
                  )
                }
                onBlur={s.finish}
                onKeyUp={(e) => {
                  if (e.key === "Enter") s.finish();
                }}
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
              <input
                key={`${layer.id}-${layer[key]}`}
                aria-label={`Crop ${key}`}
                type="number"
                min={12}
                max={layer[key]}
                defaultValue={Math.round(layer[key])}
                onBlur={(e) => {
                  const amount = Math.max(
                    12,
                    Math.min(layer[key], Number(e.target.value)),
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
          : layer.kind === "tape"
            ? "Selected tape"
            : "Selected paper"}
      </h3>
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
        label="Size"
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
      {layer.kind !== "photo" && (
        <div className="color-row">
          <span>Color</span>
          <div>
            {tapeColors.map((color) => (
              <button
                key={color}
                style={{ background: color }}
                aria-label={`Piece color ${color}`}
                aria-pressed={layer.color === color}
                onClick={() => s.updateLayer({ color })}
              />
            ))}
          </div>
        </div>
      )}
      <details className="more-options">
        <summary>More options</summary>
        <div className="numeric-fields">
          {(["x", "y", "width", "height"] as const).map((key) => (
            <label className="field" key={key}>
              {key}
              <input
                aria-label={`Piece ${key}`}
                type="number"
                value={Math.round(layer[key])}
                min={key === "x" || key === "y" ? -200 : 12}
                onChange={(e) =>
                  s.updateLayer(
                    {
                      [key]: Math.max(
                        key === "x" || key === "y" ? -200 : 12,
                        Number(e.target.value),
                      ),
                    },
                    true,
                  )
                }
                onBlur={s.finish}
                onKeyUp={(e) => {
                  if (e.key === "Enter") s.finish();
                }}
              />
            </label>
          ))}
        </div>
        <label className="field">
          Angle
          <input
            aria-label="Piece angle"
            type="number"
            min={-180}
            max={180}
            value={Math.round(layer.rotation)}
            onChange={(e) =>
              s.updateLayer(
                {
                  rotation: Math.max(
                    -180,
                    Math.min(180, Number(e.target.value)),
                  ),
                },
                true,
              )
            }
            onBlur={s.finish}
          />
        </label>
        <Range
          label="Opacity"
          value={layer.opacity * 100}
          onChange={(v) => s.updateLayer({ opacity: v / 100 }, true)}
          onFinish={s.finish}
        />
        <div className="nudge-actions">
          <span>Move</span>
          {(
            [
              ["Left", ArrowLeft, -5, 0],
              ["Up", ArrowUp, 0, -5],
              ["Down", ArrowDown, 0, 5],
              ["Right", ArrowRight, 5, 0],
            ] as const
          ).map(([name, Icon, dx, dy]) => (
            <button
              key={name}
              aria-label={`Move ${name}`}
              onClick={() =>
                s.updateLayer({ x: layer.x + dx, y: layer.y + dy })
              }
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
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
        {[...s.composition.layers].reverse().map((l) => (
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
              {l.assetId && <img src={s.assets[l.assetId]?.url} alt="" />}
            </span>
            <span>{l.name}</span>
          </button>
        ))}
      </div>
      <div className="layer-actions">
        <button
          disabled={!s.layer}
          aria-label="Bring forward"
          onClick={() => s.reorder(1)}
        >
          <ArrowUp size={15} /> Forward
        </button>
        <button
          disabled={!s.layer}
          aria-label="Send backward"
          onClick={() => s.reorder(-1)}
        >
          <ArrowDown size={15} /> Backward
        </button>
        <button
          disabled={!s.layer}
          aria-label="Duplicate selected piece"
          onClick={s.duplicate}
        >
          <Copy size={15} /> Duplicate
        </button>
        <button
          disabled={!s.layer}
          aria-label="Delete selected piece"
          onClick={s.remove}
        >
          <Trash2 size={15} /> Delete
        </button>
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
          { name: "Original", film: 0, copier: 0 },
          { name: "Sun-faded", film: 0.65, copier: 0 },
          { name: "Copy shop", film: 0.2, copier: 0.85 },
        ].map((p) => (
          <button
            className="preset"
            key={p.name}
            aria-pressed={
              s.composition.effects.film === p.film &&
              s.composition.effects.copier === p.copier
            }
            onClick={() => s.preset(p.film, p.copier)}
          >
            <PresetThumbnail
              asset={s.asset}
              composition={s.composition}
              crop={s.layer?.crop || DEFAULT_CROP}
              film={p.film}
              copier={p.copier}
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
                aria-label={`Paper tone ${color}`}
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
            <h2>Tape and paper</h2>
            <div className="decoration-buttons">
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
                Add tape or paper, or select a decoration on the canvas to
                adjust it.
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
