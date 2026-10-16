import test from 'node:test';
import assert from 'node:assert/strict';
import {inkTrailDestination} from '../dist/ink-trail.js';
import {createJourneyState,LUGGAGE} from '../dist/journey-state.js';

test('ink marks guide each item home before advancing, with the farewell letter last',()=>{
  const journey=createJourneyState(),cart={x:-27.8,z:59};
  for(const item of LUGGAGE){
    assert.deepEqual(inkTrailDestination(journey.snapshot(),LUGGAGE,cart),{key:`item:${item.id}`,id:item.id,x:item.x,z:item.z});
    assert.equal(journey.begin(item.id),true);assert.equal(journey.reveal(item.id),true);assert.equal(journey.pickup(item.id),true);
    assert.deepEqual(inkTrailDestination(journey.snapshot(),LUGGAGE,cart),{key:'wagon',id:item.id,...cart});
    assert.equal(journey.deposit(),item.id);
  }
  assert.equal(inkTrailDestination(journey.snapshot(),LUGGAGE,cart),null);
  journey.reset();assert.equal(inkTrailDestination(journey.snapshot(),LUGGAGE,cart).id,'hat');
});

test('a missing active object clears the trail rather than inventing an unsafe destination',()=>{
  assert.equal(inkTrailDestination({complete:false,carried:null,activeId:'missing'},LUGGAGE,{x:0,z:0}),null);
});
