import prisma from "../utils/prisma.js";
import { authenticateSocket } from "../middleware/auth.js";
import { recordUserUsage } from '../usage/store.js';
import { sourceOf } from '../usage/policy.js';
import { inputWakeAt } from './parachute.js';
import {
  nextForbiddenDeadline,
  removeForbiddenMember,
} from "./forbiddenWords.js";
import {
  initialState,
  applyCommand,
  advanceState,
  projectState,
  displayName,
  fail,
  finish,
} from "./engine.js";

const publicUser = { id: true, username: true, avatar: true };
const include = {
  players: {
    include: { user: { select: publicUser } },
    orderBy: { joinedAt: "asc" },
  },
};
let io;
export function onlineUserCount() {
  return new Set([...(io?.sockets.sockets.values() || [])].map(socket => socket.user?.id).filter(Boolean)).size;
}
const timers = new Map();
const hostTimers = new Map();
const queues = new Map();
const absenceTimers = new Map();

export function onlineIds(roomId) {
  return new Set(
    [...(io?.sockets.adapter.rooms.get(roomId) || [])]
      .map((id) => io.sockets.sockets.get(id)?.user.id)
      .filter(Boolean),
  );
}

function membersFor(room) {
  const online = onlineIds(room.id);
  return room.players.map((p) => ({
    ...p.user,
    username: displayName(p.user),
    online: online.has(p.userId),
  }));
}

// Serializable retry covers admission, membership and runtime in one boundary.
// The revision predicate also rejects lost updates if isolation is changed later.
export async function mutateRoom(code, work) {
  const key = code.toUpperCase();
  const previous = queues.get(key) || Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(() => mutateTransaction(key, work));
  queues.set(key, next);
  try {
    return await next;
  } finally {
    if (queues.get(key) === next) queues.delete(key);
  }
}

async function mutateTransaction(code, work) {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const room = await tx.room.findUnique({
            where: { code: code.toUpperCase() },
            include,
          });
          if (!room) fail("ไม่พบวงนี้ ตรวจรหัสอีกครั้ง", "ROOM_NOT_FOUND");
          const state = structuredClone(
            room.runtime?.schema === 1 ? room.runtime : initialState(),
          );
          const result = await work({
            tx,
            room,
            state,
            members: membersFor(room),
          });
          if (result?.unchanged) return room;
          (result?.state || state).updatedAt = Date.now();
          const updated = await tx.room.updateMany({
            where: { id: room.id, revision: room.revision },
            data: {
              runtime: result?.state || state,
              revision: { increment: 1 },
              status: [
                "INPUT",
                "RACING",
                "RESULTS",
                "PAUSED",
                "FORBIDDEN",
              ].includes((result?.state || state).phase)
                ? "PLAYING"
                : (result?.state || state).phase === "FINISHED"
                  ? "FINISHED"
                  : "WAITING",
              ...(result?.patch || {}),
            },
          });
          if (updated.count !== 1) {
            const error = new Error("Concurrent room update");
            error.code = "P2034";
            throw error;
          }
          return tx.room.findUnique({ where: { id: room.id }, include });
        },
        { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 },
      );
    } catch (error) {
      if (error.code === "P2034" && attempt < 19) {
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.min(150, 10 * (attempt + 1)) + Math.random() * 20,
          ),
        );
        continue;
      }
      throw error;
    }
  }
}

export async function joinRoom(code, userId, source = 'WEB') {
  let joined = false;
  const result = await mutateRoom(code, async ({ tx, room, state }) => {
    joined = !room.players.some((p) => p.userId === userId);
    if (!room.players.some((p) => p.userId === userId)) {
      if (room.players.length >= Math.min(room.maxPlayers, 10))
        fail("วงนี้เต็มแล้ว (สูงสุด 10 คน)", "ROOM_FULL");
      if (state.phase === "FINISHED")
        fail("วงนี้จบแล้ว ให้เพื่อนเปิดวงใหม่ก่อน");
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: publicUser,
      });
      if (!user)
        fail("ชื่อเล่นหมดอายุแล้ว กรุณาเข้าวงอีกครั้ง", "UNAUTHORIZED");
      await tx.roomPlayer.create({ data: { roomId: room.id, userId } });
      state.profiles[userId] = { ...user, username: displayName(user) };
    }
    return { state };
  });
  if (joined) recordUserUsage(userId, { type: 'ROOM_JOINED', roomCode: result.code, gameType: result.runtime?.config?.gameType, source });
  return result;
}

function snapshot(room, userId) {
  const members = membersFor(room);
  return {
    room: {
      id: room.id,
      code: room.code,
      hostId: room.hostId,
      maxPlayers: Math.min(room.maxPlayers, 10),
      revision: room.revision,
    },
    members,
    state: projectState(room.runtime, userId),
    serverNow: Date.now(),
  };
}

async function publish(room) {
  if (!io || !room) return;
  for (const id of io.sockets.adapter.rooms.get(room.id) || []) {
    const socket = io.sockets.sockets.get(id);
    if (room.players.some((p) => p.userId === socket?.user.id))
      socket.emit("party:state", snapshot(room, socket.user.id));
  }
  schedule(room);
  checkHost(room);
  for (const member of membersFor(room)) {
    const key = `${room.id}:${member.id}`;
    if (member.online) {
      clearTimeout(absenceTimers.get(key));
      absenceTimers.delete(key);
    } else if (!absenceTimers.has(key)) {
      const timer = setTimeout(
        async () => {
          absenceTimers.delete(key);
          if (onlineIds(room.id).has(member.id)) return;
          try {
            await leaveRoom(room.code, member.id);
          } catch (error) {
            console.error(
              "Absent member cleanup:",
              error.code || error.message,
            );
          }
        },
        5 * 60 * 1000,
      );
      timer.unref();
      absenceTimers.set(key, timer);
    }
  }
}

function schedule(room) {
  clearTimeout(timers.get(room.id));
  timers.delete(room.id);
  const state = room.runtime;
  const deadline =
    state?.phase === "FORBIDDEN"
      ? onlineIds(room.id).size
        ? nextForbiddenDeadline(state)
        : state.round.endsAt
      : state?.phase === "INPUT"
        ? inputWakeAt(state.round)
        : state?.phase === "RACING"
          ? state.round?.raceEndsAt
          : null;
  if (!deadline) return;
  const timer = setTimeout(
    async () => {
      timers.delete(room.id);
      try {
        const updated = await mutateRoom(room.code, ({ state }) => {
          const changed = advanceState(state, Date.now());
          return changed ? { state } : { unchanged: true };
        });
        await publish(updated);
      } catch (error) {
        console.error("Round recovery:", error.code || error.message);
        // Retry transient database outages; finalize remains idempotent.
        const retry = setTimeout(() => schedule(room), 2000);
        retry.unref();
        timers.set(room.id, retry);
      }
    },
    Math.max(10, deadline - Date.now()),
  );
  timer.unref();
  timers.set(room.id, timer);
}

function checkHost(room) {
  if (onlineIds(room.id).has(room.hostId)) {
    clearTimeout(hostTimers.get(room.id));
    hostTimers.delete(room.id);
    return;
  }
  if (hostTimers.has(room.id) || !onlineIds(room.id).size) return;
  const timer = setTimeout(
    async () => {
      hostTimers.delete(room.id);
      try {
        const updated = await mutateRoom(room.code, ({ room, members }) => {
          if (onlineIds(room.id).has(room.hostId)) return { unchanged: true };
          const next = members.find((p) => p.online);
          return next ? { patch: { hostId: next.id } } : { unchanged: true };
        });
        await publish(updated);
      } catch (error) {
        console.error("Host transfer:", error.code || error.message);
      }
    },
    Number(process.env.HOST_GRACE_MS) || 30000,
  );
  timer.unref();
  hostTimers.set(room.id, timer);
}

export async function leaveRoom(code, userId) {
  const room = await mutateRoom(code, async ({ tx, room, state, members }) => {
    if (!members.some((p) => p.id === userId))
      fail("คุณไม่ได้อยู่ในวงนี้", "NOT_MEMBER");
    await tx.roomPlayer.deleteMany({ where: { roomId: room.id, userId } });
    removeForbiddenMember(state, userId);
    state.ready = state.ready.filter((id) => id !== userId);
    state.sittingOut = state.sittingOut.filter((id) => id !== userId);
    const remaining = members.filter((p) => p.id !== userId);
    const next = remaining.find((p) => p.online) || remaining[0];
    if (!remaining.length) {
      if (state.round?.gameType === "FORBIDDEN_WORD") finish(state, Date.now());
      // Keep the summary for a day. Do not cascade away other guests/history.
      state.phase = "FINISHED";
      state.round = state.round
        ? { ...state.round, deadlineAt: null, raceEndsAt: null }
        : null;
    }
    return {
      state,
      patch: room.hostId === userId && next ? { hostId: next.id } : {},
    };
  });
  const absenceKey = `${room.id}:${userId}`;
  clearTimeout(absenceTimers.get(absenceKey));
  absenceTimers.delete(absenceKey);
  for (const id of io?.sockets.adapter.rooms.get(room.id) || []) {
    const socket = io.sockets.sockets.get(id);
    if (socket?.user.id === userId) {
      socket.emit("party:left");
      socket.leave(room.id);
    }
  }
  await publish(room);
  return room;
}

export function initializeParty(server) {
  io = server;
  io.use(authenticateSocket);
  io.on("connection", (socket) => {
    const usageSource = sourceOf(socket.handshake);
    recordUserUsage(socket.user.id, { type: 'CONNECTED', source: usageSource });
    let events = 0;
    const window = setInterval(() => {
      events = 0;
    }, 10000);
    window.unref();
    const limited = () => ++events > 60;
    const answerError = (callback, error) => {
      const known =
        typeof error.code === "string" && !error.code.startsWith("P");
      if (error.code !== 'STALE_STATE') recordUserUsage(socket.user.id, { type: 'ERROR', errorCode: known ? error.code : 'SERVER_ERROR', source: usageSource });
      callback?.({
        ok: false,
        code: known ? error.code : "SERVER_ERROR",
        error: known ? error.message : "เชื่อมต่อไม่สำเร็จ ลองอีกครั้ง",
      });
    };
    socket.on("party:sync", async (code, callback) => {
      try {
        if (limited()) fail("ส่งคำสั่งถี่เกินไป รอสักครู่");
        if (typeof code !== "string" || !/^[A-Z0-9]{6}$/i.test(code))
          fail("รหัสวงต้องมี 6 ตัว");
        const room = await joinRoom(code, socket.user.id, usageSource);
        // One active room per browser connection; another tab may join elsewhere.
        for (const previous of socket.rooms)
          if (previous !== socket.id && previous !== room.id)
            socket.leave(previous);
        await socket.join(room.id);
        await publish(room);
        callback?.({ ok: true, snapshot: snapshot(room, socket.user.id) });
      } catch (error) {
        answerError(callback, error);
      }
    });
    socket.on("party:command", async (input, callback) => {
      try {
        if (limited()) fail("ส่งคำสั่งถี่เกินไป รอสักครู่");
        if (
          !input ||
          typeof input.code !== "string" ||
          !/^[A-Z0-9]{6}$/i.test(input.code)
        )
          fail("รหัสวงไม่ถูกต้อง");
        let activity = null;
        const room = await mutateRoom(
          input.code,
          ({ room, state, members }) => {
            activity = null;
            if (!socket.rooms.has(room.id))
              fail("กลับเข้าวงก่อนส่งคำสั่ง", "NOT_MEMBER");
            const previousRound = state.round?.id;
            const previousPhase = state.phase;
            const result = applyCommand(state, input, {
              userId: socket.user.id,
              hostId: room.hostId,
              members,
              revision: room.revision,
              now: Date.now(),
            });
            if (result.changed) {
              if (['START', 'NEXT'].includes(input.type) && result.state.round?.id !== previousRound) activity = 'GAME_STARTED';
              else if (result.state.phase === 'FINISHED' && previousPhase !== 'FINISHED') activity = 'GAME_ENDED';
              else if (input.type === 'PAUSE') activity = 'GAME_PAUSED';
              else if (input.type === 'RESUME') activity = 'GAME_RESUMED';
            }
            return result.changed
              ? { state: result.state }
              : { unchanged: true };
          },
        );
        if (activity) recordUserUsage(socket.user.id, { type: activity, roomCode: room.code, gameType: room.runtime?.round?.gameType || room.runtime?.config?.gameType, source: usageSource });
        await publish(room);
        callback?.({ ok: true, snapshot: snapshot(room, socket.user.id) });
      } catch (error) {
        answerError(callback, error);
      }
    });
    socket.on("party:leave", async (code, callback) => {
      try {
        if (limited()) fail("ส่งคำสั่งถี่เกินไป");
        const room = await leaveRoom(code, socket.user.id);
        recordUserUsage(socket.user.id, { type: 'ROOM_LEFT', roomCode: room.code, gameType: room.runtime?.config?.gameType, source: usageSource });
        callback?.({ ok: true });
      } catch (error) {
        answerError(callback, error);
      }
    });
    socket.on("disconnecting", () => {
      const roomIds = [...socket.rooms].filter((id) => id !== socket.id);
      setTimeout(async () => {
        for (const id of roomIds) {
          try {
            await publish(
              await prisma.room.findUnique({ where: { id }, include }),
            );
          } catch (error) {
            console.error("Presence refresh:", error.code || error.message);
          }
        }
      }, 100).unref();
    });
    socket.on("disconnect", () => {
      clearInterval(window);
      recordUserUsage(socket.user.id, { type: 'DISCONNECTED', source: usageSource });
    });
  });
  // A restart must resume persisted deadlines even if no host reconnects.
  const recover = async () => {
    try {
      const rooms = await prisma.room.findMany({
        where: { status: { not: "FINISHED" } },
        include,
      });
      for (const room of rooms) await publish(room);
    } catch (error) {
      console.error("Runtime recovery:", error.code || error.message);
    }
  };
  recover();
  // Recovery sweep also catches a timer whose database write failed transiently.
  const sweep = setInterval(recover, 60000);
  sweep.unref();
  const retention = setInterval(
    async () => {
      try {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const expired = await prisma.room.findMany({
          where: { status: "FINISHED", createdAt: { lt: new Date(cutoff) } },
          select: { id: true, revision: true, runtime: true },
        });
        const eligible = expired.filter(
          (r) => r.runtime?.schema === 1 && r.runtime.updatedAt < cutoff,
        );
        if (eligible.length)
          await prisma.$transaction(
            eligible.map((r) =>
              prisma.room.deleteMany({
                where: { id: r.id, revision: r.revision, status: "FINISHED" },
              }),
            ),
          );
        await prisma.user.deleteMany({
          where: {
            isGuest: true,
            createdAt: { lt: new Date(cutoff) },
            roomPlayers: { none: {} },
            createdRooms: { none: {} },
          },
        });
      } catch (error) {
        console.error("Retention cleanup:", error.code || error.message);
      }
    },
    60 * 60 * 1000,
  );
  retention.unref();
}
