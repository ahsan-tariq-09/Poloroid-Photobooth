import type { CameraISO, FilmPreset } from "./CameraSettings";

/** Applies the selected stock and a restrained digital fill flash to the saved pixels. */
export function applyCameraFilm(image:ImageData,preset:FilmPreset,flash:boolean,iso:CameraISO=800) {
  const data=image.data;
  // Browser video is already auto-exposed; this simulates ISO gain, not sensor control.
  const gain=iso/800, exposure=new Float32Array(256);
  for(let n=0;n<256;n++){
    const srgb=n/255,linear=srgb<=.04045?srgb/12.92:Math.pow((srgb+.055)/1.055,2.4);
    const light=linear*gain;
    exposure[n]=255*(light<=.0031308?light*12.92:1.055*Math.pow(light,1/2.4)-.055);
  }
  let seed=173;
  for(let i=0;i<data.length;i+=4){
    const red=exposure[data[i]],green=exposure[data[i+1]],blue=exposure[data[i+2]];
    const luminance=.2126*red+.7152*green+.0722*blue;
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const grain=(seed/4294967296-.5)*(preset==="Film Grain"?36:10)*Math.sqrt(gain);
    const lift=flash?18*Math.pow(Math.max(0,1-luminance/255),1.5):0;
    for(let c=0;c<3;c++){
      let value=preset==="B&W"?luminance:c===0?red:c===1?green:blue;
      if(preset==="Classic"||preset==="Film Grain") value=(value*.84+luminance*.16-128)*1.03+128+[5,1,-5][c];
      if(preset==="Faded")value=(value*.68+luminance*.32)*.82+29;
      data[i+c]=Math.max(0,Math.min(255,value+grain+lift));
    }
  }
  return image;
}
