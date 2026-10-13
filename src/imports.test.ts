// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { identifyFile, sanitizeSvg } from './imports';
describe('upload identification',()=>{
  it('accepts iPhone images and SVGs without MIME information',()=>{
    expect(identifyFile({name:'IMG_001.HEIC',type:''})).toBe('heic');
    expect(identifyFile({name:'portrait.heif',type:''})).toBe('heic');
    expect(identifyFile({name:'doodle.SVG',type:''})).toBe('svg');
    expect(identifyFile({name:'memory.JPG',type:''})).toBe('raster');
  });
  it('rejects unsupported files',()=>expect(()=>identifyFile({name:'file.pdf',type:'application/pdf'})).toThrow('Choose a JPG'));
});
describe('self-contained SVG import',()=>{
  const start='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">';
  it('preserves vector gradients, transparency and internal clipping',()=>{
    const {svg,width,height}=sanitizeSvg(`${start}<defs><linearGradient id="g"><stop stop-color="red"/></linearGradient><clipPath id="c"><rect width="100" height="100"/></clipPath></defs><rect width="200" height="100" fill="url(#g)" clip-path="url(#c)" opacity="0.5"/></svg>`);
    expect(width).toBe(200);expect(height).toBe(100);expect(svg).toContain('linearGradient');expect(svg).toContain('opacity="0.5"');
  });
  it('strips active content',()=>{
    const {svg}=sanitizeSvg(`${start}<script>alert(1)</script><rect width="100" height="100" onclick="alert(1)"/><foreignObject/><animate attributeName="x"/></svg>`);
    expect(svg).not.toMatch(/script|onclick|foreignObject|animate/);
  });
  it('accepts quoted internal references',()=>{
    expect(()=>sanitizeSvg(`${start}<defs><clipPath id="c"><rect width="100" height="100"/></clipPath></defs><rect style="clip-path:url('#c')"/></svg>`)).not.toThrow();
  });
  it('rejects external images and styles rather than silently losing artwork',()=>{
    expect(()=>sanitizeSvg(`${start}<image href="https://example.com/a.png"/></svg>`)).toThrow('linked resources');
    expect(()=>sanitizeSvg(`${start}<style>@import 'https://example.com/font.css';</style></svg>`)).toThrow('external styles');
    expect(()=>sanitizeSvg(`${start}<rect fill="url(https://example.com/f.svg#g)"/></svg>`)).toThrow('external styles');
  });
  it('rejects malformed and dimensionless artwork',()=>{
    expect(()=>sanitizeSvg('<svg>')).toThrow('could not be read');
    expect(()=>sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')).toThrow('viewBox');
  });
  it('supports explicit pixel dimensions and Unicode',()=>{
    const {svg,width}=sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" width="320px" height="200"><text>été &amp; memories</text></svg>');
    expect(width).toBe(320);expect(svg).toContain('été');
  });
});
