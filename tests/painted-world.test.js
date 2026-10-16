import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nearBank,farBank,passWall,conformRockSurface} from '../dist/landscape-shape.js';
test('curved banks leave a continuous river and all shore missions on land',()=>{
 let min=Infinity,max=-Infinity;
 for(let z=-86;z<=86;z+=.25){const x=nearBank(z);min=Math.min(min,x);max=Math.max(max,x);assert.ok(farBank(z)-x>40);assert.ok(Math.abs(nearBank(z+.01)-x)<.006);}
 assert.ok(max-min>11);assert.ok(-5.7<nearBank(-25.5)-1.25);assert.ok(-4<nearBank(-24)-1.25);assert.ok(-11<nearBank(35)-1.25);
});
test('cliffs bound the cart-centred outward road, while the approach remains open',()=>{
 assert.equal(passWall(-28.6,64),false);assert.equal(passWall(-30.3,64),true);assert.equal(passWall(-26.9,64),true);assert.equal(passWall(-30,58),false);
 for(const offset of [-1.5,0,1.5])assert.equal(passWall(-28.6+offset,64),false);
});
test('rotated stretched low rocks follow the hillside across their whole footprint',()=>{
 const original=new Float32Array([-1,.08,0,1,.08,0,0,-.02,-1,0,.22,1]);
 const positions=original.slice(),transform={x:4,z:-3,yaw:.71,scaleX:1.7,scaleY:1,scaleZ:.6,height:.24};
 const ground=(x,z)=>2+x*.8-z*.4+.03*Math.sin(x*2+z);
 const result=conformRockSurface(positions,transform,ground),origin=ground(transform.x,transform.z)-.12;
 for(let i=0;i<positions.length;i+=3){
  const lx=original[i]*transform.scaleX,lz=original[i+2]*transform.scaleZ;
  const x=transform.x+Math.cos(transform.yaw)*lx+Math.sin(transform.yaw)*lz,z=transform.z-Math.sin(transform.yaw)*lx+Math.cos(transform.yaw)*lz;
  const clearance=origin+positions[i+1]-ground(x,z);
  assert.ok(Math.abs(clearance-(original[i+1]-.12))<1e-6);
  if(original[i+1]<.12)assert.ok(clearance<0,'the lower stone skin stays buried on both sides of the slope');
 }
 assert.ok(result.maxShift>1);assert.equal(result.mode,'terrain-conformed-surface');
});
test('cliff-foot grounding preserves the upper mountain silhouette',()=>{
 const original=new Float32Array([-2,0,0,2,0,0,-1,8,0,1,10,0]);
 const positions=original.slice();conformRockSurface(positions,{x:0,z:0,height:10,wholeSurface:false},x=>x*.5);
 assert.equal(positions[1],-1);assert.equal(positions[4],1);assert.equal(positions[10],10);
 assert.ok(Math.abs(positions[7]-8)<.03,'the crest is preserved while the buried foot conforms');
});
test('horse skin is a connected real 3D mesh, with unit normals and complete UVs',()=>{
 const b=readFileSync(new URL('../dist/assets/models/horse-v2.bin',import.meta.url)),n=b.readUInt32LE(4),count=b.readUInt32LE(8);assert.equal(b.readUInt32LE(0),0x484f5253);assert.equal(b.length,16+n*32+count*4);assert.ok(count/3>40000);
 const p=new Float32Array(b.buffer,b.byteOffset+16,n*3),normal=new Float32Array(b.buffer,b.byteOffset+16+n*12,n*3),uv=new Float32Array(b.buffer,b.byteOffset+16+n*24,n*2),idx=new Uint32Array(b.buffer,b.byteOffset+16+n*32,count);
 const parent=Array.from({length:n},(_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 for(let i=0;i<count;i+=3){assert.ok(idx[i]<n&&idx[i+1]<n&&idx[i+2]<n);parent[find(idx[i])]=find(idx[i+1]);parent[find(idx[i+1])]=find(idx[i+2]);}
 assert.equal(new Set(parent.map((_,i)=>find(i))).size,1);
 for(let i=0;i<n;i++){assert.ok(Number.isFinite(p[i*3])&&Number.isFinite(uv[i*2]));assert.ok(Math.abs(Math.hypot(normal[i*3],normal[i*3+1],normal[i*3+2])-1)<1e-4);}
});
