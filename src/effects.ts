import shader from './effects.wgsl?raw';
import type { Composition } from './model';
export function hash(value: number) {
  let v = value >>> 0;
  v = Math.imul(v ^ (v >>> 16), 2146121005);
  v = Math.imul(v ^ (v >>> 15), 2221713035);
  return (v ^ (v >>> 16)) >>> 0;
}
export function cpuEffects(input: Uint8ClampedArray, width: number, height: number, effects: Composition['effects']) {
  const out = new Uint8ClampedArray(input.length), { film, copier, seed } = effects;
  const sample = (x: number, y: number, channel: number) => input[(Math.max(0, Math.min(height-1,y))*width + Math.max(0,Math.min(width-1,x)))*4+channel];
  const offset = Math.round(width * .014 * copier);
  for (let y = 0; y < height; y++) {
    const band = Math.floor(y / height * 28);
    const shift = band % 7 === 0 || band % 11 === 0 ? Math.round(((hash(band+seed)%100)/100-.5)*width*.12*copier) : 0;
    for (let x = 0; x < width; x++) {
      const i = (y*width+x)*4, sx = x+shift;
      const grain = ((hash(Math.floor(x/width*460)+Math.floor(y/height*460)*461+seed)%101)/100-.5)*22*film;
      const rgb = [sample(sx,y,0)*(1-copier)+sample(sx+offset,y,0)*copier, sample(sx,y,1), sample(sx,y,2)*(1-copier)+sample(sx-offset,y,2)*copier];
      const luminance = rgb[0]*.2126 + rgb[1]*.7152 + rgb[2]*.0722;
      const faded = rgb.map((v,c) => {
        const muted = v * .72 + luminance * .28;
        return v*(1-film)+(muted*[.85,.82,.77][c]+[32,26,22][c])*film+grain;
      });
      const gray = faded[0]*.2126 + faded[1]*.7152 + faded[2]*.0722, mono = effects.grayscale ?? 0;
      for (let c = 0; c < 3; c++) out[i+c] = Math.max(0,Math.min(255,Math.round(faded[c]*(1-mono)+gray*mono)));
      out[i+3] = sample(sx,y,3);
    }
  }
  return out;
}
let device: GPUDevice | null = null;
let pipeline: GPUComputePipeline | null = null;
let initialization: Promise<boolean> | undefined;
export let backend: 'webgpu' | 'canvas' = 'canvas';
export function initializeEffects() {
  return initialization ??= (async () => {
    if (!navigator.gpu) return false;
    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
      if (!adapter) return false;
      device = await adapter.requestDevice();
      device.lost.then(() => { device = null; pipeline = null; backend = 'canvas'; });
      pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module: device.createShaderModule({ code: shader }), entryPoint: 'main' } });
      backend = 'webgpu'; return true;
    } catch { device = null; pipeline = null; backend = 'canvas'; return false; }
  })();
}
export async function applyEffects(data: ImageData, effects: Composition['effects']) {
  if (effects.film === 0 && effects.copier === 0 && !effects.grayscale) return data;
  await initializeEffects();
  const gpu = device, compute = pipeline;
  if (gpu && compute) {
    const size = data.data.byteLength;
    const resources: GPUBuffer[] = [];
    try {
      gpu.pushErrorScope('validation');
      const input = gpu.createBuffer({ size, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }); resources.push(input);
      const output = gpu.createBuffer({ size, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }); resources.push(output);
      const readback = gpu.createBuffer({ size, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); resources.push(readback);
      const uniform = gpu.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }); resources.push(uniform);
      const settings = new ArrayBuffer(32), ints = new Uint32Array(settings), floats = new Float32Array(settings);
      ints[0] = data.width; ints[1] = data.height; floats[2] = effects.film; floats[3] = effects.copier; ints[4] = effects.seed; floats[5] = effects.grayscale ?? 0;
      gpu.queue.writeBuffer(input,0,new Uint8Array(data.data)); gpu.queue.writeBuffer(uniform,0,settings);
      const encoder = gpu.createCommandEncoder(), pass = encoder.beginComputePass();
      pass.setPipeline(compute); pass.setBindGroup(0,gpu.createBindGroup({ layout: compute.getBindGroupLayout(0), entries: [{binding:0,resource:{buffer:input}},{binding:1,resource:{buffer:output}},{binding:2,resource:{buffer:uniform}}] }));
      pass.dispatchWorkgroups(Math.ceil(data.width/8),Math.ceil(data.height/8)); pass.end();
      encoder.copyBufferToBuffer(output,0,readback,0,size); gpu.queue.submit([encoder.finish()]);
      const validation = await gpu.popErrorScope();
      if (validation) throw new Error(validation.message);
      await readback.mapAsync(GPUMapMode.READ);
      const pixels = new Uint8ClampedArray(readback.getMappedRange().slice(0));
      readback.unmap(); return new ImageData(pixels,data.width,data.height);
    } catch { backend = 'canvas'; device = null; pipeline = null; }
    finally { resources.forEach(buffer => buffer.destroy()); }
  }
  return new ImageData(cpuEffects(data.data,data.width,data.height,effects),data.width,data.height);
}
