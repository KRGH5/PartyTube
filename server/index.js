import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './db.js';
import { Room } from './Room.js';

const app = express(); const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true, methods: ['GET', 'POST'] } });
const rooms = new Map();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json());
const id = () => randomUUID().slice(0, 6).toUpperCase();
function loadRoom(roomId) {
  if (rooms.has(roomId)) return rooms.get(roomId);
  const row = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  if (!row) return null;
  const room = new Room({ id: row.id, videoId: row.video_id, playing: row.playing, position: row.position });
  rooms.set(roomId, room); return room;
}
function save(room) { db.prepare('UPDATE rooms SET video_id=?, playing=?, position=? WHERE id=?').run(room.videoId, +room.playing, room.position, room.id); }
function isController(member) { return member && ['host', 'moderator'].includes(member.role); }
function emitMembers(room) { io.to(room.id).emit('participants', room.members()); }
app.post('/api/rooms', (req, res) => {
  const roomId = id(); const videoId = req.body.videoId || 'dQw4w9WgXcQ';
  db.prepare('INSERT INTO rooms (id, video_id) VALUES (?, ?)').run(roomId, videoId);
  res.status(201).json({ roomId });
});
app.get('/api/rooms/:roomId', (req, res) => {
  const room = loadRoom(req.params.roomId.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ roomId: room.id, state: room.state() });
});
io.on('connection', socket => {
  socket.on('join_room', ({ roomId, username }, reply = () => {}) => {
    const room = loadRoom(String(roomId || '').toUpperCase());
    if (!room) return reply({ error: 'This room does not exist.' });
    const safeName = String(username || 'Guest').trim().slice(0, 30) || 'Guest';
    const role = room.participants.size === 0 ? 'host' : 'participant';
    const member = { socketId: socket.id, userId: randomUUID(), username: safeName, role };
    room.add(member); socket.join(room.id); socket.data.roomId = room.id;
    reply({ member: { userId: member.userId, username: member.username, role }, state: room.state(), participants: room.members() });
    socket.to(room.id).emit('user_joined', { username: member.username, userId: member.userId }); emitMembers(room);
  });
  socket.on('playback', ({ action, position, videoId }, reply = () => {}) => {
    const room = loadRoom(socket.data.roomId); const member = room?.get(socket.id);
    if (!isController(member)) return reply({ error: 'Only hosts and moderators can control playback.' });
    if (!['play', 'pause', 'seek', 'change_video'].includes(action)) return reply({ error: 'Unknown action.' });
    if (action === 'change_video' && !/^[\w-]{11}$/.test(String(videoId || ''))) return reply({ error: 'Enter a valid YouTube video link.' });
    room.updateState({ playing: action === 'play' ? true : action === 'pause' ? false : undefined, position: action === 'change_video' ? 0 : position, videoId: action === 'change_video' ? videoId : undefined });
    save(room); io.to(room.id).emit('sync_state', room.state()); reply({ ok: true });
  });
  socket.on('assign_role', ({ userId, role }, reply = () => {}) => {
    const room = loadRoom(socket.data.roomId); const actor = room?.get(socket.id);
    if (actor?.role !== 'host') return reply({ error: 'Only the host can change roles.' });
    const target = [...room.participants.values()].find(p => p.userId === userId);
    if (!target || !['participant', 'moderator'].includes(role)) return reply({ error: 'Invalid role change.' });
    target.role = role; emitMembers(room); reply({ ok: true });
  });
  socket.on('remove_participant', ({ userId }, reply = () => {}) => {
    const room = loadRoom(socket.data.roomId); const actor = room?.get(socket.id);
    if (actor?.role !== 'host') return reply({ error: 'Only the host can remove participants.' });
    const target = [...room.participants.values()].find(p => p.userId === userId);
    if (!target || target.role === 'host') return reply({ error: 'Cannot remove this participant.' });
    io.to(target.socketId).emit('removed'); io.sockets.sockets.get(target.socketId)?.leave(room.id); room.remove(target.socketId); emitMembers(room); reply({ ok: true });
  });
  socket.on('disconnect', () => { const room = loadRoom(socket.data.roomId); const member = room?.get(socket.id); if (!room || !member) return; room.remove(socket.id); io.to(room.id).emit('user_left', { username: member.username, userId: member.userId }); emitMembers(room); });
});
app.use(express.static(path.join(__dirname, '../dist')));
app.get(/.*/, (_, res) => res.sendFile(path.join(__dirname, '../dist/index.html')));
httpServer.listen(process.env.PORT || 3001, () => console.log('PartyTube server ready'));
