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

## Verification limits

The browser tool blocked local preview inspection. The private HTTPS site deployed successfully, but the available browser session encountered a ChatGPT sign-in error. Interactive browser QA, desktop/mobile screenshots, physical-camera capture, actual WebGPU hardware rendering/device-loss behavior, and real iPhone/Safari orientation coverage remain unverified. These limitations are not represented as passed checks.

Recommended device checks: upload a portrait and landscape iPhone HEIC; take a photo and switch cameras; manipulate pieces with mouse and touch; test keyboard editing and reduced motion; download both artwork formats and reopen them offline. Each output should include the full Polaroid border and caption area.
