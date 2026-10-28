import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parachuteView } from '../src/utils/parachuteView.mjs';
const round=()=>({jumpFlow:2,startsAt:3000,deadlineAt:15000,landingAt:15000,revealAt:18000,flightWindowMs:12000,participantIds:['p0','p1','p2'],opened:[],quota:1});
test('parachute presentation separates countdown, freefall, landing and result acknowledgement',()=>{
  const r=round();
  assert.equal(parachuteView(r,1000).phase,'PREPARING');
  assert.equal(parachuteView(r,4000).phase,'FALLING');
  assert.equal(parachuteView(r,15000).phase,'LANDING');
  assert.equal(parachuteView(r,18000).phase,'WAITING_RESULT');
  r.result={players:[]};assert.equal(parachuteView(r,18000).phase,'RESULTS');
});
test('accepted early openings slow the player while unopened friends keep falling',()=>{
  const r=round();r.opened=[{userId:'p0',openedAt:4000}];
  const view=parachuteView(r,12000);
  assert.equal(view.openedCount,1);assert.equal(view.players[0].opened,true);
  assert.ok(view.players[0].y<view.players[1].y);
  assert.deepEqual(parachuteView(JSON.parse(JSON.stringify(r)),12000),view);
});
test('early completion still has a watching period and a full landing instead of instant results',()=>{
  const r=round();r.deadlineAt=3500;r.landingAt=7500;r.revealAt=10500;
  assert.equal(parachuteView(r,4000).phase,'WATCHING');
  assert.equal(parachuteView(r,8000).phase,'LANDING');
  assert.equal(parachuteView(r,10500).phase,'WAITING_RESULT');
});
test('ten long-lived participant slots stay bounded throughout fall and landing without optimistic openings',()=>{
  const r=round();r.participantIds=Array.from({length:10},(_,i)=>`p${i}`);
  for(const now of [0,3000,9000,15000,17999,25000]){
    const view=parachuteView(r,now);assert.equal(view.players.length,10);
    assert.ok(view.players.every((p)=>p.x>0&&p.x<100&&p.y>=16&&p.y<=84&&!p.opened));
  }
});
test('final scene follows confirmed result records even when old opener metadata is unavailable',()=>{
  const r=round();r.result={players:[{userId:'p0',order:1,missed:false},{userId:'p1',order:2,missed:false},{userId:'p2',order:null,missed:true}]};
  const model=parachuteView(r,18000);
  assert.deepEqual(model.players.map(p=>p.opened),[true,true,false]);
  assert.ok(model.players.every(p=>p.landed));
});
