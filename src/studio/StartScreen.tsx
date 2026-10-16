import { useEffect, useState } from "react";
import { Camera, Upload, ArrowRight } from "lucide-react";
import { Link, useLocation } from "react-router";
import { examples, loadSample, type ExampleDefinition } from "./examples";
import type { Assets } from "../model";
import CompositionPreview from "./CompositionPreview";

export default function StartScreen({
  busy,
  hasSession,
  onUpload,
  onCamera,
  onExample,
}: {
  busy: boolean;
  hasSession: boolean;
  onUpload: () => void;
  onCamera: () => void;
  onExample: (example: ExampleDefinition) => void;
}) {
  const [assets, setAssets] = useState<Assets | null>(null);
  const location = useLocation();
  useEffect(() => {
    let cancelled = false;
    void loadSample()
      .then((sample) => {
        if (!cancelled) setAssets({ sample });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <main className="start-screen">
      {location.state?.notice && (
        <p className="notice" role="status">
          {location.state.notice}
        </p>
      )}
      <div className="start-heading">
        <h1 tabIndex={-1}>Create a Polaroid</h1>
        <p>Start with a photo. Make it your own.</p>
      </div>
      <section
        className="upload-area"
        aria-label="Add your photos"
        aria-busy={busy}
      >
        <Upload size={28} strokeWidth={1.5} aria-hidden="true" />
        <h2>{busy ? "Preparing your photos…" : "Drop your photos here"}</h2>
        <button className="primary-button" disabled={busy} onClick={onUpload}>
          Choose photos <ArrowRight size={17} />
        </button>
        <p className="formats">JPG / JPEG, PNG, HEIC / HEIF and SVG</p>
        <button
          className="camera-button text-button"
          disabled={busy}
          onClick={onCamera}
        >
          <Camera size={17} /> Use camera
        </button>
      </section>
      <p className="privacy-note">
        Your photos stay in this browser. Refreshing clears your work.
      </p>
      {hasSession && (
        <Link className="resume-link" to="/edit">
          Resume editing <ArrowRight size={16} />
        </Link>
      )}
      <section className="examples" aria-labelledby="examples-title">
        <div className="section-heading">
          <h2 id="examples-title">Or try an example</h2>
          <p>Everything here is editable.</p>
        </div>
        <div className="example-grid">
          {examples.map((example) => (
            <article className="example-card" key={example.id}>
              <div className="example-art">
                {assets ? (
                  <CompositionPreview
                    assets={assets}
                    composition={example.composition}
                    label={`${example.title} example Polaroid`}
                    scale={0.55}
                  />
                ) : (
                  <img src="/sample-coast.png" alt="Coastal photo" />
                )}
              </div>
              <div className="example-description">
                <h3>{example.title}</h3>
                <p>{example.description}</p>
                <button
                  className="text-button"
                  disabled={busy}
                  aria-label={`Try ${example.title} example`}
                  onClick={() => onExample(example)}
                >
                  Try example <ArrowRight size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
