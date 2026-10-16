// ponytail: bake a continuous organic skin once with native Node; no runtime modeller or new dependency.
import { mkdir, writeFile } from 'node:fs/promises';
const shapes=[];
const ell=(x,y,z,rx,ry,rz,angle=0,k=.10)=>shapes.push({type:'ell',x,y,z,rx,ry,rz,c:Math.cos(angle),s:Math.sin(angle),k});
const cap=(a,b,r0,r1,k=.055)=>shapes.push({type:'cap',a,b,r0,r1,k});
ell(0,1.33,-.18,.425,.49,.91);
ell(0,1.43,-.88,.405,.47,.47,0,.16);
ell(0,1.44,.50,.35,.50,.42,0,.16);
ell(0,1.96,.83,.218,.59,.285,.44,.15);
ell(0,2.38,1.10,.182,.245,.215,0,.13);
ell(0,2.18,1.37,.184,.215,.44,.55,.105);
ell(0,1.98,1.69,.174,.145,.195,0,.08);
for(const side of [-1,1]){
  const x=side*.295,offset=side===1?.065:-.025;
  // Front legs: elbow, knee, long cannon, sloping pastern.
  cap([x,1.39,.53],[x,.86,.62+offset],.137,.083,.10);
  ell(x,.76,.64+offset,.081,.13,.084,0,.06);
  cap([x,.72,.66+offset],[x,.22,.70+offset],.062,.051,.045);
  ell(x,.20,.72+offset,.069,.075,.075,0,.04);
  cap([x,.20,.72+offset],[x,.095,.81+offset],.057,.052,.04);
  // Hind legs: broad thigh, rearward hock, fine lower leg.
  cap([x,1.41,-.89],[x,.91,-.70+offset],.188,.104,.12);
  cap([x,.95,-.71+offset],[x,.58,-1.02+offset],.10,.071,.065);
  ell(x,.57,-1.01+offset,.079,.09,.092,0,.045);
  cap([x,.54,-1.01+offset],[x,.20,-.91+offset],.059,.052,.04);
  cap([x,.20,-.91+offset],[x,.095,-.82+offset],.058,.053,.04);
}
function sdf(x,y,z){
  let d=100;
  for(const s of shapes){
    let q;
    if(s.type==='ell'){
      const px=x-s.x,dy=y-s.y,dz=z-s.z,py=s.c*dy+s.s*dz,pz=-s.s*dy+s.c*dz;
      const k0=Math.hypot(px/s.rx,py/s.ry,pz/s.rz),k1=Math.hypot(px/(s.rx*s.rx),py/(s.ry*s.ry),pz/(s.rz*s.rz));
      q=k1<1e-9?-Math.min(s.rx,s.ry,s.rz):k0*(k0-1)/k1;
    }else{
      const ax=x-s.a[0],ay=y-s.a[1],az=z-s.a[2],bx=s.b[0]-s.a[0],by=s.b[1]-s.a[1],bz=s.b[2]-s.a[2];
      const t=Math.max(0,Math.min(1,(ax*bx+ay*by+az*bz)/(bx*bx+by*by+bz*bz)));
      q=Math.hypot(ax-bx*t,ay-by*t,az-bz*t)-(s.r0+(s.r1-s.r0)*t);
    }
    const h=Math.max(s.k-Math.abs(d-q),0)/s.k;
    d=Math.min(d,q)-h*h*s.k*.25;
  }
  return d;
}
const step=.038,lo=[-.67,.014,-1.46],hi=[.67,2.70,1.97];
const dims=lo.map((v,i)=>Math.ceil((hi[i]-v)/step)+1),[nx,ny,nz]=dims;
const field=new Float32Array(nx*ny*nz),at=(x,y,z)=>(z*ny+y)*nx+x;
for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)field[at(x,y,z)]=sdf(lo[0]+x*step,lo[1]+y*step,lo[2]+z*step);
const offsets=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
const tetra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
const pos=[],normal=[],uv=[],indices=[],vertices=new Map();
function vertex(a,b,fa,fb){
  const t=fa/(fa-fb),p=a.map((v,i)=>v+(b[i]-v)*t),key=p.map(v=>Math.round(v*1e6)).join(',');
  if(vertices.has(key))return vertices.get(key);
  const id=pos.length/3,e=.002,dx=sdf(p[0]+e,p[1],p[2])-sdf(p[0]-e,p[1],p[2]),dy=sdf(p[0],p[1]+e,p[2])-sdf(p[0],p[1]-e,p[2]),dz=sdf(p[0],p[1],p[2]+e)-sdf(p[0],p[1],p[2]-e),len=Math.hypot(dx,dy,dz);
  pos.push(...p);normal.push(dx/len,dy/len,dz/len);uv.push((p[2]+1.46)/3.43,p[1]/2.70);vertices.set(key,id);return id;
}
function tri(a,b,c){
  const ax=pos[a*3],ay=pos[a*3+1],az=pos[a*3+2],ux=pos[b*3]-ax,uy=pos[b*3+1]-ay,uz=pos[b*3+2]-az,vx=pos[c*3]-ax,vy=pos[c*3+1]-ay,vz=pos[c*3+2]-az;
  const dot=(uy*vz-uz*vy)*normal[a*3]+(uz*vx-ux*vz)*normal[a*3+1]+(ux*vy-uy*vx)*normal[a*3+2];
  if(dot<0)indices.push(a,c,b);else indices.push(a,b,c);
}
for(let z=0;z<nz-1;z++)for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
  const f=offsets.map(o=>field[at(x+o[0],y+o[1],z+o[2])]);if(f.every(v=>v>0)||f.every(v=>v<0))continue;
  const p=offsets.map(o=>[lo[0]+(x+o[0])*step,lo[1]+(y+o[1])*step,lo[2]+(z+o[2])*step]);
  for(const t of tetra){
    const ins=t.filter(i=>f[i]<0),out=t.filter(i=>f[i]>=0);if(!ins.length||!out.length)continue;
    const edge=(a,b)=>vertex(p[a],p[b],f[a],f[b]);
    if(ins.length===1){const a=ins[0];tri(edge(a,out[0]),edge(a,out[1]),edge(a,out[2]));}
    else if(ins.length===3){const a=out[0];tri(edge(a,ins[0]),edge(a,ins[1]),edge(a,ins[2]));}
    else{const a=edge(ins[0],out[0]),b=edge(ins[0],out[1]),c=edge(ins[1],out[0]),d=edge(ins[1],out[1]);tri(a,b,c);tri(b,d,c);}
  }
}
const header=new Uint32Array([0x484f5253,pos.length/3,indices.length,1]);
const data=Buffer.concat([Buffer.from(header.buffer),Buffer.from(new Float32Array(pos).buffer),Buffer.from(new Float32Array(normal).buffer),Buffer.from(new Float32Array(uv).buffer),Buffer.from(new Uint32Array(indices).buffer)]);
const path=new URL('../dist/assets/models/horse-v2.bin',import.meta.url);await mkdir(new URL('.',path),{recursive:true});await writeFile(path,data);
console.log(JSON.stringify({vertices:pos.length/3,triangles:indices.length/3,bytes:data.length,bounds:lo.map((_,i)=>[Math.min(...pos.filter((v,j)=>j%3===i)),Math.max(...pos.filter((v,j)=>j%3===i))])}));
