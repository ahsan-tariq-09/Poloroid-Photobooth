# Prototype validation

## Automated checks

`pnpm test` covers layer cutting (including rotated pieces), source coverage, overflow bounds, duplication and hit testing, centered crop geometry, gesture history, deterministic fallback effects, and file-format recognition without MIME information.

SVG tests cover transparency, gradients, internal clipping, quoted internal references, active-content sanitization, external dependencies, malformed XML, dimensions, and Unicode. Native Canvas and resvg tests render a finished Polaroid, reopen its SVG without network access, and compare pixels with PNG output using effects, tape, overlapping fragments, and overflow. A separate check verifies that untouched uploaded SVG artwork remains embedded as vectors.

The actual `heic-to/csp` browser worker is executed in a Node worker adapter for tests. A public libheif HEIC fixture is decoded into PNG, and malformed HEIC input is rejected. Test dependencies and fixtures do not enter the production bundle.

TypeScript and the production build pass. The initial application bundle is separate from the lazy HEIC decoder.

## Multi-photo editing and output regression coverage

The current suite covers fixed frame/aperture geometry, photo-only clipping, band-aware hit testing, source-preserving rotated crops, arbitrary-angle and freehand cuts, repeated straight/freehand cuts on irregular fragment edges, invalid/self-crossing strokes, 3×3 fitting, grid transforms, and independent source references.

Actual React pointer events exercise corner resizing, drawn cuts, crop rectangles and tape rotation. Component tests cover sequential slow HEIC uploads followed by SVG, mixed batches with decoding failures, source retention across Undo/Redo, Reset, single duplication versus Repeat, camera permission/cleanup, all format selections, printing and unchanged STL links.

Native Canvas/resvg tests reopen complete self-contained exports with multiple sources, curved masks, rotated fragments, effects, transparency and decorative overflow, then compare them with PNG pixels. JPEG encoding is decoded at its original dimensions. The production HEIC worker is bundled in memory and executed, then its real output is decoded using the independent `heic-to/csp` import decoder. Odd image height and red/blue pixel orientation are checked.

Print preparation waits for the image before opening the print dialog, uses an 88 mm × 107 mm frame, and removes its temporary sheet after printing. Print CSS excludes all editor UI, centers the fixed-size figure and preserves decorative overflow at the same scale.

Presentation remains outside Composition/history. Stage tests verify processed texture reuse, reduced-motion cancellation, and stale texture rejection. No new photo-effect settings or shader algorithms were added.

## Docker and supplied models

The Docker image has been built successfully and checked by starting a temporary unprivileged Nginx container, retrieving the page and an STL asset, and stopping it.

All supplied STL files match their originals byte-for-byte:

| File                     | SHA-256                                                          |
| ------------------------ | ---------------------------------------------------------------- |
| frame-polaroid-part1.stl | dbd663e540cd5e307e28a35de12347c1f818578cfbd81b5159624d15358136c7 |
| frame-polaroid-part2.stl | 293887702cd1070c646eff7199b2bca8e26739cb10398c70c8f45bb90c75d9f8 |
| polaroid frame.stl       | d399030138a97533220fbc51109a8b2421293b523d5d218803cdf835da89ceea |

## Photo-first flow verification — October 15, 2026

The suite now has **59 passing tests**. The existing 49 regressions were retained and adapted to the new screens. Added checks cover route guards, all three editable examples matching their thumbnail definitions, Back/Forward navigation, pending caption commits, selection and history across screens, replacement confirmation and cancellation, failed replacement preservation, stale import rejection and URL cleanup, removed editor bindings, category changes releasing repeat groups, camera countdown entry and caption-only sans-serif rendering.

Browser checks used the production build at desktop, 390 px and 320 px widths. Controls appear below the canvas on mobile; no horizontal overflow was found. Real PNG, JPEG, SVG and HEIC downloads were imported together successfully. The HEIC export had an `ftypheic` brand and was decoded back into a photo layer. Group repeat, numeric grid resizing, tape rotation and angled cuts were exercised through the reorganized controls. Native Tab interaction commits numeric changes.

Downloaded PNG/JPEG/SVG artwork measured 1560 × 1899 px. The reopened SVG differed from its PNG by a mean **0.157 channel levels out of 255** and contained no network image references. The finished canvas and saved files have upright frames, retain entered captions and omit the removed frame slogan. Printing remains covered by actual-size DOM tests; no physical print was sent.

The initial development HEIC check triggered Vite's first-use dependency optimization reload. Production HEIC export passed. The development configuration now explicitly discovers both codecs before editing to avoid this reload. Both codec bundles remain lazy in production. Unused DM fonts and old page styles/handlers were removed. No new photo effects were added.

TypeScript, production and Docker builds pass; the dependency audit has no known vulnerabilities. A temporary Docker container returned HTTP 200 for `/`, `/edit`, `/finish` and an unchanged STL download, then was stopped. Vercel has explicit Edit/Finish rewrites without wildcard asset rewrites.

Desktop/mobile verification images are saved alongside this document. The public delivery target is [poloroid-photobooth.vercel.app](https://poloroid-photobooth.vercel.app/).

## Verification limits

Physical-printer measurements, physical-camera output, real iPhone/Safari portrait orientation, and WebGPU hardware/device-loss behavior remain unverified. Camera stream cleanup and denied-permission handling are covered by component tests; the HEIC decoder and offline PNG/SVG rendering are covered by actual decoding/rendering tests. Live touch gestures and screen-reader behavior still benefit from testing on target devices.
