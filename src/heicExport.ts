export async function encodeHeic(canvas: HTMLCanvasElement): Promise<Blob> {
  const pixels = canvas
    .getContext("2d")!
    .getImageData(0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./heicExport.worker.ts", import.meta.url),
      { type: "module" },
    );
    const finish = (error?: string, bytes?: Uint8Array) => {
      clearTimeout(timer);
      worker.terminate();
      if (error || !bytes?.length)
        reject(
          new Error(
            error || "HEIC encoding failed. Please choose PNG or JPEG.",
          ),
        );
      else resolve(new Blob([new Uint8Array(bytes)], { type: "image/heic" }));
    };
    const timer = setTimeout(
      () => finish("HEIC encoding took too long. Please choose PNG or JPEG."),
      90_000,
    );
    worker.onmessage = (
      event: MessageEvent<{ error?: string; bytes?: Uint8Array }>,
    ) => finish(event.data.error, event.data.bytes);
    worker.onerror = () =>
      finish(
        "HEIC encoding is unavailable in this browser. Please choose PNG or JPEG.",
      );
    worker.postMessage(
      { pixels: pixels.data, width: pixels.width, height: pixels.height },
      [pixels.data.buffer],
    );
  });
}
