# roid beta

A camera-first browser studio with warm paper, a physical-camera interface, upright Polaroids and a scrapbook for collages and photo strips. Built with React, React Router, TypeScript, Vite, WebGPU and a Canvas fallback. The production build supports installation and offline use.

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

`vercel.json` configures the Vite build, static `dist` output and explicit `/camera`, `/edit`, `/finish` and `/scrapbook` rewrites. Static assets and STL downloads keep their original paths. Use Node 24 and set the build environment variable `ENABLE_EXPERIMENTAL_COREPACK=1` so Vercel uses the pinned pnpm version in `package.json`. No application secrets or backend are required.

The Vercel project is `poloroid-photobooth` in `knightahsan09-7593`. Preview deployments require Vercel authentication. The initial deployment uses the local checkout because the Vercel account does not yet have a GitHub login connection. To enable automatic deployments, connect GitHub in Vercel and link `ahsan-tariq-09/Poloroid-Photobooth` in the project's Git settings.

For a manual preview, link the checkout to that project, verify the project and workspace with `vercel project inspect --non-interactive`, then run `vercel deploy --target preview`. Local `.vercel/` settings and environment files are excluded from Git.

## Use the studio

On phones, `/` opens the full-screen `/camera` route and requests camera permission immediately. Film starts loaded. The original leather-and-metal camera fills the screen, with film presets, ISO, timer, flash, roll and shutter directly on its body. The controls reflow on short screens and in landscape; captured prints slide from the bottom slot. Upload remains available while permission is pending or denied, with Retry camera after a failure. Rotation keeps the current camera and settings; leaving stops the stream. The camera header links to the scrapbook and, when available, the current Polaroid. Desktop retains the Start page and camera dialog.

1. **Start (`/`)**: Roll film and shutter controls are the primary actions, with Upload photos below the camera and upload/drop support for JPG/JPEG, PNG, HEIC/HEIF or self-contained SVG. The home camera keeps its timer, ISO, film presets, flash and shutter interactive around a darker, grainy display photograph. Roll film opens the real camera with those settings already loaded. Both viewfinders show the selected ISO, film and timer, with a live film preview that matches the captured treatment. ISO 100–3200 digitally simulates exposure gain and grain around a neutral ISO 800; it does not control the camera sensor. The black-and-metal camera captures a single Polaroid, a 3-second print ejection before shake controls become available, a button-triggered shake (or manual shake) and a sound mute control. Reduced motion settles the ejection immediately. **Develop** opens Edit and **Done** opens Finish. Classic, Cut and taped, and 3×3 grid are editable examples whose thumbnails use the same deterministic compositions as Edit. Their vintage party demo image is disclosed as AI-generated.
2. **Edit (`/edit`)**: the fixed, upright Polaroid stays above the photo layers. Arrange contains Add photos, Move, Crop, Cut, Repeat and Zoom. Move photos directly, center them, or use directional nudges. Decorate adds movable text, tape and paper, with color, rotation and size controls. Look includes Original, Warm film, Black & white and Copy shop, plus frame and caption styling, including caption color. New photos start with Warm film at 65%. Photos and pieces expands layer selection; the Piece menu provides copying, pasting, deletion, ordering and page alignment.
3. **Finish (`/finish`)**: review the finished Polaroid, download PNG, JPEG, genuine HEIC or self-contained SVG, print, or add it to the scrapbook. Finish is read-only, including after choosing Done in the camera; **Back to editing** returns to the editing tools. Every artwork includes the complete outer frame and caption and clips everything outside that frame. Separate STL frame downloads remain available.
4. **Scrapbook (`/scrapbook`)**: arrange up to 12 photos as overlapping Polaroids with tilt and optional tape, or as a continuous vertical photo strip. Set the page title and paper color, reorder photos, reopen a Polaroid for editing and update its original scrapbook item. **Save on device** persists the current page; **Download page** exports the collage or strip as PNG.

The initial upload opens a new composition with an empty caption. Imported photos retain their source aspect ratio and full image instead of being automatically cover-cropped; crop and position are user decisions. Additional photos in Edit join the existing composition independently. Imports decode sequentially and successful files survive mixed-batch failures. Returning to Start offers Continue your Polaroid; starting a new upload or example asks before replacing the existing work. Failed replacement imports leave that work intact.

Navigation, category selection and temporary animations do not enter composition history. Back/Forward and Back to editing preserve assets, selection and Undo/Redo. Refresh clears the unsaved editor session; direct Edit/Finish visits without a session return to Start with an explanation. The scrapbook separately stores **one current page** in IndexedDB after an explicit Save on device, including its editable photo sources. It reopens on the same browser and origin. Saving replaces the prior saved version; unsaved changes are temporary, and clearing browser data removes the saved page. There is no account or cross-device sync.

**Text and fonts:** Choose Decorate → Add text for independent text pieces (up to 200 characters, including newlines). Move, resize, rotate, color, copy/paste and order them like other decorations. Look → Caption font changes the existing caption independently. Both selectors offer exactly 30 choices: Studio sans, 28 Google Fonts families and the existing **Lindbergh Baby** ransom-note font from [Font Library](https://fontlibrary.org/en/font/lindbergh-baby). No fonts were authored for this project. Caveat (the default handwritten caption) and Permanent Marker are bundled with their original licenses; the other 26 Google Fonts load on demand. Lindbergh Baby is also bundled with its license. Font loading has visible recovery controls. Photo content and user-entered text are never sent in font request URLs.

Numeric fields keep partial typing until blur or Enter; Escape restores the current value. Individual pieces are limited to 1600 logical pixels, positions to ±1600 pixels, and complete exports to 10,000 pixels per edge and 32 megapixels. Invalid geometry retains the last valid edit. An interrupted editor download now offers Retry without clearing the session, and a pending photo import respects subsequent navigation.

Crop trims through a drawn rectangle or corner handles without stretching the surviving pixels. Cut defaults to Scissors: draw a non-self-crossing edge-to-edge path, or return to the starting circle to cut out a closed shape. Each connected piece can move independently; the surrounding piece retains its hole. Straight line and Cut by angle remain available. Invalid strokes leave the composition unchanged. Repeat creates exactly nine full copies in a fitted 3×3 grid; its box adjusts the tiles together until the tool or category changes. Use Copy and Paste in the Piece menu to copy a piece within the current session. Copy does not add an Undo step; each paste does.

The Piece menu is available above the canvas, on right-click, and by long-press. Its Layer submenu has Bring forward, Bring to front, Send backward and Send to back, within the photo or decoration band. The frame always stays above photos and below tape/paper. Align to page uses the outer Polaroid frame and the selected piece's rotated outline: Left, Center, Right, Top, Middle and Bottom. Clipboard contents stay in memory and clear when starting a new session.

Photos moved outside the frame remain visible in the editing workspace so they can be recovered. The workspace has fixed margins and does not resize while moving pieces. Finished previews, all Polaroid downloads and print output clip photo and decoration overflow to the outer frame. The frame prints at 88 × 107 mm.

Accessible menus use [Radix Primitives](https://www.radix-ui.com/primitives/docs/components/context-menu). Cutting and holes use the existing [polyclip-ts](https://github.com/luizbarboza/polyclip-ts) engine, shared by hit testing, Canvas and SVG geometry. The editor and menu code load only when entering Edit.

Gestures commit on release. Undo/Redo reverses each completed action. Reset restores the initial composition (including an example's arrangement) plus the original arrangement of photos subsequently added. Individual layers can rotate; the outer frame stays upright. All controls retain native Tab, button and form keyboard behavior, and dialogs support Escape dismissal.

Print prepares one Polaroid with an outer frame of **88 × 107 mm**, centered on the sheet. Choose **Actual size / 100% scale**, disable headers/footers, and avoid Fit to page in the printer dialog. Output is clipped to the frame. Printer settings and physical calibration can override sizing. Check each supplied STL's opening separately before fitting a photo.

## Interface interactions

Project-local design and animation skills from Transitions.dev, Impeccable,
GSAP, and Make Interfaces Feel Better are installed for future development.
See the local skill inventory and usage guide at `docs/DESIGN-SKILLS.md`. These are
agent tools; installing them does not change the running website.

Motion for React animates tool selection, panel changes, dialogs, camera countdown, print ejection and download confirmation. The Polaroid enters the workspace and reveals its photo; dragged pieces lift and settle, inserted collage elements land on the paper, and cuts briefly show their seam. Shake and sound are optional presentation effects, separate from composition state and undo history. Downloads and printing use the final framed composition. Warm film, Original and Black & white offer distinct photo treatments alongside Copy shop.

Reduced-motion settings are respected, and animations settle when the page is hidden. The stage reuses processed photo textures during animation and layer movement rather than running photo effects each frame. Preset thumbnails now render the current uploaded photo.

## Image handling and exports

All image decoding, editing and exports happen on the user's device. No photo-upload endpoint, account, analytics, or Python service is used. Unsaved editor images remain in memory. Explicitly saving the scrapbook persists its images and editable compositions locally in IndexedDB; download a page to keep an independent flattened copy.

HEIC conversion lazily imports `heic-to/csp`. It decodes the still image and uses libheif's image transforms. Live Photo playback, HDR-preserving output, and multi-image HEIF container editing are outside this prototype. Conversion failures leave the previous composition intact.

SVG uploads are sanitized with DOMPurify and loaded as isolated images. Scripts, event handlers, foreign objects, and animations are removed. External images, styles and fonts must be embedded or outlined before upload. Valid `viewBox` dimensions or explicit pixel dimensions are required. SVGs are edited as a whole artwork layer; individual vector-path editing is not provided.

Polaroid raster exports render at 3× logical resolution (1560 × 1897 pixels), clipped to the outer frame. The vector frame's true aspect ratio is 88:107; the raster includes subpixel rounding at its outer edge. SVG exports share the same polygon masks, source mapping, transforms, layer bands and outer-frame clipping as Canvas. Untouched SVG sources remain embedded vectors; raster/effect layers, text pieces and caption lettering are embedded PNGs. Exports wait for selected fonts and remain self-contained. SVG physical dimensions use the same millimeter scale as printing. Scrapbook PNGs render at 2× page resolution: collages are 2000 × 1560 pixels; photo strips are 720 pixels wide with height determined by the shot count (800 pixels for one shot).

HEIC encoding lazily loads `elheif` in a dedicated worker. It encodes the completed, flattened image into actual HEIC bytes, validates the file brand, and terminates the worker after completion, failure, or a 90-second timeout. Encoding errors offer PNG/JPEG rather than silently relabeling another format. Source images and exports never leave the browser. The HEIC encoder and decoder are separate lazy bundles.

WebGPU runs the actual effect shader in `src/effects.wgsl`. The Canvas implementation uses the same seeded grain and displacement formulas when GPU initialization fails or the device is lost. The HEIC decoder is a separate lazy bundle; its size does not affect the initial editor download.

## Offline use and installation

The production build registers a service worker and supplies a standalone web-app manifest. Once the interface reports **Ready to use offline on this device**, the app shell, built JavaScript/CSS, HEIC codecs, demo image, icons and self-hosted fonts are cached. Navigation falls back to the cached app when the network is unavailable. Development mode does not install this cache; verify with `pnpm build` and `pnpm preview`.

Install roid uses the browser's install prompt when available and otherwise shows Safari/iOS and Android instructions. The UI headings use self-hosted DM Serif Display, with system sans-serif controls. DM Serif Display, Caveat, Permanent Marker and Lindbergh Baby are precached. The 26 on-demand Google Fonts families still require network access on first use; external fonts and STL downloads are not part of the app's precache. Offline readiness does not save unsaved artwork: use Save on device separately.

## Project structure

- `src/model.ts`, `history.ts`: immutable layer geometry and gesture history.
- `src/imports.ts`: supported file detection, HEIC conversion, SVG validation.
- `src/render.ts`, `effects.ts`, `effects.wgsl`: shared composition geometry, Canvas/SVG exports, GPU/CPU effects.
- `src/App.tsx`: routing, session guards, upload intent and replacement confirmation.
- `src/studio/`: shared session hook, Start/Edit/Finish screens, grouped controls, deterministic examples and shared-renderer previews.
- `src/Stage.tsx`, `Camera.tsx`: pointer editing and camera lifecycle.
- `src/styles.css`, `src/studio/canvas.css`, `src/studio/nostalgia.css`: responsive layout, canvas interactions, dialogs, physical print styles and the warm paper/camera design.
- `src/scrapbook.ts`, `src/studio/useScrapbook.ts`, `src/studio/ScrapbookScreen.tsx`: local page storage, editable memories and collage/strip rendering.
- `src/service-worker.js`, `vite.config.ts`, `public/manifest.webmanifest`: production offline cache generation and installation metadata.
- `public/frames`: the three unchanged STL files supplied for this project.
- `docs/inspiration`: local supplied references used for the design, excluded from Git.
- `.openai/hosting.json`: retained identity for the earlier Sites preview; the public delivery target is Vercel.

## Validation

The mobile camera route passes 164 automated tests, typecheck and the production build. Chromium via CDP and Windows WebKit checks cover 1280×900, 390×844, 320×568 and 844×390 and 568×320 layouts, visible-control keyboard interaction and bottom-slot alignment, rotation without restarting the stream, capture/reveal/retake, reduced motion, hidden-page settling, Edit/Finish, PNG download, permission pending/denied/retry, upload fallback, session resume and replacement cancellation. Browser camera input uses local sample imagery through a simulated media boundary; physical iOS/Android camera and sensor behavior remains unverified. No deployment was performed.

The final redesign passed 100 automated tests, typecheck and the production build after the service-worker cache fix. Chrome checks covered an offline reload with the server stopped, create/edit/finish, adding to the scrapbook, explicit save and reopen, and an actual 720 × 800 single-shot-strip PNG download. Collage output is 2000 × 1560 pixels. Layouts were inspected at 320px, 390px and 1280px. Physical camera capture and installation on real iOS/Android devices remain untested. This redesign has not been deployed.

Local documentation in `docs/` is excluded from Git and is not required to build or run the app. Audit fixes and font verification (`docs/UI-UX-FIXES.md`), the original audit (`docs/UI-UX-AUDIT.md`), and earlier validation coverage (`docs/VALIDATION.md`) retain historical context; the current workflow and limitations are described above.

## References and credits

The design follows the supplied **Design Document for Photobooth**, by Ahsan Tariq, Nairran Zargar, and Md Toha Tawsif. The interaction is a square Polaroid disrupted through cutting, layering, adhesive and analog distortion.

The local design reference map at `docs/DESIGN.md` records the inspiration images and how they shaped the interface. Original sample imagery and its generation prompt are documented there.

Supplied models:

- [Magnetic Photo Frame (Polaroid/Instax style)](https://www.printables.com/model/149884-magnetic-photo-frame-polaroidinstax-style/files): `frame-polaroid-part1.stl`, `frame-polaroid-part2.stl`.
- [Polaroid frame](https://www.printables.com/model/155872-polaroid-frame/files): `polaroid frame.stl`.

The existing GPL-3.0 repository license is preserved. Supplied third-party references and STL models retain their original rights; consult their source listings. Dependency license notices accompany their packages. See [HEIC encoder sources and notices](ENCODER-NOTICES.md) for encoder attribution.

Current camera refinement: centered leather camera, Roll/Click demo and image provenance are documented locally at `docs/redesign/CAMERA-REFINEMENT.md`.
