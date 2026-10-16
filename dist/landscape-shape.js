// Shared coast functions keep the terrain, plants, collision boundary and water wash together.
export const nearBank=z=>4+6*Math.sin(z*.046+.25)+2.15*Math.sin(z*.107-.30);
export const farBank=z=>70+10*Math.sin(z*.031)+4.2*Math.sin(z*.071+.8);
export const farBankGLSL='70.0+10.0*sin(p.y*0.031)+4.2*sin(p.y*0.071+0.8)';
// The road narrows between two cliffs; the cart fills its only onward opening.
export function passWall(x,z){return z>61.0&&(x< -30.22||x> -26.98);}

// Keep low stones on the hillside after their final rotation and stretching.
// Tall cliffs only conform at their buried foot, preserving their distant crest.
export function conformRockSurface(positions,{x,z,yaw=0,scaleX=1,scaleY=1,scaleZ=1,height,wholeSurface=true},heightAt){
  const centre=heightAt(x,z),cos=Math.cos(yaw),sin=Math.sin(yaw);
  let minY=Infinity,maxY=-Infinity,maxShift=0;
  for(let i=1;i<positions.length;i+=3){minY=Math.min(minY,positions[i]);maxY=Math.max(maxY,positions[i]);}
  const range=Math.max(.001,maxY-minY);
  for(let i=0;i<positions.length;i+=3){
    const lx=positions[i]*scaleX,lz=positions[i+2]*scaleZ;
    const ground=heightAt(x+cos*lx+sin*lz,z-sin*lx+cos*lz);
    const t=Math.max(0,Math.min(1,((positions[i+1]-minY)/range-.45)/.40));
    const weight=wholeSurface?1:1-t*t*(3-2*t);
    const shift=(ground-centre)*weight;
    positions[i+1]+=shift/scaleY;maxShift=Math.max(maxShift,Math.abs(shift));
  }
  return {vertices:positions.length/3,maxShift,nominalHeight:height,mode:wholeSurface?'terrain-conformed-surface':'terrain-conformed-foot'};
}
