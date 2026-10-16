import { ArrowLeft, Download, Printer } from "lucide-react";
import { Link } from "react-router";
import type { Studio } from "./useStudioSession";
import type { ExportFormat } from "../render";
import CompositionPreview from "./CompositionPreview";

export default function FinishScreen({ studio: s }: { studio: Studio }) {
  return (
    <main className="finish-screen">
      <div className="page-heading">
        <div>
          <h1 tabIndex={-1}>Your Polaroid</h1>
          <p>Ready to download or print.</p>
        </div>
        <Link to="/edit" className="text-button">
          <ArrowLeft size={16} /> Back to editing
        </Link>
      </div>
      <div className="finish-layout">
        <div className="finished-art">
          <CompositionPreview
            assets={s.assets}
            composition={s.composition}
            label="Finished Polaroid"
            scale={1.5}
          />
        </div>
        <section className="finish-options" aria-label="Save your Polaroid">
          <h2>Save your Polaroid</h2>
          <label className="field">
            File format
            <select
              aria-label="Download format"
              value={s.format}
              disabled={s.exporting}
              onChange={(e) => s.setFormat(e.target.value as ExportFormat)}
            >
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
              <option value="heic">HEIC</option>
              <option value="svg">SVG</option>
            </select>
          </label>
          <button
            className="primary-button download-main"
            disabled={s.exporting || s.busy}
            onClick={() => void s.exportFile()}
          >
            <Download size={17} /> {s.exporting ? "Preparing…" : "Download"}
          </button>
          <button
            className="secondary-button print-button"
            aria-label="Print Polaroid"
            disabled={s.exporting || s.busy}
            onClick={() => void s.exportFile(true)}
          >
            <Printer size={17} /> Print
          </button>
          <p className="print-guidance">
            88 × 107 mm. Choose <strong>Actual size / 100% scale</strong> in
            your print settings.
          </p>
          <details className="printable-frames">
            <summary>Printable frames</summary>
            <p>Download a 3D-printable frame for your photo.</p>
            <h3>Magnetic frame</h3>
            <a download href="/frames/frame-polaroid-part1.stl">
              Download part 1 · STL
            </a>
            <a download href="/frames/frame-polaroid-part2.stl">
              Download part 2 · STL
            </a>
            <a
              target="_blank"
              rel="noreferrer"
              href="https://www.printables.com/model/149884-magnetic-photo-frame-polaroidinstax-style/files"
            >
              Model and printing details ↗
            </a>
            <h3>Desk frame</h3>
            <a download href="/frames/polaroid%20frame.stl">
              Download desk frame · STL
            </a>
            <a
              target="_blank"
              rel="noreferrer"
              href="https://www.printables.com/model/155872-polaroid-frame/files"
            >
              Model and printing details ↗
            </a>
            <p>Check each model’s opening before sizing your photo.</p>
          </details>
        </section>
      </div>
    </main>
  );
}
