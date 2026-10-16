import test from 'node:test';
import assert from 'node:assert/strict';
import {createBirdRoute,routeLength,pointOnRoute,nearestRouteDistance} from '../dist/bird-route.js';
const bounds={minX:0,maxX:20,minZ:0,maxZ:20};
test('guide goes around a cliff barrier through its walkable opening',()=>{
  const canWalk=(x,z)=>x>=0&&x<=20&&z>=0&&z<=20&&!(x>8&&x<12&&z<15);
  const p=createBirdRoute({canWalk,heightAt:()=>0,bounds});
  const route=p.find({x:3,z:3},{x:17,z:3});
  assert.ok(route.length>4);assert.ok(route.some(n=>n.z>=15));
  for(let i=1;i<route.length;i++)assert.equal(p.clear(route[i-1],route[i]),true);
  assert.ok(routeLength(route)>30);
});
test('disconnected land produces no unsafe direct flight',()=>{
  const p=createBirdRoute({canWalk:(x)=>x<8||x>12,heightAt:()=>0,bounds});
  assert.deepEqual(p.find({x:3,z:3},{x:17,z:3}),[]);
});
test('road weighting favours a visible nearby path over plain snow',()=>{
  const roads=Array.from({length:21},(_,x)=>({x,z:6}));
  const p=createBirdRoute({canWalk:()=>true,heightAt:()=>0,bounds,roads});
  const route=p.find({x:0,z:2},{x:20,z:2});
  assert.ok(route.some(n=>n.z>=4));
  assert.deepEqual(route[0],{x:0,z:2});assert.deepEqual(route.at(-1),{x:20,z:2});
});
test('route interpolation preserves waiting distance across turns and endpoints',()=>{
  const route=[{x:0,z:0},{x:0,z:10},{x:10,z:10}];
  assert.equal(routeLength(route),20);assert.deepEqual(pointOnRoute(route,14),{x:4,z:10});
  assert.deepEqual(pointOnRoute(route,50),{x:10,z:10});assert.equal(pointOnRoute([],1),null);
  assert.deepEqual(nearestRouteDistance(route,{x:4,z:12}),{along:14,distance:2});
});
