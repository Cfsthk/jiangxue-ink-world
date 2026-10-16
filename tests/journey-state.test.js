import test from 'node:test';
import assert from 'node:assert/strict';
import {createJourneyState,LUGGAGE} from '../dist/journey-state.js';
const take=(s,id)=>{assert.equal(s.begin(id),true);assert.equal(s.reveal(id),true);assert.equal(s.pickup(id),true);};
test('one carried item prevents a second pickup or environment task',()=>{const s=createJourneyState();take(s,'books');assert.equal(s.begin('hat'),false);assert.equal(s.pickup('hat'),false);assert.equal(s.carried,'books');assert.equal(s.returned,0);});
test('farewell letter stays locked until all five are returned, including the carried fifth',()=>{const s=createJourneyState();for(const i of LUGGAGE.slice(0,4)){take(s,i.id);s.deposit();}take(s,'map');assert.equal(s.unlocked('farewell'),false);assert.equal(s.begin('farewell'),false);s.deposit();assert.equal(s.unlocked('farewell'),true);});
test('bird sequence advances only after each return and finishes on the letter',()=>{
  const s=createJourneyState();
  for(let index=0;index<LUGGAGE.length;index++){
    const id=LUGGAGE[index].id;assert.equal(s.activeId,id);
    for(const later of LUGGAGE.slice(index+1)){assert.equal(s.unlocked(later.id),false);assert.equal(s.begin(later.id),false);}
    take(s,id);assert.equal(s.activeId,id);assert.equal(s.complete,false);
    assert.equal(s.deposit(),id);assert.equal(s.deposit(),null);
    assert.equal(s.returned,index+1);
  }
  assert.equal(s.activeId,null);assert.equal(s.complete,true);
});
test('cannot pick up covered objects or skip unfinished interaction',()=>{const s=createJourneyState();assert.equal(s.pickup('books'),false);s.begin('books');assert.equal(s.pickup('books'),false);assert.equal(s.reveal('hat'),false);assert.equal(s.deposit(),null);});
test('restart restores the first bird destination and clears progress',()=>{const s=createJourneyState();take(s,'books');s.deposit();take(s,'hat');s.reset();assert.equal(s.returned,0);assert.equal(s.carried,null);assert.equal(s.activeId,'books');assert.equal(s.complete,false);assert.equal(s.unlocked('farewell'),false);for(const i of s.snapshot().items)assert.equal(i.status,'covered');assert.equal(s.begin('invalid'),false);});
