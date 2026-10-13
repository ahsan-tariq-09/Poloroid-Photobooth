# HEIC test fixture

`libheif-example.heic` is the public example image from the upstream libheif project:

https://github.com/strukturag/libheif/blob/master/examples/example.heic

It is used only to verify the actual browser HEIC decoder and PNG conversion. It is not shipped in the production site's `dist` output. The upstream repository supplies its licensing and notices:

https://github.com/strukturag/libheif/blob/master/examples/COPYING

These tests exercise a representative HEIC still image. Real iPhone model, HDR, portrait orientation, and Safari camera coverage also require testing on the target devices.
