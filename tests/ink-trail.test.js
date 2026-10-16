import test from 'node:test';
import assert from 'node:assert/strict';
import {inkTrailDestination,inkTrailLegs} from '../dist/ink-trail.js';
import {createJourneyState,LUGGAGE} from '../dist/journey-state.js';

test('ink marks advance directly between five items and only then lead to the wagon',()=>{
  const journey=createJourneyState(),cart={x:-28.6,z:59};
  for(const [index,item] of LUGGAGE.entries()){
    assert.deepEqual(inkTrailDestination(journey.snapshot(),LUGGAGE,cart),{key:`item:${item.id}`,id:item.id,x:item.x,z:item.z});
    assert.equal(journey.begin(item.id),true);assert.equal(journey.reveal(item.id),true);assert.equal(journey.pickup(item.id),true);
    const next=inkTrailDestination(journey.snapshot(),LUGGAGE,cart);
    if(index<4)assert.equal(next.key,`item:${LUGGAGE[index+1].id}`);
    else assert.deepEqual(next,{key:'wagon',id:null,...cart});
  }
  journey.deposit();assert.equal(inkTrailDestination(journey.snapshot(),LUGGAGE,cart),null);
  journey.reset();assert.equal(inkTrailDestination(journey.snapshot(),LUGGAGE,cart).id,'hat');
});

test('route audits cover the actual six legs without redundant wagon returns',()=>{
  const spawn={x:-27.8,z:54.5},cart={x:-28.6,z:59},legs=inkTrailLegs(LUGGAGE,spawn,cart);
  assert.equal(legs.length,6);assert.deepEqual(legs.map(leg=>leg.item),[...LUGGAGE.map(item=>item.id),'wagon']);
  assert.equal(legs[0].from,spawn);assert.equal(legs[5].to,cart);
  for(let i=1;i<legs.length;i++)assert.equal(legs[i].from,legs[i-1].to);
  assert.deepEqual(legs.map(leg=>leg.direction),['to-item','to-item','to-item','to-item','to-item','to-wagon']);
  assert.deepEqual(inkTrailLegs([],spawn,cart),[]);
});

test('a missing active object clears the trail rather than inventing an unsafe destination',()=>{
  assert.equal(inkTrailDestination({complete:false,readyToReturn:false,activeId:'missing'},LUGGAGE,{x:0,z:0}),null);
});
