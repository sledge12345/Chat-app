// lib/auth.js
// Random room ID + HMAC-signed token, so a room isn't joinable by guessing
// a name — same scheme as the Railway version.

const crypto = require('crypto');

const SECRET = process.env.ROOM_LINK_SECRET || 'dev-secret-change-me';

function signRoomToken(roomId) {
  return crypto.createHmac('sha256', SECRET).update(roomId).digest('hex').slice(0, 32);
}

function verifyRoomToken(roomId, token) {
  if (!token) return false;
  const expected = signRoomToken(roomId);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(token));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { signRoomToken, verifyRoomToken };
