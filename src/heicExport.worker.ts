import { ensureInitialized, jsEncodeImage } from "elheif";

self.onmessage = async (
  event: MessageEvent<{
    pixels: Uint8ClampedArray;
    width: number;
    height: number;
  }>,
) => {
  try {
    await ensureInitialized();
    const { pixels, width, height } = event.data;
    const result = jsEncodeImage(new Uint8Array(pixels.buffer), width, height);
    if (result.err || !result.data?.length)
      throw new Error(result.err || "Empty HEIC result");
    const bytes = new Uint8Array(result.data);
    const brand = new TextDecoder().decode(bytes.slice(4, 32));
    if (!brand.includes("ftyp") || !/heic|heix|mif1/.test(brand))
      throw new Error("Invalid HEIC output");
    self.postMessage({ bytes }, { transfer: [bytes.buffer] });
  } catch {
    self.postMessage({
      error: "The HEIC encoder could not finish. Please choose PNG or JPEG.",
    });
  }
};
