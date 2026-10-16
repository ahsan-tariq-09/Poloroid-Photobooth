# Poloroid

A photo-first browser studio with a warm paper palette, upright Polaroids and a Start → Edit → Finish flow. Built with React, React Router, TypeScript, Vite, WebGPU and a Canvas fallback.

Public site: [poloroid-photobooth.vercel.app](https://poloroid-photobooth.vercel.app/).

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

## Deploy with Vercel

`vercel.json` configures the Vite build, static `dist` output and explicit `/edit` and `/finish` rewrites. Static assets and STL downloads keep their original paths. Use Node 24 and set the build environment variable `ENABLE_EXPERIMENTAL_COREPACK=1` so Vercel uses the pinned pnpm version in `package.json`. No application secrets or backend are required.

The Vercel project is `poloroid-photobooth` in `knightahsan09-7593`. Preview deployments require Vercel authentication. The initial deployment uses the local checkout because the Vercel account does not yet have a GitHub login connection. To enable automatic deployments, connect GitHub in Vercel and link `ahsan-tariq-09/Poloroid-Photobooth` in the project's Git settings.

For a manual preview, link the checkout to that project, verify the project and workspace with `vercel project inspect --non-interactive`, then run `vercel deploy --target preview`. Local `.vercel/` settings and environment files are excluded from Git.

## Use the studio

1. **Start (`/`)**: choose or drop JPG/JPEG, PNG, HEIC/HEIF or self-contained SVG files, use the camera, or try Classic, Cut and taped, or 3×3 grid. Examples reuse the coastal photo and render their thumbnails from the same deterministic composition that opens in Edit.
2. **Edit (`/edit`)**: the fixed, upright Polaroid stays above the photo layers. Arrange contains Add photos, Move, Crop, Cut, Repeat and Zoom. Decorate adds tape/paper and exposes color, rotation and size. Look contains film/copier settings, frame color and caption. Photos and pieces expands layer selection; the Piece menu provides copying, pasting, deletion, ordering and page alignment; More options expands precise geometry and nudging.
3. **Finish (`/finish`)**: download PNG, JPEG, genuine HEIC or self-contained SVG, print, or download the separate STL frame models. Every artwork includes the complete frame and any user-entered caption, with no editor controls or decorative slogans.

The initial upload opens a new composition with an empty caption. Additional photos in Edit join the existing composition independently. Imports decode sequentially and successful files survive mixed-batch failures. Returning to Start offers Resume editing; starting a new upload or example asks before replacing the existing work. Failed replacement imports leave that work intact.

Navigation, category selection and temporary animations do not enter composition history. Back/Forward and Back to editing preserve assets, selection and Undo/Redo. Refresh clears the in-memory session; direct Edit/Finish visits without a session return to Start with an explanation. No account or storage is added.

Crop trims through a drawn rectangle or corner handles without stretching the surviving pixels. Cut defaults to Scissors: draw a non-self-crossing edge-to-edge path, or return to the starting circle to cut out a closed shape. Each connected piece can move independently; the surrounding piece retains its hole. Straight line and Cut by angle remain available. Invalid strokes leave the composition unchanged. Repeat creates exactly nine full copies in a fitted 3×3 grid; its box adjusts the tiles together until the tool or category changes. Use Copy and Paste in the Piece menu to copy a piece within the current session. Copy does not add an Undo step; each paste does.

The Piece menu is available above the canvas, on right-click, and by long-press. Its Layer submenu has Bring forward, Bring to front, Send backward and Send to back, within the photo or decoration band. The frame always stays above photos and below tape/paper. Align to page uses the outer Polaroid frame and the selected piece's rotated outline: Left, Center, Right, Top, Middle and Bottom. Clipboard contents stay in memory and clear when starting a new session.

Photos moved outside the frame stay visible behind it. The workspace has fixed margins and does not resize while moving pieces. Finished previews, all downloads and print output include photo overflow; the frame itself still prints at 88 × 107 mm.

Accessible menus use [Radix Primitives](https://www.radix-ui.com/primitives/docs/components/context-menu). Cutting and holes use the existing [polyclip-ts](https://github.com/luizbarboza/polyclip-ts) engine, shared by hit testing, Canvas and SVG geometry. The editor and menu code load only when entering Edit.

Gestures commit on release. Undo/Redo reverses each completed action. Reset restores the initial composition (including an example's arrangement) plus the original arrangement of photos subsequently added. Individual layers can rotate; the outer frame stays upright. All controls retain native Tab, button and form keyboard behavior, and dialogs support Escape dismissal.

Print prepares one Polaroid with an outer frame of **88 × 107 mm**, centered on the sheet. Choose **Actual size / 100% scale**, disable headers/footers, and avoid Fit to page in the printer dialog. Decorative overflow keeps its original scale. Printer settings and physical calibration can override sizing. Check each supplied STL's opening separately before fitting a photo.

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
- `src/App.tsx`: routing, session guards, upload intent and replacement confirmation.
- `src/studio/`: shared session hook, Start/Edit/Finish screens, grouped controls, deterministic examples and shared-renderer previews.
- `src/Stage.tsx`, `Camera.tsx`: pointer editing and camera lifecycle.
- `src/styles.css`, `studio/canvas.css`: responsive layout, canvas interactions, dialogs and physical print styles.
- `public/frames`: the three unchanged STL files supplied for this project.
- `docs/inspiration`: the supplied references used for the design, retained as documentation rather than displayed as stock website screenshots.
- `.openai/hosting.json`: retained identity for the earlier Sites preview; the public delivery target is Vercel.

## Validation

The current studio passes 67 automated tests, TypeScript checks, production and Docker builds. The dependency audit reports no known vulnerabilities. See [validation coverage and device limitations](docs/VALIDATION.md) and the [desktop interface verification view](docs/studio-desktop.png).

## References and credits

The design follows the supplied **Design Document for Photobooth**, by Ahsan Tariq, Nairran Zargar, and Md Toha Tawsif. The interaction is a square Polaroid disrupted through cutting, layering, adhesive and analog distortion.

See [the design reference map](docs/DESIGN.md) for the actual inspiration images and how they shaped the interface. Original sample imagery and its generation prompt are documented there.

Supplied models:

- [Magnetic Photo Frame (Polaroid/Instax style)](https://www.printables.com/model/149884-magnetic-photo-frame-polaroidinstax-style/files): `frame-polaroid-part1.stl`, `frame-polaroid-part2.stl`.
- [Polaroid frame](https://www.printables.com/model/155872-polaroid-frame/files): `polaroid frame.stl`.

The existing GPL-3.0 repository license is preserved. Supplied third-party references and STL models retain their original rights; consult their source listings. Dependency license notices accompany their packages.
