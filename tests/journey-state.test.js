import test from 'node:test';
import assert from 'node:assert/strict';
import {createJourneyState,LUGGAGE} from '../dist/journey-state.js';
const take=(s,id)=>{assert.equal(s.begin(id),true);assert.equal(s.reveal(id),true);assert.equal(s.pickup(id),true);};
test('exactly five keepsakes remain, with the farewell letter last',()=>assert.deepEqual(LUGGAGE.map(i=>i.id),['hat','scroll','decree','map','farewell']));
test('one carried item prevents a second pickup or environment task',()=>{const s=createJourneyState();take(s,'hat');assert.equal(s.begin('scroll'),false);assert.equal(s.pickup('scroll'),false);assert.equal(s.carried,'hat');assert.equal(s.returned,0);});
test('farewell stays locked while the fourth item is still carried',()=>{const s=createJourneyState();for(const i of LUGGAGE.slice(0,3)){take(s,i.id);s.deposit();}take(s,'map');assert.equal(s.unlocked('farewell'),false);assert.equal(s.begin('farewell'),false);s.deposit();assert.equal(s.unlocked('farewell'),true);});
test('the story becomes readable at pickup, before the return',()=>{const s=createJourneyState();s.begin('hat');s.reveal('hat');assert.deepEqual(s.snapshot().storiesRead,[]);s.pickup('hat');assert.deepEqual(s.snapshot().storiesRead,['hat']);assert.equal(s.returned,0);s.deposit();assert.deepEqual(s.snapshot().storiesRead,['hat']);});
test('guide sequence advances only after a return; completion requires the last return',()=>{
 const s=createJourneyState();
 for(let index=0;index<LUGGAGE.length;index++){
  const id=LUGGAGE[index].id;assert.equal(s.activeId,id);
  for(const later of LUGGAGE.slice(index+1)){assert.equal(s.unlocked(later.id),false);assert.equal(s.begin(later.id),false);}
  take(s,id);assert.equal(s.activeId,id);assert.equal(s.complete,false);
  assert.equal(s.deposit(),id);assert.equal(s.deposit(),null);assert.equal(s.returned,index+1);
 }
 assert.equal(s.activeId,null);assert.equal(s.complete,true);
});
test('covered and unfinished objects cannot be picked up',()=>{const s=createJourneyState();assert.equal(s.pickup('hat'),false);s.begin('hat');assert.equal(s.pickup('hat'),false);assert.equal(s.reveal('scroll'),false);assert.equal(s.deposit(),null);});
test('restart restores hat destination, all covers and unread stories',()=>{const s=createJourneyState();take(s,'hat');s.deposit();take(s,'scroll');s.reset();assert.equal(s.returned,0);assert.equal(s.carried,null);assert.equal(s.activeId,'hat');assert.equal(s.complete,false);assert.equal(s.unlocked('farewell'),false);assert.deepEqual(s.snapshot().storiesRead,[]);for(const i of s.snapshot().items)assert.equal(i.status,'covered');assert.equal(s.begin('invalid'),false);});
