import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { X } from "lucide-react";
import { ACCEPT } from "./imports";
import Camera from "./Camera";
import { useStudioMotion } from "./useStudioMotion";
import { useStudioSession, type Screen } from "./studio/useStudioSession";
import { Dialog } from "./studio/shared";
import StartScreen from "./studio/StartScreen";
import EditScreen from "./studio/EditScreen";
import FinishScreen from "./studio/FinishScreen";
import type { ExampleDefinition } from "./studio/examples";

function SessionGuard({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return active ? (
    children
  ) : (
    <Navigate
      to="/"
      replace
      state={{
        notice:
          "Choose a photo or example to start. Photos are cleared when this page is refreshed.",
      }}
    />
  );
}

function StudioApp() {
  const s = useStudioSession();
  const enabled = useStudioMotion();
  const location = useLocation(),
    navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const intent = useRef<"replace" | "add">("replace");
  const [camera, setCamera] = useState(false),
    [dragging, setDragging] = useState(false);
  const [replacement, setReplacement] = useState<null | (() => void)>(null);
  const path = location.pathname;
  const previousPath = useRef(path);
  const leaveEditor = useRef(s.leaveEditor);
  leaveEditor.current = s.leaveEditor;
  useEffect(() => {
    if (previousPath.current === "/edit" && path !== "/edit")
      leaveEditor.current();
    previousPath.current = path;
    document.title =
      path === "/edit"
        ? "Edit · Poloroid"
        : path === "/finish"
          ? "Finish · Poloroid"
          : "Create a Polaroid · Poloroid";
    document.querySelector<HTMLElement>("main h1")?.focus();
    window.scrollTo?.(0, 0);
  }, [path]);
  const confirmReplacement = (action: () => void) => {
    if (s.hasSession) setReplacement(() => action);
    else action();
  };
  const openUpload = (mode: "replace" | "add") => {
    intent.current = mode;
    input.current?.click();
  };
  const importFiles = (files: File[], mode: "replace" | "add") => {
    if (!files.length) return;
    const run = () => {
      void s.upload(files, mode === "replace").then((success) => {
        if (success) navigate("/edit");
      });
    };
    if (mode === "replace") confirmReplacement(run);
    else run();
  };
  const tryExample = (example: ExampleDefinition) =>
    confirmReplacement(() => {
      void s.startExample(example).then((success) => {
        if (success) navigate("/edit");
      });
    });
  const go = (screen: Screen) => {
    s.leaveEditor();
    navigate(screen);
  };
  return (
    <MotionConfig reducedMotion="user">
      <div
        className="app-shell"
        data-motion={enabled ? "active" : "paused"}
        onDragOver={(e) => {
          if (Array.from(e.dataTransfer.types).includes("Files")) {
            e.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null))
            setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!s.busy)
            importFiles(
              Array.from(e.dataTransfer.files),
              path === "/edit" ? "add" : "replace",
            );
        }}
      >
        <input
          ref={input}
          type="file"
          hidden
          multiple
          accept={ACCEPT}
          aria-label="Upload a JPG, PNG, HEIC, HEIF, or SVG photo"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = "";
            importFiles(files, intent.current);
          }}
        />
        <header className="site-header">
          <Link className="wordmark" to="/" onClick={s.leaveEditor}>
            Poloroid<span className="wordmark-dot">.</span>
          </Link>
          <nav aria-label="Studio steps">
            {(
              [
                ["/", "Start"],
                ["/edit", "Edit"],
                ["/finish", "Finish"],
              ] as const
            ).map(([screen, label], index) => (
              <button
                key={screen}
                aria-current={path === screen ? "step" : undefined}
                disabled={screen !== "/" && (!s.hasSession || s.busy)}
                onClick={() => go(screen)}
              >
                <span>{index + 1}</span>
                {label}
              </button>
            ))}
          </nav>
        </header>
        {s.error && (
          <div className="error-banner" role="alert">
            <span>{s.error}</span>
            <button aria-label="Dismiss error" onClick={() => s.setError("")}>
              <X size={18} />
            </button>
          </div>
        )}
        <Routes>
          <Route
            path="/"
            element={
              <StartScreen
                busy={s.busy}
                hasSession={s.hasSession}
                onUpload={() => openUpload("replace")}
                onCamera={() => {
                  intent.current = "replace";
                  setCamera(true);
                }}
                onExample={tryExample}
              />
            }
          />
          <Route
            path="/edit"
            element={
              <SessionGuard active={s.hasSession}>
                <EditScreen
                  studio={s}
                  enabled={enabled}
                  onUpload={() => openUpload("add")}
                />
              </SessionGuard>
            }
          />
          <Route
            path="/finish"
            element={
              <SessionGuard active={s.hasSession}>
                <FinishScreen studio={s} />
              </SessionGuard>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {dragging && (
          <div className="drop-overlay" aria-hidden="true">
            Drop photos to {path === "/edit" ? "add them" : "start"}
          </div>
        )}
        <AnimatePresence>
          {s.message && (
            <motion.div
              className="toast"
              role="status"
              key={s.message}
              initial={enabled ? { opacity: 0, y: 12 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: enabled ? 0.15 : 0 }}
            >
              {s.message}
            </motion.div>
          )}
          {camera && (
            <Camera
              enabled={enabled}
              onClose={() => setCamera(false)}
              onCapture={(file) => {
                setCamera(false);
                importFiles([file], intent.current);
              }}
              onUpload={() => {
                setCamera(false);
                openUpload(intent.current);
              }}
            />
          )}
          {replacement && (
            <Dialog
              title="Start a new Polaroid?"
              onClose={() => setReplacement(null)}
            >
              <p>
                This replaces your current photos and edits. If the new photo
                cannot open, your work will stay intact.
              </p>
              <div className="dialog-actions">
                <button
                  className="secondary-button"
                  onClick={() => setReplacement(null)}
                >
                  Keep editing
                </button>
                <button
                  className="primary-button"
                  onClick={() => {
                    const action = replacement;
                    setReplacement(null);
                    action();
                  }}
                >
                  Start new Polaroid
                </button>
              </div>
            </Dialog>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <StudioApp />
    </BrowserRouter>
  );
}
