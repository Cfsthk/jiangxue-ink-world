// Shared coast functions keep the terrain, plants, collision boundary and water wash together.
export const nearBank=z=>4+6*Math.sin(z*.046+.25)+2.15*Math.sin(z*.107-.30);
export const farBank=z=>70+10*Math.sin(z*.031)+4.2*Math.sin(z*.071+.8);
export const farBankGLSL='70.0+10.0*sin(p.y*0.031)+4.2*sin(p.y*0.071+0.8)';
// The road narrows between two cliffs; the cart fills its only onward opening.
export function passWall(x,z){return z>61.0&&(x< -29.42||x> -26.18);}
