import type { FilmPreset } from "./CameraSettings";

/** Applies the selected stock and a restrained digital fill flash to the saved pixels. */
export function applyCameraFilm(image:ImageData,preset:FilmPreset,flash:boolean) {
  const data=image.data;
  let seed=173;
  for(let i=0;i<data.length;i+=4){
    const luminance=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const grain=(seed/4294967296-.5)*(preset==="Film Grain"?36:10);
    const lift=flash?18*Math.pow(1-luminance/255,1.5):0;
    for(let c=0;c<3;c++){
      let value=preset==="B&W"?luminance:data[i+c];
      if(preset==="Classic"||preset==="Film Grain") value=(value*.84+luminance*.16-128)*1.03+128+[5,1,-5][c];
      if(preset==="Faded")value=(value*.68+luminance*.32)*.82+29;
      data[i+c]=Math.max(0,Math.min(255,value+grain+lift));
    }
  }
  return image;
}
