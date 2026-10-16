import test from 'node:test';
import assert from 'node:assert/strict';
import {createJourneyState,LUGGAGE} from '../dist/journey-state.js';
const take=(s,id)=>{assert.equal(s.begin(id),true);assert.equal(s.reveal(id),true);assert.equal(s.pickup(id),true);};
test('exactly five keepsakes remain, with the farewell letter last',()=>assert.deepEqual(LUGGAGE.map(i=>i.id),['hat','scroll','decree','map','farewell']));
test('a pickup advances to the next task without returning to the wagon',()=>{
  const s=createJourneyState();take(s,'hat');
  assert.equal(s.collected,1);assert.equal(s.returned,0);assert.equal(s.activeId,'scroll');
  assert.equal(s.status('hat'),'collected');assert.equal(s.begin('scroll'),true);
  assert.equal(s.readyToReturn,false);assert.equal(s.deposit(),null);
});
test('farewell stays locked until the fourth item is picked up',()=>{
  const s=createJourneyState();for(const item of LUGGAGE.slice(0,3))take(s,item.id);
  s.begin('map');s.reveal('map');assert.equal(s.unlocked('farewell'),false);assert.equal(s.begin('farewell'),false);
  s.pickup('map');assert.equal(s.unlocked('farewell'),true);assert.equal(s.returned,0);
});
test('the story becomes readable at pickup and remains readable through final return',()=>{
  const s=createJourneyState();s.begin('hat');s.reveal('hat');assert.deepEqual(s.snapshot().storiesRead,[]);
  s.pickup('hat');assert.deepEqual(s.snapshot().storiesRead,['hat']);
  for(const item of LUGGAGE.slice(1))take(s,item.id);s.deposit();
  assert.deepEqual(s.snapshot().storiesRead,LUGGAGE.map(item=>item.id));
});
test('all five pickups are required before one bulk return completes the journey',()=>{
  const s=createJourneyState();
  for(let index=0;index<LUGGAGE.length;index++){
    const id=LUGGAGE[index].id;assert.equal(s.activeId,id);
    for(const later of LUGGAGE.slice(index+1)){assert.equal(s.unlocked(later.id),false);assert.equal(s.begin(later.id),false);}
    assert.equal(s.deposit(),null);take(s,id);assert.equal(s.collected,index+1);
    assert.equal(s.returned,0);assert.equal(s.complete,false);
    assert.equal(s.readyToReturn,index===LUGGAGE.length-1);
  }
  assert.equal(s.activeId,null);assert.deepEqual(s.deposit(),LUGGAGE.map(item=>item.id));
  assert.equal(s.returned,5);assert.equal(s.collected,5);assert.equal(s.complete,true);assert.equal(s.readyToReturn,false);
  assert.equal(s.deposit(),null);for(const item of s.snapshot().items)assert.equal(item.status,'returned');
});
test('covered, unfinished and already collected objects cannot be picked up',()=>{
  const s=createJourneyState();assert.equal(s.pickup('hat'),false);s.begin('hat');assert.equal(s.pickup('hat'),false);
  assert.equal(s.reveal('scroll'),false);s.reveal('hat');assert.equal(s.pickup('hat'),true);
  assert.equal(s.pickup('hat'),false);assert.equal(s.begin('hat'),false);assert.equal(s.collected,1);
});
test('restart clears collected and returned inventory, covers and read stories',()=>{
  const s=createJourneyState();for(const item of LUGGAGE)take(s,item.id);s.deposit();s.reset();
  assert.equal(s.returned,0);assert.equal(s.collected,0);assert.equal(s.readyToReturn,false);assert.equal(s.activeId,'hat');
  assert.equal(s.complete,false);assert.equal(s.unlocked('farewell'),false);assert.deepEqual(s.snapshot().storiesRead,[]);
  for(const item of s.snapshot().items)assert.equal(item.status,'covered');assert.equal(s.begin('invalid'),false);
});
