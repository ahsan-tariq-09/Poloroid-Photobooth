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

- Upload JPG/JPEG, PNG, HEIC/HEIF, or a self-contained static SVG; drag-and-drop works too. Camera capture includes a three-second countdown and a camera flip option.
- Crop: drag the photograph to reframe it and use Zoom to scale it. Move: drag collage layers. Layers also have size, rotation, opacity, ordering, and nudge controls.
- Cut: choose Across or Down, then click a photograph to split at that location. Split in half provides a keyboard-accessible alternative. Repeat duplicates a piece. Tape and Paper add editable decorations.
- Distort: adjust faded-film grain and copier band/channel displacement. Undo/redo commits an entire gesture at once.
- Add a caption and choose a paper tone. Download PNG or SVG to keep the finished Polaroid.
- Download the supplied STL frame models from Printable frames. They are physical frame downloads, independent of the image export. Consult their source pages for dimensions, printing and assembly instructions, and licensing. Size your paper print to the frame opening; PNG output does not guarantee a physical fit.

Keyboard shortcuts: Move `V`, Crop `C`, Cut `X`, Repeat `D`, Tape `T`, Paper `P`, Distort `E`; undo `Ctrl/⌘ Z`, redo `Ctrl/⌘ Shift Z`; arrow keys nudge the selected layer (Shift moves 10 units); Delete removes a selected piece; Escape clears selection or closes a dialog.

## Interface interactions

Motion for React animates tool selection, panel changes, dialogs, camera countdown and download confirmation. The Polaroid enters the workspace and reveals its photo; dragged pieces lift and settle, inserted collage elements land on the paper, and cuts briefly show their seam. These are temporary interface animations, separate from composition state and undo history. PNG/SVG exports always use the complete final composition. No new photo filters were added in this upgrade.

Reduced-motion settings are respected, and animations settle when the page is hidden. The stage reuses processed photo textures during animation and layer movement rather than running photo effects each frame. Preset thumbnails now render the current uploaded photo.

## Image handling and exports

All image decoding, editing and exports happen on the user's device. No photo-upload endpoint, account, analytics, or Python service is used. User images remain in memory and are not persisted. Reloading clears your session.

HEIC conversion lazily imports `heic-to/csp`. It decodes the still image and uses libheif's image transforms. Live Photo playback, HDR-preserving output, and multiple-photo HEIF editing are outside this prototype. Conversion failures leave the previous composition intact.

SVG uploads are sanitized with DOMPurify and loaded as isolated images. Scripts, event handlers, foreign objects, and animations are removed. External images, styles and fonts must be embedded or outlined before upload. Valid `viewBox` dimensions or explicit pixel dimensions are required. SVGs are edited as a whole artwork layer; individual vector-path editing is not provided.

PNG exports render at 3× logical resolution (1560 × 1920 pixels for an unmodified frame). Bounds expand for collage layers outside the frame. SVG exports share the same scene geometry: the frame and paper remain vectors, untouched SVG source remains embedded vector artwork, and photographs or effect-rendered image layers are embedded PNGs. Lettering is embedded as a transparent bitmap so exported files work without installed fonts. Everything needed to reopen an export is inside the file.

WebGPU runs the actual effect shader in `src/effects.wgsl`. The Canvas implementation uses the same seeded grain and displacement formulas when GPU initialization fails or the device is lost. The HEIC decoder is a separate lazy bundle; its size does not affect the initial editor download.

## Project structure

- `src/model.ts`, `history.ts`: immutable layer geometry and gesture history.
- `src/imports.ts`: supported file detection, HEIC conversion, SVG validation.
- `src/render.ts`, `effects.ts`, `effects.wgsl`: shared composition geometry, Canvas/SVG exports, GPU/CPU effects.
- `src/App.tsx`, `Stage.tsx`, `Camera.tsx`, `styles.css`: responsive interface, pointer editing and camera lifecycle.
- `public/frames`: the three unchanged STL files supplied for this project.
- `docs/inspiration`: the supplied references used for the design, retained as documentation rather than displayed as stock website screenshots.
- `.openai/hosting.json`: private Sites deployment identity and static `dist` output.

## References and credits

The design follows the supplied **Design Document for Photobooth**, by Ahsan Tariq, Nairran Zargar, and Md Toha Tawsif. The interaction is a square Polaroid disrupted through cutting, layering, adhesive and analog distortion.

See [the design reference map](docs/DESIGN.md) for the actual inspiration images and how they shaped the interface. Original sample imagery and its generation prompt are documented there.

Supplied models:

- [Magnetic Photo Frame (Polaroid/Instax style)](https://www.printables.com/model/149884-magnetic-photo-frame-polaroidinstax-style/files): `frame-polaroid-part1.stl`, `frame-polaroid-part2.stl`.
- [Polaroid frame](https://www.printables.com/model/155872-polaroid-frame/files): `polaroid frame.stl`.

The existing GPL-3.0 repository license is preserved. Supplied third-party references and STL models retain their original rights; consult their source listings. Dependency license notices accompany their packages.
