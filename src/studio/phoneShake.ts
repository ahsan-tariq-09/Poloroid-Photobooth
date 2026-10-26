type Vector = { x:number; y:number; z:number };
type Reading = { x:number|null; y:number|null; z:number|null } | null | undefined;
const valid = (value:Reading):value is Vector => !!value && [value.x,value.y,value.z].every(v=>typeof v==="number"&&Number.isFinite(v));

/** Five strong, alternating acceleration peaks reject bumps and ordinary handling. */
export function createPhoneShakeDetector() {
  let gravity:Vector|null=null, previousTime:number|null=null;
  let lastPeak:Vector|null=null, lastPeakTime=0, started=0, peaks=0;
  const reset=()=>{gravity=null;previousTime=null;lastPeak=null;lastPeakTime=0;started=0;peaks=0;};
  return {reset, sample(acceleration:Reading,includingGravity:Reading,time:number){
    if(!Number.isFinite(time))return false;
    if(previousTime!==null&&(time<=previousTime||time-previousTime>1000))reset();
    const elapsed=previousTime===null?16:time-previousTime;previousTime=time;
    let vector:Vector;
    if(valid(acceleration))vector=acceleration;
    else if(valid(includingGravity)){
      if(!gravity){gravity={...includingGravity};return false;}
      const blend=elapsed/(350+elapsed);
      gravity={x:gravity.x+(includingGravity.x-gravity.x)*blend,y:gravity.y+(includingGravity.y-gravity.y)*blend,z:gravity.z+(includingGravity.z-gravity.z)*blend};
      vector={x:includingGravity.x-gravity.x,y:includingGravity.y-gravity.y,z:includingGravity.z-gravity.z};
    }else return false;
    const magnitude=Math.hypot(vector.x,vector.y,vector.z);
    if(magnitude<18)return false;
    if(!lastPeak||time-lastPeakTime>700||time-started>2500){lastPeak=vector;lastPeakTime=started=time;peaks=1;return false;}
    if(time-lastPeakTime<140)return false;
    const alignment=(vector.x*lastPeak.x+vector.y*lastPeak.y+vector.z*lastPeak.z)/(magnitude*Math.hypot(lastPeak.x,lastPeak.y,lastPeak.z));
    if(alignment>-.65)return false;
    lastPeak=vector;lastPeakTime=time;peaks++;
    return peaks>=5&&time-started>=800;
  }};
}
