const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
export function flightLength(points){return points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0);}
export function pointOnFlight(points,progress){
  if(!points.length)return null;
  if(progress<=0)return {...points[0]};
  if(progress>=1)return {...points.at(-1)};
  let remaining=flightLength(points)*Math.max(0,Math.min(1,progress));
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],length=distance(a,b);
    if(remaining<=length){const t=length?remaining/length:1;return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};}remaining-=length;
  }
  return {...points.at(-1)};
}
export function advanceFlight(progress,dt,duration,playing){
  return playing?Math.min(1,progress+Math.max(0,dt)/duration):progress;
}
export const flightEase=t=>t*t*(3-2*t);
