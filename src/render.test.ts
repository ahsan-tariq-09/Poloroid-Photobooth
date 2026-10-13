import { createCanvas, GlobalFonts, ImageData, loadImage } from '@napi-rs/canvas';
import { Resvg } from '@resvg/resvg-js';
import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { initialComposition, addDecoration, bounds, splitLayer, type Asset } from './model';
import { canvas, renderComposition, serializeSvg } from './render';

beforeAll(()=>{
  vi.stubGlobal('document',{createElement:()=>createCanvas(1,1)});
  vi.stubGlobal('ImageData',ImageData);
  GlobalFonts.registerFromPath('node_modules/@fontsource/dm-serif-display/files/dm-serif-display-latin-400-italic.woff2','DM Serif Display');
  GlobalFonts.registerFromPath('node_modules/@fontsource/dm-mono/files/dm-mono-latin-400-normal.woff2','DM Mono');
});
async function makeAsset(svg?:string):Promise<Asset>{
  let image;
  if(svg)image=await loadImage(Buffer.from(svg));
  else{
    const c=createCanvas(300,200),ctx=c.getContext('2d');
    ctx.fillStyle='#286c79';ctx.fillRect(0,0,300,200);
    ctx.fillStyle='#e47932';ctx.fillRect(150,0,150,200);
    image=await loadImage(c.toBuffer('image/png'));
  }
  return {image:image as unknown as HTMLImageElement,width:image.width,height:image.height,url:'test',name:'test',svg};
}
const at=(output:HTMLCanvasElement,x:number,y:number)=>[...output.getContext('2d')!.getImageData(x,y,1,1).data];
describe('real Polaroid rendering and export',()=>{
  it('renders the actual sample as a complete Polaroid',async()=>{
    const image=await loadImage('public/sample-coast.png');
    const asset={image:image as unknown as HTMLImageElement,width:image.width,height:image.height,url:'sample',name:'sample'};
    const composition=initialComposition(true);
    const output=await renderComposition(canvas(1,1),asset,composition,bounds(composition),3);
    mkdirSync('.sites-runtime/qa',{recursive:true});
    writeFileSync('.sites-runtime/qa/sample-poloroid.png',Buffer.from(output.toDataURL('image/png').split(',')[1],'base64'));
    expect(at(output,10,10)).toEqual([255,249,233,255]);
    expect(output.height/output.width).toBeCloseTo(640/520);
  });
  it('exports the complete frame with a wider caption area',async()=>{
    const asset=await makeAsset(),c=initialComposition(),region=bounds(c);
    const output=await renderComposition(canvas(1,1),asset,c,region,3);
    expect(output.width).toBe(1560);expect(output.height).toBe(1920);
    expect(at(output,4,4)).toEqual([255,249,233,255]);
    expect(at(output,750,1750)).toEqual([255,249,233,255]);
    expect(at(output,350,300)[0]).toBe(40);
    expect(at(output,1200,300)[0]).toBe(228);
  });
  it('reopens the SVG entirely from embedded assets and matches PNG geometry with effects and overflow',async()=>{
    const asset=await makeAsset();let c=initialComposition();
    c=splitLayer(c,c.layers[0].id,'horizontal',.4);
    c.layers[1].x-=90;c.layers[1].rotation=12;c.effects={film:.6,copier:.8,seed:76};
    c=addDecoration(c,'tape','#e65b3c');c.caption='A little memory';
    const svg=await serializeSvg(asset,c);
    expect(svg).not.toMatch(/href="https?:/);expect(svg).toContain('data:image/png;base64,');
    const image=await loadImage(new Resvg(svg).render().asPng());
    const output=await renderComposition(canvas(1,1),asset,c,bounds(c),3);
    expect(image.width).toBe(output.width);expect(image.height).toBe(output.height);
    const reopened=createCanvas(image.width,image.height);reopened.getContext('2d').drawImage(image,0,0);
    const pixels=output.getContext('2d')!.getImageData(0,0,output.width,output.height).data;
    const actual=reopened.getContext('2d').getImageData(0,0,image.width,image.height).data;
    mkdirSync('.sites-runtime/qa',{recursive:true});
    writeFileSync('.sites-runtime/qa/export.svg',svg);
    writeFileSync('.sites-runtime/qa/export.png',Buffer.from(output.toDataURL('image/png').split(',')[1],'base64'));
    writeFileSync('.sites-runtime/qa/reopened-svg.png',reopened.toBuffer('image/png'));
    let difference=0;
    for(let i=0;i<pixels.length;i+=4)for(let ch=0;ch<4;ch++)difference+=Math.abs(pixels[i+ch]-actual[i+ch]);
    expect(difference/pixels.length).toBeLessThan(3);
  });
  it('retains uploaded vector SVG artwork when pixel effects are off',async()=>{
    const source='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100"><defs><linearGradient id="g"><stop stop-color="#287588"/><stop offset="1" stop-color="#de5032"/></linearGradient></defs><rect x="10" y="5" width="180" height="90" fill="url(#g)" opacity="0.6"/></svg>';
    const asset=await makeAsset(source),composition=initialComposition();
    const svg=await serializeSvg(asset,composition);
    expect(svg).toContain('data:image/svg+xml;base64,');
    expect(svg).toContain('<rect x="40" y="35" width="520" height="640"');
    const image=await loadImage(new Resvg(svg).render().asPng());expect(image.width).toBe(1560);expect(image.height).toBe(1920);
    const reopened=createCanvas(image.width,image.height);reopened.getContext('2d').drawImage(image,0,0);
    expect(reopened.getContext('2d').getImageData(700,700,1,1).data[0]).toBeLessThan(240);
  });
});
