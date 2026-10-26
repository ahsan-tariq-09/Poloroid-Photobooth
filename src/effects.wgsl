struct Settings { width: u32, height: u32, film: f32, copier: f32, seed: u32, grayscale: f32, pad1: u32, pad2: u32 }
@group(0) @binding(0) var<storage, read> inputPixels: array<u32>;
@group(0) @binding(1) var<storage, read_write> outputPixels: array<u32>;
@group(0) @binding(2) var<uniform> settings: Settings;
fn hash(value: u32) -> u32 {
  var v = value;
  v = (v ^ (v >> 16u)) * 2146121005u;
  v = (v ^ (v >> 15u)) * 2221713035u;
  return v ^ (v >> 16u);
}
fn pixel(x: i32, y: i32) -> vec4<f32> {
  let index = u32(clamp(y, 0, i32(settings.height)-1)) * settings.width + u32(clamp(x, 0, i32(settings.width)-1));
  let p = inputPixels[index];
  return vec4<f32>(f32(p & 255u), f32((p >> 8u) & 255u), f32((p >> 16u) & 255u), f32((p >> 24u) & 255u));
}
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= settings.width || gid.y >= settings.height) { return; }
  let band = u32(floor(f32(gid.y) / f32(settings.height) * 28.0));
  var shift = 0;
  if (band % 7u == 0u || band % 11u == 0u) {
    shift = i32(round((f32(hash(band + settings.seed) % 100u) / 100.0 - 0.5) * f32(settings.width) * 0.12 * settings.copier));
  }
  let offset = i32(round(f32(settings.width) * 0.014 * settings.copier));
  let x = i32(gid.x) + shift;
  let y = i32(gid.y);
  var p = pixel(x, y);
  p.r = mix(p.r, pixel(x + offset, y).r, settings.copier);
  p.b = mix(p.b, pixel(x - offset, y).b, settings.copier);
  let gx = u32(floor(f32(gid.x) / f32(settings.width) * 460.0));
  let gy = u32(floor(f32(gid.y) / f32(settings.height) * 460.0));
  let grain = (f32(hash(gx + gy * 461u + settings.seed) % 101u) / 100.0 - 0.5) * 22.0 * settings.film;
  let luminance = dot(p.rgb, vec3<f32>(0.2126,0.7152,0.0722));
  let muted = mix(p.rgb, vec3<f32>(luminance), 0.28);
  let faded = muted * vec3<f32>(0.85,0.82,0.77) + vec3<f32>(32.0,26.0,22.0);
  p = vec4<f32>(mix(p.rgb, faded, settings.film) + vec3<f32>(grain), p.a);
  let gray = dot(p.rgb, vec3<f32>(0.2126,0.7152,0.0722));
  p = vec4<f32>(mix(p.rgb, vec3<f32>(gray), settings.grayscale), p.a);
  let rgba = vec4<u32>(round(clamp(p,vec4<f32>(0.0),vec4<f32>(255.0))));
  outputPixels[gid.y * settings.width + gid.x] = rgba.r | (rgba.g << 8u) | (rgba.b << 16u) | (rgba.a << 24u);
}
