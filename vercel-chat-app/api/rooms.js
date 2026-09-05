// api/rooms.js — POST /api/rooms  { name } -> { roomId, token, joinUrl }
const { customAlphabet } = require('nanoid');
const { createRoom } = require('../lib/redis');
const { signRoomToken } = require('../lib/auth');

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  try {
    const { name } = req.body || {};
    const roomId = nanoid();
    const token = signRoomToken(roomId);
    await createRoom(roomId, name);
    res.status(200).json({ roomId, token, joinUrl: `/join/${roomId}?token=${token}` });
  } catch (err) {
    console.error('create room failed', err);
    res.status(500).json({ error: 'failed to create room' });
  }
};
