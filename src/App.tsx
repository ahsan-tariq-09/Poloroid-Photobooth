import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
import { X, Volume2, VolumeX, BookOpen, ArrowRight } from "lucide-react";
import { ACCEPT } from "./imports";
import Camera from "./Camera";
import type { CameraPreferences } from "./studio/CameraSettings";
import { useStudioMotion } from "./useStudioMotion";
import { useStudioSession, type Screen } from "./studio/useStudioSession";
import { Dialog } from "./studio/shared";
import StartScreen from "./studio/StartScreen";
import FinishScreen from "./studio/FinishScreen";
import type { ExampleDefinition } from "./studio/examples";
import EditorLoader from "./studio/EditorLoader";
import ScrapbookScreen from "./studio/ScrapbookScreen";
import { useScrapbook } from "./studio/useScrapbook";
import { unpackPhoto, type StoredPhoto } from "./scrapbook";
import { soundEnabled, setSoundEnabled } from "./sounds";
import InstallApp from "./studio/InstallApp";

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
  const book = useScrapbook();
  const [sound, setSound] = useState(soundEnabled);
  const [mobileCamera] = useState(() => window.matchMedia("(max-width: 700px), (max-height: 500px) and (pointer: coarse)").matches);
  const cameraForBook = useRef(false);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const enabled = useStudioMotion();
  const location = useLocation(),
    navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const intent = useRef<"replace" | "add">("replace");
  const [camera, setCamera] = useState<boolean | CameraPreferences>(false),
    [dragging, setDragging] = useState(false);
  const [replacement, setReplacement] = useState<null | (() => void)>(null);
  const path = location.pathname;
  const cameraPage = path === "/camera";
  useEffect(s.clearMessage, [path, s.clearMessage]);
  const navigationKey = useRef(location.key);
  navigationKey.current = location.key;
  const previousPath = useRef(path);
  const leaveEditor = useRef(s.leaveEditor);
  leaveEditor.current = s.leaveEditor;
  useEffect(() => {
    if (previousPath.current === "/edit" && path !== "/edit")
      leaveEditor.current();
    previousPath.current = path;
    document.title =
      path === "/edit"
        ? "Edit · roid beta"
        : path === "/finish"
          ? "Finish · roid beta"
          : path === "/scrapbook"
            ? "Scrapbook · roid beta"
          : "Create a Polaroid · roid beta";
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
  const importFiles = (files: File[], mode: "replace" | "add", destination = "/edit", processed = false) => {
    if (!files.length) return;
    const run = () => {
      const startedAt = navigationKey.current;
      void s.upload(files, mode === "replace", processed).then((success) => {
        if (success && mode === "replace") setEditingMemoryId(null);
        if (success && navigationKey.current === startedAt) navigate(destination);
      });
    };
    if (mode === "replace") confirmReplacement(run);
    else run();
  };
  const tryExample = (example: ExampleDefinition) =>
    confirmReplacement(() => {
      const startedAt = navigationKey.current;
      void s.startExample(example).then((success) => {
        if (success) setEditingMemoryId(null);
        if (success && navigationKey.current === startedAt) navigate("/edit");
      });
    });
  const go = (screen: Screen) => {
    s.leaveEditor();
    navigate(screen);
  };
  const editSavedPhoto = (photo: StoredPhoto, id: string) => confirmReplacement(() => {
    const startedAt = navigationKey.current;
    void unpackPhoto(photo).then(({assets,composition}) => {
      if (navigationKey.current !== startedAt) return;
      s.restore(assets,composition); setEditingMemoryId(id); navigate("/edit");
    }).catch(()=>s.setError("This saved photo could not open. Your scrapbook is still available."));
  });
  return (
    <MotionConfig reducedMotion={enabled ? "never" : "always"}>
      <div
        className={`app-shell${cameraPage ? " camera-page" : ""}`}
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
          if (path === "/scrapbook") { if (!book.busy) void book.addFiles(Array.from(e.dataTransfer.files)); return; }
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
        {!cameraPage && <header className="site-header">
          <Link className="wordmark" to="/" onClick={s.leaveEditor}>
            roid <span className="brand-beta">beta</span>
          </Link>
          <div className="header-controls"><nav aria-label="Studio steps">
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
          <Link className="scrapbook-nav" to="/scrapbook" aria-label="Scrapbook" aria-current={path === "/scrapbook" ? "page" : undefined}><BookOpen size={17}/><span>Scrapbook</span></Link>
          <button className="sound-toggle" aria-label={sound ? "Mute sound effects" : "Enable sound effects"} aria-pressed={sound} onClick={()=>{setSound(!sound);setSoundEnabled(!sound);}}>{sound?<Volume2 size={18}/>:<VolumeX size={18}/>}</button></div>
        </header>}
        {cameraPage && location.state?.notice && <p className="notice camera-notice" role="status">{location.state.notice}</p>}
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
              mobileCamera ? <Navigate to="/camera" replace state={location.state}/> : <StartScreen
                busy={s.busy}
                hasSession={s.hasSession}
                onUpload={() => openUpload("replace")}
                onCamera={(settings) => {
                  intent.current = "replace";
                  cameraForBook.current = false;
                  setCamera(settings ?? true);
                }}
                onExample={tryExample}
              />
            }
          />
          <Route path="/camera" element={<Camera
            presentation="screen"
            enabled={enabled}
            busy={s.busy}
            onClose={()=>navigate("/scrapbook")}
            onUpload={()=>openUpload("replace")}
            onCapture={(files,destination)=>importFiles(files,"replace",destination === "finish" ? "/finish" : "/edit",true)}
            navigation={<>
              {s.hasSession && <Link to="/edit" aria-label="Continue your Polaroid"><ArrowRight size={21}/></Link>}
              <Link to="/scrapbook" aria-label="Scrapbook"><BookOpen size={21}/></Link>
              <button aria-label={sound ? "Mute sound effects" : "Enable sound effects"} aria-pressed={sound} onClick={()=>{setSound(!sound);setSoundEnabled(!sound);}}>{sound?<Volume2 size={20}/>:<VolumeX size={20}/>}</button>
            </>}
          />}/>
          <Route
            path="/edit"
            element={
              <SessionGuard active={s.hasSession}>
                  <EditorLoader
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
                <FinishScreen studio={s} updatingScrapbook={!!editingMemoryId} scrapbookBusy={book.loading || book.busy} onScrapbook={()=>{s.finish();const startedAt=navigationKey.current;void book.addCurrent(s.assets,s.composition,editingMemoryId).then(success=>{if(navigationKey.current!==startedAt)return;if(success)navigate("/scrapbook");else s.setError("The scrapbook could not accept this photo. Check its storage message or page limit.");});}} />
              </SessionGuard>
            }
          />
          <Route path="/scrapbook" element={<ScrapbookScreen studio={book} onCamera={()=>{intent.current="replace";cameraForBook.current=true;if(mobileCamera)navigate("/camera");else setCamera(true);}} onEditPhoto={editSavedPhoto}/>}/>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {!cameraPage && <footer className="project-about" aria-labelledby="about-title">
          <div>
            <h2 id="about-title">About roid</h2>
          </div>
          <div className="about-copy">
            <p>roid is a playful photo studio inspired by instant photography and the joy of making things by hand. Turn a photo into a keepsake: cut it up, layer it, add a few words, and make it yours.</p>
            <p>Made in your browser, with your photos staying on your device. Download your artwork, print it, or pair it with a 3D-printable frame.</p>
            <p className="field-hint">Save your scrapbook on this device, or download your Polaroid to keep it. Unsaved edits clear when you close or refresh.</p>
            <InstallApp/>
          </div>
        </footer>}
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
              initialSettings={camera === true ? undefined : camera}
              onClose={() => setCamera(false)}
              onCapture={(files, destination) => {
                setCamera(false);
                importFiles(files, intent.current, destination === "finish" ? "/finish" : "/edit", true);
              }}
              onUpload={() => {
                setCamera(false);
                if(cameraForBook.current){navigate("/scrapbook");book.setStatus("Use Add photos to choose photos for your page.");}
                else openUpload(intent.current);
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
