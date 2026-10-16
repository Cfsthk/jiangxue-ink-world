import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nearBank,farBank,passWall} from '../dist/landscape-shape.js';
test('curved banks leave a continuous river and all shore missions on land',()=>{
 let min=Infinity,max=-Infinity;
 for(let z=-86;z<=86;z+=.25){const x=nearBank(z);min=Math.min(min,x);max=Math.max(max,x);assert.ok(farBank(z)-x>40);assert.ok(Math.abs(nearBank(z+.01)-x)<.006);}
 assert.ok(max-min>11);assert.ok(-5.7<nearBank(-25.5)-1.25);assert.ok(-4<nearBank(-24)-1.25);assert.ok(-11<nearBank(35)-1.25);
});
test('cliffs bound the outward road, while the approach remains open',()=>{assert.equal(passWall(-27.8,64),false);assert.equal(passWall(-30,64),true);assert.equal(passWall(-24,64),true);assert.equal(passWall(-30,58),false);});
test('horse skin is a connected real 3D mesh, with unit normals and complete UVs',()=>{
 const b=readFileSync(new URL('../dist/assets/models/horse-v2.bin',import.meta.url)),n=b.readUInt32LE(4),count=b.readUInt32LE(8);assert.equal(b.readUInt32LE(0),0x484f5253);assert.equal(b.length,16+n*32+count*4);assert.ok(count/3>40000);
 const p=new Float32Array(b.buffer,b.byteOffset+16,n*3),normal=new Float32Array(b.buffer,b.byteOffset+16+n*12,n*3),uv=new Float32Array(b.buffer,b.byteOffset+16+n*24,n*2),idx=new Uint32Array(b.buffer,b.byteOffset+16+n*32,count);
 const parent=Array.from({length:n},(_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 for(let i=0;i<count;i+=3){assert.ok(idx[i]<n&&idx[i+1]<n&&idx[i+2]<n);parent[find(idx[i])]=find(idx[i+1]);parent[find(idx[i+1])]=find(idx[i+2]);}
 assert.equal(new Set(parent.map((_,i)=>find(i))).size,1);
 for(let i=0;i<n;i++){assert.ok(Number.isFinite(p[i*3])&&Number.isFinite(uv[i*2]));assert.ok(Math.abs(Math.hypot(normal[i*3],normal[i*3+1],normal[i*3+2])-1)<1e-4);}
});
