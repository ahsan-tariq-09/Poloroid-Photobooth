# Prototype validation

## Automated checks

`pnpm test` covers layer cutting (including rotated pieces), source coverage, overflow bounds, duplication and hit testing, centered crop geometry, gesture history, deterministic fallback effects, and file-format recognition without MIME information.

SVG tests cover transparency, gradients, internal clipping, quoted internal references, active-content sanitization, external dependencies, malformed XML, dimensions, and Unicode. Native Canvas and resvg tests render a finished Polaroid, reopen its SVG without network access, and compare pixels with PNG output using effects, tape, overlapping fragments, and overflow. A separate check verifies that untouched uploaded SVG artwork remains embedded as vectors.

The actual `heic-to/csp` browser worker is executed in a Node worker adapter for tests. A public libheif HEIC fixture is decoded into PNG, and malformed HEIC input is rejected. Test dependencies and fixtures do not enter the production bundle.

TypeScript and the production build pass. The initial application bundle is separate from the lazy HEIC decoder.

## Interaction upgrade regression coverage

The upgrade adds temporary Motion/CSS presentation only; the original photo-effect settings and GPU/Canvas shader algorithms are unchanged. Additional tests cover cut/tape/paper/duplicate controls, layer nudging and deletion, undo/redo/reset, existing presets, both downloads, stale uploads, camera close and permission failures, and all STL links.

Presentation tests verify rotated pointer mapping and cut cues. Real image tests prove that animation never changes composition state or exported pixels. Stage lifecycle tests verify texture reuse, cancellation when motion is disabled, and rejection of processed textures from replaced photos. TypeScript now rejects unused locals and parameters; obsolete imports and preset styles were removed.

## Docker and supplied models

The Docker image has been built successfully and checked by starting a temporary unprivileged Nginx container, retrieving the page and an STL asset, and stopping it.

All supplied STL files match their originals byte-for-byte:

| File | SHA-256 |
| --- | --- |
| frame-polaroid-part1.stl | dbd663e540cd5e307e28a35de12347c1f818578cfbd81b5159624d15358136c7 |
| frame-polaroid-part2.stl | 293887702cd1070c646eff7199b2bca8e26739cb10398c70c8f45bb90c75d9f8 |
| polaroid frame.stl | d399030138a97533220fbc51109a8b2421293b523d5d218803cdf835da89ceea |

## Hosted interface verification

The deployed owner-private site was inspected at its default mobile-width layout and a 1440-pixel desktop viewport. Tape insertion, duplication, undo, cutting controls, and panel switching were exercised through the browser. The current collage was preserved; the temporary viewport override was reset. The desktop verification view is saved in `studio-desktop.png`.

The browser check exposed a pre-existing selection issue when a photo was cut underneath tape. Both cutting entry points now share one handler and select a newly created photo fragment. A regression test covers repeated cuts with tape above the image.

The final automated suite has 37 passing tests. Production and Docker builds pass. Vitest was upgraded to 4.1.11 to resolve the concrete test-tooling advisories reported by GitHub; the dependency audit reports zero vulnerabilities.

## Verification limits

Physical-camera output, real iPhone/Safari portrait orientation, and WebGPU hardware/device-loss behavior remain unverified. Camera stream cleanup and denied-permission handling are covered by component tests; the HEIC decoder and offline PNG/SVG rendering are covered by actual decoding/rendering tests. Live touch gestures and screen-reader behavior still benefit from testing on target devices.
