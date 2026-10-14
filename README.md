# Poloroid — The Analog Photo Lab

A nostalgic browser photo studio for making deliberately imperfect Polaroids. Built with React, TypeScript, Vite, WebGPU, and a Canvas fallback. Every artwork download includes the Polaroid border and wider caption area.

## Run with Docker

```sh
docker compose up --build
```

Open http://localhost:8080. The multi-stage build installs dependencies inside a Node container and serves the built site using unprivileged Nginx. No host Node installation is required. Bindings default to loopback. For deployment beyond localhost, put the container behind HTTPS so camera capture and WebGPU are available.

## Run with Node

Requires Node 22.12+ and pnpm 11.25.0.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm preview
```

## Use the studio

- Add multiple JPG/JPEG, PNG, HEIC/HEIF, or self-contained SVG files through the picker or drag-and-drop. The first upload replaces the demo; later photos join the same Polaroid. Files decode sequentially, and an invalid file does not discard the others. Camera stills join the collage too.
- The Polaroid frame stays fixed above the photos. Photos and cut fragments are clipped to the square opening; tape and paper stay above the border. Desktop workspace dimensions remain steady while settings scroll.
- Move, resize corner handles, or use numeric position/size controls. Rotate tape and other layers with the circular handle or Rotation slider. Layer ordering stays within photo and decoration bands.
- Crop trims the selected piece through a drawn rectangle or corner handles, without stretching surviving pixels. Zoom independently reframes the selected photo source.
- Cut offers straight lines at any angle and non-self-crossing, edge-to-edge freehand strokes. Release the stroke to cut. Cut through center and its angle field provide a keyboard alternative. Invalid strokes do not change the collage.
- Repeat creates exactly nine full copies inside a fitted 3×3 grid. Adjust the group box or its numeric fields while Repeat is active, then switch tools to move, crop, or cut individual tiles. Duplicate remains a separate single-copy action.
- Editing gestures commit on release. Undo/Redo reverses one completed action. Reset restores all current source photos to their initial arrangement, clearing cuts, decorations and effects.
- Choose PNG, JPEG, HEIC, or SVG in Download format. Every download includes the finished frame and caption. PNG/SVG preserve transparent decorative overflow; JPEG/HEIC flatten it onto white.
- Print prepares one Polaroid with a physical frame of 88 × 107 mm, centered on the sheet. Select **Actual size / 100% scale**, disable headers/footers, and avoid Fit to page in the printer dialog. Printer-driver overrides and physical printer calibration remain outside the page's control.
- The supplied STL frame models remain separate downloads. Check their source dimensions before fitting an 88 × 107 mm print; no automatic STL fit is implied.

Keyboard shortcuts: Move `V`, Crop `C`, Cut `X`, Repeat `D`, Tape `T`, Paper `P`, Distort `E`; undo `Ctrl/⌘ Z`, redo `Ctrl/⌘ Shift Z`; arrow keys nudge the selected layer (Shift moves 10 units); Delete removes a selected piece; Escape clears selection or closes a dialog.

## Interface interactions

Motion for React animates tool selection, panel changes, dialogs, camera countdown and download confirmation. The Polaroid enters the workspace and reveals its photo; dragged pieces lift and settle, inserted collage elements land on the paper, and cuts briefly show their seam. These are temporary interface animations, separate from composition state and undo history. All downloads and printing always use the complete final composition. No new photo filters were added in this upgrade.

Reduced-motion settings are respected, and animations settle when the page is hidden. The stage reuses processed photo textures during animation and layer movement rather than running photo effects each frame. Preset thumbnails now render the current uploaded photo.

## Image handling and exports

All image decoding, editing and exports happen on the user's device. No photo-upload endpoint, account, analytics, or Python service is used. User images remain in memory and are not persisted. Reloading clears your session.

HEIC conversion lazily imports `heic-to/csp`. It decodes the still image and uses libheif's image transforms. Live Photo playback, HDR-preserving output, and multi-image HEIF container editing are outside this prototype. Conversion failures leave the previous composition intact.

SVG uploads are sanitized with DOMPurify and loaded as isolated images. Scripts, event handlers, foreign objects, and animations are removed. External images, styles and fonts must be embedded or outlined before upload. Valid `viewBox` dimensions or explicit pixel dimensions are required. SVGs are edited as a whole artwork layer; individual vector-path editing is not provided.

Raster exports render at 3× logical resolution (1560 × 1899 pixels before decorative overflow). The vector frame's true aspect ratio is 88:107; the raster includes subpixel rounding at its outer edge. Photos never expand export bounds. Tape and paper may extend beyond the frame. SVG exports share the same polygon masks, source mapping, transforms and layer bands as Canvas. Untouched SVG sources remain embedded vectors; raster/effect layers and caption lettering are embedded PNGs. SVG physical dimensions use the same millimeter scale as printing.

HEIC encoding lazily loads `elheif` in a dedicated worker. It encodes the completed, flattened image into actual HEIC bytes, validates the file brand, and terminates the worker after completion, failure, or a 90-second timeout. Encoding errors offer PNG/JPEG rather than silently relabeling another format. Source images and exports never leave the browser. The HEIC encoder and decoder are separate lazy bundles.

WebGPU runs the actual effect shader in `src/effects.wgsl`. The Canvas implementation uses the same seeded grain and displacement formulas when GPU initialization fails or the device is lost. The HEIC decoder is a separate lazy bundle; its size does not affect the initial editor download.

## Project structure

- `src/model.ts`, `history.ts`: immutable layer geometry and gesture history.
- `src/imports.ts`: supported file detection, HEIC conversion, SVG validation.
- `src/render.ts`, `effects.ts`, `effects.wgsl`: shared composition geometry, Canvas/SVG exports, GPU/CPU effects.
- `src/App.tsx`, `Stage.tsx`, `Camera.tsx`, `styles.css`: responsive interface, pointer editing and camera lifecycle.
- `public/frames`: the three unchanged STL files supplied for this project.
- `docs/inspiration`: the supplied references used for the design, retained as documentation rather than displayed as stock website screenshots.
- `.openai/hosting.json`: private Sites deployment identity and static `dist` output.

## Validation

The interaction upgrade passes 37 automated tests, TypeScript checks, the production build, and the Docker build. The test dependency audit is clean. See [validation coverage and device limitations](docs/VALIDATION.md) and the [desktop interface verification view](docs/studio-desktop.png).

## References and credits

The design follows the supplied **Design Document for Photobooth**, by Ahsan Tariq, Nairran Zargar, and Md Toha Tawsif. The interaction is a square Polaroid disrupted through cutting, layering, adhesive and analog distortion.

See [the design reference map](docs/DESIGN.md) for the actual inspiration images and how they shaped the interface. Original sample imagery and its generation prompt are documented there.

Supplied models:

- [Magnetic Photo Frame (Polaroid/Instax style)](https://www.printables.com/model/149884-magnetic-photo-frame-polaroidinstax-style/files): `frame-polaroid-part1.stl`, `frame-polaroid-part2.stl`.
- [Polaroid frame](https://www.printables.com/model/155872-polaroid-frame/files): `polaroid frame.stl`.

The existing GPL-3.0 repository license is preserved. Supplied third-party references and STL models retain their original rights; consult their source listings. Dependency license notices accompany their packages.
