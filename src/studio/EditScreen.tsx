import { ArrowRight, Redo2, RotateCcw, Undo2 } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import Stage from "../Stage";
import EditorControls from "./EditorControls";
import PieceMenu, { PieceContextMenu } from "./PieceMenu";
import type { Studio } from "./useStudioSession";

export default function EditScreen({
  studio: s,
  onUpload,
  enabled,
}: {
  studio: Studio;
  onUpload: () => void;
  enabled: boolean;
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const undo = useRef<HTMLButtonElement>(null), redo = useRef<HTMLButtonElement>(null);
  const focusAfterHistory = useRef<"undo" | "redo" | null>(null);
  const [viewportHeight, setViewportHeight] = useState(() => window.visualViewport?.height ?? window.innerHeight);
  useEffect(() => {
    const update = () => setViewportHeight(window.visualViewport?.height ?? window.innerHeight);
    window.visualViewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {window.visualViewport?.removeEventListener("resize", update); window.removeEventListener("resize", update);};
  }, []);
  useLayoutEffect(() => {
    if (!focusAfterHistory.current) return;
    const next = focusAfterHistory.current === "undo" ? undo.current : redo.current;
    if (next && !next.disabled) next.focus({preventScroll: true});
    focusAfterHistory.current = null;
  }, [s.history]);
  useEffect(() => { heading.current?.focus({preventScroll: true}); }, []);
  return (
    <main className="edit-screen">
      <div className="page-heading">
        <div>
          <h1 ref={heading} tabIndex={-1}>Edit your Polaroid</h1>
          <p>Arrange photos, add pieces, or adjust the look.</p>
        </div>
        <div className="editor-actions">
          <div className="history-actions">
            <button
              ref={undo}
              aria-label="Undo"
              disabled={!s.history.past.length}
              onClick={e => {
                if (s.history.past.length === 1 && document.activeElement === e.currentTarget) focusAfterHistory.current = "redo";
                s.undo();
              }}
            >
              <Undo2 size={16} /> Undo
            </button>
            <button
              ref={redo}
              aria-label="Redo"
              disabled={!s.history.future.length}
              onClick={e => {
                if (s.history.future.length === 1 && document.activeElement === e.currentTarget) focusAfterHistory.current = "undo";
                s.redo();
              }}
            >
              <Redo2 size={16} /> Redo
            </button>
            <button className="reset-button" onClick={s.reset}>
              <RotateCcw size={16} /> Reset
            </button>
          </div>
          <button
            className="primary-button continue-button"
            disabled={s.busy}
            onClick={() => {
              s.leaveEditor();
              navigate("/finish");
            }}
          >
            Continue <ArrowRight size={17} />
          </button>
        </div>
      </div>
      <div className="edit-layout" style={{"--editor-viewport-height": `${viewportHeight}px`} as CSSProperties}>
        <PieceContextMenu studio={s} onOpenChange={setMenuOpen}>
          <div className="workspace">
            <div className="canvas-toolbar">
              <span>{s.layer?.name || "Select a piece"}</span>
              <PieceMenu studio={s} onOpenChange={setMenuOpen} />
            </div>
            <Stage
              assets={s.assets}
              composition={s.composition}
              selected={s.selected}
              tool={s.tool}
              cutMode={s.cutMode}
              grid={s.grid?.box}
              enabled={enabled}
              menuOpen={menuOpen}
              onSelect={s.select}
              onChange={(next, final) =>
                final ? s.commit(next) : s.preview(next)
              }
              onRepeat={s.repeatPhoto}
              onCut={s.cutPhoto}
              onGrid={s.adjustGrid}
              onError={s.reportError}
            />
            {s.busy && (
              <p className="preparing" role="status">
                Preparing photos…
              </p>
            )}
          </div>
        </PieceContextMenu>
        <EditorControls studio={s} onUpload={onUpload} enabled={enabled} />
      </div>
    </main>
  );
}
