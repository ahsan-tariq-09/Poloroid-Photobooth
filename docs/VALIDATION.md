# Prototype validation

## Automated checks

`pnpm test` covers layer cutting (including rotated pieces), source coverage, overflow bounds, duplication and hit testing, centered crop geometry, gesture history, deterministic fallback effects, and file-format recognition without MIME information.

SVG tests cover transparency, gradients, internal clipping, quoted internal references, active-content sanitization, external dependencies, malformed XML, dimensions, and Unicode. Native Canvas and resvg tests render a finished Polaroid, reopen its SVG without network access, and compare pixels with PNG output using effects, tape, overlapping fragments, and overflow. A separate check verifies that untouched uploaded SVG artwork remains embedded as vectors.

The actual `heic-to/csp` browser worker is executed in a Node worker adapter for tests. A public libheif HEIC fixture is decoded into PNG, and malformed HEIC input is rejected. Test dependencies and fixtures do not enter the production bundle.

TypeScript and the production build pass. The initial application bundle is separate from the lazy HEIC decoder.

## Multi-photo editing and output regression coverage

The current suite covers fixed frame/aperture geometry, photo-only clipping, band-aware hit testing, source-preserving rotated crops, arbitrary-angle and freehand cuts, repeated cuts, invalid/self-crossing strokes, 3×3 fitting, grid transforms, and independent source references.

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

## Hosted interface verification

The deployed owner-private site was inspected at its default mobile-width layout and a 1440-pixel desktop viewport. Tape insertion, duplication, undo, cutting controls, and panel switching were exercised through the browser. The current collage was preserved; the temporary viewport override was reset. The desktop verification view is saved in `studio-desktop.png`.

The browser check exposed a pre-existing selection issue when a photo was cut underneath tape. Both cutting entry points now share one handler and select a newly created photo fragment. A regression test covers repeated cuts with tape above the image.

The current automated suite has 48 passing tests. Production and Docker builds pass. Vitest was upgraded to 4.1.11 to resolve the concrete test-tooling advisories reported by GitHub; the dependency audit reports zero vulnerabilities.

## Verification limits

Physical-printer measurements, physical-camera output, real iPhone/Safari portrait orientation, and WebGPU hardware/device-loss behavior remain unverified. Camera stream cleanup and denied-permission handling are covered by component tests; the HEIC decoder and offline PNG/SVG rendering are covered by actual decoding/rendering tests. Live touch gestures and screen-reader behavior still benefit from testing on target devices.
