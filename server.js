const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const APP_PASSWORD = process.env.APP_PASSWORD || '';

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, uptime: process.uptime() });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const rooms = new Map();
const ROOM_TTL_MS = 10 * 60 * 1000; // 10 minutes grace period when empty

function sanitizeRoomId(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32);
}

function sanitizeName(raw) {
  return String(raw || '')
    .trim()
    .slice(0, 24) || 'Misafir';
}

function getEffectiveTime(video) {
  if (!video.videoId) return 0;
  if (!video.isPlaying) return video.currentTime;
  const elapsed = (Date.now() - video.updatedAt) / 1000;
  return Math.max(0, video.currentTime + elapsed);
}

function serializeRoomUsers(room) {
  return Array.from(room.users.values());
}

function serializeVideoState(video) {
  return {
    videoId: video.videoId,
    isPlaying: video.isPlaying,
    currentTime: getEffectiveTime(video),
    serverTime: Date.now()
  };
}

function getOrCreateRoom(roomId, password) {
  let room = rooms.get(roomId);
  if (room) {
    if (room.cleanupTimer) {
      clearTimeout(room.cleanupTimer);
      room.cleanupTimer = null;
    }
    return { room, created: false };
  }

  room = {
    id: roomId,
    password: password || null,
    users: new Map(),
    video: {
      videoId: null,
      isPlaying: false,
      currentTime: 0,
      updatedAt: Date.now()
    },
    messages: [],
    screenSharerId: null,
    cleanupTimer: null
  };
  rooms.set(roomId, room);
  return { room, created: true };
}

io.on('connection', (socket) => {
  let currentRoomId = null;

  socket.on('room:join', (payload = {}, ack) => {
    const roomId = sanitizeRoomId(payload.roomId) || 'ikimiz';
    const name = sanitizeName(payload.name);
    const password = String(payload.password || '').trim();

    if (APP_PASSWORD && password !== APP_PASSWORD) {
      if (typeof ack === 'function') {
        ack({ ok: false, error: 'Genel giriş şifresi hatalı.' });
      }
      return;
    }

    const existing = rooms.get(roomId);
    if (existing && existing.password && existing.password !== password) {
      if (typeof ack === 'function') {
        ack({ ok: false, error: 'Oda şifresi hatalı.' });
      }
      return;
    }

    if (existing && existing.users.size >= 4) {
      if (typeof ack === 'function') {
        ack({ ok: false, error: 'Bu oda şu an dolu.' });
      }
      return;
    }

    const { room } = getOrCreateRoom(roomId, password);
    currentRoomId = roomId;

    const user = {
      id: socket.id,
      name,
      voiceJoined: false,
      muted: false,
      speaking: false
    };

    room.users.set(socket.id, user);
    socket.join(roomId);

    const joinNotice = {
      id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      system: true,
      text: `${name} odaya katıldı`,
      timestamp: Date.now()
    };

    socket.to(roomId).emit('room:users', serializeRoomUsers(room));
    socket.to(roomId).emit('chat:message', joinNotice);

    if (room.screenSharerId && room.screenSharerId !== socket.id) {
      io.to(room.screenSharerId).emit('screen:viewer-joined', { viewerId: socket.id });
    }

    if (typeof ack === 'function') {
      ack({
        ok: true,
        roomId,
        selfId: socket.id,
        hasPassword: Boolean(room.password),
        users: serializeRoomUsers(room),
        video: serializeVideoState(room.video),
        screenSharerId: room.screenSharerId,
        messages: room.messages
      });
    }
  });

  socket.on('video:change', ({ videoId } = {}) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const cleanId = String(videoId || '').trim().slice(0, 32);
    if (!cleanId) return;

    const actor = room.users.get(socket.id);
    room.screenSharerId = null;
    room.video = {
      videoId: cleanId,
      isPlaying: true,
      currentTime: 0,
      updatedAt: Date.now()
    };

    io.to(currentRoomId).emit('video:changed', {
      ...serializeVideoState(room.video),
      actorName: actor ? actor.name : 'Biri',
      actorId: socket.id
    });
  });

  socket.on('video:sync', ({ action, currentTime } = {}) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || !room.video.videoId) return;

    const safeTime = Number.isFinite(Number(currentTime))
      ? Math.max(0, Number(currentTime))
      : getEffectiveTime(room.video);

    if (action === 'play') {
      room.video.isPlaying = true;
      room.video.currentTime = safeTime;
      room.video.updatedAt = Date.now();
    } else if (action === 'pause') {
      room.video.isPlaying = false;
      room.video.currentTime = safeTime;
      room.video.updatedAt = Date.now();
    } else if (action === 'seek') {
      room.video.currentTime = safeTime;
      room.video.updatedAt = Date.now();
    } else {
      return;
    }

    const actor = room.users.get(socket.id);
    socket.to(currentRoomId).emit('video:state', {
      action,
      ...serializeVideoState(room.video),
      actorName: actor ? actor.name : 'Biri',
      actorId: socket.id
    });
  });

  socket.on('video:request-sync', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    socket.emit('video:state', {
      action: 'resync',
      ...serializeVideoState(room.video),
      actorId: 'server'
    });
  });

  socket.on('chat:send', ({ text } = {}) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const cleanText = String(text || '').trim().slice(0, 600);
    if (!cleanText) return;

    const sender = room.users.get(socket.id);
    const msg = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      senderId: socket.id,
      senderName: sender ? sender.name : 'Misafir',
      text: cleanText,
      timestamp: Date.now()
    };

    room.messages.push(msg);
    if (room.messages.length > 60) {
      room.messages.shift();
    }

    io.to(currentRoomId).emit('chat:message', msg);
  });

  socket.on('chat:typing', ({ isTyping } = {}) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    const sender = room.users.get(socket.id);
    socket.to(currentRoomId).emit('chat:typing', {
      userId: socket.id,
      name: sender ? sender.name : 'Misafir',
      isTyping: Boolean(isTyping)
    });
  });

  // WebRTC Voice Chat Signaling
  socket.on('voice:join', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const user = room.users.get(socket.id);
    if (user) {
      user.voiceJoined = true;
      user.muted = false;
    }

    io.to(currentRoomId).emit('room:users', serializeRoomUsers(room));
    socket.to(currentRoomId).emit('voice:peer-joined', {
      peerId: socket.id,
      name: user ? user.name : 'Misafir'
    });
  });

  socket.on('voice:leave', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const user = room.users.get(socket.id);
    if (user) {
      user.voiceJoined = false;
      user.speaking = false;
    }

    io.to(currentRoomId).emit('room:users', serializeRoomUsers(room));
    socket.to(currentRoomId).emit('voice:peer-left', { peerId: socket.id });
  });

  socket.on('voice:mute-state', ({ muted } = {}) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const user = room.users.get(socket.id);
    if (user) {
      user.muted = Boolean(muted);
      if (user.muted) user.speaking = false;
    }
    io.to(currentRoomId).emit('room:users', serializeRoomUsers(room));
  });

  socket.on('voice:speaking', ({ speaking } = {}) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const user = room.users.get(socket.id);
    if (user) {
      user.speaking = Boolean(speaking) && !user.muted;
    }
    socket.to(currentRoomId).emit('voice:speaking', {
      peerId: socket.id,
      speaking: Boolean(speaking)
    });
  });

  socket.on('voice:signal', ({ targetId, type, payload } = {}) => {
    if (!currentRoomId || !targetId || !type) return;
    io.to(targetId).emit('voice:signal', {
      fromId: socket.id,
      type,
      payload
    });
  });

  // WebRTC Screen / Tab Share Signaling
  socket.on('screen:start', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    room.screenSharerId = socket.id;
    const sharer = room.users.get(socket.id);
    const peerIds = Array.from(room.users.keys()).filter((id) => id !== socket.id);

    socket.to(currentRoomId).emit('screen:started', {
      sharerId: socket.id,
      sharerName: sharer ? sharer.name : 'Partnerin'
    });

    peerIds.forEach((viewerId) => {
      socket.emit('screen:viewer-joined', { viewerId });
    });
  });

  socket.on('screen:stop', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    if (room.screenSharerId === socket.id) {
      room.screenSharerId = null;
      socket.to(currentRoomId).emit('screen:stopped', { sharerId: socket.id });
    }
  });

  socket.on('screen:signal', ({ targetId, type, payload } = {}) => {
    if (!currentRoomId || !targetId || !type) return;
    io.to(targetId).emit('screen:signal', {
      fromId: socket.id,
      type,
      payload
    });
  });

  socket.on('disconnect', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const user = room.users.get(socket.id);
    room.users.delete(socket.id);

    if (room.screenSharerId === socket.id) {
      room.screenSharerId = null;
      socket.to(currentRoomId).emit('screen:stopped', { sharerId: socket.id });
    }

    if (user) {
      socket.to(currentRoomId).emit('voice:peer-left', { peerId: socket.id });
      socket.to(currentRoomId).emit('room:users', serializeRoomUsers(room));
      socket.to(currentRoomId).emit('chat:message', {
        id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        system: true,
        text: `${user.name} ayrıldı`,
        timestamp: Date.now()
      });
    }

    if (room.users.size === 0) {
      room.video.isPlaying = false;
      room.cleanupTimer = setTimeout(() => {
        rooms.delete(room.id);
      }, ROOM_TTL_MS);
    }
  });
});

server.listen(PORT, () => {
  console.log(`WatchParty sunucusu http://localhost:${PORT} adresinde çalışıyor`);
});
