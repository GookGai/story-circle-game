// One disposable browser-protocol player for the Android trial's core gameplay check.
import { io } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { PRODUCTION_URL as base } from '../src/utils/appLinks.mjs';

mkdirSync('../../artifacts', { recursive: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let token, code, socket, snapshot;
async function request(path, body) {
  const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return result;
}
const emit = (event, ...args) => new Promise((resolve, reject) => socket.timeout(15000).emit(event, ...args, (error, reply) => error ? reject(error) : resolve(reply)));
function accept(value) { if (!snapshot || value.room.revision >= snapshot.room.revision) snapshot = value; }
async function command(type, extra = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const sync = await emit('party:sync', code);
    if (!sync.ok) throw new Error('Companion sync failed');
    accept(sync.snapshot);
    const reply = await emit('party:command', { code, type, commandId: randomUUID(), expectedRevision: snapshot.room.revision, roundId: snapshot.state.round?.id, ...extra });
    if (reply.ok) { accept(reply.snapshot); return; }
    if (reply.code !== 'STALE_STATE') throw new Error(`${type}: ${reply.error}`);
  }
  throw new Error(`${type}: state changed repeatedly`);
}
try {
  token = (await request('/api/auth/guest', { username: 'Web QA', avatar: 'fox' })).token;
  code = (await request('/api/rooms', { gameType: 'MINORITY_VOTE', maxPlayers: 2, settings: { totalRounds: 3 } })).room.code;
  socket = io(base, { auth: { token }, transports: ['websocket'] });
  socket.on('party:state', accept);
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  accept((await emit('party:sync', code)).snapshot);
  await command('READY', { ready: true });
  writeFileSync('../../artifacts/android-room-code.txt', code);
  const timeout = Date.now() + 240000;
  let started = false, voted = false, played = false;
  while (Date.now() < timeout) {
    if (!started && snapshot.members.length === 2 && snapshot.state.ready.length === 2) { await command('START'); started = true; }
    if (started && !voted && snapshot.state.phase === 'INPUT' && Date.now() >= snapshot.state.round.startsAt) { await command('VOTE', { choice: 'A' }); voted = true; }
    if (snapshot.state.phase === 'RESULTS') {
      const players = snapshot.state.round.result.players;
      if (players.length !== 2 || players.some(player => player.choice !== 'A')) throw new Error('Both browser and Android votes must reach the server');
      played = true;
    }
    if (played && snapshot.members.length === 1) {
      writeFileSync('../../artifacts/android-gameplay.json', JSON.stringify({ passed: true, code, players: 2, game: 'MINORITY_VOTE', phase: 'RESULTS' }));
      console.log('Android and browser companion completed one shared vote round');
      break;
    }
    await delay(250);
  }
  if (!played || !existsSync('../../artifacts/android-gameplay.json')) throw new Error('Android did not complete and leave the shared round before timeout');
} finally {
  if (socket?.connected && code) {
    try { if (snapshot?.state.phase !== 'FINISHED') await command('END'); } catch { /* Only this disposable room is affected. */ }
    await emit('party:leave', code).catch(() => {});
  }
  socket?.disconnect();
}
