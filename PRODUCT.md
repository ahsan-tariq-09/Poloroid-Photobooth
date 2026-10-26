# Polaroid

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Make personal instant-photo keepsakes in a browser. Take a photo, choose Develop to edit or Done to finish, arrange it inside a Polaroid, and download or print it. Collect finished work in a scrapbook saved on this device.

## Capabilities and Constraints

Existing React, TypeScript, Vite application. Keep photos on the device. Preserve the editing tools, undo history, supported imports, four export formats and physical print dimensions. Imports preserve the full source and its proportions; users decide positioning and cropping. Finished output is clipped to the outer frame. Warm film is the default at 65%; Original, Black & white and Copy shop remain available. Caption and independent text colors are editable.

Camera capture offers a single Polaroid or a four-shot strip. Develop opens editing; Done opens Finish for a single photo, with repositioning retained. The strip joins the scrapbook. Camera permissions are requested through an explicit action. Sound has an accessible mute control. Respect reduced motion.

The scrapbook holds one current page with up to 12 photos. It supports overlapping, tilted Polaroids with tape or a continuous vertical photo strip, page title and paper color, and PNG page downloads. Save on device explicitly writes the page and editable photo sources to IndexedDB. Reopening a saved photo supports updating its original scrapbook item. Unsaved edits remain temporary; clearing site data removes saved work. There is no account or cross-device sync.

The production PWA precaches the app shell, built code and codecs, demo image, icons and self-hosted fonts. Its readiness status and install help support mobile use. On-demand Google Fonts need a network connection on first use; STL files are not precached. Device storage and installation depend on browser support. This redesign does not include a deployment.

## Brand Commitments

The brand name is Polaroid. The user's Canva camera reference supplies black leather, metallic controls, green viewfinder markings and a red shutter. The requested mood combines nostalgic technology with a restrained modern interface. Specific copy, no fabricated proof, no pricing, and no excessive whitespace.

## Evidence on Hand

Canva reference: https://www.canva.com/design/DAHYz75uUaQ/vCQzdxfj0GIXwdZMn31AMQ/view
The supplied broken-export screenshot shows out-of-frame image overflow. The existing coastal sample is AI-generated demonstration content and must be labeled accordingly. Existing reference images and STL models are in docs/inspiration and public/frames.

## Product Principles

- Make taking a photo the clearest first action.
- Keep arrangement direct: drag, resize, center and directional nudges.
- Export exactly the framed result.
- Save keepsakes explicitly on this device and communicate storage limitations.
- Keep animation and sound separate from image data.
