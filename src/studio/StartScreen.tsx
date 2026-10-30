import { useEffect, useState } from "react";
import { Upload, ArrowRight, BookOpen } from "lucide-react";
import { Link, useLocation } from "react-router";
import { examples, loadSample, type ExampleDefinition } from "./examples";
import type { Assets } from "../model";
import CompositionPreview from "./CompositionPreview";
import DemoCamera from "./DemoCamera";
import type { CameraPreferences } from "./CameraSettings";

export default function StartScreen({busy, hasSession, onUpload, onCamera, onExample}: {
  busy: boolean; hasSession: boolean; onUpload: () => void; onCamera: (settings?:CameraPreferences) => void;
  onExample: (example: ExampleDefinition) => void;
}) {
  const [assets, setAssets] = useState<Assets | null>(null);
  const location = useLocation();
  useEffect(() => {
    let cancelled = false;
    void loadSample().then(sample => {if (!cancelled) setAssets({sample});}).catch(() => {});
    return () => {cancelled = true;};
  }, []);
  return <main className="start-screen">
    {location.state?.notice && <p className="notice" role="status">{location.state.notice}</p>}
    <section className="camera-intro" aria-label="Create a Polaroid" aria-busy={busy}>
      <div className="intro-copy">
        <h1 tabIndex={-1}>Keep a little <em>of the moment.</em></h1>
      </div>
      <DemoCamera busy={busy} onCamera={onCamera}/>
      <div className="camera-start">
        <div className="start-actions">
          <button className="text-button upload-secondary" disabled={busy} onClick={onUpload}><Upload size={17}/>{busy ? "Opening photos…" : "Upload photos"}</button>
        </div>
        <p className="import-hint">Or drop photos here. JPG, PNG, HEIC and SVG.</p>
        <p className="local-note">Made on your device. Your photos stay yours.</p>
        {hasSession && <Link className="resume-link" to="/edit">Continue your Polaroid <ArrowRight size={16}/></Link>}
      </div>
    </section>
    <section className="examples" aria-labelledby="examples-title">
      <div className="section-heading"><div><h2 id="examples-title">A few ways to make it yours.</h2><p>Open an example and move things around.</p></div></div>
      <div className="example-grid">
        {examples.map(example => <article className="example-card" key={example.id}>
          <button className="example-art" disabled={busy} onClick={() => onExample(example)} aria-label={`Try ${example.title} example`}>
            {assets ? <CompositionPreview assets={assets} composition={example.composition} label={`${example.title} example Polaroid`} scale={.55}/> : <img src="/sample-flash.webp" alt="Vintage party photo"/>}
          </button>
          <div className="example-description"><h3>{example.title}</h3><p>{example.description}</p></div>
        </article>)}
        <div className="scrapbook-invite"><BookOpen size={28} strokeWidth={1.3}/><h3>More than one<br/>good moment?</h3><p>Make a scrapbook page or a classic photo strip.</p><Link to="/scrapbook" className="text-button">Open scrapbook <ArrowRight size={17}/></Link></div>
      </div>
    </section>
  </main>;
}
